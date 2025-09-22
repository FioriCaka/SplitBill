import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { SplitBillService } from './splitbill.service';

export const authGuard: CanMatchFn = (): boolean | UrlTree => {
  const sb = inject(SplitBillService);
  const router = inject(Router);
  return sb.getUser() ? true : router.parseUrl('/login');
};
