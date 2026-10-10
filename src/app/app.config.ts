import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withPreloading,
} from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import * as Sentry from '@sentry/angular';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { reloadForStaleChunk } from './lib/chunk-reload';
import { NotificationMonitorService } from './service/notification-monitor.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(PreloadAllModules),
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'top',
      }),
      withNavigationErrorHandler((event) => {
        reloadForStaleChunk(event.error, event.url);
      })
    ),
    provideAppInitializer(() => inject(NotificationMonitorService).start()),
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({ showDialog: false }),
    },
  ],
};
