import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CalendarViewComponent, ICalendarEvent } from './calendar-view.component';

describe('CalendarViewComponent', () => {
  let fixture: ComponentFixture<CalendarViewComponent>;

  const event = (title: string): ICalendarEvent => ({
    id: title,
    title,
    date: new Date(),
    type: 'milestone',
    projectId: 1,
    projectName: 'Apollo',
    description: '',
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendarViewComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(CalendarViewComponent);
  });

  it('re-renders the grid when the events input changes', () => {
    fixture.componentRef.setInput('events', [event('Cached kickoff')]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Cached kickoff');

    fixture.componentRef.setInput('events', [event('Fresh kickoff')]);
    fixture.detectChanges();
    expect(el.textContent).toContain('Fresh kickoff');
    expect(el.textContent).not.toContain('Cached kickoff');
  });
});
