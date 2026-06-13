import { auth, db, storage } from "../firebase/config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
  getDownloadURL,
  ref
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";
import {
  canAccessModule,
  getModuleLockMessage,
  getUserSubscription
} from "./access-service.js";
import {
  completeLesson,
  getLessonProgress
} from "./progress-service.js";

const params = new URLSearchParams(window.location.search);
const moduleId = params.get("moduleId")?.trim();
const lessonId = params.get("lessonId")?.trim();
const contentElement = document.getElementById("lessonContent");
const completeButton = document.getElementById("markCompleteBtn");

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function normalizeRole(role) {
  return String(role || "Student").toLowerCase();
}

function isStaffVisibilityRole(role) {
  return ["superadmin", "admin", "editor", "viewer"].includes(normalizeRole(role));
}

function bypassesSubscription(role) {
  return ["superadmin", "admin", "editor"].includes(normalizeRole(role));
}

function moduleStatus(module) {
  return module.status || (module.published === false ? "draft" : "published");
}

function lessonStatus(lesson) {
  return lesson.status || (lesson.published === false ? "draft" : "published");
}

function lessonOrder(lesson) {
  return Number(lesson.sortOrder ?? lesson.order ?? 0);
}

function lessonUrl(id) {
  const query = new URLSearchParams({ moduleId, lessonId: id });
  return `lesson-view.html?${query.toString()}`;
}

function showError(title, message) {
  document.body.classList.remove("lesson-view-pending");
  document.querySelector(".lesson-view-shell").innerHTML = `
    <section class="access-denied-card lesson-view-error">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a class="nav-button nav-button-back" href="dashboard.html">&lt;&lt; Back to Dashboard</a>
    </section>
  `;
}

function youtubeEmbedUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    let videoId = "";
    if (parsed.hostname.includes("youtu.be")) videoId = parsed.pathname.slice(1);
    if (parsed.hostname.includes("youtube.com")) {
      videoId = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
    }
    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : "";
  } catch {
    return "";
  }
}

function sanitizedLessonHtml(html) {
  const documentFragment = new DOMParser().parseFromString(String(html || ""), "text/html");
  documentFragment.querySelectorAll("script, iframe, object, embed, form, input, button").forEach((element) => element.remove());
  documentFragment.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith("on") || ((name === "href" || name === "src") && value.startsWith("javascript:"))) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return documentFragment.body.innerHTML;
}

async function resolveStorageContent(lesson) {
  const resolved = { ...lesson };
  const mappings = [
    ["videoUrl", "videoPath"],
    ["htmlFileUrl", "htmlFilePath"],
    ["resourceUrl", "resourcePath"]
  ];
  const failures = [];

  await Promise.all(mappings.map(async ([urlField, pathField]) => {
    if (resolved[urlField] || !resolved[pathField]) return;
    try {
      resolved[urlField] = await getDownloadURL(ref(storage, resolved[pathField]));
    } catch (error) {
      failures.push(pathField);
      console.error(`Unable to resolve ${pathField}:`, error);
    }
  }));

  resolved.storageFailures = failures;
  return resolved;
}

function renderContent(lesson) {
  const blocks = [];
  const embedUrl = youtubeEmbedUrl(lesson.youtubeUrl || lesson.youtubeVideoUrl);

  if (embedUrl) {
    blocks.push(`<div class="lesson-embed"><iframe src="${escapeHtml(embedUrl)}" title="YouTube lesson video" allowfullscreen></iframe></div>`);
  }
  if (lesson.videoUrl) {
    blocks.push(`<video class="lesson-video" controls preload="metadata" src="${escapeHtml(lesson.videoUrl)}">Your browser does not support HTML5 video.</video>`);
  }
  if (lesson.htmlFileUrl) {
    blocks.push(`<iframe class="lesson-html-frame" src="${escapeHtml(lesson.htmlFileUrl)}" title="Lesson HTML content" sandbox="allow-same-origin allow-scripts allow-forms allow-popups"></iframe>`);
  }
  if (lesson.lessonContentHtml) {
    blocks.push(`<div class="lesson-rich-content">${sanitizedLessonHtml(lesson.lessonContentHtml)}</div>`);
  }
  if (lesson.resourceUrl) {
    blocks.push(`<a class="button" href="${escapeHtml(lesson.resourceUrl)}" target="_blank" rel="noopener">Download / View Resource</a>`);
  }
  if (lesson.quizId) {
    const quizQuery = new URLSearchParams({ quizId: lesson.quizId, moduleId, lessonId });
    blocks.push(`<a class="button" href="quiz.html?${quizQuery.toString()}">Take Quiz</a>`);
  }
  if (lesson.storageFailures?.length) {
    blocks.push(`<p class="module-lock-reason">Storage URL missing or unavailable for: ${escapeHtml(lesson.storageFailures.join(", "))}.</p>`);
  }

  contentElement.innerHTML = blocks.join("") || `
    <div class="lesson-empty-state">
      <h3>Lesson content is not available yet.</h3>
      <p>Storage URL missing or content has not been added.</p>
    </div>
  `;
}

async function renderProgress(userId, lessons) {
  const progressItems = await Promise.all(
    lessons.map((lesson) => getLessonProgress(userId, moduleId, lesson.id))
  );
  const completed = progressItems.filter((progress) => progress?.completed === true).length;
  const total = lessons.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  document.getElementById("moduleProgressText").textContent = `${completed} / ${total} lessons completed (${percent}%)`;
  document.getElementById("moduleProgressBar").style.width = `${percent}%`;
  return progressItems;
}

