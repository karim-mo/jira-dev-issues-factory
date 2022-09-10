import { IssueType } from '@enums/issue-type.enum';
import { jiraApi } from '@utils/jira-api.util';
import { log } from '@utils/logger.util';
import { blue, magenta, green, yellow } from 'cli-color';
import Jira from 'jira-client';

export async function createJiraIssuesFromConfig(jiraConfig: object, user: Jira.UserObject, sprint: any) {
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
}
