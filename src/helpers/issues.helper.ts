import { IssueType } from '@enums/issue-type.enum';
import { doneIssues } from '@global/done-issues.global';
import { IIssue } from '@interfaces/issue.interface';
import { jiraApi } from '@utils/jira-api.util';
import { log } from '@utils/logger.util';
import { blue, magenta, green, yellow, red } from 'cli-color';
import Jira from 'jira-client';
import inquirer from 'inquirer';

export async function createJiraIssuesFromConfig(jiraConfig: object, user: Jira.UserObject, sprint: any) {
  // Calculate total estimate of all issues
  const allEstimates = Object.keys(jiraConfig).flatMap((key) => {
    const issues: IIssue[] = jiraConfig[key].issues;

    return issues.flatMap((issue) => {
      const { estimate } = issue;
      const subTasks = issue.subTasks || [];
      const subTasksEstimates = subTasks.map((subTask) => subTask.estimate);

      return [estimate, ...subTasksEstimates];
    });
  });

  const totalEstimate = calculateTotalIssuesEstimate(allEstimates);

  const estimatePrompt = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'estimate',
      message: `This is your total estimate: \x1b[32m${totalEstimate}\x1b[0m, proceed?`,
    },
  ]);

  if (!estimatePrompt?.estimate) {
    log(red('Aborting...'));
    return;
  }

  log(yellow('Creating Jira issues...'));

  const promises = Object.keys(jiraConfig).map(async (key) => {
    const issueType = jiraConfig[key].type;
    const isEpic = issueType === IssueType.EPIC;
    const isStory = issueType === IssueType.STORY;
    const isDevTask = issueType === IssueType.DEV_TASK && key !== 'n/a';
    const isNewDevTask = issueType === IssueType.DEV_TASK && key === 'n/a';

    let parent: Jira.JsonResponse;
    if (isEpic) {
      const epic = await jiraApi.getEpic(key);

      if (!epic) throw new Error(`Could not find epic with key ${key}`);

      parent = epic;
      log(blue(`Creating issues for epic: ${epic.name}`));
    } else if (isStory) {
      const story = await jiraApi.getIssue(key);

      if (!story || story?.fields?.issuetype?.name !== 'Story') throw new Error(`Could not find story with key ${key}`);

      await jiraApi.updateIssue(key, {
        fields: {
          customfield_10010: sprint.id,
        },
      });

      log(magenta(`Added story ${key} to sprint ${sprint.name}`));

      parent = story;
      log(magenta(`Creating issues for story: ${story.fields?.summary}`));
    } else if (isDevTask) {
      const devTask = await jiraApi.getIssue(key);

      if (devTask?.fields?.issuetype?.name !== 'Development Task')
        throw new Error(`Could not find dev task with key ${key}`);

      await jiraApi.updateIssue(key, {
        fields: {
          customfield_10010: sprint.id,
        },
      });

      log(magenta(`Added dev task ${key} to sprint ${sprint.name}`));

      parent = devTask;
      log(magenta(`Creating issues for dev task: ${devTask.fields?.summary}`));
    }

    const issues: IIssue[] = jiraConfig[key].issues;

    const issuePromises = issues.map(async (issue, issueIndex) => {
      const issueObj: Jira.IssueObject = {
        fields: {
          project: {
            key: process.env.JIRA_PROJECT_KEY,
          },
          ...((isEpic || isNewDevTask) && { customfield_10010: sprint.id }),
          summary: issue.title,
          description: issue.description,
          issuetype: {
            ...((isEpic || isNewDevTask) && { name: 'Development Task' }),
            ...((isStory || isDevTask) && { name: 'Development Sub-task' }),
          },
          assignee: {
            id: user.accountId,
          },
          // ...(isEpic && { customfield_10008: parent.key }),
          ...((isStory || isDevTask) && { parent: { key: parent.key } }),
          timetracking: {
            originalEstimate: issue.estimate,
            remainingEstimate: issue.estimate,
          },
        },
      };

      const createdIssue = await jiraApi.addNewIssue(issueObj);

      if (!createdIssue || createdIssue.errors)
        throw new Error(`Could not create issue ${issue.title}, error: ${JSON.stringify(createdIssue?.errors)}`);

      if (isEpic) {
        try {
          await jiraApi.issueLink({
            type: {
              id: '10003',
            },
            inwardIssue: {
              key: createdIssue.key,
            },
            outwardIssue: {
              key: parent.key,
            },
          });
        } catch (e) {
          log(red(`Could not link epic ${parent.key} to dev task ${createdIssue.key}. Please link them manually.`));
        }
      }

      if ((isEpic || isNewDevTask) && issue.subTasks?.length) {
        const subtaskPromises = issue.subTasks?.map(async (subtask, subTaskIndex) => {
          const subtaskObj: Jira.IssueObject = {
            fields: {
              project: {
                key: process.env.JIRA_PROJECT_KEY,
              },
              summary: subtask.title,
              // description: subtask.description || '',
              issuetype: {
                name: 'Development Sub-task',
              },
              assignee: {
                id: user.accountId,
              },
              parent: {
                key: createdIssue.key,
              },
              timetracking: {
                originalEstimate: subtask.estimate,
                remainingEstimate: subtask.estimate,
              },
            },
          };

          const createdSubtask = await jiraApi.addNewIssue(subtaskObj);

          if (!createdSubtask || createdSubtask.errors)
            throw new Error(
              `Could not create subtask ${subtask.title}, error: ${JSON.stringify(createdSubtask?.errors)}`,
            );

          doneIssues.addData({
            issueIndex,
            issueSubTaskIndex: subTaskIndex,
            parentKey: parent.key,
          });
        });

        await Promise.all(subtaskPromises);
        doneIssues.addData({
          issueIndex,
          parentKey: parent.key,
        });
        log(
          green(
            `Created issue https://${process.env.JIRA_HOST}/browse/${createdIssue.key} with ${
              issue.subTasks?.length || 0
            } subtasks`,
          ),
        );
        return;
      }

      doneIssues.addData({
        issueIndex,
        parentKey: parent.key,
      });
      log(green(`Created issue https://${process.env.JIRA_HOST}/browse/${createdIssue.key}`));
    });

    await Promise.all(issuePromises);
  });

  await Promise.all(promises);
}

