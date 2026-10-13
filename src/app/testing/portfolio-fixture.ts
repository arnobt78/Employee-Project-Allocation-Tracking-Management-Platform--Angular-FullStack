import { NEVER } from 'rxjs';
import { Employee } from '@/app/model/class/Employee';
import { IProject, IProjectEmployee } from '@/app/model/interface/master';
import { MasterService } from '@/app/service/master.service';

const ARCHIVED_AT = '2026-07-10T10:00:00.000Z';

/** Same shape as the demo seed: 4 active projects plus 1 archived, 7 assignments, 5 people. */
export const FIXTURE_PROJECTS = [
  { projectId: 5001, projectName: 'Aurora', status: 'active', approvalStatus: 'approved', leadByEmpId: 1001, startDate: '2026-08-03' },
  { projectId: 5002, projectName: 'Helios', status: 'in_review', approvalStatus: 'in_review', leadByEmpId: 1002, startDate: '2026-10-05' },
  { projectId: 5003, projectName: 'Atlas', status: 'on_hold', approvalStatus: 'approved', leadByEmpId: 1003, startDate: '2026-11-02' },
  { projectId: 5004, projectName: 'Mercury', status: 'planning', approvalStatus: 'draft', leadByEmpId: 1004, startDate: '2026-06-01' },
  { projectId: 5005, projectName: 'Beacon', status: 'active', approvalStatus: 'approved', leadByEmpId: 1005, startDate: '2026-01-12', archivedAt: ARCHIVED_AT },
] as unknown as IProject[];

export const FIXTURE_EMPLOYEES = [
  { employeeId: 1001, employeeName: 'Ava', department: 'Engineering', isActive: true },
  { employeeId: 1002, employeeName: 'Ben', department: 'Engineering', isActive: true },
  { employeeId: 1003, employeeName: 'Cy', department: 'Operations', isActive: true },
  { employeeId: 1004, employeeName: 'Dee', department: 'Operations', isActive: true },
  { employeeId: 1005, employeeName: 'Eve', department: 'Human Resources', isActive: true },
] as unknown as Employee[];

export const FIXTURE_ASSIGNMENTS = [
  { empProjectId: 7001, projectId: 5001, empId: 1001, role: 'Project Lead', allocationPct: 40, isActive: 'Y' },
  { empProjectId: 7002, projectId: 5001, empId: 1003, role: 'QA Engineer', allocationPct: 30, isActive: 'Y' },
  { empProjectId: 7003, projectId: 5002, empId: 1002, role: 'Project Lead', allocationPct: 50, isActive: 'Y' },
  { empProjectId: 7004, projectId: 5004, empId: 1002, role: 'Designer', allocationPct: 20, isActive: 'N' },
  { empProjectId: 7005, projectId: 5003, empId: 1003, role: 'Project Lead', allocationPct: 40, isActive: 'Y' },
  { empProjectId: 7006, projectId: 5004, empId: 1004, role: 'Project Lead', allocationPct: 60, isActive: 'Y' },
  { empProjectId: 7007, projectId: 5005, empId: 1005, role: 'Project Lead', allocationPct: 50, isActive: 'Y', projectArchivedAt: ARCHIVED_AT },
] as unknown as IProjectEmployee[];

/** Warm list caches with the fixture and park every request, so pages render from the peeks. */
export function warmPortfolioCaches(master: MasterService): void {
  spyOn(master, 'peekProjects').and.returnValue(FIXTURE_PROJECTS);
  spyOn(master, 'peekEmployees').and.returnValue(FIXTURE_EMPLOYEES);
  spyOn(master, 'peekProjectEmployees').and.returnValue(FIXTURE_ASSIGNMENTS);
  spyOn(master, 'getAllProjects').and.returnValue(NEVER);
  spyOn(master, 'getAllEmp').and.returnValue(NEVER);
  spyOn(master, 'getProjectEmp').and.returnValue(NEVER);
}

/** `label → value + hint` text of every KPI card in the fixture. */
export function kpiCards(root: HTMLElement): Record<string, string> {
  const cards: Record<string, string> = {};
  root.querySelectorAll('app-kpi-stat-card').forEach((card) => {
    const [label, ...rest] = Array.from(card.querySelectorAll('p')).map((p) => p.textContent?.trim() ?? '');
    cards[label] = rest.join(' | ');
  });
  return cards;
}
