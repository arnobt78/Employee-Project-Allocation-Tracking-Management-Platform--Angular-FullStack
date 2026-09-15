import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  inject,
} from '@angular/core';
import type { LucideIconData } from 'lucide-angular';
import {
  Activity,
  Archive,
  Building2,
  Calendar,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Compass,
  Contact,
  Download,
  Eraser,
  ExternalLink,
  FileDown,
  FileText,
  Filter,
  FolderGit2,
  FolderKanban,
  FolderOpen,
  GitPullRequest,
  Infinity as InfinityIcon,
  Info,
  LifeBuoy,
  Link,
  Loader,
  LoaderCircle,
  LogOut,
  LayoutDashboard,
  ListFilter,
  Menu,
  ChartColumn,
  Copy,
  CopyCheck,
  MessageSquarePlus,
  OctagonAlert,
  PanelRight,
  PauseCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldUser,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
  Unlink,
  User,
  UserPlus,
  UserX,
  Users,
  WandSparkles,
  X,
  Zap,
} from 'lucide-angular';

const ICON_REGISTRY: Record<string, LucideIconData> = {
  activity: Activity,
  archive: Archive,
  'building-2': Building2,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  'calendar-range': CalendarRange,
  check: Check,
  'check-circle': CircleCheck,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  circle: Circle,
  'circle-check': CircleCheck,
  'circle-dashed': CircleDashed,
  'circle-dot': CircleDot,
  compass: Compass,
  contact: Contact,
  download: Download,
  eraser: Eraser,
  'external-link': ExternalLink,
  'file-down': FileDown,
  'file-text': FileText,
  filter: Filter,
  'folder-git-2': FolderGit2,
  'folder-kanban': FolderKanban,
  'folder-open': FolderOpen,
  'git-pull-request': GitPullRequest,
  infinity: InfinityIcon,
  info: Info,
  'life-buoy': LifeBuoy,
  link: Link,
  loader: Loader,
  'loader-circle': LoaderCircle,
  'log-out': LogOut,
  'layout-dashboard': LayoutDashboard,
  'list-filter': ListFilter,
  menu: Menu,
  'chart-column': ChartColumn,
  copy: Copy,
  'copy-check': CopyCheck,
  'message-square-plus': MessageSquarePlus,
  'octagon-alert': OctagonAlert,
  'panel-right': PanelRight,
  'pause-circle': PauseCircle,
  pencil: Pencil,
  plus: Plus,
  'rotate-ccw': RotateCcw,
  save: Save,
  search: Search,
  settings: Settings,
  'shield-user': ShieldUser,
  siren: Siren,
  'sliders-horizontal': SlidersHorizontal,
  sparkles: Sparkles,
  'trash-2': Trash2,
  'triangle-alert': TriangleAlert,
  unlink: Unlink,
  user: User,
  'user-plus': UserPlus,
  'user-x': UserX,
  users: Users,
  'wand-sparkles': WandSparkles,
  x: X,
  zap: Zap,
};

/** Standalone Lucide renderer (lucide-angular's NgModule component is not importable in Angular 20 standalone). */
@Component({
  selector: 'app-icon, lucide-icon',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0',
    '[attr.aria-hidden]': 'true',
  },
})
export class AppIconComponent implements OnChanges {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input() name = '';
  @Input() size = 16;
  @Input() strokeWidth = 2;

  ngOnChanges(): void {
    this.render();
  }

  private render(): void {
    const icon = ICON_REGISTRY[this.name];
    const el = this.host.nativeElement;
    el.replaceChildren();
    if (!icon) {
      return;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(this.size));
    svg.setAttribute('height', String(this.size));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', String(this.strokeWidth));
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.display = 'block';

    for (const [tag, attrs] of icon) {
      const child = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (key === 'key') {
          continue;
        }
        child.setAttribute(key, String(value));
      }
      svg.appendChild(child);
    }

    el.appendChild(svg);
  }
}
