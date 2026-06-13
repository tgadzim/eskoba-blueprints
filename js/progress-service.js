import { db } from "../firebase/config.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

function scopedProgressRef(userId, moduleId, lessonId) {
  return doc(db, "progress", userId, "modules", moduleId, "lessons", lessonId);
}

function legacyProgressRef(userId, lessonId) {
  return doc(db, "progress", userId, "lessons", lessonId);
}

export async function getLessonProgress(userId, moduleId, lessonId) {
  try {
    const scopedSnapshot = await getDoc(scopedProgressRef(userId, moduleId, lessonId));

    if (scopedSnapshot.exists()) {
      return scopedSnapshot.data();
    }
  } catch (error) {
    console.warn("Unable to read module-scoped progress; using legacy progress:", error);
  }

  const legacySnapshot = await getDoc(legacyProgressRef(userId, lessonId));
  const legacyData = legacySnapshot.exists() ? legacySnapshot.data() : null;

  if (!legacyData || (legacyData.moduleId && legacyData.moduleId !== moduleId)) {
    return null;
  }

  return legacyData;
}

export async function completeLesson(userId, moduleId, lessonId) {
  const progress = {
    moduleId,
    lessonId,
    completed: true,
    completedAt: serverTimestamp()
  };

  // Write legacy first so existing rules and exports keep working during migration.
  await setDoc(legacyProgressRef(userId, lessonId), progress);

  try {
    await setDoc(scopedProgressRef(userId, moduleId, lessonId), progress);
  } catch (error) {
    console.warn("Unable to write module-scoped progress; legacy progress was saved:", error);
  }
}

export async function getProgressSummary(userId, modules) {
  const lessons = modules
    .filter((module) => module.published)
    .flatMap((module) => module.lessons.map((lesson) => ({
      moduleId: module.id,
      lessonId: lesson.id
    })));

  const results = await Promise.all(
    lessons.map(({ moduleId, lessonId }) => getLessonProgress(userId, moduleId, lessonId))
  );

  const completed = results.filter((progress) => progress?.completed === true).length;
  const total = lessons.length;

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100)
  };
}
