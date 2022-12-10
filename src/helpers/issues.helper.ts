import { IssueType } from '@enums/issue-type.enum';
import { jiraApi } from '@utils/jira-api.util';
import { log } from '@utils/logger.util';
import { blue, magenta, green, yellow } from 'cli-color';
import Jira from 'jira-client';

export async function createJiraIssuesFromConfig(jiraConfig: object, user: Jira.UserObject, sprint: any) {
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

    const issues = jiraConfig[key].issues;

    const issuePromises = issues.map(async (issue) => {
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
          ...(isEpic && { customfield_10008: parent.key }),
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

      if ((isEpic || isNewDevTask) && issue.subTasks?.length) {
        const subtaskPromises = issue.subTasks?.map(async (subtask) => {
          const subtaskObj: Jira.IssueObject = {
            fields: {
              project: {
                key: process.env.JIRA_PROJECT_KEY,
              },
              summary: subtask.title,
              description: subtask.description || '',
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
