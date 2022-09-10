import Jira from 'jira-client';

export const jiraApi = new Jira({
  protocol: 'https',
  host: process.env.JIRA_HOST,
  apiVersion: '2',
  strictSSL: true,
  username: process.env.JIRA_USER,
  password: process.env.JIRA_PW || process.env.JIRA_ACCESS_TOKEN,
});
