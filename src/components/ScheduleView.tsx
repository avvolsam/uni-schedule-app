import { useEffect, useMemo, useState } from 'react';
import { formatClock, formatDateTime, formatDayLabel, todayIso } from '../format';
import {
  autoLiveRefresh,
  dismissChanges,
  loadFromServer,
  loadLocalState,
  refreshNow,
  type ScheduleState,
} from '../schedule';
import type { Lesson, SavedSelection } from '../types';
import ChangesBanner from './ChangesBanner';
import NotificationsPanel from './NotificationsPanel';

interface Props {
  selection: SavedSelection;
  onChangeGroup: () => void;
}

interface Status {
  kind: 'ok' | 'warn' | 'error';
  text: string;
}

function groupByDate(lessons: Lesson[]): [string, Lesson[]][] {
  const map = new Map<string, Lesson[]>();
  for (const lesson of lessons) {
    const key = lesson.date || 'Без даты';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(lesson);
  }
  return [...map.entries()];
}

export default function ScheduleView({ selection, onChangeGroup }: Props) {
  const group = selection.groupCode;
  const [state, setState] = useState<ScheduleState>(() => loadLocalState(group));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // On open: show whatever is saved on the phone instantly (state initialiser above),
  // then fetch the app's latest published data, then — if it's been a while — ask the
  // university site directly in the background.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await loadFromServer(group);
        if (!cancelled) setState(s);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      }
      const live = await autoLiveRefresh(group);
      if (!cancelled && live) setState(live);
    })();
    return () => {
      cancelled = true;
    };
  }, [group]);

  async function handleRefresh() {
    setBusy(true);
    setStatus(null);
    const outcome = await refreshNow(group);
    setState(outcome.state);
    setBusy(false);

    if (outcome.via === 'live') {
      setStatus({
        kind: 'ok',
        text: outcome.changed
          ? 'Обновлено с сайта РАНХиГС. Есть изменения — они показаны выше.'
          : 'Обновлено с сайта РАНХиГС. Изменений нет.',
      });
    } else if (outcome.via === 'server') {
      const built = outcome.state.stored ? formatClock(outcome.state.stored.timestamp) : '';
      setStatus({
        kind: 'warn',
        text: `Напрямую с сайта РАНХиГС получить не удалось (${outcome.liveError}). Показана последняя версия, собранная приложением${built ? ` в ${built}` : ''}.`,
      });
    } else {
      setStatus({ kind: 'error', text: `Не удалось обновить: ${outcome.error}` });
    }
  }

  const { stored, changes } = state;

  const days = useMemo(() => {
    if (!stored) return [];
    const today = todayIso();
    return groupByDate(stored.lessons.filter((l) => !l.date || l.date >= today));
  }, [stored]);

  return (
    <div className="schedule">
      <header className="schedule-header">
        <div>
          <h1>{group}</h1>
          {selection.directionBreadcrumb && (
            <p className="breadcrumb">{selection.directionBreadcrumb}</p>
          )}
        </div>
        <div className="header-actions">
          <button
            onClick={handleRefresh}
            disabled={busy}
            className={busy ? 'spinning' : ''}
            title="Обновить расписание"
            aria-label="Обновить расписание"
          >
            ↻
          </button>
          <button onClick={onChangeGroup} title="Сменить группу" aria-label="Сменить группу">
            ⚙
          </button>
        </div>
      </header>

      {stored && (
        <p className="updated-at">
          Обновлено: {formatDateTime(stored.timestamp)} ·{' '}
          {stored.source === 'live' ? 'напрямую с сайта РАНХиГС' : 'сборка приложения'}
        </p>
      )}

      {busy && <p className="hint">Проверяю сайт РАНХиГС…</p>}
      {status && <p className={`status status-${status.kind}`}>{status.text}</p>}

      <ChangesBanner changes={changes} onDismiss={() => setState(dismissChanges(group))} />

      <NotificationsPanel groupCode={group} />

      {!stored && loadError && (
        <div className="error-box">
          <p className="error">Не удалось загрузить расписание: {loadError}</p>
          <p className="hint">Проверьте интернет и нажмите ↻.</p>
        </div>
      )}
      {!stored && !loadError && <p>Загрузка расписания…</p>}

      {stored && days.length === 0 && <p className="hint">Ближайших занятий не найдено.</p>}

      {days.map(([date, dayLessons]) => (
        <section key={date} className="day">
          <h2>{date === 'Без даты' ? date : formatDayLabel(date)}</h2>
          <ul className="lessons">
            {dayLessons.map((lesson, i) => (
              <li key={i} className="lesson">
                <div className="lesson-time">{lesson.time || '—'}</div>
                <div className="lesson-body">
                  <div className="lesson-subject">
                    {lesson.subject}
                    {lesson.type && <span className="lesson-type"> · {lesson.type}</span>}
                  </div>
                  <div className="lesson-meta">
                    {[lesson.position, lesson.teacher].filter(Boolean).join(' ')}
                    {lesson.room && <span className="lesson-room"> · ауд. {lesson.room}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="footer-note">
        Неофициальное приложение, не связано с РАНХиГС. Данные берутся с открытого сайта
        spb.ranepa.ru. Выбранная группа и расписание хранятся только на вашем телефоне.
      </p>
    </div>
  );
}
