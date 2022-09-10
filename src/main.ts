import dotenv from 'dotenv';
dotenv.config();

import { authenticateWithJira } from '@helpers/auth.helper';
import { validateConfigFile } from '@helpers/config-validator.helper';
import { createJiraIssuesFromConfig } from '@helpers/issues.helper';
import { retrieveActiveSprint } from '@helpers/sprint.helper';
import { log } from '@utils/logger.util';
import { blue, red } from 'cli-color';
import jiraConfig from 'jiraconfig.json';

async function main() {
  try {
    log(blue('Starting Jira issue creation script'));

    // Authentication
    const user = await authenticateWithJira();

    // JSON config validation
    validateConfigFile(jiraConfig);

    // Retrieve current active sprint
    const sprint = await retrieveActiveSprint();

    // Start creating Jira issues based on config file
    await createJiraIssuesFromConfig(jiraConfig, user, sprint);
  } catch (err) {
    log(err);
    log(red(err.message));
  }
}

main();
