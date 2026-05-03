import { Routes } from '@angular/router';
import { Hiscores } from './hiscores/hiscores';
import { App } from './app';

export const routes: Routes = [
  { path: '', redirectTo: '/hiscores', pathMatch: 'full' },
  { path: 'hiscores', component: Hiscores, },
  { path: 'hiscores/:playerName', component: Hiscores },
  { path: 'hiscores/:playerName/:groupId', component: Hiscores },
  { path: '**', component: App },
];
