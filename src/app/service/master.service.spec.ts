import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MasterService } from './master.service';
import { IApiDocumentation, IProject } from '../model/interface/master';

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
