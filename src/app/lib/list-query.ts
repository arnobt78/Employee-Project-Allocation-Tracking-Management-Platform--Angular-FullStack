import { DestroyRef, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

export const DEFAULT_LIST_PAGE_SIZE = 10;
export const MAX_LIST_QUERY_LENGTH = 256;

export interface ListQueryState {
  q: string;
  page: number;
  f: string;
  role: string;
  etype: string;
  title: string;
  active: string;
  client: string;
}

/** Single normalize path for signal + URL `?q=` (trim + length cap). */
export function normalizeListSearchQuery(term: string): string {
  return term.trim().slice(0, MAX_LIST_QUERY_LENGTH);
}

export function parseListQueryParams(params: ParamMap): ListQueryState {
  const q = normalizeListSearchQuery(params.get('q') ?? '');
  const f = normalizeListSearchQuery(params.get('f') ?? '');
  const role = normalizeListSearchQuery(params.get('role') ?? '');
  const etype = normalizeListSearchQuery(params.get('etype') ?? '');
  const title = normalizeListSearchQuery(params.get('title') ?? '');
  const active = normalizeListSearchQuery(params.get('active') ?? '');
  const client = normalizeListSearchQuery(params.get('client') ?? '');
  const rawPage = Number(params.get('page') ?? '1');
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  return { q, page, f, role, etype, title, active, client };
}

export function paginateList<T>(
  items: readonly T[],
  page: number,
  pageSize = DEFAULT_LIST_PAGE_SIZE
): { items: T[]; totalPages: number; page: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    page: safePage,
  };
}

export interface ListQueryExtraSignals {
  role?: WritableSignal<string>;
  etype?: WritableSignal<string>;
  title?: WritableSignal<string>;
  active?: WritableSignal<string>;
  client?: WritableSignal<string>;
}

export interface ListQueryController {
  setSearch: (term: string) => void;
  setPage: (page: number) => void;
  setFilter: (value: string) => void;
  setExtra: (key: keyof ListQueryExtraSignals, value: string) => void;
  clearFilters: () => void;
}

type ListQuerySnapshot = {
  q: string;
  f: string;
  role: string;
  etype: string;
  title: string;
  active: string;
  client: string;
};

/**
 * Sync list search/page/filter signals with URL
 * `?q=&page=&f=&role=&etype=&title=&active=&client=`
 */
export function bindListQuery(
  route: ActivatedRoute,
  router: Router,
  destroyRef: DestroyRef,
  searchTerm: WritableSignal<string>,
  page: WritableSignal<number>,
  filterValue?: WritableSignal<string>,
  extras?: ListQueryExtraSignals
): ListQueryController {
  const syncSignal = (
    signal: WritableSignal<string> | undefined,
    next: string
  ) => {
    if (signal && signal() !== next) {
      signal.set(next);
    }
  };

  route.queryParamMap
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe((params) => {
      const parsed = parseListQueryParams(params);
      if (searchTerm() !== parsed.q) {
        searchTerm.set(parsed.q);
      }
      if (page() !== parsed.page) {
        page.set(parsed.page);
      }
      syncSignal(filterValue, parsed.f);
      syncSignal(extras?.role, parsed.role);
      syncSignal(extras?.etype, parsed.etype);
      syncSignal(extras?.title, parsed.title);
      syncSignal(extras?.active, parsed.active);
      syncSignal(extras?.client, parsed.client);
    });

  const writeUrl = (s: ListQuerySnapshot, nextPage: number) => {
    void router.navigate([], {
      relativeTo: route,
      queryParams: {
        q: normalizeListSearchQuery(s.q) || null,
        page: nextPage > 1 ? nextPage : null,
        f: normalizeListSearchQuery(s.f) || null,
        role: normalizeListSearchQuery(s.role) || null,
        etype: normalizeListSearchQuery(s.etype) || null,
        title: normalizeListSearchQuery(s.title) || null,
        active: normalizeListSearchQuery(s.active) || null,
        client: normalizeListSearchQuery(s.client) || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  };

  const snapshot = (): ListQuerySnapshot => ({
    q: searchTerm(),
    f: filterValue?.() ?? '',
    role: extras?.role?.() ?? '',
    etype: extras?.etype?.() ?? '',
    title: extras?.title?.() ?? '',
    active: extras?.active?.() ?? '',
    client: extras?.client?.() ?? '',
  });

  return {
    setSearch: (term: string) => {
      const safe = normalizeListSearchQuery(term);
      searchTerm.set(safe);
      page.set(1);
      writeUrl({ ...snapshot(), q: safe }, 1);
    },
    setPage: (nextPage: number) => {
      const safe = Math.max(1, Math.floor(nextPage) || 1);
      page.set(safe);
      writeUrl(snapshot(), safe);
    },
    setFilter: (value: string) => {
      const safe = normalizeListSearchQuery(value);
      filterValue?.set(safe);
      page.set(1);
      writeUrl({ ...snapshot(), f: safe }, 1);
    },
    setExtra: (key, value) => {
      const safe = normalizeListSearchQuery(value);
      extras?.[key]?.set(safe);
      page.set(1);
      writeUrl({ ...snapshot(), [key]: safe }, 1);
    },
    clearFilters: () => {
      searchTerm.set('');
      filterValue?.set('');
      extras?.role?.set('');
      extras?.etype?.set('');
      extras?.title?.set('');
      extras?.active?.set('');
      extras?.client?.set('');
      page.set(1);
      writeUrl(
        { q: '', f: '', role: '', etype: '', title: '', active: '', client: '' },
        1
      );
    },
  };
}
