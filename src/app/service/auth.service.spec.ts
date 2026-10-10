import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, defer, of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { MasterService } from './master.service';
import { ToastService } from '../components/ui/toast.service';
import { AuthUser } from '../model/interface/master';

describe('AuthService', () => {
  let service: AuthService;
  let master: jasmine.SpyObj<MasterService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    master = jasmine.createSpyObj<MasterService>('MasterService', [
      'login',
      'logout',
      'clearAllCaches',
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['error']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MasterService, useValue: master },
        { provide: ToastService, useValue: toast },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  it('drops the previous session caches on successful login', () => {
    const user = { username: 'admin' } as AuthUser;
    master.login.and.returnValue(of({ result: true, message: 'ok', data: user }));

    service.login('admin', 'secret').subscribe();

    expect(master.clearAllCaches).toHaveBeenCalledTimes(1);
    expect(service.session()).toEqual(user);
  });

  it('keeps caches when login is rejected', () => {
    master.login.and.returnValue(of({ result: false, message: 'no', data: null as never }));

    service.login('admin', 'wrong').subscribe();

    expect(master.clearAllCaches).not.toHaveBeenCalled();
    expect(service.session()).toBeNull();
  });

  it('signs out locally before the server responds', () => {
    const user = { username: 'admin' } as AuthUser;
    master.login.and.returnValue(of({ result: true, message: 'ok', data: user }));
    service.login('admin', 'secret').subscribe();
    master.logout.and.returnValue(new Subject<void>());

    service.logout();

    expect(service.session()).toBeNull();
    expect(service.sessionResolved()).toBeTrue();
    expect(master.clearAllCaches).toHaveBeenCalledTimes(2);
    expect(master.logout).toHaveBeenCalledTimes(1);
  });

  it('holds a new login until the background logout settles', () => {
    const logoutResponse = new Subject<void>();
    master.logout.and.returnValue(logoutResponse);
    master.login.and.returnValue(
      of({ result: true, message: 'ok', data: { username: 'admin' } as AuthUser })
    );

    service.logout();
    service.login('admin', 'secret').subscribe();
    expect(master.login).not.toHaveBeenCalled();

    logoutResponse.next();
    logoutResponse.complete();
    expect(master.login).toHaveBeenCalledTimes(1);
    expect(service.session()?.username).toBe('admin');
  });

  it('retries a failed logout, then warns that sign-out was not confirmed', fakeAsync(() => {
    let attempts = 0;
    master.logout.and.returnValue(
      defer(() => {
        attempts += 1;
        return throwError(() => new Error('offline'));
      })
    );

    service.logout();
    tick(5_000);

    expect(attempts).toBe(3);
    expect(toast.error).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ title: 'Sign-out not confirmed' })
    );
  }));

  it('changes the auth epoch on sign-in, sign-out and unauthorized', () => {
    master.login.and.returnValue(
      of({ result: true, message: 'ok', data: { username: 'admin' } as AuthUser })
    );
    master.logout.and.returnValue(new Subject<void>());
    const epochs = [service.authEpoch];

    service.login('admin', 'secret').subscribe();
    epochs.push(service.authEpoch);
    service.logout();
    epochs.push(service.authEpoch);
    service.handleUnauthorized();
    epochs.push(service.authEpoch);

    expect(new Set(epochs).size).toBe(4);
  });
});
