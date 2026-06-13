import { db } from "../firebase/config.js";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
  escapeHtml,
  requireAdminPage,
  showAdminMessage
} from "./admin-core.js";
import { formatSubscriptionExpiry } from "./access-service.js";
import { getModules } from "./module-catalog.js";

const context = await requireAdminPage("admin-access.html");
const userSelect = document.getElementById("userSelect");
const accessList = document.getElementById("accessList");
const saveButton = document.getElementById("saveAccessBtn");
let users = [];
let modules = [];

saveButton.disabled = !context.canWrite;

function selectedUser() {
  return users.find((user) => user.id === userSelect.value);
}

function renderUserAccess() {
  const user = selectedUser();
  if (!user) {
    accessList.textContent = "Select a user.";
    return;
  }
  document.getElementById("subscriptionStatus").value = user.subscriptionStatus || "";
  document.getElementById("subscriptionPlan").value = user.subscriptionPlan || "";
  const expiry = user.subscriptionExpiry?.toDate?.() || (user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null);
  document.getElementById("subscriptionExpiry").value = expiry && !Number.isNaN(expiry.getTime()) ? formatSubscriptionExpiry(expiry) : "";

  accessList.innerHTML = `
    <table class="access-table"><thead><tr><th>Module</th><th>Access</th></tr></thead><tbody>
      ${modules.map((module) => `<tr><td>${escapeHtml(module.title)}</td><td><input type="checkbox" data-module="${escapeHtml(module.id)}" ${user.access?.[module.id] === true || String(user.access?.[module.id]).toLowerCase() === "true" ? "checked" : ""} ${context.canWrite ? "" : "disabled"}></td></tr>`).join("")}
    </tbody></table>
  `;
}

async function loadData() {
  const [usersSnapshot, loadedModules] = await Promise.all([
    getDocs(collection(db, "users")),
    getModules()
  ]);
  users = usersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  modules = loadedModules;
  userSelect.innerHTML = `<option value="">Select user</option>${users.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name || user.email || user.id)}</option>`).join("")}`;
}

userSelect.addEventListener("change", renderUserAccess);
saveButton.addEventListener("click", async () => {
  if (!context.canWrite) return;
  const user = selectedUser();
  if (!user) return showAdminMessage("Select a user first.", "error");
  const access = {};
  accessList.querySelectorAll("[data-module]").forEach((checkbox) => {
    access[checkbox.dataset.module] = checkbox.checked;
  });
  await setDoc(doc(db, "users", user.id), { access, updatedAt: serverTimestamp() }, { merge: true });
  user.access = access;
  showAdminMessage("Module access saved.");
});

await loadData();
