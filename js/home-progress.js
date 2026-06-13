import { auth } from "../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getModules } from "./module-catalog.js";
import { getProgressSummary } from "./progress-service.js";
import { getUserSubscription, withModuleAccess } from "./access-service.js";

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function renderModule(module, summary) {
  const action = module.accessible
    ? `<a class="button" href="${escapeHtml(module.path)}">Start Module</a>`
    : module.accessEligible
      ? `<button class="button button-disabled" type="button" disabled>&#128274; Open Module</button>`
      : "<strong>Coming Soon</strong>";

  const badge = module.subscriptionExpired
    ? `<span class="status-badge status-badge-expired">Subscription expired</span>`
    : module.improvement
      ? `<span class="status-badge status-badge-improvement">In Improvement</span>`
      : !module.accessible && module.accessEligible
      ? `<span class="status-badge status-badge-locked">&#128274; ${escapeHtml(module.lockMessage)}</span>`
      : "";

  return `
    <div class="card ${module.accessible ? "" : "module-card-locked"}">
      <div class="module-card-heading">
        <h2>${escapeHtml(module.title)}</h2>
        ${badge}
      </div>
      <p>${escapeHtml(module.description)}</p>
      ${!module.accessible && module.accessEligible
        ? `<p class="module-lock-reason">${escapeHtml(module.lockMessage)}</p>`
        : ""}
      <p>${summary.percent}% completed</p>
      <div style="background:#e5e7eb;height:10px;border-radius:999px;overflow:hidden;margin:14px 0;">
        <div style="background:#2563eb;height:100%;width:${summary.percent}%;"></div>
      </div>
      ${action}
    </div>
  `;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const modulesList = document.getElementById("modulesList");
  const [modules, subscription] = await Promise.all([
    getModules(),
    getUserSubscription(user.uid)
  ]);
  const modulesWithAccess = withModuleAccess(modules, subscription);
  const summaries = await Promise.all(
    modulesWithAccess.map((module) => getProgressSummary(user.uid, [module]))
  );

  modulesList.innerHTML = modulesWithAccess
    .map((module, index) => renderModule(module, summaries[index]))
    .join("");
});
