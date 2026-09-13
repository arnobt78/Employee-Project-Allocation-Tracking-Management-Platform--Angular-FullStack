import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RouteContentPlaceholderComponent } from '@/app/components/ui/route-content-placeholder.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouteContentPlaceholderComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export class LayoutComponent {
  readonly childActive = signal(false);

  onChildActivate(): void {
    this.childActive.set(true);
  }

  onChildDeactivate(): void {
    this.childActive.set(false);
  }
}
