import { auth } from "../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getModule } from "./module-catalog.js";
import { getLessonProgress } from "./progress-service.js";
import {
  canAccessModule,
  getModuleLockMessage,
  getUserSubscription
} from "./access-service.js";

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function localLessonPath(path) {
  return path.split("/").pop();
}

function lessonDestination(lesson) {
  if (lesson.path) return localLessonPath(lesson.path);
  const query = new URLSearchParams({ moduleId: document.body.dataset.module, lessonId: lesson.id });
  return `../../lesson-view.html?${query.toString()}`;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../../login.html";
    return;
  }

  const moduleId = document.body.dataset.module;
  const [module, subscription] = await Promise.all([
    getModule(moduleId),
    getUserSubscription(user.uid)
  ]);
  const lessonsList = document.getElementById("lessonsList");

  if (!module) {
    lessonsList.textContent = "Module not found.";
    return;
  }

  if (!module.accessEligible || !canAccessModule(subscription, moduleId)) {
    lessonsList.innerHTML = `
      <div class="module-lock-message">
        <div class="lock-icon" aria-hidden="true">&#128274;</div>
        <span class="status-badge ${subscription.expired ? "status-badge-expired" : "status-badge-locked"}">
          ${subscription.expired ? "Subscription expired" : "Locked"}
        </span>
        <p>${module.comingSoon ? "Coming soon" : getModuleLockMessage(subscription, moduleId)}.</p>
      </div>
    `;
    return;
  }

  document.title = module.title;

  const title = document.getElementById("moduleTitle");
  const description = document.getElementById("moduleDescription");

  if (title) title.textContent = module.title;
  if (description) description.textContent = module.description;

  if (module.lessons.length === 0) {
    lessonsList.textContent = "Lessons coming soon.";
    return;
  }

  const progress = await Promise.all(
    module.lessons.map((lesson) => getLessonProgress(user.uid, module.id, lesson.id))
  );

  lessonsList.innerHTML = module.lessons.map((lesson, index) => {
    const destination = lessonDestination(lesson);
    return `
      <div style="margin-bottom:18px;">
      ${destination
        ? `<a class="button" href="${escapeHtml(destination)}">Lesson ${index + 1}: ${escapeHtml(lesson.title)}</a>`
        : `<button class="button button-disabled" type="button" disabled>Lesson ${index + 1}: ${escapeHtml(lesson.title)} · Content unavailable</button>`}
      <span style="margin-left:12px;color:#16a34a;font-weight:bold;">
        ${progress[index]?.completed === true ? "Completed &#10003;" : ""}
      </span>
      </div>
    `;
  }).join("");
});
