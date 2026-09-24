/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public OneSignal app id (not a secret). Leave unset to build without notifications. */
  readonly VITE_ONESIGNAL_APP_ID?: string;
}
