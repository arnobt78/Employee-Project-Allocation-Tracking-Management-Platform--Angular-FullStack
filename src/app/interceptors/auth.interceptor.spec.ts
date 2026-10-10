import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../service/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: { authEpoch: number; handleUnauthorized: jasmine.Spy };

  const url = '/api/employee-management/GetAllEmployees';

  beforeEach(() => {
    auth = { authEpoch: 1, handleUnauthorized: jasmine.createSpy('handleUnauthorized') };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('sends API requests with credentials and signs out on 401', () => {
    http.get(url).subscribe({ error: () => undefined });

    const request = controller.expectOne(url);
    expect(request.request.withCredentials).toBeTrue();
    request.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('ignores a 401 from a request issued before the session changed', () => {
    http.get(url).subscribe({ error: () => undefined });
    auth.authEpoch = 2;

    controller.expectOne(url).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.handleUnauthorized).not.toHaveBeenCalled();
  });
});
