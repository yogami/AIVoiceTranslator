export interface IActiveSessionProvider {
  getActiveTeacherCount(): number;
  getActiveStudentCount(): number;
  getActiveSessionsCount(): number;
}
