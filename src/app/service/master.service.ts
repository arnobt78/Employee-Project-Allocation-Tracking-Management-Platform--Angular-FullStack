import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable, defer, map, of, shareReplay, switchMap, tap } from 'rxjs';
import {
  IApiResponse,
  IProject,
  IProjectEmployee,
  IProjectResourceInsights,
  IContentfulBrief,
  IAiOverviewDraft,
  IGenerateOverviewDraftRequest,
  AuthUser,
  DemoAccount,
  IApiDocumentation,
  IApiStatus,
  INotificationLogEntry,
} from '../model/interface/master';
import { Employee } from '../model/class/Employee';
import { environment } from '../../environments/environment';
import { removeBy, upsertBy } from '../lib/list-ops';

interface ListCacheTypes {
  employees: Employee[];
  projects: IProject[];
  assignments: IProjectEmployee[];
  dashboard: any;
  departments: IApiResponse;
  schedule: any;
}

export type ListCacheKey = keyof ListCacheTypes;

interface ListCacheEntry<T> {
  request$: Observable<T> | null;
  /** Issue time of the cached request; 0 when expired. */
  at: number;
  snapshot: T | null;
  /** Bumped on invalidation so responses from older requests are dropped. */
  generation: number;
}

type ListCaches = { [K in ListCacheKey]: ListCacheEntry<ListCacheTypes[K]> };

export type MutationDomain = 'employee' | 'project' | 'assignment';

/**
 * Lists that embed data from each domain: employee names appear as project
 * leads and assignees; deleting a project or employee cascades to assignments.
 */
const INVALIDATES: Record<MutationDomain, readonly ListCacheKey[]> = {
  employee: ['employees', 'projects', 'assignments', 'dashboard', 'schedule'],
  project: ['projects', 'assignments', 'dashboard', 'schedule'],
  assignment: ['assignments', 'dashboard', 'schedule'],
};

const LIST_ENDPOINTS: Record<ListCacheKey, string> = {
  employees: 'GetAllEmployees',
  projects: 'GetAllProjects',
  assignments: 'GetAllProjectEmployees',
  dashboard: 'GetDashboard',
  departments: 'GetParentDepartment',
  schedule: 'GetSchedule',
};

type ListPatches = {
  [K in ListCacheKey]?: (snapshot: ListCacheTypes[K]) => ListCacheTypes[K];
};

const LOGOUT_TIMEOUT_MS = 8000;

const emptyEntry = <T>(): ListCacheEntry<T> => ({
  request$: null,
  at: 0,
  snapshot: null,
  generation: 0,
});

@Injectable({
  providedIn: 'root',
})
export class MasterService {
  corsProxyUrl: string = environment.api.baseUrl;
  shouldEncodeProxyTarget = false;
  apiUrl: string = '';

  private readonly cacheTtlMs = 30_000;
  /** Bumped on sign-in/out; in-flight list reads from the old session are dropped, not refetched. */
  private cacheEpoch = 0;

  private readonly lists: ListCaches = {
    employees: emptyEntry(),
    projects: emptyEntry(),
    assignments: emptyEntry(),
    dashboard: emptyEntry(),
    departments: emptyEntry(),
    schedule: emptyEntry(),
  };

  private readonly projectDetailSnapshots = new Map<
    number,
    { project: IProject; at: number }
  >();

  private apiDocumentationCache$: Observable<IApiDocumentation> | null = null;
  private apiDocumentationSnapshot: IApiDocumentation | null = null;
  private apiStatusSnapshot: IApiStatus | null = null;

  constructor(private http: HttpClient) {}

  login(payload: {
    username: string;
    password: string;
  }): Observable<IApiResponse<AuthUser>> {
    return this.http.post<IApiResponse<AuthUser>>(
      this.getProxyUrl('Login'),
      payload
    );
  }

  /** `keepalive` lets the revoke finish even if the page reloads or closes right after. */
  logout(): Observable<void> {
    return defer(() =>
      fetch(this.getProxyUrl('Logout'), {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(LOGOUT_TIMEOUT_MS),
      })
    ).pipe(
      map((response) => {
        if (!response.ok) {
          throw new Error(`Logout failed (${response.status})`);
        }
      })
    );
  }

