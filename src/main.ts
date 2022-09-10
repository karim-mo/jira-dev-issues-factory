import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { green, red, yellow, blue, magenta } from 'cli-color';
import Jira from 'jira-client';
import jiraConfig from 'jiraconfig.json';
import { validateConfigFile } from '@helpers/config-validator.helper';
import { IssueType } from './enums/issue-type.enum';

const jiraApi = new Jira({
  protocol: 'https',
  host: process.env.JIRA_HOST,
  apiVersion: '2',
  strictSSL: true,
  username: process.env.JIRA_USER,
  password: process.env.JIRA_PW || process.env.JIRA_ACCESS_TOKEN,
});

const log = console.log;

async function main() {
  try {
    log(blue('Starting Jira issue creation script'));

    log(yellow('Authenticating with Jira...'));
    const user = await jiraApi.getCurrentUser();

    if (!user || !user.self) throw new Error('Could not authenticate with Jira');
    if (!user.emailAddress?.includes(process.env.COMPANY_DOMAIN))
      throw new Error(`User is not a member of the ${process.env.COMPANY_DOMAIN} domain`);

    log(green('Authenticated with Jira successfully'));

    log(yellow('Validating configuration file...'));

    validateConfigFile(jiraConfig);

    log(green('Configuration file is valid, proceeding...'));

    log(yellow('Retrieving active sprint details...'));

    const boards = await jiraApi.getAllBoards();
    const devBoardId = boards?.values?.find((board) => board.name === 'Development')?.id;

    if (!devBoardId) throw new Error('Could not find Development board');

    const sprints = await jiraApi.getAllSprints(devBoardId, 0, 50, 'active');

    if (!sprints?.values || !sprints.values?.length) throw new Error('Could not find any active sprints');

    const sprint = sprints.values[0];

    log(green(`Found active sprint: ${sprint.name} with id ${sprint.id}`));

    log(yellow('Creating Jira issues...'));

    const promises = Object.keys(jiraConfig).map(async (key) => {
      const epicOrStory = jiraConfig[key].type;

      let parent: any;
      if (epicOrStory === 'epic') {
        const epic = await jiraApi.getEpic(key);

        if (!epic) throw new Error(`Could not find epic with key ${key}`);

        parent = epic;
        log(blue(`Creating issues for epic: ${epic.name}`));
      } else {
        const story = await jiraApi.getIssue(key);

        if (!story) throw new Error(`Could not find story with key ${key}`);

        parent = story;
        log(magenta(`Creating issues for story: ${story.fields?.summary}`));
      }

      const issues = jiraConfig[key].issues;

      const issuePromises = issues.map(async (issue) => {
        const issueObj: Jira.IssueObject = {
          fields: {
            project: {
              key: process.env.JIRA_PROJECT_KEY,
            },
            ...(epicOrStory === IssueType.EPIC && { customfield_10010: sprint.id }),
            summary: issue.title,
            description: issue.description,
            issuetype: {
              ...(epicOrStory === IssueType.EPIC && { name: 'Development Task' }),
              ...(epicOrStory === IssueType.STORY && { name: 'Development Sub-task' }),
            },
            assignee: {
              id: user.accountId,
            },
            ...(epicOrStory === IssueType.EPIC && { customfield_10008: parent.key }),
            ...(epicOrStory === IssueType.STORY && { parent: { key: parent.key } }),
          },
        };

        const createdIssue = await jiraApi.addNewIssue(issueObj);

        if (!createdIssue || createdIssue.errors)
          throw new Error(`Could not create issue ${issue.title}, error: ${JSON.stringify(createdIssue?.errors)}`);

        await jiraApi.updateIssue(createdIssue.key, {
          fields: {
            timetracking: {
              originalEstimate: issue.estimate,
              remainingEstimate: issue.estimate,
            },
          },
        });

        if (epicOrStory === IssueType.EPIC && issue.subTasks?.length) {
          const subtaskPromises = issue.subTasks?.map(async (subtask) => {
            const subtaskObj: Jira.IssueObject = {
              fields: {
                project: {
                  key: process.env.JIRA_PROJECT_KEY,
                },
                summary: subtask.title,
                description: subtask.description,
                issuetype: {
                  name: 'Development Sub-task',
                },
                assignee: {
                  id: user.accountId,
                },
                parent: {
                  key: createdIssue.key,
                },
              },
            };

            const createdSubtask = await jiraApi.addNewIssue(subtaskObj);

            if (!createdSubtask || createdSubtask.errors)
              throw new Error(
                `Could not create subtask ${subtask.title}, error: ${JSON.stringify(createdSubtask?.errors)}`,
              );

            await jiraApi.updateIssue(createdSubtask.key, {
              fields: {
                timetracking: {
                  originalEstimate: subtask.estimate,
                  remainingEstimate: subtask.estimate,
                },
              },
            });
          });

          await Promise.all(subtaskPromises);
          log(green(`Created issue ${createdIssue.key} with ${issue.subTasks?.length || 0} subtasks`));
          return;
        }

        log(green(`Created issue ${createdIssue.key}`));
      });

      await Promise.all(issuePromises);
    });

    await Promise.all(promises);

    log(green('All issues created successfully'));
  } catch (err) {
    log(err);
    log(red(err.message));
  }
}

main();
