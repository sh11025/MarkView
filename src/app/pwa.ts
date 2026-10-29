import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useUi } from '../stores/ui';

/** 서비스 워커 등록. 새 버전이 있으면 바로 바꾸지 않고 사용자에게 물어본다 (작성 중 새로고침 방지). */
export function setupPwa(): void {
  // file: 프로토콜(로컬/포터블) 환경에서는 서비스 워커 등록을 시도하지 않는다
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return;
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      useUi.getState().pushToast({
        text: '새 버전이 있습니다.',
        kind: 'info',
        sticky: true,
        action: { label: '새로고침', run: () => void updateSW(true) },
      });
    },
    onOfflineReady() {
      useUi.getState().pushToast({ text: '이제 오프라인에서도 사용할 수 있습니다.', kind: 'success' });
    },
  });
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** 브라우저가 앱 설치를 제안할 수 있으면 설치 함수를, 아니면 null */
export function useInstallPrompt(): (() => void) | null {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    // file: 프로토콜에서는 앱 설치를 제안하지 않는다
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return event
    ? () => {
        void event.prompt();
        setEvent(null);
      }
    : null;
}
