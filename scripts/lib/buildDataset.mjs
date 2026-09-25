// Pure (no network, no filesystem) transformation from raw WP REST API payloads to
// the dataset the frontend consumes. Kept separate from fetch-schedule.mjs's I/O so
// the whole pipeline can be exercised in tests with fixture data.

import { parsePost } from '../../shared/parseSchedule.mjs';
import { groupCodeToFileSlug } from '../../shared/groupSlug.mjs';
import { normalizeLessons } from '../../shared/normalizeLessons.mjs';

function termsToRecords(terms) {
  return terms.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    parent: t.parent || 0,
  }));
}

/**
 * Within one group's own set of assigned "level" (hierarchical) term ids, finds the
 * most specific (deepest) one — the one that is not the parent of any other id in the
 * same set. WordPress typically saves the whole ancestor chain against a post, so a
 * group's levelIds usually looks like [топ-уровень, средний, конкретное-направление].
 */
function findLeafLevelId(levelIds, levelById) {
  for (const id of levelIds) {
    const isParentOfAnother = levelIds.some(
      (other) => other !== id && levelById.get(other)?.parent === id
    );
    if (!isParentOfAnother) return id;
  }
  return levelIds.length ? levelIds[levelIds.length - 1] : null;
}

function breadcrumbFor(id, levelById) {
  const parts = [];
  let current = levelById.get(id);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    parts.unshift(current.name);
    seen.add(current.id);
    current = current.parent ? levelById.get(current.parent) : null;
  }
  return parts.join(' → ');
}

/**
 * Groups directions (specific "level" leaf terms, e.g. a bachelor's programme) with
 * the list of group codes that belong to them, for the frontend's onboarding picker.
 */
function computeDirections(levelTerms, groupsJson) {
  const levelById = new Map(levelTerms.map((t) => [t.id, t]));
  const directions = new Map(); // leafId -> { id, name, breadcrumb, groupCodes:Set }

  for (const [groupCode, entry] of Object.entries(groupsJson)) {
    const leafId = findLeafLevelId(entry.levelIds, levelById);
    if (leafId == null || !levelById.has(leafId)) continue;
    if (!directions.has(leafId)) {
      directions.set(leafId, {
        id: leafId,
        name: levelById.get(leafId).name,
        breadcrumb: breadcrumbFor(leafId, levelById),
        groupCodes: new Set(),
      });
    }
    directions.get(leafId).groupCodes.add(groupCode);
  }

  return [...directions.values()]
    .map((d) => ({ ...d, groupCodes: [...d.groupCodes].sort() }))
    .sort((a, b) => a.breadcrumb.localeCompare(b.breadcrumb, 'ru'));
}


const RETAKE_PERIOD = /дополнительная сессия/i;

/**
 * @param {object[]} posts raw items from GET /wp-json/wp/v2/raspisanie
 * @param {{level:object[], course:object[], form:object[], month:object[]}} taxonomies
 *   raw term arrays from the corresponding taxonomy endpoints
 * @param {Date} referenceDate "now" for the parser
 */
