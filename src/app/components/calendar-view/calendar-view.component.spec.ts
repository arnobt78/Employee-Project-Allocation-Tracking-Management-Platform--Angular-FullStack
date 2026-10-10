import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
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

  describe('busy day', () => {
    let el: HTMLElement;
    const moreButton = () =>
      el.querySelector<HTMLButtonElement>('button[aria-expanded]')!;

    beforeEach(() => {
      fixture.componentRef.setInput('events', [
        event('One'),
        event('Two'),
        event('Three'),
      ]);
      fixture.detectChanges();
      el = fixture.nativeElement;
    });

    it('renders chips as labelled, focusable links', () => {
      const chip = el.querySelector<HTMLAnchorElement>('a[href="/update-project/1"]');
      expect(chip).not.toBeNull();
      expect(chip!.getAttribute('aria-label')).toBe('Apollo: One');
    });

    it('expands and collapses "+N more" with the keyboard-operable button', () => {
      expect(moreButton().textContent).toContain('+1 more');
      moreButton().click();
      fixture.detectChanges();
      expect(moreButton().getAttribute('aria-expanded')).toBe('true');
      expect(el.textContent).toContain('Three');

      moreButton().click();
      fixture.detectChanges();
      expect(moreButton().getAttribute('aria-expanded')).toBe('false');
    });

    it('closes the expanded day when the month changes', () => {
      moreButton().click();
      fixture.componentInstance.nextMonth();
      expect(fixture.componentInstance.expandedDate()).toBeNull();
    });

    it('ignores touch hover so a tap toggles the day open', () => {
      const calendar = fixture.componentInstance;
      const date = new Date();
      calendar.onMorePointerEnter({ pointerType: 'touch' } as PointerEvent, date);
      expect(calendar.expandedDate()).toBeNull();
      calendar.toggleDateExpansion(date);
      expect(calendar.expandedDate()).toEqual(date);
    });

    it('re-entering before the collapse delay keeps the day open', fakeAsync(() => {
      const calendar = fixture.componentInstance;
      calendar.onMorePointerEnter({ pointerType: 'mouse' } as PointerEvent, new Date());
      calendar.onMoreMouseLeave();
      calendar.cancelCollapse();
      tick(500);
      expect(calendar.expandedDate()).not.toBeNull();

      calendar.onMoreMouseLeave();
      tick(500);
      expect(calendar.expandedDate()).toBeNull();
    }));
  });
});
