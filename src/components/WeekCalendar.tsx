import { addDays, weekDays } from '../../shared/dates.mjs';
import { formatMonthYear } from '../format';

interface Props {
  selected: string;
  today: string;
  /** Dates that have at least one lesson (shown with a dot). */
  markedDates: Set<string>;
  onSelect: (iso: string) => void;
}

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function WeekCalendar({ selected, today, markedDates, onSelect }: Props) {
  const days = weekDays(selected);

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button
          className="nav-button"
          onClick={() => onSelect(addDays(selected, -7))}
          aria-label="Предыдущая неделя"
        >
          ‹
        </button>

        <span className="calendar-month">{formatMonthYear(selected)}</span>

        {selected !== today && (
          <button className="today-pill" onClick={() => onSelect(today)}>
            Сегодня
          </button>
        )}

        {/* The date input sits invisibly on top of the icon, so a tap opens the phone's
            own date picker. */}
        <label className="nav-button date-picker" title="Выбрать дату" aria-label="Выбрать дату">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
            />
          </svg>
          <input
            type="date"
            value={selected}
            onChange={(e) => e.target.value && onSelect(e.target.value)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker();
              } catch {
                // Older browsers open the picker on their own from the tap.
              }
            }}
          />
        </label>

        <button
          className="nav-button"
          onClick={() => onSelect(addDays(selected, 7))}
          aria-label="Следующая неделя"
        >
          ›
        </button>
      </div>

      <div className="week-strip">
        {days.map((iso, i) => {
          const classes = ['day-button'];
          if (iso === selected) classes.push('selected');
          if (iso === today) classes.push('today');
          return (
            <button
              key={iso}
              className={classes.join(' ')}
              onClick={() => onSelect(iso)}
              aria-pressed={iso === selected}
              aria-current={iso === today ? 'date' : undefined}
            >
              <span className="dow">{WEEKDAYS_SHORT[i]}</span>
              <span className="dnum">{Number(iso.slice(8))}</span>
              <span className={`dot${markedDates.has(iso) ? ' on' : ''}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
