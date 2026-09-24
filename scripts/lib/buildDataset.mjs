// Pure (no network, no filesystem) transformation from raw WP REST API payloads to
// the dataset the frontend consumes. Kept separate from fetch-schedule.mjs's I/O so
// the whole pipeline can be exercised in tests with fixture data.

import { parsePostToLessons } from '../../shared/parseSchedule.mjs';
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

/**
 * @param {object[]} posts raw items from GET /wp-json/wp/v2/raspisanie
 * @param {{level:object[], course:object[], form:object[], month:object[]}} taxonomies
 *   raw term arrays from the corresponding taxonomy endpoints
 * @param {Date} referenceDate date to resolve day/month-only rows against
 */
export function buildDataset(posts, taxonomies, referenceDate = new Date()) {
  const groupsIndex = new Map();
  const lessonsByGroup = new Map();
  let parseFailures = 0;

  for (const post of posts) {
    let result;
    try {
      result = parsePostToLessons(post.content?.rendered || '', referenceDate);
    } catch {
      parseFailures++;
      continue;
    }

    const levelIds = post.level || [];
    const courseIds = post['course-raspisanie'] || [];
    const formIds = post['form-obuchenia'] || [];
    const monthIds = post['month-raspisanie'] || [];

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
      levelIds.forEach((id) => entry.levelIds.add(id));
      courseIds.forEach((id) => entry.courseIds.add(id));
      formIds.forEach((id) => entry.formIds.add(id));
      monthIds.forEach((id) => entry.monthIds.add(id));
      entry.postIds.add(post.id);
    }

    for (const lesson of result.lessons) {
      if (!lessonsByGroup.has(lesson.groupCode)) lessonsByGroup.set(lesson.groupCode, []);
      lessonsByGroup.get(lesson.groupCode).push(lesson);
    }
  }

  const groupsJson = {};
  for (const [groupCode, entry] of groupsIndex) {
    groupsJson[groupCode] = {
      levelIds: [...entry.levelIds],
      courseIds: [...entry.courseIds],
      formIds: [...entry.formIds],
      monthIds: [...entry.monthIds],
      postIds: [...entry.postIds],
      fileSlug: groupCodeToFileSlug(groupCode),
    };
  }

  const taxonomiesJson = {
    level: termsToRecords(taxonomies.level || []),
    course: termsToRecords(taxonomies.course || []),
    form: termsToRecords(taxonomies.form || []),
    month: termsToRecords(taxonomies.month || []),
  };

  const directionsJson = computeDirections(taxonomiesJson.level, groupsJson);

  const scheduleFiles = new Map(); // fileSlug -> { groupCode, lessons, generatedAt }
  const generatedAt = new Date().toISOString();
  for (const [groupCode, lessons] of lessonsByGroup) {
    scheduleFiles.set(groupCodeToFileSlug(groupCode), {
      groupCode,
      lessons: normalizeLessons(lessons),
      generatedAt,
    });
  }

  const metaJson = {
    generatedAt,
    postCount: posts.length,
    groupCount: groupsIndex.size,
    parseFailures,
  };

  return { groupsJson, taxonomiesJson, directionsJson, scheduleFiles, metaJson };
}
