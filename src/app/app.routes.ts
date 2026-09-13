import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component'; // Corrected path
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { EmployeeComponent } from './pages/employee/employee.component';
import { ProjectComponent } from './pages/project/project.component';
import { ProjectFormComponent } from './pages/project-form/project-form.component';
import { ProjectEmployeeComponent } from './pages/project-employee/project-employee.component';
import { BusinessInsightsComponent } from './pages/business-insights/business-insights.component';
import { CalendarTimelineComponent } from './pages/calendar-timeline/calendar-timeline.component';
import { ApiDocComponent } from './pages/api-doc/api-doc.component';
import { ApiStatusComponent } from './pages/api-status/api-status.component';
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
        component: DashboardComponent,
        data: {
          layout: 'private',
          pageTitle: 'Dashboard',
        },
      },
      {
        path: 'employee',
        component: EmployeeComponent,
        data: {
          layout: 'private',
          pageTitle: 'Employees',
        },
      },
      {
        path: 'projects',
        component: ProjectComponent,
        data: {
          layout: 'private',
          pageTitle: 'Projects',
        },
      },
      {
        path: 'new-project',
        component: ProjectFormComponent,
        data: {
          layout: 'private',
          pageTitle: 'Project setup',
        },
      },
      {
        path: 'update-project/:id',
        component: ProjectFormComponent,
        data: {
          layout: 'private',
          pageTitle: 'Project setup',
        },
      },
      {
        path: 'new-project/:id',
        redirectTo: 'update-project/:id',
        pathMatch: 'full',
      },
      {
        path: 'project-employee',
        component: ProjectEmployeeComponent,
        data: {
          layout: 'private',
          pageTitle: 'Project assignments',
        },
      },
      {
        path: 'business-insights',
        component: BusinessInsightsComponent,
        data: {
          layout: 'private',
          pageTitle: 'Business Insights',
        },
      },
      {
        path: 'calendar-timeline',
        component: CalendarTimelineComponent,
        data: {
          layout: 'private',
          pageTitle: 'Calendar & Timeline',
        },
      },
      {
        path: 'api-doc',
        component: ApiDocComponent,
        data: {
          layout: 'private',
          pageTitle: 'API Documentation',
        },
      },
      {
        path: 'api-status',
        component: ApiStatusComponent,
        data: {
          layout: 'private',
          pageTitle: 'API Status',
        },
      },
    ],
  },
];
