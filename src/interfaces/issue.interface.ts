export interface IIssue {
  title: string;
  estimate: string;
  description?: string;
  subTasks?: Omit<IIssue, 'subTasks' | 'description'>[];
}
