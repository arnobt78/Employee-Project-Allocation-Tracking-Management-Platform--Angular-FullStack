import { DestroyRef, signal } from '@angular/core';
import { convertToParamMap, Router } from '@angular/router';
import { Subject } from 'rxjs';
import {
  bindListQuery,
  normalizeListSearchQuery,
  parseListQueryParams,
  paginateList,
} from './list-query';

describe('list-query', () => {
  it('normalizeListSearchQuery trims whitespace and caps length', () => {
    expect(normalizeListSearchQuery('  hello  ')).toBe('hello');
    expect(normalizeListSearchQuery('   ')).toBe('');
    expect(normalizeListSearchQuery('a'.repeat(300)).length).toBe(256);
  });

  it('parseListQueryParams trims q the same way as the signal path', () => {
    const parsed = parseListQueryParams(
      convertToParamMap({ q: '  team lead  ', page: '2', f: '  Engineering  ' })
    );
    expect(parsed.q).toBe('team lead');
    expect(parsed.page).toBe(2);
    expect(parsed.f).toBe('Engineering');
  });

  it('parseListQueryParams caps f length like q', () => {
    const parsed = parseListQueryParams(
      convertToParamMap({ f: 'x'.repeat(300) })
    );
    expect(parsed.f.length).toBe(256);
  });

  it('paginateList clamps page within bounds', () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginateList(items, 1, 2)).toEqual({
      items: [1, 2],
      totalPages: 3,
      page: 1,
    });
    expect(paginateList(items, 99, 2).page).toBe(3);
  });

  it('setSearch stores trimmed term in the signal and URL navigate args', () => {
    const queryParamMap$ = new Subject();
    const navigateSpy = jasmine.createSpy('navigate').and.resolveTo(true);
    const route = {
      queryParamMap: queryParamMap$.asObservable(),
    } as never;
    const router = { navigate: navigateSpy } as unknown as Router;
    const destroyRef = {
      onDestroy: () => () => undefined,
    } as unknown as DestroyRef;
    const searchTerm = signal('initial');
    const page = signal(3);

    const ctrl = bindListQuery(
      route,
      router,
      destroyRef,
      searchTerm,
      page
    );

    ctrl.setSearch('  aurora  ');

    expect(searchTerm()).toBe('aurora');
    expect(navigateSpy).toHaveBeenCalled();
    const navArgs = navigateSpy.calls.mostRecent().args;
    expect(navArgs[1].queryParams.q).toBe('aurora');
    expect(navArgs[1].queryParams.page).toBeNull();
    expect(navArgs[1].queryParams.f).toBeNull();
  });

  it('setFilter and clearFilters sync f and reset page', () => {
    const queryParamMap$ = new Subject();
    const navigateSpy = jasmine.createSpy('navigate').and.resolveTo(true);
    const route = {
      queryParamMap: queryParamMap$.asObservable(),
    } as never;
    const router = { navigate: navigateSpy } as unknown as Router;
    const destroyRef = {
      onDestroy: () => () => undefined,
    } as unknown as DestroyRef;
    const searchTerm = signal('kept');
    const page = signal(4);
    const filterValue = signal('');

    const ctrl = bindListQuery(
      route,
      router,
      destroyRef,
      searchTerm,
      page,
      filterValue
    );

    ctrl.setFilter('  Active  ');
    expect(filterValue()).toBe('Active');
    expect(page()).toBe(1);
    let navArgs = navigateSpy.calls.mostRecent().args;
    expect(navArgs[1].queryParams.f).toBe('Active');
    expect(navArgs[1].queryParams.q).toBe('kept');
    expect(navArgs[1].queryParams.page).toBeNull();

    ctrl.clearFilters();
    expect(searchTerm()).toBe('');
    expect(filterValue()).toBe('');
    expect(page()).toBe(1);
    navArgs = navigateSpy.calls.mostRecent().args;
    expect(navArgs[1].queryParams.q).toBeNull();
    expect(navArgs[1].queryParams.f).toBeNull();
    expect(navArgs[1].queryParams.page).toBeNull();
  });
});
