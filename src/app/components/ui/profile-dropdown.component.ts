import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@/app/service/auth.service';
import { UserAvatarComponent } from './user-avatar.component';
import { UTILITY_NAVIGATION_ITEMS } from '@/app/constants/utility-navigation';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';

@Component({
  selector: 'app-profile-dropdown-panel',
  standalone: true,
  imports: [AppIconComponent, CommonModule, RouterLink],
  template: `
    <div
      class="w-56 overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 py-2 shadow-[0_25px_70px_rgba(9,14,33,0.75)] backdrop-blur-md sm:w-64"
      role="menu"
    >
      <div class="px-2 sm:px-4 py-3">
        <p class="truncate text-sm font-medium text-white">{{ displayName }}</p>
        <p class="truncate text-xs text-white/60">{{ subtitle }}</p>
      </div>
      <div class="mx-3 border-t border-white/10"></div>
      <div class="py-1">
        @for (item of utilityItems; track item.route) {
          <a
            [routerLink]="item.route"
            role="menuitem"
            class="flex items-center gap-1 px-4 py-2.5 text-sm text-white/85 transition hover:bg-white/10 hover:text-white"
            (click)="onNavigate()"
          >
            <lucide-icon [name]="item.iconName" [size]="16"></lucide-icon>
            <span>{{ item.label }}</span>
          </a>
        }
      </div>
      <div class="mx-3 border-t border-white/10"></div>
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-1 px-4 py-2.5 text-left text-sm text-rose-200 transition hover:bg-white/10 disabled:opacity-60"
        [disabled]="loggingOut"
        (click)="onLogout()"
      >
        @if (loggingOut) {
          <lucide-icon
            name="loader-circle"
            [size]="16"
            class="animate-spin"
          ></lucide-icon>
          <span>Logging Out...</span>
        } @else {
          <lucide-icon name="log-out" [size]="16"></lucide-icon>
          <span>Log Out</span>
        }
      </button>
    </div>
  `,
})
class ProfileDropdownPanelComponent {
  displayName = '';
  subtitle = '';
  utilityItems = UTILITY_NAVIGATION_ITEMS;
  loggingOut = false;
  onNavigate = () => {};
  onLogout = () => {};
}

@Component({
  selector: 'app-profile-dropdown',
  standalone: true,
  imports: [CommonModule, OverlayModule, UserAvatarComponent],
  template: `
    <button
      #trigger
      type="button"
      class="flex size-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 shadow-inner transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      [attr.aria-expanded]="isOpen()"
      aria-haspopup="menu"
      aria-label="Open Profile Menu"
      (click)="toggle()"
    >
      <app-user-avatar
        [seed]="avatarSeed"
        [label]="displayName"
        [size]="40"
        [alt]="displayName"
      ></app-user-avatar>
    </button>
  `,
})
export class ProfileDropdownComponent {
  private readonly overlay = inject(Overlay);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('trigger', { static: true })
  trigger!: ElementRef<HTMLButtonElement>;

  readonly isOpen = signal(false);
  private overlayRef: OverlayRef | null = null;
  private panelRef: ProfileDropdownPanelComponent | null = null;

  get session() {
    return this.authService.session();
  }

  get displayName(): string {
    const user = this.session;
    return user?.displayName?.trim() || user?.username || 'User';
  }

  get avatarSeed(): string {
    return this.session?.username || this.displayName;
  }

  get subtitle(): string {
    const user = this.session;
    if (!user) {
      return '';
    }
    const role = user.role?.trim() ?? '';
    const username = user.username?.trim() ?? '';
    if (!role) {
      return username;
    }
    if (role.toLowerCase() === username.toLowerCase()) {
      return username;
    }
    return `${role} · ${username}`;
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.open();
  }

  open(): void {
    if (this.overlayRef) {
      return;
    }

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.trigger)
      .withPositions([
        {
          originX: 'end',
          originY: 'bottom',
          overlayX: 'end',
          overlayY: 'top',
          offsetY: 8,
        },
        {
          originX: 'end',
          originY: 'top',
          overlayX: 'end',
          overlayY: 'bottom',
          offsetY: -8,
        },
      ])
      .withPush(true);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
    });

    const portal = new ComponentPortal(ProfileDropdownPanelComponent);
    const componentRef = this.overlayRef.attach(portal);
    this.panelRef = componentRef.instance;
    componentRef.instance.displayName = this.displayName;
    componentRef.instance.subtitle = this.subtitle;
    componentRef.instance.onNavigate = () => this.close();
    componentRef.instance.onLogout = () => this.logout();

    this.overlayRef.backdropClick().subscribe(() => this.close());
    this.overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });

    this.isOpen.set(true);
  }

  close(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.panelRef = null;
    this.isOpen.set(false);
  }

  private logout(): void {
    if (this.panelRef?.loggingOut) {
      return;
    }
    if (this.panelRef) {
      this.panelRef.loggingOut = true;
    }
    this.authService.logout().subscribe({
      next: () => {
        this.close();
        void this.router.navigateByUrl('/login');
      },
      error: () => {
        this.close();
        void this.router.navigateByUrl('/login');
      },
    });
  }
}
