import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { addDays } from '../../shared/dates.mjs';
import { formatClock, formatDateTime, formatDayLabel, formatShortDate, todayIso } from '../format';
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
import WeekCalendar from './WeekCalendar';

interface Props {
  selection: SavedSelection;
  onChangeGroup: () => void;
}

interface Status {
  kind: 'ok' | 'warn' | 'error';
  text: string;
}

const SWIPE_MIN_DISTANCE = 60;

function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <li className="lesson">
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
  );
}

export default function ScheduleView({ selection, onChangeGroup }: Props) {
  const group = selection.groupCode;
  const [state, setState] = useState<ScheduleState>(() => loadLocalState(group));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The app always opens on today.
  const [today, setToday] = useState(todayIso);
  const [selected, setSelected] = useState(today);
  const todayRef = useRef(today);

  // A phone app can sit in the background for days. When it comes back on a new calendar
  // day, jump to the new "today" instead of leaving yesterday on screen.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      const now = todayIso();
      if (now !== todayRef.current) {
        todayRef.current = now;
        setToday(now);
        setSelected(now);
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

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

  const { byDate, sortedDates, undated } = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    const noDate: Lesson[] = [];
    for (const lesson of stored?.lessons ?? []) {
      if (!lesson.date) {
        noDate.push(lesson);
        continue;
      }
      if (!map.has(lesson.date)) map.set(lesson.date, []);
      map.get(lesson.date)!.push(lesson);
    }
    return { byDate: map, sortedDates: [...map.keys()].sort(), undated: noDate };
  }, [stored]);

  const markedDates = useMemo(() => new Set(sortedDates), [sortedDates]);
  const dayLessons = byDate.get(selected) ?? [];
  const nextLessonDate = sortedDates.find((d) => d > selected);

  // Swiping the lessons area left/right moves one day forward/back.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setSelected((cur) => addDays(cur, dx < 0 ? 1 : -1));
  }

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

      {!stored && loadError && (
        <div className="error-box">
          <p className="error">Не удалось загрузить расписание: {loadError}</p>
          <p className="hint">Проверьте интернет и нажмите ↻.</p>
        </div>
      )}
      {!stored && !loadError && <p>Загрузка расписания…</p>}

      {stored && (
        <>
          <WeekCalendar
            selected={selected}
            today={today}
            markedDates={markedDates}
            onSelect={setSelected}
          />

          <div className="day-view" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <h2 className="day-heading">{formatDayLabel(selected)}</h2>

            {dayLessons.length > 0 ? (
              <ul className="lessons">
                {dayLessons.map((lesson, i) => (
                  <LessonCard key={i} lesson={lesson} />
                ))}
              </ul>
            ) : (
              <div className="empty-day">
                <p>В этот день занятий нет.</p>
                {nextLessonDate && (
                  <button className="link-button" onClick={() => setSelected(nextLessonDate)}>
                    Ближайшее занятие — {formatShortDate(nextLessonDate)}
                  </button>
                )}
              </div>
            )}
          </div>

          {undated.length > 0 && (
            <details className="undated">
              <summary>Занятия без даты ({undated.length})</summary>
              <ul className="lessons">
                {undated.map((lesson, i) => (
                  <LessonCard key={i} lesson={lesson} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <NotificationsPanel groupCode={group} />

      <p className="footer-note">
        Неофициальное приложение, не связано с РАНХиГС. Данные берутся с открытого сайта
        spb.ranepa.ru. Выбранная группа и расписание хранятся только на вашем телефоне.
      </p>
    </div>
  );
}