  getSession(): Observable<IApiResponse<AuthUser>> {
    return this.http.get<IApiResponse<AuthUser>>(this.getProxyUrl('Session'));
  }

  getDemoAccounts(): Observable<IApiResponse<DemoAccount[]>> {
    return this.http.get<IApiResponse<DemoAccount[]>>(
      this.getProxyUrl('GetDemoAccounts')
    );
  }

  peekEmployees(): Employee[] | null {
    return this.lists.employees.snapshot;
  }

  peekProjects(): IProject[] | null {
    return this.lists.projects.snapshot;
  }

  /**
   * Detail snapshots come from mutation/GetProject responses and survive list
   * invalidation, so create -> edit navigation renders without a cold load.
   * `fresh` means the entry is authoritative enough to skip revalidation.
   */
  peekProject(id: number): { project: IProject; fresh: boolean } | null {
    const detail = this.projectDetailSnapshots.get(id);
    const listed = this.lists.projects.snapshot?.find((p) => p.projectId === id);
    if (detail && (!listed || detail.at >= this.lists.projects.at)) {
      return {
        project: detail.project,
        fresh: Date.now() - detail.at < this.cacheTtlMs,
      };
    }
    return listed ? { project: listed, fresh: false } : null;
  }

  peekProjectEmployees(): IProjectEmployee[] | null {
    return this.lists.assignments.snapshot;
  }

  peekDashboard(): any | null {
    return this.lists.dashboard.snapshot;
  }

  peekDepartments(): IApiResponse | null {
    return this.lists.departments.snapshot;
  }

  peekSchedule(): any | null {
    return this.lists.schedule.snapshot;
  }

  /** Loads lists that have never been fetched, so their pages open from cache. */
  warmLists(keys: readonly ListCacheKey[]): void {
    for (const key of keys) {
      if (this.lists[key].snapshot === null) {
        this.getCached(key).subscribe({ error: () => undefined });
      }
    }
  }

  clearAllCaches(): void {
    this.cacheEpoch += 1;
    (Object.keys(this.lists) as ListCacheKey[]).forEach((key) =>
      this.resetList(key)
    );
    this.projectDetailSnapshots.clear();
    this.apiDocumentationCache$ = null;
    this.apiDocumentationSnapshot = null;
    this.apiStatusSnapshot = null;
  }

  /**
   * Expire every list that embeds data from `domain` (see INVALIDATES).
   * Lists with a patch keep a corrected snapshot for instant paint and still
   * revalidate; the rest are dropped.
   */
  invalidate(domain: MutationDomain, patches: ListPatches = {}): void {
    INVALIDATES[domain].forEach((key) => this.resetList(key, patches[key]));
    if (domain !== 'project') {
      this.projectDetailSnapshots.clear();
    }
  }

  getAllDept(): Observable<IApiResponse> {
    return this.getCached('departments');
  }

  getChildDeptById(deptid: number): Observable<IApiResponse> {
    return this.http.get<IApiResponse>(
      this.getProxyUrl(`GetChildDepartmentByParentId?deptId=${deptid}`)
    );
  }

  saveEmp(obj: Employee): Observable<IApiResponse> {
    return this.http
      .post<IApiResponse>(this.getProxyUrl('CreateEmployee'), obj)
      .pipe(tap((res) => this.afterEmployeeSaved(res)));
  }

  getAllEmp(): Observable<Employee[]> {
    return this.getCached('employees');
  }

  updateEmp(obj: Employee): Observable<IApiResponse> {
    const queryUrl = this.getProxyUrl('UpdateEmployee') + `?id=${obj.employeeId}`;
    return this.http
      .put<IApiResponse>(queryUrl, obj)
      .pipe(tap((res) => this.afterEmployeeSaved(res)));
  }

