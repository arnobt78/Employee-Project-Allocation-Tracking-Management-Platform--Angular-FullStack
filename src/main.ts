import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { initClientSentry } from './app/lib/sentry/init';

initClientSentry();

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
