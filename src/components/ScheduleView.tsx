import { useEffect, useMemo, useState } from 'react';
import { fetchSchedule } from '../api';
import type { Lesson, SavedSelection } from '../types';

interface Props {
  selection: SavedSelection;
  onChangeGroup: () => void;
}

const WEEKDAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);

  const dateStr = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${WEEKDAY_NAMES[d.getDay()]}`;
  if (diffDays === 0) return `Сегодня, ${dateStr}`;
  if (diffDays === 1) return `Завтра, ${dateStr}`;
  return dateStr;
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
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchSchedule(selection.groupCode)
      .then((data) => {
        if (cancelled) return;
        setLessons(data.lessons);
        setGeneratedAt(data.generatedAt);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Не удалось загрузить расписание');
      });
    return () => {
      cancelled = true;
    };
  }, [selection.groupCode, refreshKey]);

  const upcomingLessons = useMemo(() => {
    if (!lessons) return null;
    const todayIso = new Date().toISOString().slice(0, 10);
    return lessons.filter((l) => !l.date || l.date >= todayIso);
  }, [lessons]);

  const days = useMemo(
    () => (upcomingLessons ? groupByDate(upcomingLessons) : []),
    [upcomingLessons]
  );

  return (
    <div className="schedule">
      <header className="schedule-header">
        <div>
          <h1>{selection.groupCode}</h1>
          {selection.directionBreadcrumb && (
            <p className="breadcrumb">{selection.directionBreadcrumb}</p>
          )}
        </div>
        <div className="header-actions">
          <button onClick={() => setRefreshKey((k) => k + 1)} title="Обновить">
            ↻
          </button>
          <button onClick={onChangeGroup} title="Сменить группу">
            ⚙
          </button>
        </div>
      </header>

      {generatedAt && (
        <p className="updated-at">
          Обновлено: {new Date(generatedAt).toLocaleString('ru-RU')}
        </p>
      )}

      {error && (
        <div className="error-box">
          <p className="error">{error}</p>
          <p className="hint">Показано последнее сохранённое расписание, если оно есть.</p>
        </div>
      )}

      {!lessons && !error && <p>Загрузка расписания…</p>}

      {lessons && days.length === 0 && (
        <p className="hint">Ближайших занятий не найдено.</p>
      )}

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
    </div>
  );
}
