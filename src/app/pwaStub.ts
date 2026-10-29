/**
 * 포터블 빌드용 PWA Stub.
 * 포터블 빌드에서는 VitePWA 플러그인이 없으므로 'virtual:pwa-register'를 대체한다.
 */

export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: unknown) => void;
  onRegisterError?: (error: unknown) => void;
}

export function registerSW(_options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
