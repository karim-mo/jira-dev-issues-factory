import { IssueType } from '@enums/issue-type.enum';
import { log } from '@utils/logger.util';
import { jiraConfigValidation } from '@validations/jira-config.validation';
import { green, yellow } from 'cli-color';

export function validateConfigFile(config: object) {
  log(yellow('Validating configuration file...'));

  for (const key in config) {
    if (key === 'n/a' && config[key].type !== IssueType.DEV_TASK)
      throw new Error('Invalid config file, Dev Tasks with n/a key must be of type dev_task.');

    if (key !== 'n/a' && config[key].type === IssueType.DEV_TASK && !checkSubTasksArrayForIssue(key, config))
      throw new Error('Invalid config file, Dev Tasks without an n/a key must have an empty subTasks array.');

    const { error } = jiraConfigValidation.validate(config[key]);
    if (error) throw new Error('Invalid config file, please refer to the sample config file.');
  }

  log(green('Configuration file is valid, proceeding...'));
}

function checkSubTasksArrayForIssue(key: string, config: object) {
  const issues = config[key].issues;

  for (const issue of issues) {
    if (issue?.subTasks?.length > 0) return false;
  }

  return true;
}
