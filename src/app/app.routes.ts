import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
    data: {
      layout: 'auth',
      pageTitle: 'Sign in',
    },
  },
  {
    path: '',
    component: LayoutComponent,
    canActivateChild: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        data: {
          layout: 'private',
          pageTitle: 'Dashboard',
        },
      },
      {
        path: 'employee',
        loadComponent: () =>
          import('./pages/employee/employee.component').then(
            (m) => m.EmployeeComponent
          ),
        data: {
          layout: 'private',
          pageTitle: 'Employees',
        },
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./pages/project/project.component').then(
            (m) => m.ProjectComponent
          ),
        data: {
          layout: 'private',
          pageTitle: 'Projects',
        },
      },
      {
        path: 'new-project',
        loadComponent: () =>
          import('./pages/project-form/project-form.component').then(
            (m) => m.ProjectFormComponent
          ),
        data: {
          layout: 'private',
          pageTitle: 'Project Setup',
        },
      },
      {
        path: 'update-project/:id',
        loadComponent: () =>
          import('./pages/project-form/project-form.component').then(
            (m) => m.ProjectFormComponent
          ),
        data: {
          layout: 'private',
          pageTitle: 'Project Setup',
        },
      },
      {
        path: 'new-project/:id',
        redirectTo: 'update-project/:id',
        pathMatch: 'full',
      },
      {
        path: 'project-employee',
        loadComponent: () =>
          import('./pages/project-employee/project-employee.component').then(
            (m) => m.ProjectEmployeeComponent
          ),
        data: {
          layout: 'private',
          pageTitle: 'Project assignments',
        },
      },
      {
        path: 'business-insights',
        loadComponent: () =>
          import('./pages/business-insights/business-insights.component').then(
            (m) => m.BusinessInsightsComponent
          ),
        data: {
          layout: 'private',
          pageTitle: 'Business Insights',
        },
      },
      {
        path: 'calendar-timeline',
        loadComponent: () =>
          import('./pages/calendar-timeline/calendar-timeline.component').then(
            (m) => m.CalendarTimelineComponent
          ),
        data: {
          layout: 'private',
          pageTitle: 'Calendar & Timeline',
        },
      },
      {
        path: 'api-doc',
        loadComponent: () =>
          import('./pages/api-doc/api-doc.component').then(
            (m) => m.ApiDocComponent
          ),
        data: {
          layout: 'private',
          pageTitle: 'API Documentation',
        },
      },
      {
        path: 'api-status',
        loadComponent: () =>
          import('./pages/api-status/api-status.component').then(
            (m) => m.ApiStatusComponent
          ),
        data: {
          layout: 'private',
          pageTitle: 'API Status',
        },
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
