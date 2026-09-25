import { useEffect, useMemo, useState } from 'react';
import { addDays } from '../../shared/dates.mjs';
import { fetchDirections, fetchGroups, fetchTaxonomies } from '../api';
import { todayIso } from '../format';
import type { Direction, GroupsIndex, SavedSelection, Taxonomies } from '../types';

interface Props {
  onSelect: (selection: SavedSelection) => void;
}

type Step = 'direction' | 'refine' | 'group';

const ARCHIVE_AFTER_DAYS = 45;

function useAsyncData() {
  const [directions, setDirections] = useState<Direction[] | null>(null);
  const [groups, setGroups] = useState<GroupsIndex | null>(null);
  const [taxonomies, setTaxonomies] = useState<Taxonomies | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDirections(), fetchGroups(), fetchTaxonomies()])
      .then(([d, g, t]) => {
        if (cancelled) return;
        setDirections(d);
        setGroups(g);
        setTaxonomies(t);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Не удалось загрузить список направлений');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { directions, groups, taxonomies, error };
}

export default function Onboarding({ onSelect }: Props) {
  const { directions, groups, taxonomies, error } = useAsyncData();
  const [step, setStep] = useState<Step>('direction');
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<Direction | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);

  // Groups that finished studying long ago still have their old posts on the site; don't
  // offer them. A group with no lessons at all is kept (its schedule may simply not be
  // published yet) and marked as such.
  const visibleDirections = useMemo(() => {
    if (!directions || !groups) return [];
    const cutoff = addDays(todayIso(), -ARCHIVE_AFTER_DAYS);
    const isCurrent = (code: string) => {
      const info = groups[code];
      if (!info) return false;
      return info.lessonCount === 0 || !info.lastLessonDate || info.lastLessonDate >= cutoff;
    };
    return directions
      .map((d) => ({ ...d, groupCodes: d.groupCodes.filter(isCurrent).sort((a, b) => a.localeCompare(b, 'ru')) }))
      .filter((d) => d.groupCodes.length > 0);
  }, [directions, groups]);

  const filteredDirections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleDirections;
    return visibleDirections.filter((d) => d.breadcrumb.toLowerCase().includes(q));
  }, [visibleDirections, query]);

  const courseOptions = useMemo(() => {
    if (!direction || !groups || !taxonomies) return [];
    const courseById = new Map(taxonomies.course.map((c) => [c.id, c.name]));
    const seen = new Map<number, { id: number; name: string; groupCodes: string[] }>();
    for (const code of direction.groupCodes) {
      const info = groups[code];
      if (!info) continue;
      for (const cid of info.courseIds) {
        if (!seen.has(cid)) {
          seen.set(cid, { id: cid, name: courseById.get(cid) || `Курс #${cid}`, groupCodes: [] });
        }
        seen.get(cid)!.groupCodes.push(code);
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [direction, groups, taxonomies]);

  const groupCandidates = useMemo(() => {
    if (!direction) return [];
    if (courseId == null) return direction.groupCodes;
    return direction.groupCodes.filter((code) => groups?.[code]?.courseIds.includes(courseId));
  }, [direction, courseId, groups]);

  function chooseDirection(d: Direction) {
    setDirection(d);
    setCourseId(null);
    if (d.groupCodes.length > 1) {
      // Only bother asking about the course if it would actually narrow anything down.
      const distinctCourses = new Set(
        d.groupCodes.flatMap((code) => groups?.[code]?.courseIds ?? [])
      );
      setStep(distinctCourses.size > 1 ? 'refine' : 'group');
    } else {
      setStep('group');
    }
  }

  function confirmGroup(code: string) {
    onSelect({ groupCode: code, directionBreadcrumb: direction?.breadcrumb || '' });
  }

  if (error) {
    return (
      <div className="onboarding">
        <p className="error">Ошибка: {error}</p>
        <p className="hint">Проверьте подключение к интернету и обновите страницу.</p>
      </div>
    );
  }

  if (!directions || !groups || !taxonomies) {
    return (
      <div className="onboarding">
        <p>Загрузка списка направлений…</p>
      </div>
    );
  }

  return (
    <div className="onboarding">
      <h1>Выбор группы</h1>

      {step === 'direction' && (
        <>
          <p className="hint">Шаг 1 из {direction && groupCandidates.length !== 1 ? '3' : '2'}: найдите своё направление</p>
          <input
            className="search"
            placeholder="Например: экономика, юриспруденция…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <ul className="list">
            {filteredDirections.map((d) => (
              <li key={d.id}>
                <button onClick={() => chooseDirection(d)}>{d.breadcrumb}</button>
              </li>
            ))}
            {filteredDirections.length === 0 && <li className="hint">Ничего не найдено</li>}
          </ul>
        </>
      )}

      {step === 'refine' && direction && (
        <>
          <p className="hint">Шаг 2 из 3: уточните курс</p>
          <p className="breadcrumb">{direction.breadcrumb}</p>
          <ul className="list">
            {courseOptions.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setCourseId(c.id);
                    setStep('group');
                  }}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          <button className="back" onClick={() => setStep('direction')}>
            ← Назад
          </button>
        </>
      )}

      {step === 'group' && direction && (
        <>
          <p className="hint">
            Шаг {courseOptions.length > 1 ? '3 из 3' : '2 из 2'}: выберите свою группу
          </p>
          <p className="breadcrumb">{direction.breadcrumb}</p>
          <ul className="list">
            {groupCandidates.map((code) => (
              <li key={code}>
                <button onClick={() => confirmGroup(code)}>
                  {code}
                  {groups[code]?.lessonCount === 0 && (
                    <span className="no-schedule"> · расписание пока не опубликовано</span>
                  )}
                </button>
              </li>
            ))}
            {groupCandidates.length === 0 && (
              <li className="hint">Группы не найдены — попробуйте выбрать другой курс</li>
            )}
          </ul>
          <button className="back" onClick={() => setStep(courseOptions.length > 1 ? 'refine' : 'direction')}>
            ← Назад
          </button>
        </>
      )}
    </div>
  );
}
