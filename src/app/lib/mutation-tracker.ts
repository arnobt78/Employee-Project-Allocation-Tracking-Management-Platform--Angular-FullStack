import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Observable, Subscription, finalize } from 'rxjs';
import { ToastOptions, ToastService } from '../components/ui/toast.service';

type ToastMessage = Omit<ToastOptions, 'status'>;

/** Per-key pending state so one row's mutation never locks the others. */
export class PendingSet<K = string> {
  private readonly keys = signal<ReadonlySet<K>>(new Set());

  has(key: K): boolean {
    return this.keys().has(key);
  }

  some(predicate: (key: K) => boolean): boolean {
    return [...this.keys()].some(predicate);
  }

  add(key: K): void {
    this.keys.update((keys) => new Set(keys).add(key));
  }

  delete(key: K): void {
    this.keys.update((keys) => {
      const next = new Set(keys);
      next.delete(key);
      return next;
    });
  }
}

export interface TrackOptions<T, K> {
  pending: PendingSet<K>;
  key: K;
  /** Apply the authoritative server response to local state. */
  onSuccess?: (value: T) => void;
  /** Restore local state after a failure. */
  onError?: (error: unknown) => void;
  successToast?: ToastMessage | ((value: T) => ToastMessage);
  errorToast: ToastMessage;
  /** Skip `onSuccess`/`onError` once the owning view is gone (e.g. no navigation after leaving). */
  destroyRef?: DestroyRef;
}

/**
 * One lifecycle for every CRUD action: mark pending → request → apply the
 * response → toast → clear pending. Pending ends as soon as the response is
 * applied; list revalidation happens separately and never holds the spinner.
 */
@Injectable({ providedIn: 'root' })
export class MutationTracker {
  private readonly toast = inject(ToastService);
  private readonly listeners = new Set<() => void>();

  /** Called after every successful mutation (e.g. to watch for email failures). */
  onMutationSuccess(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  track<T, K>(
    request$: Observable<T>,
    options: TrackOptions<T, K>
  ): Subscription | null {
    const { pending, key } = options;
    if (pending.has(key)) {
      return null;
    }
    let destroyed = false;
    options.destroyRef?.onDestroy(() => (destroyed = true));
    pending.add(key);
    return request$.pipe(finalize(() => pending.delete(key))).subscribe({
      next: (value) => {
        try {
          if (!destroyed) {
            options.onSuccess?.(value);
          }
        } finally {
          pending.delete(key);
        }
        const success =
          typeof options.successToast === 'function'
            ? options.successToast(value)
            : options.successToast;
        if (success) {
          this.toast.success(success);
        }
        this.listeners.forEach((listener) => listener());
      },
      error: (error: unknown) => {
        if (!destroyed) {
          options.onError?.(error);
        }
        const reason = clientErrorMessage(error);
        this.toast.error(
          reason ? { ...options.errorToast, description: reason } : options.errorToast
        );
      },
    });
  }
}

/** A 4xx response's `{ message }` explains what to fix (e.g. a 409 conflict); 5xx bodies are not shown. */
export function clientErrorMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status < 400 || error.status >= 500) {
    return null;
  }
  const message = (error.error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}
