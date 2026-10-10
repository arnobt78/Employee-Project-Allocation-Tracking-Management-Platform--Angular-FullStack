import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActionButtonComponent } from './action-button.component';

@Component({
  standalone: true,
  imports: [ActionButtonComponent],
  template: `
    <button
      ehAction
      icon="save"
      [pending]="pending()"
      [disabled]="disabled()"
      pendingLabel="Saving…"
      (click)="clicks = clicks + 1"
    >
      Save
    </button>
  `,
})
class HostComponent {
  readonly pending = signal(false);
  readonly disabled = signal(false);
  clicks = 0;
}

describe('ActionButtonComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    return { fixture, button, host: fixture.componentInstance };
  }

  it('swaps to a busy spinner state while pending', () => {
    const { fixture, button, host } = setup();
    expect(button.textContent).toContain('Save');
    expect(button.hasAttribute('aria-busy')).toBeFalse();

    host.pending.set(true);
    fixture.detectChanges();
    expect(button.textContent).toContain('Saving…');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.querySelector('.animate-spin')).not.toBeNull();
  });

  it('keeps focus while pending but swallows clicks', () => {
    const { fixture, button, host } = setup();
    button.focus();
    host.pending.set(true);
    host.disabled.set(true);
    fixture.detectChanges();

    expect(button.disabled).toBeFalse();
    expect(document.activeElement).toBe(button);
    button.click();
    expect(host.clicks).toBe(0);
  });

  it('uses native disabled when disabled and idle', () => {
    const { fixture, button, host } = setup();
    host.disabled.set(true);
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();

    host.disabled.set(false);
    fixture.detectChanges();
    button.click();
    expect(host.clicks).toBe(1);
  });
});
