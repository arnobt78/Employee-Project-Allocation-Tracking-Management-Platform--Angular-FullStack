import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';

import { ApiDocComponent } from './api-doc.component';
import { MasterService } from '../../service/master.service';
import { IApiDocumentation } from '../../model/interface/master';
import { ToastService } from '@/app/components/ui/toast.service';

describe('ApiDocComponent', () => {
  let master: MasterService;

  const doc: IApiDocumentation = {
    info: {
      title: 'Employee Management API',
      version: '1.0.0',
      description: 'Reference',
      baseUrl: '/api',
    },
    endpoints: { GET: [], POST: [], PUT: [], DELETE: [] },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApiDocComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    master = TestBed.inject(MasterService);
  });

  function create(): HTMLElement {
    const fixture = TestBed.createComponent(ApiDocComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the shared mirror skeleton on a cold load', () => {
    spyOn(master, 'peekApiDocumentation').and.returnValue(null);
    spyOn(master, 'getApiDocumentation').and.returnValue(NEVER);
    const el = create();
    expect(el.querySelector('[data-testid="api-doc-skeleton"]')).toBeTruthy();
  });

  it('renders the session-cached doc without refetching', () => {
    spyOn(master, 'peekApiDocumentation').and.returnValue(doc);
    const getSpy = spyOn(master, 'getApiDocumentation').and.returnValue(NEVER);
    const el = create();
    expect(el.querySelector('[data-testid="api-doc-skeleton"]')).toBeNull();
    expect(el.textContent).toContain('Employee Management API');
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('shows the message of each error response', () => {
    const withErrors: IApiDocumentation = {
      ...doc,
      endpoints: {
        ...doc.endpoints,
        GET: [
          {
            path: 'GetProject/{id}',
            method: 'GET',
            description: 'Get a project',
            url: '/api/GetProject/{id}',
            response: { status: 200, body: 'Project' },
            errorResponses: [{ status: 404, body: { result: false, message: 'Project not found' } }],
            category: 'Projects',
          },
        ],
      },
    };
    spyOn(master, 'peekApiDocumentation').and.returnValue(withErrors);
    spyOn(master, 'getApiDocumentation').and.returnValue(NEVER);
    const el = create();
    expect(el.textContent).toContain('Message:');
    expect(el.textContent).toContain('Project not found');
  });

  describe('copy URL', () => {
    function setup(): ApiDocComponent {
      spyOn(master, 'peekApiDocumentation').and.returnValue(doc);
      spyOn(master, 'getApiDocumentation').and.returnValue(NEVER);
      return TestBed.createComponent(ApiDocComponent).componentInstance;
    }

    it('shows a Copied toast after writing to the clipboard', async () => {
      const component = setup();
      const toast = TestBed.inject(ToastService);
      const success = spyOn(toast, 'success');
      spyOn(navigator.clipboard, 'writeText').and.resolveTo();
      await component.copyToClipboard('/api/GetProjects');
      expect(success).toHaveBeenCalledWith({ title: 'Copied', description: '/api/GetProjects' });
    });

    it('shows an error toast when the clipboard rejects', async () => {
      const component = setup();
      const toast = TestBed.inject(ToastService);
      const error = spyOn(toast, 'error');
      spyOn(navigator.clipboard, 'writeText').and.rejectWith(new Error('denied'));
      await component.copyToClipboard('/api/GetProjects');
      expect(error).toHaveBeenCalled();
    });
  });
});
