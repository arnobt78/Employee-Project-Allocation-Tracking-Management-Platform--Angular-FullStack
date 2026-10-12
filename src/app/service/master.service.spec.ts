import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MasterService } from './master.service';
import {
  IApiDocumentation,
  IProject,
  IProjectEmployee,
} from '../model/interface/master';

describe('MasterService', () => {
  let service: MasterService;
  let http: HttpTestingController;

  const project = { projectId: 7, projectName: 'Aurora' } as IProject;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MasterService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('sends logout as a keepalive request so it survives a page unload', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response('{}'));

    await new Promise<void>((resolve) =>
      service.logout().subscribe({ complete: resolve })
    );

    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toContain('Logout');
    expect(init).toEqual(
      jasmine.objectContaining({ method: 'POST', keepalive: true, credentials: 'include' })
    );
  });

  it('drops an in-flight list response after caches are cleared, without refetching', () => {
    const received: IProject[][] = [];
    service.getAllProjects().subscribe((list) => received.push(list));
    const request = http.expectOne((req) => req.url.endsWith('GetAllProjects'));

    service.clearAllCaches();
    request.flush([project]);

    http.expectNone((req) => req.url.endsWith('GetAllProjects'));
    expect(received).toEqual([]);
    expect(service.peekProjects()).toBeNull();
  });

  describe('warmLists', () => {
    it('fetches only lists that were never loaded and shares in-flight requests', () => {
      service.getAllProjects().subscribe();
      http.expectOne((req) => req.url.endsWith('GetAllProjects')).flush([project]);

      service.getAllEmp().subscribe();
      service.warmLists(['employees', 'projects', 'assignments']);

      http.expectOne((req) => req.url.endsWith('GetAllEmployees')).flush([]);
      http.expectOne((req) => req.url.endsWith('GetAllProjectEmployees')).flush([]);
      http.expectNone((req) => req.url.endsWith('GetAllProjects'));
      expect(service.peekProjectEmployees()).toEqual([]);
    });
  });

  describe('peekProject', () => {
    it('returns a fresh detail snapshot after a create mutation', () => {
      service.saveProject(project).subscribe();
      http.expectOne((req) => req.url.endsWith('CreateProject')).flush(project);

      expect(service.peekProject(7)).toEqual({ project, fresh: true });
    });

    it('forgets the detail snapshot after delete', () => {
      service.updateProject(project).subscribe();
      http.expectOne((req) => req.url.includes('UpdateProject')).flush(project);
      service.deleteProjectById(7).subscribe();
      http.expectOne((req) => req.url.includes('DeleteProject')).flush({});

      expect(service.peekProject(7)).toBeNull();
    });

    it('seeds the detail snapshot from approval responses', () => {
      const approved = { ...project, approvalStatus: 'approved' } as IProject;
      service.approveProject(7, {}).subscribe();
      http.expectOne((req) => req.url.endsWith('ApproveProject')).flush(approved);

      expect(service.peekProject(7)?.project).toEqual(approved);
    });

    it('keeps a mutation response over a slower GetProject issued earlier', () => {
      jasmine.clock().install();
      try {
        jasmine.clock().mockDate(new Date(1_000));
        service.getProjectById(7).subscribe();
        const read = http.expectOne((req) => req.url.includes('GetProject'));

        jasmine.clock().mockDate(new Date(2_000));
        const saved = { ...project, projectName: 'Saved' } as IProject;
        service.updateProject(saved).subscribe();
        http.expectOne((req) => req.url.includes('UpdateProject')).flush(saved);

        read.flush(project);
        expect(service.peekProject(7)?.project).toEqual(saved);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('falls back to the list snapshot as non-fresh', () => {
      service.getAllProjects().subscribe();
      http.expectOne((req) => req.url.endsWith('GetAllProjects')).flush([project]);

      expect(service.peekProject(7)).toEqual({ project, fresh: false });
      expect(service.peekProject(99)).toBeNull();
    });
  });

  describe('list cache invalidation', () => {
    const assignment = { empProjectId: 1, projectId: 7, empId: 3 } as IProjectEmployee;

    const seedAssignments = () => {
      service.getProjectEmp().subscribe();
      http
        .expectOne((req) => req.url.endsWith('GetAllProjectEmployees'))
        .flush([assignment]);
      expect(service.peekProjectEmployees()).toEqual([assignment]);
    };

    it('shares one in-flight request between callers', () => {
      service.getAllProjects().subscribe();
      service.getAllProjects().subscribe();
      http.expectOne((req) => req.url.endsWith('GetAllProjects')).flush([project]);
    });

    it('prunes the deleted project and its assignments, then revalidates', () => {
      seedAssignments();
      service.getAllProjects().subscribe();
      http.expectOne((req) => req.url.endsWith('GetAllProjects')).flush([project]);

      service.deleteProjectById(7).subscribe();
      http.expectOne((req) => req.url.includes('DeleteProject')).flush({});

      expect(service.peekProjectEmployees()).toEqual([]);
      expect(service.peekProjects()).toEqual([]);
      service.getProjectEmp().subscribe();
      http.expectOne((req) => req.url.endsWith('GetAllProjectEmployees')).flush([]);
    });

    it('moves a project and its assignments between views on archive and restore', () => {
      seedAssignments();
      service.getAllProjects().subscribe();
      http.expectOne((req) => req.url.endsWith('GetAllProjects')).flush([project]);
      const archivedAt = '2026-10-12T00:00:00.000Z';

      service.setProjectArchived(7, true).subscribe();
      const archive = http.expectOne((req) => req.url.includes('ArchiveProject'));
      expect(archive.request.method).toBe('POST');
      expect(archive.request.url).toContain('?id=7');
      archive.flush({ ...project, archivedAt });

      expect(service.peekProjects()?.[0].archivedAt).toBe(archivedAt);
      expect(service.peekProjectEmployees()?.[0].projectArchivedAt).toBe(archivedAt);
      expect(service.peekProject(7)?.project.archivedAt).toBe(archivedAt);

      service.setProjectArchived(7, false).subscribe();
      http.expectOne((req) => req.url.includes('RestoreProject')).flush({ ...project, archivedAt: undefined });

      expect(service.peekProjects()?.[0].archivedAt).toBeUndefined();
      expect(service.peekProjectEmployees()?.[0].projectArchivedAt).toBeNull();
    });

    it('prunes assignments and drops lead-name lists after an employee delete', () => {
      seedAssignments();
      service.getAllProjects().subscribe();
      http.expectOne((req) => req.url.endsWith('GetAllProjects')).flush([project]);

      service.deleteEmpById(3).subscribe();
      http.expectOne((req) => req.url.includes('DeleteEmployee')).flush({});

      expect(service.peekProjectEmployees()).toEqual([]);
      expect(service.peekProjects()).toBeNull();
    });

    it('upserts the saved assignment into the snapshot', () => {
      seedAssignments();
      const saved = { ...assignment, role: 'Lead' } as IProjectEmployee;
      service.updateProjectEmp(saved).subscribe();
      http.expectOne((req) => req.url.includes('UpdateProjectEmployee')).flush(saved);

      expect(service.peekProjectEmployees()).toEqual([saved]);
    });

    it('refetches instead of delivering a list response issued before a mutation', () => {
      const received: IProjectEmployee[][] = [];
      service.getProjectEmp().subscribe((list) => received.push(list));
      const stale = http.expectOne((req) =>
        req.url.endsWith('GetAllProjectEmployees')
      );

      service.deleteProjectEmpById(1).subscribe();
      http.expectOne((req) => req.url.includes('DeleteProjectEmployee')).flush({});

      stale.flush([assignment]);
      expect(service.peekProjectEmployees()).toBeNull();
      expect(received).toEqual([]);

      http.expectOne((req) => req.url.endsWith('GetAllProjectEmployees')).flush([]);
      expect(received).toEqual([[]]);
      expect(service.peekProjectEmployees()).toEqual([]);
    });

    it('retries after a failed list request', () => {
      service.getAllProjects().subscribe({ error: () => undefined });
      http
        .expectOne((req) => req.url.endsWith('GetAllProjects'))
        .flush('down', { status: 500, statusText: 'Server Error' });

      service.getAllProjects().subscribe();
      http.expectOne((req) => req.url.endsWith('GetAllProjects')).flush([project]);
      expect(service.peekProjects()).toEqual([project]);
    });
  });

  describe('getApiDocumentation', () => {
    const doc: IApiDocumentation = {
      info: { title: 'API', version: '1', description: '', baseUrl: '/' },
      endpoints: { GET: [], POST: [], PUT: [], DELETE: [] },
    };

    it('caches the static reference for the session', () => {
      service.getApiDocumentation().subscribe();
      http.expectOne((req) => req.url.endsWith('GetApiDocumentation')).flush(doc);

      service.getApiDocumentation().subscribe((value) => {
        expect(value).toEqual(doc);
      });
      http.expectNone((req) => req.url.endsWith('GetApiDocumentation'));
      expect(service.peekApiDocumentation()).toEqual(doc);
    });

    it('allows a retry after a failed request', () => {
      service.getApiDocumentation().subscribe({ error: () => undefined });
      http
        .expectOne((req) => req.url.endsWith('GetApiDocumentation'))
        .flush('down', { status: 500, statusText: 'Server Error' });

      service.getApiDocumentation().subscribe();
      http.expectOne((req) => req.url.endsWith('GetApiDocumentation')).flush(doc);
      expect(service.peekApiDocumentation()).toEqual(doc);
    });
  });
});