function calculateTotalIssuesEstimate(estimatesArray: string[]): string {
  let totalMinutes = 0;

  // convert each estimate to minutes
  for (let i = 0; i < estimatesArray.length; i++) {
    let estimate = estimatesArray[i];

    let values = estimate.split(' ');

    for (let j = 0; j < values.length; j++) {
      let amount = parseInt(values[j].slice(0, -1));
      let unit = values[j].slice(-1);

      switch (unit) {
        case 'w':
          totalMinutes += amount * 60 * 8 * 5;
          break;
        case 'd':
          totalMinutes += amount * 60 * 8;
          break;
        case 'h':
          totalMinutes += amount * 60;
          break;
        case 'm':
          totalMinutes += amount;
          break;
      }
    }
  }

  // convert total minutes back to estimate format
  let weeks = Math.floor(totalMinutes / (60 * 8 * 5));
  totalMinutes = totalMinutes % (60 * 8 * 5);
  let days = Math.floor(totalMinutes / (60 * 8));
  totalMinutes = totalMinutes % (60 * 8);
  let hours = Math.floor(totalMinutes / 60);
  let minutes = totalMinutes % 60;

  let result = '';
  if (weeks > 0) {
    result += weeks + 'w ';
  }
  if (days > 0) {
    result += days + 'd ';
  }
  if (hours > 0 || (hours === 0 && minutes >= 60)) {
    result += hours + 'h ';
  }
  if (minutes > 0) {
    result += minutes + 'm';
  }

  return result.trim();
}