export function buildDataset(posts, taxonomies, referenceDate = new Date()) {
  const groupsIndex = new Map();
  const lessonsByGroup = new Map();
  const quality = {
    parseFailures: 0,
    skippedRetakePosts: 0,
    postsWithoutTable: 0,
    unrecognisedTables: [],
    rowsWithoutDate: 0,
    datesRepaired: 0,
  };

  // "Дополнительная сессия" posts are re-sits of individual students' debts, not a group's
  // timetable: they must not appear in every classmate's calendar.
  const retakePeriodIds = new Set(
    (taxonomies.month || []).filter((t) => RETAKE_PERIOD.test(t.name)).map((t) => t.id)
  );

  for (const post of posts) {
    const monthIds = post['month-raspisanie'] || [];
    if (monthIds.some((id) => retakePeriodIds.has(id))) {
      quality.skippedRetakePosts++;
      continue;
    }

    let result;
    try {
      result = parsePost(
        { html: post.content?.rendered || '', title: post.title?.rendered || '', modified: post.modified },
        { now: referenceDate }
      );
    } catch {
      quality.parseFailures++;
      continue;
    }

    if (result.status === 'no-table') quality.postsWithoutTable++;
    if (result.status === 'retake') quality.skippedRetakePosts++;
    quality.rowsWithoutDate += result.rowsWithoutDate;
    quality.datesRepaired += result.datesRepaired;
    for (const headers of result.unrecognised) {
      if (headers.some(Boolean) && quality.unrecognisedTables.length < 20) {
        quality.unrecognisedTables.push({ postId: post.id, headers: headers.join(' | ').slice(0, 120) });
      }
    }
    if (result.status === 'retake') continue;

    const levelIds = post.level || [];
    const courseIds = post['course-raspisanie'] || [];
    const formIds = post['form-obuchenia'] || [];

    // Groups that only "guest" in a joint lecture row of someone else's post must not
    // inherit that post's direction and course, so classify by the groups named in the
    // post's title (or, if the title names none, by everyone in it).
    const owners = new Set(result.titleGroupCodes.length ? result.titleGroupCodes : result.groupCodes);

    for (const groupCode of result.groupCodes) {
      if (!groupsIndex.has(groupCode)) {
        groupsIndex.set(groupCode, {
          levelIds: new Set(),
          courseIds: new Set(),
          formIds: new Set(),
          monthIds: new Set(),
          postIds: new Set(),
        });
      }
      const entry = groupsIndex.get(groupCode);
      entry.postIds.add(post.id);
      if (owners.has(groupCode)) {
        levelIds.forEach((id) => entry.levelIds.add(id));
        courseIds.forEach((id) => entry.courseIds.add(id));
        formIds.forEach((id) => entry.formIds.add(id));
        monthIds.forEach((id) => entry.monthIds.add(id));
      }
    }

    for (const lesson of result.lessons) {
      if (!lessonsByGroup.has(lesson.groupCode)) lessonsByGroup.set(lesson.groupCode, []);
      lessonsByGroup.get(lesson.groupCode).push(lesson);
    }
  }

  const generatedAt = new Date().toISOString();
  const scheduleFiles = new Map(); // fileSlug -> { groupCode, lessons, generatedAt }
  const groupsJson = {};
  let lessonCount = 0;
  let emptyGroups = 0;

  for (const [groupCode, entry] of groupsIndex) {
    const lessons = normalizeLessons(lessonsByGroup.get(groupCode) || []);
    const fileSlug = groupCodeToFileSlug(groupCode);
    scheduleFiles.set(fileSlug, { groupCode, lessons, generatedAt });
    lessonCount += lessons.length;
    if (lessons.length === 0) emptyGroups++;

    groupsJson[groupCode] = {
      levelIds: [...entry.levelIds],
      courseIds: [...entry.courseIds],
      formIds: [...entry.formIds],
      monthIds: [...entry.monthIds],
      postIds: [...entry.postIds],
      fileSlug,
      lessonCount: lessons.length,
      lastLessonDate: lessons.length ? lessons[lessons.length - 1].date : null,
    };
  }

  const taxonomiesJson = {
    level: termsToRecords(taxonomies.level || []),
    course: termsToRecords(taxonomies.course || []),
    form: termsToRecords(taxonomies.form || []),
    month: termsToRecords(taxonomies.month || []),
  };

  const directionsJson = computeDirections(taxonomiesJson.level, groupsJson);

  const metaJson = {
    generatedAt,
    postCount: posts.length,
    groupCount: groupsIndex.size,
    lessonCount,
    emptyGroups,
    retakePeriodIds: [...retakePeriodIds],
    ...quality,
  };

  return { groupsJson, taxonomiesJson, directionsJson, scheduleFiles, metaJson };
}