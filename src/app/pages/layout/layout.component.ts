import {
  Component,
  DestroyRef,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellContentState } from '@/app/service/shell-content.state';
import { AuthService } from '@/app/service/auth.service';
import { ListCacheKey, MasterService } from '@/app/service/master.service';

/** Lists behind the main nav pages; warmed after first paint so they open from cache. */
const WARM_LISTS: readonly ListCacheKey[] = ['employees', 'projects', 'assignments'];
const IDLE_FALLBACK_MS = 1500;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export class LayoutComponent implements OnDestroy {
  private readonly shellContent = inject(ShellContentState);
  private readonly auth = inject(AuthService);
  private readonly master = inject(MasterService);
  private readonly destroyRef = inject(DestroyRef);
  readonly childActive = signal(false);

  constructor() {
    afterNextRender(() => this.scheduleWarmUp());
  }

  ngOnDestroy(): void {
    this.shellContent.childActive.set(false);
    this.childActive.set(false);
  }

  onChildActivate(): void {
    this.childActive.set(true);
    this.shellContent.childActive.set(true);
  }

  onChildDeactivate(): void {
    this.childActive.set(false);
    this.shellContent.childActive.set(false);
  }

  private scheduleWarmUp(): void {
    const warm = () => {
      if (this.auth.isAuthenticated()) {
        this.master.warmLists(WARM_LISTS);
      }
    };
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(warm, { timeout: IDLE_FALLBACK_MS * 2 });
      this.destroyRef.onDestroy(() => cancelIdleCallback(handle));
    } else {
      const handle = setTimeout(warm, IDLE_FALLBACK_MS);
      this.destroyRef.onDestroy(() => clearTimeout(handle));
    }
  }
}
