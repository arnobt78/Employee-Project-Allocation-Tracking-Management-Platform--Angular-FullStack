import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';

import { ApiDocComponent } from './api-doc.component';
import { MasterService } from '../../service/master.service';
import { IApiDocumentation } from '../../model/interface/master';

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
});