  deleteEmpById(id: number): Observable<IApiResponse> {
    const queryUrl = this.getProxyUrl('DeleteEmployee') + `?id=${id}`;
    return this.http
      .delete<IApiResponse>(queryUrl)
      .pipe(
        tap(() =>
          this.invalidate('employee', {
            employees: (list) => removeBy(list, 'employeeId', id),
            assignments: (list) => removeBy(list, 'empId', id),
          })
        )
      );
  }

  saveProject(obj: IProject): Observable<IProject> {
    return this.trackProjectMutation(
      this.http.post<IProject>(this.getProxyUrl('CreateProject'), obj)
    );
  }

  updateProject(obj: IProject): Observable<IProject> {
    const queryUrl = this.getProxyUrl('UpdateProject') + `?id=${obj.projectId}`;
    return this.trackProjectMutation(this.http.put<IProject>(queryUrl, obj));
  }

  getAllProjects(): Observable<IProject[]> {
    return this.getCached('projects');
  }

  getProjectById(id: number): Observable<IProject> {
    const queryUrl = this.getProxyUrl('GetProject') + `?id=${id}`;
    return defer(() => {
      const issuedAt = Date.now();
      return this.http
        .get<IProject>(queryUrl)
        .pipe(tap((project) => this.rememberProject(project, issuedAt)));
    });
  }

  getProjectResourceInsights(
    id: number
  ): Observable<IProjectResourceInsights> {
    const queryUrl = this.getProxyUrl('GetProjectResources') + `?id=${id}`;
    return this.http.get<IProjectResourceInsights>(queryUrl);
  }

  fetchContentfulBrief(params: {
    entryId?: string;
    contentType?: string;
    slug?: string;
    preview?: boolean;
  }): Observable<IContentfulBrief> {
    let httpParams = new HttpParams();
    if (params.entryId) {
      httpParams = httpParams.set('entryId', params.entryId);
    }
    if (params.contentType) {
      httpParams = httpParams.set('contentType', params.contentType);
    }
    if (params.slug) {
      httpParams = httpParams.set('slug', params.slug);
    }
    if (params.preview) {
      httpParams = httpParams.set('preview', 'true');
    }
    return this.http.get<IContentfulBrief>(
      this.getProxyUrl('GetContentfulBrief'),
      {
        params: httpParams,
      }
    );
  }

  generateOverviewDraft(
    payload: IGenerateOverviewDraftRequest
  ): Observable<IAiOverviewDraft> {
    return this.http.post<IAiOverviewDraft>(
      this.getProxyUrl('GenerateOverviewDraft'),
      payload
    );
  }

  /** Archive or restore; the project's assignments follow it between the Active and Archived views. */
  setProjectArchived(id: number, archived: boolean): Observable<IProject> {
    const action = archived ? 'ArchiveProject' : 'RestoreProject';
    return this.http
      .post<IProject>(this.getProxyUrl(action) + `?id=${id}`, {})
      .pipe(
        tap((project) => {
          const projectArchivedAt = project?.archivedAt ?? null;
          this.invalidate('project', {
            projects: (list) => upsertBy(list, 'projectId', project),
            assignments: (list) =>
              list.map((item) =>
                item.projectId === id ? { ...item, projectArchivedAt } : item
              ),
          });
          this.rememberProject(project);
        })
      );
  }

  deleteProjectById(id: number): Observable<IApiResponse> {
    const queryUrl = this.getProxyUrl('DeleteProject') + `?id=${id}`;
    return this.http.delete<IApiResponse>(queryUrl).pipe(
      tap(() => {
        this.invalidate('project', {
          projects: (list) => removeBy(list, 'projectId', id),
          assignments: (list) => removeBy(list, 'projectId', id),
        });
        this.projectDetailSnapshots.delete(id);
      })
    );
  }

  requestProjectApproval(
    projectId: number,
    payload: Record<string, unknown>
  ): Observable<IProject> {
    return this.trackProjectMutation(
      this.http.post<IProject>(this.getProxyUrl('RequestApproval'), {
        projectId,
        ...payload,
      })
    );
  }

