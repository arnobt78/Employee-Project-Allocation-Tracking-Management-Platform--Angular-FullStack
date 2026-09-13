import { Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellContentState } from '@/app/service/shell-content.state';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export class LayoutComponent implements OnDestroy {
  private readonly shellContent = inject(ShellContentState);
  readonly childActive = signal(false);

  ngOnDestroy(): void {
    this.shellContent.childActive.set(false);
    this.childActive.set(false);
  }

  onChildActivate(): void {
    this.childActive.set(true);
    this.shellContent.childActive.set(true);
  }

  onChildDeactivate(): void {
    this.childActive.set(false);
    this.shellContent.childActive.set(false);
  }
}
