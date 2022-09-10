import { jiraApi } from '@utils/jira-api.util';
import { log } from '@utils/logger.util';
import { yellow, green } from 'cli-color';

export async function retrieveActiveSprint() {
  log(yellow('Retrieving active sprint details...'));

  const boards = await jiraApi.getAllBoards();
  const devBoardId = boards?.values?.find((board) => board.name === 'Development')?.id;

  if (!devBoardId) throw new Error('Could not find Development board');

  const sprints = await jiraApi.getAllSprints(devBoardId, 0, 50, 'active');

  if (!sprints?.values || !sprints.values?.length) throw new Error('Could not find any active sprints');

  const sprint = sprints.values[0];

  log(green(`Found active sprint: ${sprint.name} with id ${sprint.id}`));

  return sprint;
}
