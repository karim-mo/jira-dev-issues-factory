import { jiraApi } from '@utils/jira-api.util';
import { log } from '@utils/logger.util';
import { yellow, green } from 'cli-color';

export async function authenticateWithJira() {
  log(yellow('Authenticating with Jira...'));
  const user = await jiraApi.getCurrentUser();

  if (!user || !user.self) throw new Error('Could not authenticate with Jira');
  if (!user.emailAddress?.includes(process.env.COMPANY_DOMAIN))
    throw new Error(`User is not a member of the ${process.env.COMPANY_DOMAIN} domain`);

  log(green('Authenticated with Jira successfully'));

  return user;
}
