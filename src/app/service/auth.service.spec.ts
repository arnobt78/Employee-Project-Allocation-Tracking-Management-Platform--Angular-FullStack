import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { MasterService } from './master.service';
import { AuthUser } from '../model/interface/master';

describe('AuthService', () => {
  let service: AuthService;
  let master: jasmine.SpyObj<MasterService>;

  beforeEach(() => {
    master = jasmine.createSpyObj<MasterService>('MasterService', [
      'login',
      'clearAllCaches',
    ]);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: MasterService, useValue: master }],
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
});
