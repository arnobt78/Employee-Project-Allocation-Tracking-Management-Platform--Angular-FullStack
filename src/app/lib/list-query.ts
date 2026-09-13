import { DestroyRef, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

export const DEFAULT_LIST_PAGE_SIZE = 10;
export const MAX_LIST_QUERY_LENGTH = 256;

export interface ListQueryState {
  q: string;
  page: number;
  f: string;
}

/** Single normalize path for signal + URL `?q=` (trim + length cap). */
export function normalizeListSearchQuery(term: string): string {
  return term.trim().slice(0, MAX_LIST_QUERY_LENGTH);
}

export function parseListQueryParams(params: ParamMap): ListQueryState {
  const q = normalizeListSearchQuery(params.get('q') ?? '');
  const f = normalizeListSearchQuery(params.get('f') ?? '');
  const rawPage = Number(params.get('page') ?? '1');
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  return { q, page, f };
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

export interface ListQueryController {
  setSearch: (term: string) => void;
  setPage: (page: number) => void;
  setFilter: (value: string) => void;
  clearFilters: () => void;
}

/**
 * Sync list search/page/filter signals with URL ?q=&page=&f=
 */
export function bindListQuery(
  route: ActivatedRoute,
  router: Router,
  destroyRef: DestroyRef,
  searchTerm: WritableSignal<string>,
  page: WritableSignal<number>,
  filterValue?: WritableSignal<string>
): ListQueryController {
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
      if (filterValue && filterValue() !== parsed.f) {
        filterValue.set(parsed.f);
      }
    });

  const writeUrl = (q: string, nextPage: number, f: string) => {
    const safeQ = normalizeListSearchQuery(q);
    const safeF = normalizeListSearchQuery(f);
    void router.navigate([], {
      relativeTo: route,
      queryParams: {
        q: safeQ || null,
        page: nextPage > 1 ? nextPage : null,
        f: safeF || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  };

  const currentFilter = () => filterValue?.() ?? '';

  return {
    setSearch: (term: string) => {
      const safe = normalizeListSearchQuery(term);
      searchTerm.set(safe);
      page.set(1);
      writeUrl(safe, 1, currentFilter());
    },
    setPage: (nextPage: number) => {
      const safe = Math.max(1, Math.floor(nextPage) || 1);
      page.set(safe);
      writeUrl(searchTerm(), safe, currentFilter());
    },
    setFilter: (value: string) => {
      const safe = normalizeListSearchQuery(value);
      filterValue?.set(safe);
      page.set(1);
      writeUrl(searchTerm(), 1, safe);
    },
    clearFilters: () => {
      searchTerm.set('');
      filterValue?.set('');
      page.set(1);
      writeUrl('', 1, '');
    },
  };
}
