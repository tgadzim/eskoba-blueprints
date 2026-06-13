import { db } from "../firebase/config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { escapeHtml, requireAdminPage } from "./admin-core.js";
import { getModules } from "./module-catalog.js";
import { getProgressSummary } from "./progress-service.js";

function renderUser(data, summary) {
  return `
    <article class="admin-list-item">
      <div>
        <strong>${escapeHtml(data.name || data.email || "Unnamed user")}</strong>
        <p>${escapeHtml(data.email)} · ${escapeHtml(data.role)} · ${escapeHtml(data.company)}</p>
        <p>${summary.completed} / ${summary.total} lessons completed (${summary.percent}%)</p>
      </div>
      <span class="admin-badge">${escapeHtml(data.subscriptionPlan || "No plan")}</span>
    </article>
  `;
}

await requireAdminPage("admin.html");

const usersList = document.getElementById("usersList");
try {
  const [usersSnapshot, modules] = await Promise.all([
    getDocs(collection(db, "users")),
    getModules()
  ]);
  usersList.innerHTML = (await Promise.all(usersSnapshot.docs.map(async (userDoc) => {
    const summary = await getProgressSummary(userDoc.id, modules);
    return renderUser(userDoc.data(), summary);
  }))).join("") || "No users found.";
} catch (error) {
  console.error("Admin users loading error:", error);
  usersList.textContent = "Unable to load users.";
}
