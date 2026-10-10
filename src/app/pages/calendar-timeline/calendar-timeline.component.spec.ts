import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';

import { CalendarTimelineComponent } from './calendar-timeline.component';
import { MasterService } from '../../service/master.service';

describe('CalendarTimelineComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarTimelineComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('renders the same mirror skeleton as the route placeholder on a cold load', () => {
    const master = TestBed.inject(MasterService);
    spyOn(master, 'peekSchedule').and.returnValue(null);
    spyOn(master, 'getScheduleData').and.returnValue(NEVER);

    const fixture = TestBed.createComponent(CalendarTimelineComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="calendar-skeleton"]')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="page-header"]').length).toBe(1);
  });
});
