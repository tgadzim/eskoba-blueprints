import { auth } from "../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  canAccessModule,
  getModuleLockMessage,
  getUserSubscription
} from "./access-service.js";
import { getModule } from "./module-catalog.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const moduleId = document.body.dataset.module;
  const lessonId = document.body.dataset.lesson;
  const [module, subscription] = await Promise.all([
    getModule(moduleId),
    getUserSubscription(user.uid)
  ]);
  const lessonIsPublished = !lessonId || module?.lessons.some((lesson) => lesson.id === lessonId);

  if (module?.accessEligible && lessonIsPublished && canAccessModule(subscription, moduleId)) {
    document.body.classList.remove("access-check-pending");
    return;
  }

  const reason = !module
    ? "This module is not currently available"
    : !lessonIsPublished
      ? "This lesson is not published"
      : module.comingSoon
        ? "Coming soon"
        : getModuleLockMessage(subscription, moduleId);

  document.body.classList.remove("access-check-pending");
  document.body.innerHTML = `
    <main class="access-denied-page">
      <section class="access-denied-card">
        <div class="lock-icon" aria-hidden="true">&#128274;</div>
        <span class="status-badge ${subscription.expired ? "status-badge-expired" : "status-badge-locked"}">
          ${subscription.expired ? "Subscription expired" : "Locked"}
        </span>
        <h1>Module unavailable</h1>
        <p>${reason}.</p>
        <a class="nav-button nav-button-back" href="../../dashboard.html">&lt;&lt; Back to Dashboard</a>
      </section>
    </main>
  `;
});
