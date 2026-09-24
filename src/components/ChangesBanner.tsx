import { formatDateTime, formatLessonShort } from '../format';
import type { PendingChange } from '../types';

interface Props {
  changes: PendingChange[];
  onDismiss: () => void;
}

export default function ChangesBanner({ changes, onDismiss }: Props) {
  if (changes.length === 0) return null;

  return (
    <div className="changes-banner" role="status">
      <h2>Расписание изменилось</h2>
      {[...changes].reverse().map((c) => (
        <div key={c.detectedAt} className="change-entry">
          <p className="change-time">{formatDateTime(c.detectedAt)}</p>
          {c.diff.added.length > 0 && (
            <>
              <p className="change-kind">Добавлено</p>
              <ul>
                {c.diff.added.map((l, i) => (
                  <li key={i}>{formatLessonShort(l)}</li>
                ))}
              </ul>
            </>
          )}
          {c.diff.removed.length > 0 && (
            <>
              <p className="change-kind">Отменено или перенесено</p>
              <ul>
                {c.diff.removed.map((l, i) => (
                  <li key={i}>{formatLessonShort(l)}</li>
                ))}
              </ul>
            </>
          )}
          {c.diff.changed.length > 0 && (
            <>
              <p className="change-kind">Изменено</p>
              <ul>
                {c.diff.changed.map(({ before, after }, i) => (
                  <li key={i}>
                    {formatLessonShort(after)}
                    <span className="change-detail">
                      {before.room !== after.room && ` · ауд. ${before.room || '—'} → ${after.room || '—'}`}
                      {before.teacher !== after.teacher &&
                        ` · ${before.teacher || '—'} → ${after.teacher || '—'}`}
                      {before.type !== after.type && ` · ${before.type || '—'} → ${after.type || '—'}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
      <button onClick={onDismiss}>Понятно</button>
    </div>
  );
}
