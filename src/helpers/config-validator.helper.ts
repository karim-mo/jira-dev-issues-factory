import { log } from '@utils/logger.util';
import { jiraConfigValidation } from '@validations/jira-config.validation';
import { green, yellow } from 'cli-color';

export function validateConfigFile(config: object) {
  log(yellow('Validating configuration file...'));

  for (const key in config) {
    const { error } = jiraConfigValidation.validate(config[key]);
    if (error) throw new Error('Invalid config file, please refer to the sample config file.');
  }

  log(green('Configuration file is valid, proceeding...'));
}
