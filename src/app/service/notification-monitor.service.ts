import { Injectable, inject } from '@angular/core';
import { EMPTY, Subject, catchError, merge, mergeMap, switchMap, tap, timer } from 'rxjs';
import { ToastService } from '../components/ui/toast.service';
import { MutationTracker } from '../lib/mutation-tracker';
import { INotificationLogEntry } from '../model/interface/master';
import { AuthService } from './auth.service';
import { MasterService } from './master.service';

/**
 * Emails are sent after the mutation responds. Resend fails within ~1 s; an
 * SMTP fallback can take up to its connection timeout (8 s) plus send time.
 */
export const FAILURE_CHECK_DELAYS_MS = [6_000, 15_000, 30_000] as const;
/** Tolerates client/server clock skew when asking for failures "since now". */
const CLOCK_SKEW_MS = 10_000;
const MAX_REMEMBERED_IDS = 200;

/**
 * Surfaces background email failures: after tracked mutations, polls
 * `GetNotificationFailures` and shows one error toast per new failure batch.
 * A burst of mutations shares one schedule (restarted by the latest mutation,
 * querying from the earliest). Silent when there are none.
 */
@Injectable({ providedIn: 'root' })
export class NotificationMonitorService {
  private readonly master = inject(MasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly tracker = inject(MutationTracker);
  private readonly mutations = new Subject<void>();
  private readonly reported = new Set<string>();
  private windowStart: string | null = null;
  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.mutations
      .pipe(
        tap(() => {
          this.windowStart ??= new Date(Date.now() - CLOCK_SKEW_MS).toISOString();
        }),
        switchMap(() => {
          const since = this.windowStart as string;
          return merge(...FAILURE_CHECK_DELAYS_MS.map((delay) => timer(delay))).pipe(
            mergeMap(() => this.checkSince(since)),
            tap({ complete: () => (this.windowStart = null) })
          );
        })
      )
      .subscribe((failures) => this.report(failures));
    this.tracker.onMutationSuccess(() => this.mutations.next());
  }

  private checkSince(since: string) {
    if (!this.auth.isAuthenticated()) {
      return EMPTY;
    }
    return this.master.getNotificationFailures(since).pipe(catchError(() => EMPTY));
  }

  private report(failures: INotificationLogEntry[]): void {
    const fresh = failures.filter((failure) => !this.reported.has(failure.id));
    if (!fresh.length) {
      return;
    }
    if (this.reported.size > MAX_REMEMBERED_IDS) {
      this.reported.clear();
    }
    fresh.forEach((failure) => this.reported.add(failure.id));

    const recipients = fresh.reduce((sum, failure) => sum + failure.recipientCount, 0);
    this.toast.error({
      title: fresh.length === 1 ? 'Email delivery failed' : `${fresh.length} email deliveries failed`,
      description: `Email to ${recipients} recipient${recipients === 1 ? '' : 's'} failed. See API Status → Recent email deliveries.`,
      duration: 8000,
    });
  }
}
