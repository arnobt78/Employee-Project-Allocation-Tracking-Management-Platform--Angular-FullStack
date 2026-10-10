import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { LayoutComponent } from './layout.component';
import { AuthService } from '@/app/service/auth.service';
import { MasterService } from '@/app/service/master.service';

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('warms nav lists when idle for a signed-in user only', () => {
    const master = TestBed.inject(MasterService);
    const auth = TestBed.inject(AuthService);
    const warm = spyOn(master, 'warmLists');
    spyOn(window, 'requestIdleCallback').and.callFake((callback) => {
      callback({} as IdleDeadline);
      return 1;
    });

    TestBed.createComponent(LayoutComponent).detectChanges();
    expect(warm).not.toHaveBeenCalled();

    spyOn(auth, 'isAuthenticated').and.returnValue(true);
    TestBed.createComponent(LayoutComponent).detectChanges();
    expect(warm).toHaveBeenCalledOnceWith(['employees', 'projects', 'assignments']);
  });

  it('should start with no child active (placeholder owned by App shell)', () => {
    expect(component.childActive()).toBe(false);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      compiled.querySelector('[data-testid="route-content-placeholder"]')
    ).toBeNull();
  });
});
