import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
} from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { AuthService } from './auth.service';
import { NotificationsService } from './notifications.service';
import { Subject, firstValueFrom } from 'rxjs';

const TOKEN_STORAGE_KEY = 'splitbill:push-token';

type FirebaseStatusEnsureResult = { ready: boolean };

const FirebaseStatus = Capacitor.isPluginAvailable('FirebaseStatus')
  ? registerPlugin<{ ensure(): Promise<FirebaseStatusEnsureResult> }>(
      'FirebaseStatus'
    )
  : undefined;

@Injectable({ providedIn: 'root' })
export class PushService {
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private notifications = inject(NotificationsService);

  private inviteSubject = new Subject<void>();
  inviteNotifications$ = this.inviteSubject.asObservable();

  private initialized = false;
  private listenersAttached = false;
  private registering = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      await this.notifications.requestPermission();
    } catch {
      // ignore
    }

    if (!this.isNativePlatform()) {
      return;
    }

    this.attachListeners();

    if (this.registering) return;

    this.registering = true;
    try {
      const firebaseReady = await this.ensureNativeFirebaseReady();
      if (!firebaseReady) {
        console.error(
          '[PushService] Firebase is not configured on this device. Skipping push registration.'
        );
        return;
      }
      console.info(
        '[PushService] Firebase ready, proceeding with push registration.'
      );

      const permission = await PushNotifications.checkPermissions();
      if (permission.receive !== 'granted') {
        const request = await PushNotifications.requestPermissions();
        if (request.receive !== 'granted') {
          console.warn('[PushService] Push permission denied');
          return;
        }
        console.info('[PushService] Push permission granted after prompt.');
      } else {
        console.info('[PushService] Push permission already granted.');
      }

      console.info('[PushService] Calling PushNotifications.register()');
      await PushNotifications.register();
    } catch (err) {
      console.error(
        '[PushService] Failed to register for push notifications',
        err
      );
    } finally {
      this.registering = false;
    }
  }

  private async ensureNativeFirebaseReady(): Promise<boolean> {
    if (!this.isNativePlatform()) return true;
    if (!FirebaseStatus) {
      console.warn(
        '[PushService] FirebaseStatus plugin unavailable; assuming Firebase ready'
      );
      return true;
    }
    try {
      const result = await FirebaseStatus.ensure();
      if (!result?.ready) {
        await this.notifications.notify('Push setup incomplete', {
          body: 'Configure Firebase for Android (google-services.json) before enabling push.',
        });
        return false;
      }
      return true;
    } catch (err) {
      console.error('[PushService] Firebase readiness check failed', err);
      return false;
    }
  }

  private attachListeners() {
    if (this.listenersAttached || !this.isNativePlatform()) return;
    this.listenersAttached = true;

    PushNotifications.addListener('registration', (token) => {
      console.info(
        '[PushService] Received FCM token from native layer',
        token.value
      );
      this.handleRegistration(token).catch((err) =>
        console.warn('[PushService] registration handler error', err)
      );
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushService] registration error', error);
    });

    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        console.info('[PushService] Push notification received', notification);
        this.handleNotification(notification).catch((err) =>
          console.warn('[PushService] notification handler error', err)
        );
      }
    );

    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (event) => {
        console.info('[PushService] Push notification action performed', event);
        this.handleNotification(event.notification).catch((err) =>
          console.warn('[PushService] notification action error', err)
        );
      }
    );
  }

  private isNativePlatform(): boolean {
    const platform = Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android';
  }

  private async handleRegistration(token: Token) {
    console.debug('[PushService] Storing FCM token locally');
    this.storeToken(token.value);
    await this.syncTokenWithBackend(token.value);
  }

  private async handleNotification(notification: PushNotificationSchema) {
    const title = notification.title || notification.data?.title || 'SplitBill';
    const body = notification.body || notification.data?.body || '';
    await this.notifications.notify(title, { body });

    const type = notification.data?.type;
    if (type === 'invite') {
      this.inviteSubject.next();
    }
  }

  private storeToken(token: string) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  private readToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  private clearToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  async onAuthenticated(): Promise<void> {
    const token = this.readToken();
    if (!token) return;
    await this.syncTokenWithBackend(token);
  }

  async onLogout(): Promise<void> {
    const token = this.readToken();
    if (!token) return;
    await this.removeTokenFromBackend(token);
    this.clearToken();
  }

  private async syncTokenWithBackend(token: string): Promise<void> {
    const baseUrl = this.auth.apiBaseUrl;
    const authToken = this.auth.token;
    if (!baseUrl || !authToken) return;

    try {
      const info = await Device.getInfo();
      const deviceName = info.model || info.platform;
      const appVersion = (info as any).appVersion || info.osVersion;

      await firstValueFrom(
        this.http.post(
          `${baseUrl}/devices/push`,
          {
            token,
            platform: info.platform,
            device_name: deviceName,
            app_version: appVersion,
          },
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${authToken}`,
            }),
          }
        )
      );

      console.info('[PushService] Synced push token with backend');
    } catch (err) {
      console.warn('[PushService] Failed to sync push token', err);
    }
  }

  private async removeTokenFromBackend(token: string): Promise<void> {
    const baseUrl = this.auth.apiBaseUrl;
    const authToken = this.auth.token;
    if (!baseUrl || !authToken) return;

    try {
      await firstValueFrom(
        this.http.request('DELETE', `${baseUrl}/devices/push`, {
          headers: new HttpHeaders({
            Authorization: `Bearer ${authToken}`,
          }),
          body: { token },
        })
      );

      console.info('[PushService] Removed push token from backend');
    } catch (err) {
      console.warn('[PushService] Failed to remove push token', err);
    }
  }
}
