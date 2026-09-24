import { useEffect, useState } from 'react';
import {
  disablePush,
  enablePush,
  getPushSupport,
  isPushEnabledLocally,
  pushConfigured,
  syncPushGroup,
} from '../push';

interface Props {
  groupCode: string;
}

type Phase = 'off' | 'loading' | 'needs-tap' | 'enabled' | 'denied' | 'error';

export default function NotificationsPanel({ groupCode }: Props) {
  const support = pushConfigured ? getPushSupport() : 'unsupported';
  const [phase, setPhase] = useState<Phase>(() => (isPushEnabledLocally() ? 'enabled' : 'off'));
  const [error, setError] = useState<string | null>(null);

  // If notifications are on, keep this device's group tag equal to the selected group.
  useEffect(() => {
    if (phase !== 'enabled') return;
    syncPushGroup(groupCode).catch(() => {
      // Not critical: the tag is refreshed the next time the app is opened.
    });
  }, [groupCode, phase]);

  if (!pushConfigured) return null;

  async function handleEnable() {
    setPhase('loading');
    setError(null);
    try {
      const result = await enablePush(groupCode);
      setPhase(result === 'enabled' ? 'enabled' : result === 'denied' ? 'denied' : 'needs-tap');
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'blocked'
          ? 'Сервис уведомлений недоступен в вашей сети или заблокирован блокировщиком рекламы.'
          : 'Не удалось подключить уведомления. Попробуйте ещё раз позже.'
      );
      setPhase('error');
    }
  }

  async function handleDisable() {
    setPhase('loading');
    try {
      await disablePush();
    } catch {
      // The local flag is already cleared; the device stops syncing its group either way.
    }
    setPhase('off');
  }

  if (phase === 'enabled') {
    return (
      <p className="push-line">
        🔔 Уведомления об изменениях включены ·{' '}
        <button className="link-button" onClick={handleDisable}>
          Отключить
        </button>
      </p>
    );
  }

  if (support === 'ios-needs-install') {
    return (
      <div className="push-card">
        <h2>Уведомления об изменениях</h2>
        <p>
          На iPhone уведомления работают только у приложений на экране «Домой». Нажмите в Safari
          «Поделиться» → «На экран «Домой»», откройте приложение оттуда и включите уведомления.
        </p>
      </div>
    );
  }

  if (support === 'unsupported') return null;

  return (
    <div className="push-card">
      <h2>Уведомления об изменениях</h2>
      <p>
        Пришлём уведомление, когда изменится расписание вашей группы (проверка раз в час), даже если
        приложение закрыто.
      </p>

      {phase === 'denied' && (
        <p className="status status-warn">
          Уведомления запрещены в настройках браузера или телефона для этого сайта. Разрешите их и
          попробуйте снова.
        </p>
      )}
      {phase === 'error' && error && <p className="status status-error">{error}</p>}

      <button
        className="primary-button"
        onClick={handleEnable}
        disabled={phase === 'loading'}
      >
        {phase === 'loading'
          ? 'Подключаю…'
          : phase === 'needs-tap'
            ? 'Разрешить уведомления'
            : 'Включить уведомления'}
      </button>

      <p className="push-privacy">
        После включения подключится сервис OneSignal. Ему передаются только анонимный идентификатор
        устройства и код вашей группы — без имени, почты и других данных.
      </p>
    </div>
  );
}
