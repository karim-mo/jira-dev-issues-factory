import { IDoneIssue } from '@interfaces/done-task.interface';
import { IIssue } from '@interfaces/issue.interface';
import fs from 'fs';

class DoneIssues {
  private static instance: DoneIssues;
  private doneIssues: IDoneIssue[];

  private constructor() {
    this.doneIssues = [];
  }

  public static getInstance(): DoneIssues {
    if (!DoneIssues.instance) {
      DoneIssues.instance = new DoneIssues();
    }
    return DoneIssues.instance;
  }

  public addData(element: IDoneIssue): void {
    this.doneIssues.push(element);
  }

  // TODO: Think of a better way to do this
  // public adjustConfigFileWithUndoneIssues(jiraConfig: object): void {
  //   const undoneIssues = {};
  //   Object.keys(jiraConfig).forEach((key) => {
  //     const issues: IIssue[] = jiraConfig[key].issues;

  //     const undoneIssuesForParent = [];

  //     issues.forEach((issue, issueIndex) => {
  //       const { subTasks } = issue;
  //       const undoneSubTasks = [];

  //       subTasks?.forEach((subTask, subTaskIndex) => {
  //         const doneIssue = this.objectFind(this.doneIssues, {
  //           parentKey: key,
  //           issueIndex,
  //           issueSubTaskIndex: subTaskIndex,
  //         });

  //         if (!doneIssue) {
  //           undoneSubTasks.push(subTask);
  //         }
  //       });

  //       const finalIssue = {
  //         ...issue,
  //       };

  //       if (undoneSubTasks.length) {
  //         finalIssue.subTasks = undoneSubTasks;
  //       }

  //       const doneIssue = this.objectFind(this.doneIssues, {
  //         parentKey: key,
  //         issueIndex,
  //       });

  //       if (!doneIssue) {
  //         undoneIssuesForParent.push(finalIssue);
  //       }
  //     });

  //     if (undoneIssuesForParent.length) {
  //       undoneIssues[key] = {
  //         ...jiraConfig[key],
  //         issues: undoneIssuesForParent,
  //       };
  //     }

  //     // Write undone issues to config file
  //     fs.writeFileSync('./jiraconfig.json', JSON.stringify(undoneIssues, null, 2));
  //   });
  // }

  private objectFind(array: IDoneIssue[], query: IDoneIssue): IDoneIssue | undefined {
    return array.find((item) => {
      return Object.keys(query).every((key) => {
        return item[key] === query[key];
      });
    });
  }
}

export const doneIssues = DoneIssues.getInstance();
