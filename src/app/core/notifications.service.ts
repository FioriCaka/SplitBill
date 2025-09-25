import { Injectable } from '@angular/core';

// Lightweight notifications facade. In web, falls back to Notification API (if permitted), else console.
// In native apps, you could swap this with a Capacitor Local Notifications plugin implementation.

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  async requestPermission(): Promise<boolean> {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const res = await Notification.requestPermission();
    return res === 'granted';
  }

  async notify(title: string, options?: NotificationOptions) {
    try {
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification(title, options);
        return;
      }
    } catch {}
    console.log('[Notify]', title, options || '');
  }
}
