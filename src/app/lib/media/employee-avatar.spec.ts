import { employeeAvatar } from './employee-avatar';

describe('employeeAvatar', () => {
  it('seeds from email so the robot is stable across pages', () => {
    const view = employeeAvatar({
      emailId: 'ada@example.com',
      employeeName: 'Ada Lovelace',
      avatarUrl: null,
    });
    expect(view).toEqual({ seed: 'ada@example.com', imageUrl: null, label: 'Ada Lovelace' });
  });

  it('falls back to the name, then the fallback name', () => {
    expect(employeeAvatar({ employeeName: ' Grace ' }).seed).toBe('Grace');
    expect(employeeAvatar(null, 'Acme Corp')).toEqual({
      seed: 'Acme Corp',
      imageUrl: null,
      label: 'Acme Corp',
    });
  });

  it('passes through an uploaded avatar URL', () => {
    expect(employeeAvatar({ employeeName: 'Linus', avatarUrl: 'https://x/a.png' }).imageUrl).toBe(
      'https://x/a.png'
    );
  });
});
