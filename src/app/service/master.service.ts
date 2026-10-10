import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, defer, shareReplay, tap } from 'rxjs';
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
} from '../model/interface/master';
import { Employee } from '../model/class/Employee';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MasterService {
  corsProxyUrl: string = environment.api.baseUrl;
  shouldEncodeProxyTarget = false;
  apiUrl: string = '';

  private readonly cacheTtlMs = 30_000;

  private employeesCache$: Observable<Employee[]> | null = null;
  private employeesCacheAt = 0;
  private employeesSnapshot: Employee[] | null = null;

  private projectsCache$: Observable<IProject[]> | null = null;
  private projectsCacheAt = 0;
  private projectsSnapshot: IProject[] | null = null;
  private readonly projectDetailSnapshots = new Map<
    number,
    { project: IProject; at: number }
  >();

  private projectEmployeesCache$: Observable<IProjectEmployee[]> | null = null;
  private projectEmployeesCacheAt = 0;
  private projectEmployeesSnapshot: IProjectEmployee[] | null = null;

  private dashboardCache$: Observable<any> | null = null;
  private dashboardCacheAt = 0;
  private dashboardSnapshot: any | null = null;

  private departmentsCache$: Observable<IApiResponse> | null = null;
  private departmentsCacheAt = 0;
  private departmentsSnapshot: IApiResponse | null = null;

  private scheduleCache$: Observable<any> | null = null;
  private scheduleCacheAt = 0;
  private scheduleSnapshot: any | null = null;

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

  logout(): Observable<IApiResponse<null>> {
    return this.http.post<IApiResponse<null>>(this.getProxyUrl('Logout'), {});
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
    return this.employeesSnapshot;
  }

  peekProjects(): IProject[] | null {
    return this.projectsSnapshot;
  }

  /**
   * Detail snapshots come from mutation/GetProject responses and survive list
   * invalidation, so create -> edit navigation renders without a cold load.
   * `fresh` means the entry is authoritative enough to skip revalidation.
   */
  peekProject(id: number): { project: IProject; fresh: boolean } | null {
    const detail = this.projectDetailSnapshots.get(id);
    const listed = this.projectsSnapshot?.find((p) => p.projectId === id);
    if (detail && (!listed || detail.at >= this.projectsCacheAt)) {
      return {
        project: detail.project,
        fresh: Date.now() - detail.at < this.cacheTtlMs,
      };
    }
    return listed ? { project: listed, fresh: false } : null;
  }

  peekProjectEmployees(): IProjectEmployee[] | null {
    return this.projectEmployeesSnapshot;
  }

  peekDashboard(): any | null {
    return this.dashboardSnapshot;
  }

  peekDepartments(): IApiResponse | null {
    return this.departmentsSnapshot;
  }

  peekSchedule(): any | null {
    return this.scheduleSnapshot;
  }

  clearAllCaches(): void {
    this.employeesCache$ = null;
    this.projectsCache$ = null;
    this.projectEmployeesCache$ = null;
    this.dashboardCache$ = null;
    this.departmentsCache$ = null;
    this.scheduleCache$ = null;
    this.employeesCacheAt = 0;
    this.projectsCacheAt = 0;
    this.projectEmployeesCacheAt = 0;
    this.dashboardCacheAt = 0;
    this.departmentsCacheAt = 0;
    this.scheduleCacheAt = 0;
    this.employeesSnapshot = null;
    this.projectsSnapshot = null;
    this.projectDetailSnapshots.clear();
    this.projectEmployeesSnapshot = null;
    this.dashboardSnapshot = null;
    this.departmentsSnapshot = null;
    this.scheduleSnapshot = null;
    this.apiDocumentationCache$ = null;
    this.apiDocumentationSnapshot = null;
    this.apiStatusSnapshot = null;
  }

  invalidateEmployees(): void {
    this.employeesCache$ = null;
    this.employeesCacheAt = 0;
    this.employeesSnapshot = null;
    this.projectDetailSnapshots.clear();
    this.dashboardCache$ = null;
    this.dashboardCacheAt = 0;
    this.dashboardSnapshot = null;
  }

  invalidateProjects(): void {
    this.projectsCache$ = null;
    this.projectsCacheAt = 0;
    this.projectsSnapshot = null;
    this.dashboardCache$ = null;
    this.dashboardCacheAt = 0;
    this.dashboardSnapshot = null;
    this.scheduleCache$ = null;
    this.scheduleCacheAt = 0;
    this.scheduleSnapshot = null;
  }

  invalidateProjectEmployees(): void {
    this.projectEmployeesCache$ = null;
    this.projectEmployeesCacheAt = 0;
    this.projectEmployeesSnapshot = null;
    this.dashboardCache$ = null;
    this.dashboardCacheAt = 0;
    this.dashboardSnapshot = null;
    this.scheduleCache$ = null;
    this.scheduleCacheAt = 0;
    this.scheduleSnapshot = null;
  }

  invalidateDashboard(): void {
    this.dashboardCache$ = null;
    this.dashboardCacheAt = 0;
    this.dashboardSnapshot = null;
  }

  invalidateSchedule(): void {
    this.scheduleCache$ = null;
    this.scheduleCacheAt = 0;
    this.scheduleSnapshot = null;
  }

  getAllDept(): Observable<IApiResponse> {
    return this.getCached(
      () => this.departmentsCache$,
      (value) => {
        this.departmentsCache$ = value;
      },
      () => this.departmentsCacheAt,
      (value) => {
        this.departmentsCacheAt = value;
      },
      (value) => {
        this.departmentsSnapshot = value;
      },
      () =>
        this.http
          .get<IApiResponse>(this.getProxyUrl('GetParentDepartment'))
          .pipe(shareReplay({ bufferSize: 1, refCount: false }))
    );
  }

  getChildDeptById(deptid: number): Observable<IApiResponse> {
    return this.http.get<IApiResponse>(
      this.getProxyUrl(`GetChildDepartmentByParentId?deptId=${deptid}`)
    );
  }

  saveEmp(obj: Employee): Observable<IApiResponse> {
    return this.http
      .post<IApiResponse>(this.getProxyUrl('CreateEmployee'), obj)
      .pipe(tap(() => this.invalidateEmployees()));
  }

  getAllEmp(): Observable<Employee[]> {
    return this.getCached(
      () => this.employeesCache$,
      (value) => {
        this.employeesCache$ = value;
      },
      () => this.employeesCacheAt,
      (value) => {
        this.employeesCacheAt = value;
      },
      (value) => {
        this.employeesSnapshot = value;
      },
      () =>
        this.http
          .get<Employee[]>(this.getProxyUrl('GetAllEmployees'))
          .pipe(shareReplay({ bufferSize: 1, refCount: false }))
    );
  }

  updateEmp(obj: Employee): Observable<IApiResponse> {
    const queryUrl = this.getProxyUrl('UpdateEmployee') + `?id=${obj.employeeId}`;
    return this.http
      .put<IApiResponse>(queryUrl, obj)
      .pipe(tap(() => this.invalidateEmployees()));
  }

  deleteEmpById(id: number): Observable<IApiResponse> {
    const queryUrl = this.getProxyUrl('DeleteEmployee') + `?id=${id}`;
    return this.http
      .delete<IApiResponse>(queryUrl)
      .pipe(tap(() => this.invalidateEmployees()));
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
    return this.getCached(
      () => this.projectsCache$,
      (value) => {
        this.projectsCache$ = value;
      },
      () => this.projectsCacheAt,
      (value) => {
        this.projectsCacheAt = value;
      },
      (value) => {
        this.projectsSnapshot = value;
      },
      () =>
        this.http
          .get<IProject[]>(this.getProxyUrl('GetAllProjects'))
          .pipe(shareReplay({ bufferSize: 1, refCount: false }))
    );
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

  deleteProjectById(id: number): Observable<IApiResponse> {
    const queryUrl = this.getProxyUrl('DeleteProject') + `?id=${id}`;
    return this.http.delete<IApiResponse>(queryUrl).pipe(
      tap(() => {
        this.invalidateProjects();
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
    return this.getCached(
      () => this.projectEmployeesCache$,
      (value) => {
        this.projectEmployeesCache$ = value;
      },
      () => this.projectEmployeesCacheAt,
      (value) => {
        this.projectEmployeesCacheAt = value;
      },
      (value) => {
        this.projectEmployeesSnapshot = value;
      },
      () =>
        this.http
          .get<IProjectEmployee[]>(this.getProxyUrl('GetAllProjectEmployees'))
          .pipe(shareReplay({ bufferSize: 1, refCount: false }))
    );
  }

  saveProjectEmp(obj: IProjectEmployee): Observable<IProject> {
    return this.http
      .post<IProject>(this.getProxyUrl('CreateProjectEmployee'), obj)
      .pipe(tap(() => this.invalidateProjectEmployees()));
  }

  updateProjectEmp(obj: IProjectEmployee): Observable<IProjectEmployee> {
    const queryUrl =
      this.getProxyUrl('UpdateProjectEmployee') + `?id=${obj.empProjectId}`;
    return this.http
      .put<IProjectEmployee>(queryUrl, obj)
      .pipe(tap(() => this.invalidateProjectEmployees()));
  }

  deleteProjectEmpById(id: number): Observable<IApiResponse> {
    const queryUrl = this.getProxyUrl('DeleteProjectEmployee') + `?id=${id}`;
    return this.http
      .delete<IApiResponse>(queryUrl)
      .pipe(tap(() => this.invalidateProjectEmployees()));
  }

  getDashboardData(): Observable<any> {
    return this.getCached(
      () => this.dashboardCache$,
      (value) => {
        this.dashboardCache$ = value;
      },
      () => this.dashboardCacheAt,
      (value) => {
        this.dashboardCacheAt = value;
      },
      (value) => {
        this.dashboardSnapshot = value;
      },
      () =>
        this.http
          .get<any>(this.getProxyUrl('GetDashboard'))
          .pipe(shareReplay({ bufferSize: 1, refCount: false }))
    );
  }

  getScheduleData(): Observable<any> {
    return this.getCached(
      () => this.scheduleCache$,
      (value) => {
        this.scheduleCache$ = value;
      },
      () => this.scheduleCacheAt,
      (value) => {
        this.scheduleCacheAt = value;
      },
      (value) => {
        this.scheduleSnapshot = value;
      },
      () =>
        this.http
          .get<any>(this.getProxyUrl('GetSchedule'))
          .pipe(shareReplay({ bufferSize: 1, refCount: false }))
    );
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

  private getCached<T>(
    getCache: () => Observable<T> | null,
    setCache: (value: Observable<T>) => void,
    getCacheAt: () => number,
    setCacheAt: (value: number) => void,
    setSnapshot: (value: T) => void,
    factory: () => Observable<T>
  ): Observable<T> {
    const now = Date.now();
    const cached = getCache();
    if (cached && now - getCacheAt() < this.cacheTtlMs) {
      return cached;
    }

    const nextCache = factory().pipe(
      tap((value) => {
        setCacheAt(Date.now());
        setSnapshot(value);
      })
    );
    setCache(nextCache);
    return nextCache;
  }

  /** Every project mutation returns the full document: refresh lists + seed the detail snapshot. */
  private trackProjectMutation(
    request$: Observable<IProject>
  ): Observable<IProject> {
    return request$.pipe(
      tap((project) => {
        this.invalidateProjects();
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
