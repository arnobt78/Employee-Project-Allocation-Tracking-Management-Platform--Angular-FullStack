import { ApiHttpMethod } from '@/app/model/interface/master';

/** Static API Documentation copy shared by the live page and its loading mirror. */
export const API_DOC_METHOD_TABS: readonly ApiHttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
];

export const API_DOC_TAB_ACTIVE_CLASS =
  'border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary';
export const API_DOC_TAB_IDLE_CLASS =
  'px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white';

export const API_DOC_CHIP_ACTIVE_CLASS =
  'rounded-full border border-primary bg-primary/20 px-3 py-1 text-xs font-medium text-primary';
export const API_DOC_CHIP_IDLE_CLASS =
  'rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white';

export const API_DOC_COPY = {
  versionPill: 'Version',
  baseUrl: 'Base URL:',
  version: 'Version:',
  allCategories: 'All Categories',
  copyUrl: '📋 Copy URL',
} as const;
