import { jiraConfigValidation } from '@validations/jira-config.validation';

export function validateConfigFile(config: object) {
  for (const key in config) {
    const { error } = jiraConfigValidation.validate(config[key]);
    if (error) throw new Error('Invalid config file, please refer to the sample config file.');
  }
}
