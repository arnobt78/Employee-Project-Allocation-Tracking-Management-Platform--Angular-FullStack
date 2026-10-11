import { TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  function render(titlePending: boolean): HTMLElement {
    const fixture = TestBed.createComponent(PageHeaderComponent);
    fixture.componentRef.setInput('title', 'Aurora');
    fixture.componentRef.setInput('titlePending', titlePending);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the title heading by default', () => {
    const el = render(false);
    expect(el.querySelector('h1')?.textContent).toContain('Aurora');
    expect(el.querySelector('[data-testid="page-header-title-pending"]')).toBeNull();
  });

  it('renders a title stub instead of the heading while pending', () => {
    const el = render(true);
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelector('[data-testid="page-header-title-pending"]')).toBeTruthy();
  });

  it('centers projected actions by default and bottom-aligns them with actionsAlign="end"', () => {
    const fixture = TestBed.createComponent(PageHeaderComponent);
    fixture.componentRef.setInput('title', 'Aurora');
    fixture.detectChanges();
    const row = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="page-header"]'
    )!;
    expect(row.classList).toContain('sm:items-center');
    expect(row.classList).not.toContain('sm:items-end');

    fixture.componentRef.setInput('actionsAlign', 'end');
    fixture.detectChanges();
    expect(row.classList).toContain('sm:items-end');
    expect(row.classList).not.toContain('sm:items-center');
  });
});
