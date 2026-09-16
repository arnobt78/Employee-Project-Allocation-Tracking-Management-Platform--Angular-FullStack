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

  it('parseListQueryParams reads role/etype/title/active/client extras', () => {
    const parsed = parseListQueryParams(
      convertToParamMap({
        role: '  Engineer  ',
        etype: ' Full-time ',
        title: ' Lead ',
        active: ' yes ',
        client: ' Acme ',
      })
    );
    expect(parsed.role).toBe('Engineer');
    expect(parsed.etype).toBe('Full-time');
    expect(parsed.title).toBe('Lead');
    expect(parsed.active).toBe('yes');
    expect(parsed.client).toBe('Acme');
  });

  it('setExtra writes dedicated query keys and clearFilters clears them', () => {
    const queryParamMap$ = new Subject();
    const navigateSpy = jasmine.createSpy('navigate').and.resolveTo(true);
    const route = {
      queryParamMap: queryParamMap$.asObservable(),
    } as never;
    const router = { navigate: navigateSpy } as unknown as Router;
    const destroyRef = {
      onDestroy: () => () => undefined,
    } as unknown as DestroyRef;
    const searchTerm = signal('');
    const page = signal(2);
    const filterValue = signal('');
    const role = signal('');
    const etype = signal('');
    const title = signal('');
    const active = signal('');
    const client = signal('');

    const ctrl = bindListQuery(
      route,
      router,
      destroyRef,
      searchTerm,
      page,
      filterValue,
      { role, etype, title, active, client }
    );

    ctrl.setExtra('client', '  Contoso  ');
    expect(client()).toBe('Contoso');
    expect(page()).toBe(1);
    let navArgs = navigateSpy.calls.mostRecent().args;
    expect(navArgs[1].queryParams.client).toBe('Contoso');
    expect(navArgs[1].queryParams.title).toBeNull();

    ctrl.setExtra('role', 'QA');
    ctrl.setExtra('etype', 'Contract');
    ctrl.setExtra('title', 'Designer');
    ctrl.setExtra('active', 'yes');
    navArgs = navigateSpy.calls.mostRecent().args;
    expect(navArgs[1].queryParams.role).toBe('QA');
    expect(navArgs[1].queryParams.etype).toBe('Contract');
    expect(navArgs[1].queryParams.title).toBe('Designer');
    expect(navArgs[1].queryParams.active).toBe('yes');

    ctrl.clearFilters();
    expect(role()).toBe('');
    expect(etype()).toBe('');
    expect(title()).toBe('');
    expect(active()).toBe('');
    expect(client()).toBe('');
    navArgs = navigateSpy.calls.mostRecent().args;
    expect(navArgs[1].queryParams.role).toBeNull();
    expect(navArgs[1].queryParams.etype).toBeNull();
    expect(navArgs[1].queryParams.title).toBeNull();
    expect(navArgs[1].queryParams.active).toBeNull();
    expect(navArgs[1].queryParams.client).toBeNull();
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
