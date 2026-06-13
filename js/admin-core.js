import { auth, db } from "../firebase/config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export const ROLES = Object.freeze({
  SUPER_ADMIN: "SuperAdmin",
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
  STUDENT: "Student"
});

export const CONTENT_STATUSES = [
  "draft",
  "coming-soon",
  "published",
  "improvement",
  "archived"
];

export const LESSON_STATUSES = [
  "draft",
  "published",
  "hidden",
  "improvement",
  "archived"
];

export const ADMIN_TABS = [
  { label: "Users", path: "admin.html", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.VIEWER] },
  { label: "Modules", path: "admin-modules.html", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EDITOR, ROLES.VIEWER] },
  { label: "Lessons", path: "admin-lessons.html", roles: [ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.VIEWER] },
  { label: "Access", path: "admin-access.html", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.VIEWER] },
  { label: "Sub-admins", path: "admin-sub-admins.html", roles: [ROLES.SUPER_ADMIN, ROLES.VIEWER] },
  { label: "Feedback", path: "admin-feedback.html", roles: [ROLES.SUPER_ADMIN, ROLES.VIEWER] },
  { label: "Questions", path: "admin-questions.html", roles: [ROLES.SUPER_ADMIN, ROLES.VIEWER] },
  { label: "Quizzes", path: "admin-quizzes.html", roles: [ROLES.SUPER_ADMIN, ROLES.VIEWER] }
];

const ROLE_ALIASES = new Map(
  Object.values(ROLES).map((role) => [role.toLowerCase(), role])
);

export function normalizeRole(role) {
  return ROLE_ALIASES.get(String(role || "").toLowerCase()) || ROLES.STUDENT;
}

export function canViewAdmin(role) {
  return normalizeRole(role) !== ROLES.STUDENT;
}

export function canAccessAdminPage(role, page) {
  const normalizedRole = normalizeRole(role);
  return ADMIN_TABS.some((tab) => tab.path === page && tab.roles.includes(normalizedRole));
}

export function canWriteAdminPage(role, page) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === ROLES.SUPER_ADMIN) return true;
  if (normalizedRole === ROLES.VIEWER) return false;
  if (normalizedRole === ROLES.ADMIN) {
    return ["admin-modules.html", "admin-access.html"].includes(page);
  }
  if (normalizedRole === ROLES.EDITOR) {
    return ["admin-modules.html", "admin-lessons.html"].includes(page);
  }
  return false;
}

export function getAdminLandingPage(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === ROLES.EDITOR) return "admin-modules.html";
  if (canViewAdmin(normalizedRole)) return "admin.html";
  return "";
}

export function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function showAdminMessage(message, type = "success") {
  const element = document.getElementById("adminMessage");
  if (!element) return;
  element.textContent = message;
  element.className = `admin-message show ${type}`;
}

export function renderAdminNav(activePage, role) {
  const nav = document.getElementById("adminNav");
  const roleLabel = document.getElementById("adminRole");
  if (roleLabel) roleLabel.textContent = normalizeRole(role);
  if (!nav) return;

  nav.innerHTML = ADMIN_TABS
    .filter((tab) => tab.roles.includes(normalizeRole(role)))
    .map((tab) => `
    <a class="${tab.path === activePage ? "active" : ""}" href="${tab.path}">${tab.label}</a>
  `).join("");
}

function renderUtilityNav(role) {
  const adminLandingPage = getAdminLandingPage(role);
  const nav = document.createElement("nav");
  nav.className = "top-left-nav";
  nav.setAttribute("aria-label", "Account navigation");
  nav.innerHTML = `
    <a class="top-nav-button" href="dashboard.html">Dashboard</a>
    <a class="top-nav-button top-nav-button-admin top-nav-button-active" href="${adminLandingPage}">Admin Panel</a>
    <button class="top-nav-button top-nav-button-logout" id="adminLogoutBtn" type="button">Logout</button>
  `;
  document.body.prepend(nav);
  nav.querySelector("#adminLogoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

export function requireAdminPage(activePage) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const profile = snapshot.exists() ? snapshot.data() : {};
        const role = normalizeRole(profile.role);

        if (!canAccessAdminPage(role, activePage)) {
          window.location.href = "dashboard.html";
          return;
        }

        renderAdminNav(activePage, role);
        renderUtilityNav(role);
        resolve({ user, profile, role, canWrite: canWriteAdminPage(role, activePage) });
      } catch (error) {
        console.error("Admin role check failed:", error);
        window.location.href = "dashboard.html";
      }
    });
  });
}
