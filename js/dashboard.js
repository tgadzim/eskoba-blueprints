import { auth } from "../firebase/config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import { getModules } from "./module-catalog.js";
import { getProgressSummary } from "./progress-service.js";
import {
  formatSubscriptionExpiry,
  getUserSubscription,
  withModuleAccess
} from "./access-service.js";
import { getAdminLandingPage } from "./admin-core.js";

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function renderModules(modules, subscription) {
  const continueModule = modules.find((module) => module.accessible);

  document.getElementById("continueLearning").innerHTML = continueModule
    ? `<p>${escapeHtml(continueModule.title)}</p>
       <a class="button" href="${escapeHtml(continueModule.path)}">Open Module</a>`
    : `<p>${subscription.expired
        ? "Subscription expired. Renew your subscription to continue learning."
        : "No accessible modules are available for your current plan."}</p>`;

  document.getElementById("availableModules").innerHTML = `
    <div class="module-grid">
      ${modules.map((module) => `
        <article class="module-access-card ${module.accessible ? "" : "module-card-locked"}">
          <div class="module-card-heading">
            <h3>${escapeHtml(module.title)}</h3>
            ${module.improvement
              ? `<span class="status-badge status-badge-improvement">In Improvement</span>`
              : module.accessEligible && !module.accessible
              ? `<span class="status-badge ${module.subscriptionExpired
                  ? "status-badge-expired"
                  : "status-badge-locked"}">
                   &#128274; ${escapeHtml(module.lockMessage)}
                 </span>`
              : ""}
          </div>
          <p>${escapeHtml(module.description)}</p>
          ${module.accessible
            ? `<a class="button" href="${escapeHtml(module.path)}">Open Module</a>`
            : module.accessEligible
              ? `<button class="button button-disabled" type="button" disabled>&#128274; Open Module</button>`
              : `<span class="status-badge status-badge-locked">Coming Soon</span>`}
        </article>
      `).join("")}
    </div>
  `;

  const expiry = formatSubscriptionExpiry(subscription.expiry);
  document.getElementById("subscriptionSummary").innerHTML = `
    <strong>${escapeHtml(subscription.plan || "No plan set")}</strong>
    ${subscription.status ? `<span>${escapeHtml(subscription.status)}</span>` : ""}
    ${expiry ? `<span>Expires ${escapeHtml(expiry)}</span>` : ""}
    ${subscription.expired
      ? `<span class="status-badge status-badge-expired">Subscription expired</span>`
      : !subscription.active
        ? `<span class="status-badge status-badge-locked">Inactive</span>`
        : `<span class="status-badge status-badge-active">Active</span>`}
  `;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const welcomeEl = document.getElementById("welcomeText");
  welcomeEl.textContent = user.email || "Logged in";

  const [modules, subscription] = await Promise.all([
    getModules(),
    getUserSubscription(user.uid)
  ]);

  const profile = subscription.profile;
  const adminLandingPage = getAdminLandingPage(profile.role);
  const adminPanelBtn = document.getElementById("adminPanelBtn");
  if (adminLandingPage) {
    adminPanelBtn.href = adminLandingPage;
    adminPanelBtn.hidden = false;
  }

  if (profile.name) {
    welcomeEl.innerHTML = `
      <strong>${escapeHtml(profile.name)}</strong><br>
      <span>${escapeHtml(profile.role)} &bull; ${escapeHtml(profile.company)}</span>
    `;
  }

  const modulesWithAccess = withModuleAccess(modules, subscription);
  const summary = await getProgressSummary(user.uid, modules);

  document.getElementById("overallProgressText").innerText =
    `${summary.completed} / ${summary.total} lessons completed (${summary.percent}%)`;
  document.getElementById("overallProgressBar").style.width = `${summary.percent}%`;

  renderModules(modulesWithAccess, subscription);
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});
