import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MasterService } from '../../service/master.service';
import { CalendarViewComponent } from '../../components/calendar-view/calendar-view.component';
import { TimelineViewComponent } from '../../components/timeline-view/timeline-view.component';
import { GanttViewComponent } from '../../components/gantt-view/gantt-view.component';

export interface IScheduleData {
  milestones: IMilestone[];
  dueDates: IDueDate[];
  projectTimelines: IProjectTimeline[];
  upcomingReminders: IDueDate[];
  totalProjects: number;
  totalMilestones: number;
  totalDueDates: number;
}

export interface IMilestone {
  id: string;
  projectId: number;
  projectName: string;
  clientName: string;
  label: string;
  description: string;
  date: string;
  state: 'completed' | 'in-progress' | 'blocked' | 'upcoming';
  actorName: string;
  type: 'timeline' | 'milestone';
}

export interface IDueDate {
  id: string;
  projectId: number;
  projectName: string;
  label: string;
  description: string;
  dueDate: string;
  status?: string;
  ownerName?: string;
  type: 'timeline-due' | 'milestone-due' | 'readiness';
}

export interface IProjectTimeline {
  projectId: number;
  projectName: string;
  clientName: string;
  startDate: string;
  endDate: string | null;
  status: string;
  leadName: string;
  leadDepartment: string;
}

@Component({
  selector: 'app-calendar-timeline',
  standalone: true,
  imports: [
    CommonModule,
    CalendarViewComponent,
    TimelineViewComponent,
    GanttViewComponent,
  ],
  templateUrl: './calendar-timeline.component.html',
  styleUrls: ['./calendar-timeline.component.css'],
})
export class CalendarTimelineComponent implements OnInit {
  private readonly masterService = inject(MasterService);

  readonly scheduleDataSignal = signal<IScheduleData | null>(null);
  readonly scheduleData = this.scheduleDataSignal.asReadonly();
  readonly loadingSignal = signal<boolean>(false);
  readonly loading = this.loadingSignal.asReadonly();
  readonly activeTabSignal = signal<'calendar' | 'timeline' | 'gantt'>('calendar');
  readonly activeTab = this.activeTabSignal.asReadonly();

  // Computed values for calendar view
  readonly calendarEvents = computed(() => {
    const data = this.scheduleData();
    if (!data) return [];
    
    const events: Array<{
      id: string;
      title: string;
      date: Date;
      type: 'milestone' | 'due-date' | 'reminder';
      projectId: number;
      projectName: string;
      description: string;
      state?: string;
      status?: string;
    }> = [];

    // Add milestones
    data.milestones.forEach((milestone) => {
      const date = new Date(milestone.date);
      if (!isNaN(date.getTime())) {
        events.push({
          id: milestone.id,
          title: milestone.label,
          date: date,
          type: 'milestone',
          projectId: milestone.projectId,
          projectName: milestone.projectName,
          description: milestone.description || '',
          state: milestone.state,
        });
      }
    });

    // Add due dates
    data.dueDates.forEach((dueDate) => {
      const date = new Date(dueDate.dueDate);
      if (!isNaN(date.getTime())) {
        events.push({
          id: dueDate.id,
          title: dueDate.label,
          date: date,
          type: 'due-date',
          projectId: dueDate.projectId,
          projectName: dueDate.projectName,
          description: dueDate.description || '',
          status: dueDate.status,
        });
      }
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  // Computed values for timeline view
  readonly timelineProjects = computed(() => {
    const data = this.scheduleData();
    if (!data) return [];
    return data.projectTimelines;
  });

  // Computed values for Gantt view
  readonly ganttData = computed(() => {
    const data = this.scheduleData();
    if (!data) return [];
    return data.projectTimelines.map((project) => ({
      ...project,
      start: new Date(project.startDate),
      end: project.endDate ? new Date(project.endDate) : null,
      duration: project.endDate
        ? Math.ceil(
            (new Date(project.endDate).getTime() -
              new Date(project.startDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
    }));
  });

  // Computed upcoming reminders
  readonly upcomingReminders = computed(() => {
    const data = this.scheduleData();
    if (!data) return [];
    return data.upcomingReminders;
  });

  ngOnInit(): void {
    this.loadScheduleData();
  }

  loadScheduleData(): void {
    this.loadingSignal.set(true);
    this.masterService.getScheduleData().subscribe({
      next: (data: IScheduleData) => {
        this.scheduleDataSignal.set(data);
        this.loadingSignal.set(false);
      },
      error: (error) => {
        console.error('Error loading schedule data:', error);
        this.loadingSignal.set(false);
      },
    });
  }

  setActiveTab(tab: 'calendar' | 'timeline' | 'gantt'): void {
    this.activeTabSignal.set(tab);
  }

  getDaysUntilDue(dueDate: string): number {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  isOverdue(dueDate: string): boolean {
    return this.getDaysUntilDue(dueDate) < 0;
  }

  isDueSoon(dueDate: string): boolean {
    const daysUntil = this.getDaysUntilDue(dueDate);
    return daysUntil >= 0 && daysUntil <= 7;
  }
}

