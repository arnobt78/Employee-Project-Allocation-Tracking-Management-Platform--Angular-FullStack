import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
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

  private projectsCache$: Observable<IProject[]> | null = null;
  private projectsCacheAt = 0;

  private projectEmployeesCache$: Observable<IProjectEmployee[]> | null = null;
  private projectEmployeesCacheAt = 0;

  private dashboardCache$: Observable<any> | null = null;
  private dashboardCacheAt = 0;

  private departmentsCache$: Observable<IApiResponse> | null = null;
  private departmentsCacheAt = 0;

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

  clearAllCaches(): void {
    this.employeesCache$ = null;
    this.projectsCache$ = null;
    this.projectEmployeesCache$ = null;
    this.dashboardCache$ = null;
    this.departmentsCache$ = null;
    this.employeesCacheAt = 0;
    this.projectsCacheAt = 0;
    this.projectEmployeesCacheAt = 0;
    this.dashboardCacheAt = 0;
    this.departmentsCacheAt = 0;
  }

  invalidateEmployees(): void {
    this.employeesCache$ = null;
    this.employeesCacheAt = 0;
    this.dashboardCache$ = null;
    this.dashboardCacheAt = 0;
  }

  invalidateProjects(): void {
    this.projectsCache$ = null;
    this.projectsCacheAt = 0;
    this.dashboardCache$ = null;
    this.dashboardCacheAt = 0;
  }

  invalidateProjectEmployees(): void {
    this.projectEmployeesCache$ = null;
    this.projectEmployeesCacheAt = 0;
    this.dashboardCache$ = null;
    this.dashboardCacheAt = 0;
  }

  invalidateDashboard(): void {
    this.dashboardCache$ = null;
    this.dashboardCacheAt = 0;
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
    return this.http
      .post<IProject>(this.getProxyUrl('CreateProject'), obj)
      .pipe(tap(() => this.invalidateProjects()));
  }

  updateProject(obj: IProject): Observable<IProject> {
    const queryUrl = this.getProxyUrl('UpdateProject') + `?id=${obj.projectId}`;
    return this.http
      .put<IProject>(queryUrl, obj)
      .pipe(tap(() => this.invalidateProjects()));
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
      () =>
        this.http
          .get<IProject[]>(this.getProxyUrl('GetAllProjects'))
          .pipe(shareReplay({ bufferSize: 1, refCount: false }))
    );
  }

  getProjectById(id: number): Observable<IProject> {
    const queryUrl = this.getProxyUrl('GetProject') + `?id=${id}`;
    return this.http.get<IProject>(queryUrl);
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
    return this.http
      .delete<IApiResponse>(queryUrl)
      .pipe(tap(() => this.invalidateProjects()));
  }

  requestProjectApproval(
    projectId: number,
    payload: Record<string, unknown>
  ): Observable<IProject> {
    return this.http.post<IProject>(this.getProxyUrl('RequestApproval'), {
      projectId,
      ...payload,
    });
  }

  approveProject(
    projectId: number,
    payload: Record<string, unknown>
  ): Observable<IProject> {
    return this.http.post<IProject>(this.getProxyUrl('ApproveProject'), {
      projectId,
      ...payload,
    });
  }

  rejectProject(
    projectId: number,
    payload: Record<string, unknown>
  ): Observable<IProject> {
    return this.http.post<IProject>(this.getProxyUrl('RejectProject'), {
      projectId,
      ...payload,
    });
  }

  resetProjectApproval(
    projectId: number,
    payload: Record<string, unknown> = {}
  ): Observable<IProject> {
    return this.http.post<IProject>(
      this.getProxyUrl('ResetProjectApproval'),
      {
        projectId,
        ...payload,
      }
    );
  }

  addReviewerComment(
    projectId: number,
    payload: Record<string, unknown>
  ): Observable<IProject> {
    return this.http.post<IProject>(this.getProxyUrl('AddReviewerComment'), {
      projectId,
      ...payload,
    });
  }

  resolveReviewerComment(
    projectId: number,
    commentId: string,
    payload: Record<string, unknown>
  ): Observable<IProject> {
    return this.http.post<IProject>(
      this.getProxyUrl('ResolveReviewerComment'),
      {
        projectId,
        commentId,
        ...payload,
      }
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
      () =>
        this.http
          .get<any>(this.getProxyUrl('GetDashboard'))
          .pipe(shareReplay({ bufferSize: 1, refCount: false }))
    );
  }

  getScheduleData(): Observable<any> {
    return this.http.get<any>(this.getProxyUrl('GetSchedule'));
  }

  getApiDocumentation(): Observable<any> {
    return this.http.get<any>(this.getProxyUrl('GetApiDocumentation'));
  }

  getApiStatus(): Observable<any> {
    return this.http.get<any>(this.getProxyUrl('GetApiStatus'));
  }

  private getCached<T>(
    getCache: () => Observable<T> | null,
    setCache: (value: Observable<T>) => void,
    getCacheAt: () => number,
    setCacheAt: (value: number) => void,
    factory: () => Observable<T>
  ): Observable<T> {
    const now = Date.now();
    const cached = getCache();
    if (cached && now - getCacheAt() < this.cacheTtlMs) {
      return cached;
    }

    const nextCache = factory().pipe(
      tap(() => setCacheAt(Date.now()))
    );
    setCache(nextCache);
    return nextCache;
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
