// Small friendly lines shown under the day's lessons. Wording is gender-neutral on
// purpose: students of every gender use the app.

const FOR_LESSON_DAYS = [
  'Ты уже молодец: расписание открыто. Дальше — легче.',
  'Пара за парой — и день пройдёт. У тебя получится.',
  'Не забудь про воду и небольшой перерыв между парами.',
  'Не нужно быть идеальным. Достаточно прийти — и это уже много.',
  'Один день — один шаг. Этот шаг у тебя уже почти сделан.',
  'Хорошее настроение и чашка чего-нибудь вкусного — и вперёд.',
  'Всё получится. А если нет — будет хорошая история на потом.',
];

const FOR_FREE_DAYS = [
  'В этот день без пар — самое время выдохнуть.',
  'Свободный день. Отдых — тоже часть учёбы.',
  'Пар нет. Можно спокойно заварить чай.',
];

/** Same date => same line all day, so the text doesn't flicker between visits. */
export function pickCheer(iso, hasLessons) {
  const pool = hasLessons ? FOR_LESSON_DAYS : FOR_FREE_DAYS;
  let hash = 0;
  for (const ch of iso) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length];
}

export const ALL_CHEERS = [...FOR_LESSON_DAYS, ...FOR_FREE_DAYS];
