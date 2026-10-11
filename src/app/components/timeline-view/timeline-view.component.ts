import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { UserAvatarComponent } from '@/app/components/ui/user-avatar.component';
import { employeeAvatar, type AvatarView } from '@/app/lib/media/employee-avatar';
import {
  BADGE_TONE_CLASS,
  STATUS_TONE_BORDER,
  STATUS_TONE_FILL,
  projectStatusMeta,
  type StatusMeta,
} from '@/app/lib/status/project-status';

export interface IProjectTimeline {
  projectId: number;
  projectName: string;
  clientName: string;
  startDate: string;
  endDate: string | null;
  status: string;
  leadName: string;
  leadDepartment: string;
  leadEmail?: string;
  leadAvatarUrl?: string | null;
}

interface TimelineRow {
  project: IProjectTimeline;
  status: StatusMeta;
  fill: string;
  border: string;
  lead: AvatarView | null;
  position: number;
  width: number;
  duration: string;
}

const DAY_MS = 1000 * 60 * 60 * 24;

@Component({
  selector: 'app-timeline-view',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, UserAvatarComponent],
  templateUrl: './timeline-view.component.html',
  styleUrls: ['./timeline-view.component.css'],
})
export class TimelineViewComponent {
  readonly projects = input<IProjectTimeline[]>([]);
  readonly badgeTone = BADGE_TONE_CLASS;

  readonly dateRange = computed(() => {
    const projects = this.projects();
    if (projects.length === 0) {
      return { min: new Date(), max: new Date() };
    }
    const times = projects.flatMap((p) => [
      new Date(p.startDate).getTime(),
      p.endDate ? new Date(p.endDate).getTime() : Date.now(),
    ]);
    return { min: new Date(Math.min(...times)), max: new Date(Math.max(...times)) };
  });

  /** One pass per data change; the template never recomputes positions or colours. */
  readonly rows = computed<TimelineRow[]>(() => {
    const { min, max } = this.dateRange();
    const totalDays = (max.getTime() - min.getTime()) / DAY_MS;
    return [...this.projects()]
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .map((project) => {
        const status = projectStatusMeta(project.status);
        const position = this.position(project, min, totalDays);
        const width =
          totalDays > 0
            ? Math.min((Math.max(0, this.durationDays(project)) / totalDays) * 100, 100 - position)
            : 0;
        return {
          project,
          status,
          fill: STATUS_TONE_FILL[status.tone],
          border: STATUS_TONE_BORDER[status.tone],
          lead: project.leadName
            ? employeeAvatar({
                employeeName: project.leadName,
                emailId: project.leadEmail || null,
                avatarUrl: project.leadAvatarUrl ?? null,
              })
            : null,
          position,
          width,
          duration: this.durationLabel(project),
        };
      });
  });

  private position(project: IProjectTimeline, min: Date, totalDays: number): number {
    if (totalDays <= 0) return 0;
    const daysFromStart = (new Date(project.startDate).getTime() - min.getTime()) / DAY_MS;
    return Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100));
  }

  private durationDays(project: IProjectTimeline): number {
    const end = project.endDate ? new Date(project.endDate) : new Date();
    return Math.ceil((end.getTime() - new Date(project.startDate).getTime()) / DAY_MS);
  }

  private durationLabel(project: IProjectTimeline): string {
    const start = new Date(project.startDate);
    const today = new Date();
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const daysUntilStart = Math.ceil((start.getTime() - today.getTime()) / DAY_MS);
    if (daysUntilStart > 0) {
      return `Starts in ${daysUntilStart} day${daysUntilStart !== 1 ? 's' : ''}`;
    }
    const duration = Math.max(0, this.durationDays(project));
    return `${duration} day${duration !== 1 ? 's' : ''}`;
  }
}
