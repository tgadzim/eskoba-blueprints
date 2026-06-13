import { db } from "../firebase/config.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export const fallbackModules = [
  {
    id: "meta-advertising-andromeda2026",
    title: "Meta Advertising / Andromeda2026",
    description: "Learn the Meta Ads framework for campaign structure, creative testing, metric validation, optimization and scaling.",
    path: "modules/meta-advertising-andromeda2026/index.html",
    order: 1,
    status: "published",
    published: true,
    lessons: [
      {
        id: "lesson-1",
        title: "Introduction to Andromeda2026",
        path: "modules/meta-advertising-andromeda2026/lesson-1.html",
        order: 1,
        status: "published",
        published: true
      },
      {
        id: "lesson-2",
        title: "How to Scale Andromeda 2026 - RM1000 Spend Daily",
        path: "modules/meta-advertising-andromeda2026/lesson-2.html",
        order: 2,
        status: "published",
        published: true
      }
    ]
  },
  {
    id: "product-marketing-direction",
    title: "Product Marketing Direction",
    description: "Coming soon.",
    path: "modules/product-marketing-direction/index.html",
    order: 2,
    status: "coming-soon",
    published: false,
    lessons: []
  },
  {
    id: "business-diagnosis",
    title: "Business Diagnosis",
    description: "Coming soon.",
    path: "modules/business-diagnosis/index.html",
    order: 3,
    status: "coming-soon",
    published: false,
    lessons: []
  }
];

function normalizeLesson(lesson, index, fallbackLesson) {
  const status = lesson.status || fallbackLesson?.status ||
    ((lesson.published ?? fallbackLesson?.published ?? true) ? "published" : "draft");

  return {
    id: lesson.id || fallbackLesson?.id || `lesson-${index + 1}`,
    title: lesson.title || fallbackLesson?.title || `Lesson ${index + 1}`,
    description: lesson.description || fallbackLesson?.description || "",
    path: lesson.path || fallbackLesson?.path || "",
    order: Number(lesson.order ?? fallbackLesson?.order ?? index + 1),
    status,
    published: status === "published",
    lessonContentType: lesson.lessonContentType || fallbackLesson?.lessonContentType || "html",
    youtubeUrl: lesson.youtubeUrl || lesson.youtubeVideoUrl || "",
    lessonContentHtml: lesson.lessonContentHtml || "",
    quizId: lesson.quizId || "",
    videoUrl: lesson.videoUrl || "",
    htmlFileUrl: lesson.htmlFileUrl || "",
    resourceUrl: lesson.resourceUrl || ""
  };
}

function normalizeModule(moduleId, data) {
  const fallback = fallbackModules.find((module) => module.id === moduleId);
  const sourceLessons = Array.isArray(data.lessons) ? data.lessons : fallback?.lessons || [];
  const status = data.status || fallback?.status ||
    ((data.published ?? fallback?.published ?? true) ? "published" : "coming-soon");

  return {
    id: moduleId,
    title: data.title || fallback?.title || moduleId,
    description: data.description || fallback?.description || "",
    path: data.path || fallback?.path || `modules/${moduleId}/index.html`,
    order: Number(data.order ?? fallback?.order ?? 999),
    status,
    published: status === "published",
    comingSoon: status === "coming-soon",
    improvement: status === "improvement",
    studentVisible: ["published", "coming-soon", "improvement"].includes(status),
    accessEligible: ["published", "improvement"].includes(status),
    requiredPlan: data.requiredPlan || fallback?.requiredPlan || "free",
    isPaid: data.isPaid ?? fallback?.isPaid ?? false,
    thumbnailPath: data.thumbnailPath || fallback?.thumbnailPath || "",
    thumbnailUrl: data.thumbnailUrl || fallback?.thumbnailUrl || "",
    lessons: sourceLessons
      .map((lesson, index) => normalizeLesson(lesson, index, fallback?.lessons?.[index]))
      .filter((lesson) => lesson.status === "published")
      .sort((a, b) => a.order - b.order)
  };
}

export async function getModules() {
  try {
    const snapshot = await getDocs(collection(db, "modules"));

    if (snapshot.empty) {
      return fallbackModules.map((module) => normalizeModule(module.id, module));
    }

    const modules = await Promise.all(snapshot.docs.map(async (moduleDoc) => {
      const data = moduleDoc.data();

      if (!Array.isArray(data.lessons)) {
        try {
          const lessonsSnapshot = await getDocs(collection(db, "modules", moduleDoc.id, "lessons"));

          if (!lessonsSnapshot.empty) {
            data.lessons = lessonsSnapshot.docs.map((lessonDoc) => ({
              id: lessonDoc.id,
              ...lessonDoc.data()
            }));
          }
        } catch (error) {
          console.warn(`Unable to load lessons for ${moduleDoc.id}:`, error);
        }
      }

      return normalizeModule(moduleDoc.id, data);
    }));

    const remoteIds = new Set(snapshot.docs.map((moduleDoc) => moduleDoc.id));
    const missingFallbacks = fallbackModules.filter((module) => !remoteIds.has(module.id));

    return [
      ...modules.filter((module) => module.studentVisible),
      ...missingFallbacks.map((module) => normalizeModule(module.id, module))
    ].sort((a, b) => a.order - b.order);
  } catch (error) {
    console.warn("Using fallback module catalog:", error);
    return fallbackModules.map((module) => normalizeModule(module.id, module));
  }
}

export async function getModule(moduleId) {
  const modules = await getModules();
  return modules.find((module) => module.id === moduleId);
}

export function getPublishedLessons(modules) {
  return modules
    .filter((module) => module.published)
    .flatMap((module) => module.lessons.map((lesson) => ({
      ...lesson,
      moduleId: module.id
    })));
}