  approveProject(
    projectId: number,
    payload: Record<string, unknown>
  ): Observable<IProject> {
    return this.trackProjectMutation(
      this.http.post<IProject>(this.getProxyUrl('ApproveProject'), {
        projectId,
        ...payload,
      })
    );
  }

  rejectProject(
    projectId: number,
    payload: Record<string, unknown>
  ): Observable<IProject> {
    return this.trackProjectMutation(
      this.http.post<IProject>(this.getProxyUrl('RejectProject'), {
        projectId,
        ...payload,
      })
    );
  }

  resetProjectApproval(
    projectId: number,
    payload: Record<string, unknown> = {}
  ): Observable<IProject> {
    return this.trackProjectMutation(
      this.http.post<IProject>(this.getProxyUrl('ResetProjectApproval'), {
        projectId,
        ...payload,
      })
    );
  }

  addReviewerComment(
    projectId: number,
    payload: Record<string, unknown>
  ): Observable<IProject> {
    return this.trackProjectMutation(
      this.http.post<IProject>(this.getProxyUrl('AddReviewerComment'), {
        projectId,
        ...payload,
      })
    );
  }

  resolveReviewerComment(
    projectId: number,
    commentId: string,
    payload: Record<string, unknown>
  ): Observable<IProject> {
    return this.trackProjectMutation(
      this.http.post<IProject>(this.getProxyUrl('ResolveReviewerComment'), {
        projectId,
        commentId,
        ...payload,
      })
    );
  }

  getProjectEmp(): Observable<IProjectEmployee[]> {
    return this.getCached('assignments');
  }

  saveProjectEmp(obj: Partial<IProjectEmployee>): Observable<IProjectEmployee> {
    return this.http
      .post<IProjectEmployee>(this.getProxyUrl('CreateProjectEmployee'), obj)
      .pipe(tap((saved) => this.afterAssignmentSaved(saved)));
  }

  updateProjectEmp(obj: IProjectEmployee): Observable<IProjectEmployee> {
    const queryUrl =
      this.getProxyUrl('UpdateProjectEmployee') + `?id=${obj.empProjectId}`;
    return this.http
      .put<IProjectEmployee>(queryUrl, obj)
      .pipe(tap((saved) => this.afterAssignmentSaved(saved)));
  }

  deleteProjectEmpById(id: number): Observable<IApiResponse> {
    const queryUrl = this.getProxyUrl('DeleteProjectEmployee') + `?id=${id}`;
    return this.http
      .delete<IApiResponse>(queryUrl)
      .pipe(
        tap(() =>
          this.invalidate('assignment', {
            assignments: (list) => removeBy(list, 'empProjectId', id),
          })
        )
      );
  }

  getDashboardData(): Observable<any> {
    return this.getCached('dashboard');
  }

  getScheduleData(): Observable<any> {
    return this.getCached('schedule');
  }

  peekApiDocumentation(): IApiDocumentation | null {
    return this.apiDocumentationSnapshot;
  }

  peekApiStatus(): IApiStatus | null {
    return this.apiStatusSnapshot;
  }

  /** The API reference is static per deployment, so it is cached for the session. */
  getApiDocumentation(): Observable<IApiDocumentation> {
    if (!this.apiDocumentationCache$) {
      this.apiDocumentationCache$ = this.http
        .get<IApiDocumentation>(this.getProxyUrl('GetApiDocumentation'))
        .pipe(
          tap({
            next: (doc) => {
              this.apiDocumentationSnapshot = doc;
            },
            error: () => {
              this.apiDocumentationCache$ = null;
            },
          }),
          shareReplay({ bufferSize: 1, refCount: false })
        );
    }
    return this.apiDocumentationCache$;
  }

  /** Live data: always refetched; the snapshot only seeds the next visit. */
  getApiStatus(): Observable<IApiStatus> {
    return this.http
      .get<IApiStatus>(this.getProxyUrl('GetApiStatus'))
      .pipe(
        tap((status) => {
          this.apiStatusSnapshot = status;
        })
      );
  }