function renderSidebar(lessons, progressItems) {
  document.getElementById("lessonSidebar").innerHTML = lessons.map((lesson, index) => `
    <a class="lesson-sidebar-link ${lesson.id === lessonId ? "active" : ""}" href="${lessonUrl(lesson.id)}">
      <span>${escapeHtml(lesson.title || lesson.id)}</span>
      <small>${escapeHtml(lessonStatus(lesson))}${progressItems[index]?.completed === true ? " · Completed ✓" : ""}</small>
    </a>
  `).join("") || "<p>No visible lessons.</p>";
}

function renderNavigation(lessons) {
  const currentIndex = lessons.findIndex((lesson) => lesson.id === lessonId);
  const previous = lessons[currentIndex - 1];
  const next = lessons[currentIndex + 1];
  const previousButton = document.getElementById("previousLessonBtn");
  const nextButton = document.getElementById("nextLessonBtn");

  previousButton.href = previous ? lessonUrl(previous.id) : "#";
  nextButton.href = next ? lessonUrl(next.id) : "#";
  previousButton.classList.toggle("button-disabled", !previous);
  nextButton.classList.toggle("button-disabled", !next);
  previousButton.setAttribute("aria-disabled", String(!previous));
  nextButton.setAttribute("aria-disabled", String(!next));
  if (!previous) previousButton.addEventListener("click", (event) => event.preventDefault());
  if (!next) nextButton.addEventListener("click", (event) => event.preventDefault());
}

async function initializeViewer(user) {
  if (!moduleId) return showError("Missing moduleId", "Open this page with a moduleId query parameter.");
  if (!lessonId) return showError("Missing lessonId", "Open this page with a lessonId query parameter.");

  try {
    const [moduleSnapshot, lessonSnapshot, lessonsSnapshot, subscription] = await Promise.all([
      getDoc(doc(db, "modules", moduleId)),
      getDoc(doc(db, "modules", moduleId, "lessons", lessonId)),
      getDocs(collection(db, "modules", moduleId, "lessons")),
      getUserSubscription(user.uid)
    ]);

    if (!moduleSnapshot.exists()) return showError("Module not found", `No module exists for ${moduleId}.`);
    if (!lessonSnapshot.exists()) return showError("Lesson not found", `No lesson exists for ${lessonId}.`);

    const module = { id: moduleSnapshot.id, ...moduleSnapshot.data() };
    const lesson = { id: lessonSnapshot.id, ...lessonSnapshot.data() };
    const role = subscription.profile.role;
    const staffVisibility = isStaffVisibilityRole(role);
    const moduleState = moduleStatus(module);
    const lessonState = lessonStatus(lesson);

    if (!staffVisibility && ["draft", "archived", "coming-soon"].includes(moduleState)) {
      return showError("Access denied", "This module is not currently available to students.");
    }
    if (!staffVisibility && lessonState !== "published") {
      return showError("Access denied", "This lesson is not currently published.");
    }
    if (!bypassesSubscription(role) && !canAccessModule(subscription, moduleId)) {
      return showError(
        subscription.expired ? "Subscription expired" : "Access denied",
        getModuleLockMessage(subscription, moduleId)
      );
    }

    const allLessons = lessonsSnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => lessonOrder(a) - lessonOrder(b));
    const visibleLessons = staffVisibility
      ? allLessons
      : allLessons.filter((item) => lessonStatus(item) === "published");

    document.title = `${lesson.title || lesson.id} - ${module.title || module.id}`;
    document.getElementById("moduleTitle").textContent = module.title || module.id;
    document.getElementById("moduleDescription").textContent = module.description || "";
    document.getElementById("lessonTitle").textContent = lesson.title || lesson.id;
    document.getElementById("lessonDescription").textContent = lesson.description || "";
    document.getElementById("lessonStatus").textContent = lessonState;
    document.getElementById("lessonStatus").classList.add(`status-badge-${lessonState}`);
    document.getElementById("lessonSortOrder").textContent = `Sort order: ${lessonOrder(lesson)}`;

    renderContent(await resolveStorageContent(lesson));
    const progressItems = await renderProgress(user.uid, visibleLessons);
    renderSidebar(visibleLessons, progressItems);
    renderNavigation(visibleLessons);

    const currentProgress = await getLessonProgress(user.uid, moduleId, lessonId);
    if (currentProgress?.completed === true) {
      completeButton.textContent = "Completed ✓";
      completeButton.disabled = true;
    }
    completeButton.addEventListener("click", async () => {
      completeButton.disabled = true;
      completeButton.textContent = "Saving...";
      try {
        await completeLesson(user.uid, moduleId, lessonId);
        completeButton.textContent = "Completed ✓";
        const updatedProgress = await renderProgress(user.uid, visibleLessons);
        renderSidebar(visibleLessons, updatedProgress);
      } catch (error) {
        console.error("Unable to mark lesson complete:", error);
        completeButton.disabled = false;
        completeButton.textContent = "Mark Complete";
        showError("Progress could not be saved", "Please try again or contact support.");
      }
    });

    document.body.classList.remove("lesson-view-pending");
  } catch (error) {
    console.error("Dynamic lesson viewer failed:", error);
    showError(
      "Unable to load lesson",
      error.code === "permission-denied"
        ? "Firestore permission issue. Check the required lesson and module read rules."
        : "The lesson could not be loaded. Please try again."
    );
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  initializeViewer(user);
});
