import { DestroyRef, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

export const DEFAULT_LIST_PAGE_SIZE = 10;
export const MAX_LIST_QUERY_LENGTH = 256;

export interface ListQueryState {
  q: string;
  page: number;
}

export function parseListQueryParams(params: ParamMap): ListQueryState {
  const q = (params.get('q') ?? '').trim().slice(0, MAX_LIST_QUERY_LENGTH);
  const rawPage = Number(params.get('page') ?? '1');
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  return { q, page };
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
}

/**
 * Sync list search/page signals with URL ?q=&page= (TanStack useSearch analogue).
 */
export function bindListQuery(
  route: ActivatedRoute,
  router: Router,
  destroyRef: DestroyRef,
  searchTerm: WritableSignal<string>,
  page: WritableSignal<number>
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
    });

  const writeUrl = (q: string, nextPage: number) => {
    const safeQ = q.trim().slice(0, MAX_LIST_QUERY_LENGTH);
    void router.navigate([], {
      relativeTo: route,
      queryParams: {
        q: safeQ || null,
        page: nextPage > 1 ? nextPage : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  };

  return {
    setSearch: (term: string) => {
      const safe = term.trim().slice(0, MAX_LIST_QUERY_LENGTH);
      searchTerm.set(safe);
      writeUrl(safe, 1);
    },
    setPage: (nextPage: number) => {
      const safe = Math.max(1, Math.floor(nextPage) || 1);
      page.set(safe);
      writeUrl(searchTerm(), safe);
    },
  };
}