  getNotificationLog(limit = 20): Observable<INotificationLogEntry[]> {
    return this.http.get<INotificationLogEntry[]>(
      this.getProxyUrl('GetNotificationLog'),
      { params: new HttpParams().set('limit', limit) }
    );
  }

  getNotificationFailures(since: string): Observable<INotificationLogEntry[]> {
    return this.http.get<INotificationLogEntry[]>(
      this.getProxyUrl('GetNotificationFailures'),
      { params: new HttpParams().set('since', since) }
    );
  }

  /**
   * 30 s TTL measured from issue time, so concurrent callers share one request.
   * A response issued before an invalidation is discarded and refetched, so
   * neither the snapshot nor subscribers ever see pre-mutation data.
   */
  private getCached<K extends ListCacheKey>(
    key: K
  ): Observable<ListCacheTypes[K]> {
    const entry = this.lists[key] as ListCacheEntry<ListCacheTypes[K]>;
    if (entry.request$ && Date.now() - entry.at < this.cacheTtlMs) {
      return entry.request$;
    }

    const generation = entry.generation;
    const epoch = this.cacheEpoch;
    const request$: Observable<ListCacheTypes[K]> = this.http
      .get<ListCacheTypes[K]>(this.getProxyUrl(LIST_ENDPOINTS[key]))
      .pipe(
        tap({
          next: (value) => {
            if (entry.generation === generation) {
              entry.snapshot = value;
            }
          },
          error: () => {
            if (entry.request$ === request$) {
              entry.request$ = null;
              entry.at = 0;
            }
          },
        }),
        switchMap((value) => {
          if (this.cacheEpoch !== epoch) {
            return EMPTY;
          }
          return entry.generation === generation ? of(value) : this.getCached(key);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    entry.request$ = request$;
    entry.at = Date.now();
    return request$;
  }

  private resetList<K extends ListCacheKey>(
    key: K,
    patch?: (snapshot: ListCacheTypes[K]) => ListCacheTypes[K]
  ): void {
    const entry = this.lists[key] as ListCacheEntry<ListCacheTypes[K]>;
    entry.request$ = null;
    entry.at = 0;
    entry.snapshot = patch && entry.snapshot ? patch(entry.snapshot) : null;
    entry.generation += 1;
  }

  private afterEmployeeSaved(res: IApiResponse): void {
    const saved = res?.data as Employee | undefined;
    this.invalidate(
      'employee',
      saved?.employeeId
        ? { employees: (list) => upsertBy(list, 'employeeId', saved) }
        : {}
    );
  }

  private afterAssignmentSaved(saved: IProjectEmployee | null | undefined): void {
    this.invalidate(
      'assignment',
      saved?.empProjectId
        ? { assignments: (list) => upsertBy(list, 'empProjectId', saved) }
        : {}
    );
  }

  /** Every project mutation returns the full document: refresh lists + seed the detail snapshot. */
  private trackProjectMutation(
    request$: Observable<IProject>
  ): Observable<IProject> {
    return request$.pipe(
      tap((project) => {
        this.invalidate(
          'project',
          project?.projectId
            ? { projects: (list) => upsertBy(list, 'projectId', project) }
            : {}
        );
        this.rememberProject(project);
      })
    );
  }

  /** `issuedAt` keeps a slow read from overwriting a newer mutation response. */
  private rememberProject(
    project: IProject | null | undefined,
    issuedAt = Date.now()
  ): void {
    if (!project?.projectId || project.projectId <= 0) {
      return;
    }
    const existing = this.projectDetailSnapshots.get(project.projectId);
    if (existing && existing.at > issuedAt) {
      return;
    }
    this.projectDetailSnapshots.set(project.projectId, {
      project,
      at: issuedAt,
    });
  }

  private getProxyUrl(endpoint: string): string {
    const targetUrl = this.apiUrl ? this.apiUrl + endpoint : endpoint;
    if (this.corsProxyUrl) {
      if (this.shouldEncodeProxyTarget) {
        return this.corsProxyUrl + encodeURIComponent(targetUrl);
      }
      return `${this.corsProxyUrl}${endpoint}`;
    }
    return targetUrl;
  }
}
