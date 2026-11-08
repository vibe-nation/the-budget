import { Routes } from '@angular/router';

import { TimelineChart } from './charts/timeline/timeline-chart';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: TimelineChart,
    title: 'Бюджетът: дефицит, дълг и правителства на България от 1989 г.',
  },
  {
    path: 'documentation',
    loadComponent: () => import('./documentation/documentation').then((m) => m.Documentation),
    title: 'Документация — Бюджетът',
  },
  { path: '**', redirectTo: '' },
];
