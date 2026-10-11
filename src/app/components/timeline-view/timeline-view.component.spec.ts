import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { IProjectTimeline, TimelineViewComponent } from './timeline-view.component';
import { UserAvatarComponent } from '@/app/components/ui/user-avatar.component';

describe('TimelineViewComponent', () => {
  const projects: IProjectTimeline[] = [
    {
      projectId: 1,
      projectName: 'Aurora',
      clientName: 'Aurora Inc',
      startDate: '2026-01-01',
      endDate: '2026-03-01',
      status: 'on_hold',
      leadName: 'Ava Stone',
      leadDepartment: 'Design',
      leadEmail: 'ava@example.com',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineViewComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('shows Title Case status badges and a lead avatar seeded by email', () => {
    const fixture = TestBed.createComponent(TimelineViewComponent);
    fixture.componentRef.setInput('projects', projects);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const badges = Array.from(el.querySelectorAll('.eh-badge')).map((b) => b.textContent?.trim());
    expect(badges).toContain('On Hold');
    expect(el.textContent).not.toContain('on_hold');

    const seeds = fixture.debugElement
      .queryAll(By.directive(UserAvatarComponent))
      .map((node) => (node.componentInstance as UserAvatarComponent).seed);
    expect(seeds).toContain('ava@example.com');
  });
});
