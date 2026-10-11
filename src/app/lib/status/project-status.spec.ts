import { projectStatusMeta } from './project-status';
import { deliveryMeta, healthMeta, httpMethodTone, httpStatusTone } from './api-badges';

describe('projectStatusMeta', () => {
  it('maps known statuses to a Title Case label, icon and tone', () => {
    expect(projectStatusMeta('active')).toEqual({ label: 'Active', icon: 'zap', tone: 'emerald' });
    expect(projectStatusMeta('in_review')).toEqual({
      label: 'In Review',
      icon: 'git-pull-request',
      tone: 'amber',
    });
    expect(projectStatusMeta('on hold').label).toBe('On Hold');
    expect(projectStatusMeta('on hold').tone).toBe('slate');
    expect(projectStatusMeta('completed').tone).toBe('sky');
    expect(projectStatusMeta('cancelled').tone).toBe('rose');
    expect(projectStatusMeta('inactive').tone).toBe('slate');
  });

  it('falls back to a neutral dot for unknown or empty status', () => {
    expect(projectStatusMeta('mystery').icon).toBe('circle-dot');
    expect(projectStatusMeta('').label).toBe('Unknown');
  });
});

describe('api badges', () => {
  it('maps health and delivery statuses', () => {
    expect(healthMeta('operational').tone).toBe('emerald');
    expect(healthMeta('degraded').tone).toBe('amber');
    expect(healthMeta('down')).toEqual({ label: 'Down', icon: 'circle-x', tone: 'rose' });
    expect(deliveryMeta('failed').label).toBe('Failed');
    expect(deliveryMeta('unknown').label).toBe('Skipped');
  });

  it('colours HTTP methods and status codes', () => {
    expect(httpMethodTone('get')).toBe('sky');
    expect(httpMethodTone('DELETE')).toBe('rose');
    expect(httpMethodTone('OPTIONS')).toBe('neutral');
    expect(httpStatusTone(201)).toBe('emerald');
    expect(httpStatusTone(404)).toBe('amber');
    expect(httpStatusTone(503)).toBe('rose');
  });
});
