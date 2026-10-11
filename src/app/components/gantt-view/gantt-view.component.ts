import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { UserAvatarComponent } from '@/app/components/ui/user-avatar.component';
import type { IProjectTimeline } from '@/app/components/timeline-view/timeline-view.component';
import { employeeAvatar, type AvatarView } from '@/app/lib/media/employee-avatar';
import {
  STATUS_LEGEND,
  STATUS_TONE_FILL,
  projectStatusMeta,
  type StatusMeta,
} from '@/app/lib/status/project-status';

export interface IGanttProject extends IProjectTimeline {
  start: Date;
  end: Date | null;
  duration: number | null;
}

interface ProjectPosition {
  left: number;
  width: number;
}

interface GanttRow {
  project: IGanttProject;
  status: StatusMeta;
  fill: string;
  lead: AvatarView | null;
}

@Component({
  selector: 'app-gantt-view',
  standalone: true,
  imports: [CommonModule, AppIconComponent, UserAvatarComponent],
  templateUrl: './gantt-view.component.html',
  styleUrls: ['./gantt-view.component.css'],
})
export class GanttViewComponent {
  private readonly router = inject(Router);

  readonly projects = input<IGanttProject[]>([]);
  readonly legend = STATUS_LEGEND;
  readonly toneFill = STATUS_TONE_FILL;

  showTooltip: number | null = null;
  tooltipPosition = { left: 0, top: 0 };

  readonly rows = computed<GanttRow[]>(() =>
    [...this.projects()]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((project) => {
        const status = projectStatusMeta(project.status);
        return {
          project,
          status,
          fill: STATUS_TONE_FILL[status.tone],
          lead: project.leadName
            ? employeeAvatar({
                employeeName: project.leadName,
                emailId: project.leadEmail || null,
                avatarUrl: project.leadAvatarUrl ?? null,
              })
            : null,
        };
      })
  );

  readonly dateRange = computed(() => {
    const projects = this.projects();
    if (projects.length === 0) {
      return { min: new Date(), max: new Date() };
    }

    // Include all dates including future ones
    const dates: Date[] = [];
    const now = new Date();
    
    projects.forEach((p) => {
      dates.push(p.start);
      if (p.end) {
        dates.push(p.end);
      } else {
        // For projects without end date, use start date + duration or current date, whichever is later
        const endDate = new Date(p.start);
        endDate.setMonth(endDate.getMonth() + 6); // Default 6 months if no end date
        dates.push(endDate > now ? endDate : now);
      }
    });

    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    
    // Add some padding to ensure future projects are visible
    const padding = (max.getTime() - min.getTime()) * 0.1; // 10% padding
    max.setTime(max.getTime() + padding);

    return { min, max };
  });

  readonly totalDays = computed(() => {
    const range = this.dateRange();
    const days = Math.ceil(
      (range.max.getTime() - range.min.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(days, 1); // Ensure at least 1 day
  });

  // Pre-calculate positions to avoid change detection issues
  readonly projectPositions = computed(() => {
    const range = this.dateRange();
    const totalDays = this.totalDays();
    const positions = new Map<number, ProjectPosition>();

    this.projects().forEach((project) => {
      const daysFromStart =
        (project.start.getTime() - range.min.getTime()) / (1000 * 60 * 60 * 24);
      const left = Math.max(0, (daysFromStart / totalDays) * 100);

      // Calculate actual duration
      const end = project.end || new Date();
      const duration = Math.ceil(
        (end.getTime() - project.start.getTime()) / (1000 * 60 * 60 * 24)
      );

      const widthPercent = (duration / totalDays) * 100;
      const maxWidth = 100 - left;
      const width = Math.max(Math.min(widthPercent, maxWidth), 2);

      positions.set(project.projectId, { left, width });
    });

    return positions;
  });

  getProjectLeft(project: IGanttProject): number {
    const positions = this.projectPositions();
    const pos = positions.get(project.projectId);
    return pos?.left ?? 0;
  }

  getProjectWidth(project: IGanttProject): number {
    const positions = this.projectPositions();
    const pos = positions.get(project.projectId);
    return pos?.width ?? 2;
  }

  getProjectDuration(project: IGanttProject): number {
    const end = project.end || new Date();
    return Math.ceil(
      (end.getTime() - project.start.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  getDurationDisplay(project: IGanttProject): string {
    const start = new Date(project.start);
    const now = new Date();
    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    
    const daysUntilStart = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilStart > 0) {
      return `Starts in ${daysUntilStart} day${daysUntilStart !== 1 ? 's' : ''}`;
    }
    
    const duration = this.getProjectDuration(project);
    return `${duration} day${duration !== 1 ? 's' : ''}`;
  }

  navigateToProject(projectId: number): void {
    this.router.navigate(['/update-project', projectId]);
  }

  updateTooltipPosition(project: IGanttProject, _event?: MouseEvent): void {
    if (typeof document === 'undefined') return;
    
    setTimeout(() => {
      const barElement = document.querySelector(`[data-project-id="${project.projectId}"]`) as HTMLElement;
      if (barElement) {
        const rect = barElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const tooltipWidth = 280;
        const tooltipHeight = 200;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 10;
        
        // Calculate horizontal position
        let left = centerX;
        if (centerX - tooltipWidth / 2 < padding) {
          left = tooltipWidth / 2 + padding;
        } else if (centerX + tooltipWidth / 2 > viewportWidth - padding) {
          left = viewportWidth - tooltipWidth / 2 - padding;
        }
        
        // Calculate vertical position (prefer above, fallback to below)
        // Position closer to the bar (reduce gap from 12px to 4px)
        let top = rect.top - tooltipHeight - 4;
        if (top < padding) {
          top = rect.bottom + 4;
          // If still doesn't fit below, center it vertically
          if (top + tooltipHeight > viewportHeight - padding) {
            top = Math.max(padding, (viewportHeight - tooltipHeight) / 2);
          }
        }
        
        this.tooltipPosition = { left, top };
      }
    }, 0);
  }

  readonly monthLabels = computed(() => this.getMonthLabels());

  private getMonthLabels(): Array<{ month: string; year: string; position: number }> {
    const range = this.dateRange();
    const labels: Array<{ month: string; year: string; position: number }> = [];
    const current = new Date(range.min);
    current.setDate(1); // Start from first day of month
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const totalDays = this.totalDays();
    const maxDate = new Date(range.max);
    maxDate.setMonth(maxDate.getMonth() + 1); // Include next month

    while (current <= maxDate) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const daysFromStart =
        (monthStart.getTime() - range.min.getTime()) / (1000 * 60 * 60 * 24);
      const position = totalDays > 0 ? (daysFromStart / totalDays) * 100 : 0;

      // Only add label if it's within reasonable bounds
      if (position >= -5 && position <= 105) {
        labels.push({
          month: monthNames[current.getMonth()],
          year: current.getFullYear().toString(),
          position: Math.max(0, Math.min(100, position)),
        });
      }

      current.setMonth(current.getMonth() + 1);
    }

    return labels;
  }
}

