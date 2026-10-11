import { titleCaseLabel } from '../format/labels';
import type { StatusMeta, StatusTone } from './project-status';

/** `operational` / `healthy` / `degraded` / anything else (down). */
export function healthMeta(status: string | null | undefined): StatusMeta {
  const label = titleCaseLabel(status) || 'Unknown';
  if (status === 'operational' || status === 'healthy') {
    return { label, icon: 'circle-check', tone: 'emerald' };
  }
  if (status === 'degraded') {
    return { label, icon: 'triangle-alert', tone: 'amber' };
  }
  return { label, icon: 'circle-x', tone: 'rose' };
}

const DELIVERY_META: Record<string, StatusMeta> = {
  sent: { label: 'Sent', icon: 'send', tone: 'emerald' },
  failed: { label: 'Failed', icon: 'circle-x', tone: 'rose' },
  skipped: { label: 'Skipped', icon: 'circle-dashed', tone: 'neutral' },
};

export function deliveryMeta(status: string | null | undefined): StatusMeta {
  return DELIVERY_META[status ?? ''] ?? DELIVERY_META['skipped'];
}

const METHOD_TONES: Record<string, StatusTone> = {
  GET: 'sky',
  POST: 'emerald',
  PUT: 'amber',
  PATCH: 'violet',
  DELETE: 'rose',
};

export function httpMethodTone(method: string | null | undefined): StatusTone {
  return METHOD_TONES[(method ?? '').toUpperCase()] ?? 'neutral';
}

export function httpStatusTone(status: number | null | undefined): StatusTone {
  const code = Number(status);
  if (code >= 200 && code < 300) return 'emerald';
  if (code >= 400 && code < 500) return 'amber';
  if (code >= 500) return 'rose';
  return 'neutral';
}
