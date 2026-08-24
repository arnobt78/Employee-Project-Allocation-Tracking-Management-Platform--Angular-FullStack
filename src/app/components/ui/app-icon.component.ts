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
  Check,
  Download,
  Eraser,
  ExternalLink,
  FileDown,
  FileText,
  LifeBuoy,
  LoaderCircle,
  LogOut,
  MessageSquarePlus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  UserPlus,
  WandSparkles,
  X,
} from 'lucide-angular';

const ICON_REGISTRY: Record<string, LucideIconData> = {
  activity: Activity,
  check: Check,
  download: Download,
  eraser: Eraser,
  'external-link': ExternalLink,
  'file-down': FileDown,
  'file-text': FileText,
  'life-buoy': LifeBuoy,
  'loader-circle': LoaderCircle,
  'log-out': LogOut,
  'message-square-plus': MessageSquarePlus,
  pencil: Pencil,
  plus: Plus,
  'rotate-ccw': RotateCcw,
  save: Save,
  sparkles: Sparkles,
  'trash-2': Trash2,
  'user-plus': UserPlus,
  'wand-sparkles': WandSparkles,
  x: X,
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
