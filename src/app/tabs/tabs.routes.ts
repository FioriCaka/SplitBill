import { Routes } from '@angular/router';
import { authGuard } from '../core/auth.guard';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    canMatch: [authGuard],
    children: [
      {
        path: 'participants',
        loadComponent: () =>
          import('../participants/participants.page').then(
            (m) => m.ParticipantsPage
          ),
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('../expenses/expenses.page').then((m) => m.ExpensesPage),
      },
      {
        path: 'summary',
        loadComponent: () =>
          import('../summary/summary.page').then((m) => m.SummaryPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('../profile-page/profile-page').then((m) => m.ProfilePage),
      },

      {
        path: '',
        redirectTo: '/tabs/summary',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/summary',
    pathMatch: 'full',
  },
];
