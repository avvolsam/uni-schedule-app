import { groupCodeToFileSlug } from '../shared/groupSlug.mjs';

// Push notifications via OneSignal. Privacy by design: the OneSignal script is loaded
// only after the student presses "enable" (or had enabled it before). Students who never
// opt in make no requests to OneSignal at all.
//
// What OneSignal receives once opted in: an anonymous device push token and one tag,
// group=<group slug>. No name, e-mail or account exists in this app.

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;
const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
const SDK_TIMEOUT_MS = 15000;
const ENABLED_KEY = 'uni-schedule:push-enabled';
const BASE = import.meta.env.BASE_URL;

interface OneSignalApi {
  init(options: {
    appId: string;
    serviceWorkerPath: string;
    serviceWorkerParam: { scope: string };
    allowLocalhostAsSecureOrigin?: boolean;
    promptOptions?: { slidedown: { prompts: { type: 'push'; autoPrompt: boolean }[] } };
  }): Promise<void>;
  Notifications: { requestPermission(): Promise<unknown> };
  User: {
    addTag(key: string, value: string): void;
    removeTag(key: string): void;
    PushSubscription: { optIn(): Promise<void>; optOut(): Promise<void>; optedIn?: boolean };
  };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: OneSignalApi) => void | Promise<void>>;
  }
}

/** False when the site was built without an OneSignal app id: the feature is then hidden. */
export const pushConfigured = Boolean(APP_ID);

export type PushSupport = 'ok' | 'unsupported' | 'ios-needs-install';

export function getPushSupport(): PushSupport {
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iPhones only allow web push for apps added to the Home Screen (iOS 16.4+).
  if (isIos && !standalone) return 'ios-needs-install';
  const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return hasApis ? 'ok' : 'unsupported';
}

let sdkPromise: Promise<OneSignalApi> | null = null;

function loadSdk(): Promise<OneSignalApi> {
  if (sdkPromise) return sdkPromise;
  if (!APP_ID) return Promise.reject(new Error('push is not configured'));
  const appId = APP_ID;

  const script = document.createElement('script');
  const promise = new Promise<OneSignalApi>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), SDK_TIMEOUT_MS);
    const fail = (err: Error) => {
      clearTimeout(timer);
      reject(err);
    };

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        // A separate service-worker scope keeps OneSignal's worker from replacing the
        // app's own offline-cache worker (two workers can't share one scope).
        await OneSignal.init({
          appId,
          serviceWorkerPath: `${BASE}push/OneSignalSDKWorker.js`,
          serviceWorkerParam: { scope: `${BASE}push/` },
          allowLocalhostAsSecureOrigin: import.meta.env.DEV,
          // The dashboard requires at least one prompt to exist; this makes sure it never
          // pops up by itself. The permission dialog only ever appears on our button.
          promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
        });
        clearTimeout(timer);
        resolve(OneSignal);
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)));
      }
    });

    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => fail(new Error('blocked'));
    document.head.appendChild(script);
  });

  sdkPromise = promise;
  promise.catch(() => {
    // Allow a retry later, and don't leave a dead script tag behind.
    if (sdkPromise === promise) sdkPromise = null;
    script.remove();
  });
  return promise;
}

function markEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(ENABLED_KEY, '1');
    else localStorage.removeItem(ENABLED_KEY);
  } catch {
    // ignore: without storage the app just forgets the flag
  }
}

function wasEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

/** True if the student opted in earlier and the browser still allows notifications. */
export function isPushEnabledLocally(): boolean {
  return wasEnabled() && 'Notification' in window && Notification.permission === 'granted';
}

export type EnableResult = 'enabled' | 'denied' | 'needs-second-tap';

/**
 * Loads OneSignal, asks the browser for permission and subscribes this device to its
 * group's notifications. Browsers only show the permission dialog right after a tap; if
 * loading the script used up that moment, the caller is told to ask for one more tap.
 */
export async function enablePush(groupCode: string): Promise<EnableResult> {
  const os = await loadSdk();
  await os.Notifications.requestPermission();

  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'needs-second-tap';

  await os.User.PushSubscription.optIn();
  os.User.addTag('group', groupCodeToFileSlug(groupCode));
  markEnabled(true);
  return 'enabled';
}

export async function disablePush(): Promise<void> {
  markEnabled(false);
  const os = await loadSdk();
  os.User.removeTag('group');
  await os.User.PushSubscription.optOut();
}

/** Keeps the device's group tag in step with the group currently selected in the app. */
export async function syncPushGroup(groupCode: string): Promise<void> {
  if (!isPushEnabledLocally()) return;
  const os = await loadSdk();
  os.User.addTag('group', groupCodeToFileSlug(groupCode));
}
