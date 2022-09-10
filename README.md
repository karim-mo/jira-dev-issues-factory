# Jira Dev Issues Factory

This is a simple script that creates development tasks/sub-tasks in Jira for a given project on given epics/stories.

## Usage

```npm
npm install
npm start
```

## Configuration

The script is configured via a `jiraconfig.json` file. The file is structured as follows:

```json
{
  "epic-or-story-id(XXX-XXXX)": {
    "type": "<epic, story>",
    "issues": [
      {
        "title": "<Task title>",
        "description": "<Task description>",
        "estimate": "<Task estimate (1d, 1w, etc..)>",
        "subTasks <This array is not allowed if the type is a story>": [
          {
            "title": "<Subtask title>",
            "estimate": "<Subtask estimate (1d, 1w, etc..)>"
          }
        ]
      }
    ]
  }
}
```

## Example

```json
{
  "DEV-1": {
    "type": "epic",
    "issues": [
      {
        "title": "Create a new feature",
        "description": "This is a new feature",
        "estimate": "1d",
        "subTasks": [
          {
            "title": "Create a new feature",
            "estimate": "1d"
          },
          {
            "title": "Create a new feature",
            "estimate": "1d"
          }
        ]
      },
      {
        "title": "Create a new feature",
        "description": "This is a new feature",
        "estimate": "1d",
        "subTasks": [
          {
            "title": "Create a new feature",
            "estimate": "1d"
          },
          {
            "title": "Create a new feature",
            "estimate": "1d"
          }
        ]
      }
    ]
  },
  "DEV-2": {
    "type": "story",
    "issues": [
      {
        "title": "Create a new feature",
        "description": "This is a new feature",
        "estimate": "1d"
      },
      {
        "title": "Create a new feature",
        "description": "This is a new feature",
        "estimate": "1d"
      }
    ]
  }
}
```

`Note: The subTasks array is optional in the case of an epic and completely forbidden in the case of a story.`

## Environment variables

The script uses the following environment variables:

```bash
JIRA_HOST=<Jira host> # e.g. jira.atlassian.com
JIRA_USER=<Jira user> # e.g. johndoe
JIRA_PASS=<Jira password> # e.g. 123456
JIRA_PROJECT_KEY=<Jira project key> # e.g. DEV
JIRA_ACCESS_TOKEN=<Jira access token> # e.g. 1234567890 (discussed below)
COMPANY_DOMAIN=<Company domain> # e.g. atlassian.com (used for the employee email domains)
```

## Jira access token

### `Note: This is mainly (but not limited to) for cloud users (google, slack, etc..) who don't have a password setup.`

<br/>

The script uses the Jira access token to authenticate the user. To generate a token, follow the steps below:

1. Go to your Jira Manage Account settings
2. Click on the `Security` tab
3. Click on `Create and manage API tokens`
4. Click on `Create API token`
5. Enter a name for the token and click on `Create`
6. Copy the token and paste it in the `JIRA_ACCESS_TOKEN` environment variable
