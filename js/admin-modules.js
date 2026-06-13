import { db } from "../firebase/config.js";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
  CONTENT_STATUSES,
  escapeHtml,
  requireAdminPage,
  showAdminMessage,
  slugify
} from "./admin-core.js";
import { uploadAdminFile } from "./admin-storage.js";

const context = await requireAdminPage("admin-modules.html");
const formSection = document.getElementById("moduleFormSection");
const listSection = document.getElementById("moduleListSection");
const form = document.getElementById("moduleForm");
const list = document.getElementById("modulesList");
const fields = {
  id: document.getElementById("moduleId"),
  title: document.getElementById("moduleTitle"),
  description: document.getElementById("moduleDescription"),
  status: document.getElementById("moduleStatus"),
  requiredPlan: document.getElementById("requiredPlan"),
  sortOrder: document.getElementById("moduleSortOrder"),
  isPaid: document.getElementById("moduleIsPaid"),
  thumbnailFile: document.getElementById("thumbnailFile"),
  thumbnailPath: document.getElementById("thumbnailPath"),
  thumbnailUrl: document.getElementById("thumbnailUrl")
};
const writeButtons = [
  document.getElementById("newModuleBtn"),
  document.getElementById("saveModuleStatusBtn"),
  document.getElementById("saveModuleDraftBtn"),
  document.getElementById("publishModuleBtn")
];
let modules = [];

fields.status.innerHTML = CONTENT_STATUSES.map((value) => `<option value="${value}">${value}</option>`).join("");
writeButtons.forEach((button) => { button.disabled = !context.canWrite; });
fields.thumbnailFile.disabled = !context.canWrite;

function showList() {
  formSection.hidden = true;
  listSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showForm() {
  formSection.hidden = false;
  formSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  form.reset();
  fields.id.readOnly = false;
  fields.status.value = "draft";
  fields.requiredPlan.value = "free";
  fields.sortOrder.value = "0";
  fields.thumbnailPath.value = "";
  fields.thumbnailUrl.value = "";
  const preview = document.getElementById("thumbnailPreview");
  preview.hidden = true;
  preview.removeAttribute("src");
  document.getElementById("moduleFormTitle").textContent = "Create module";
}

function editModule(id) {
  const module = modules.find((item) => item.id === id);
  if (!module) return;

  fields.id.value = id;
  fields.id.readOnly = true;
  fields.title.value = module.title || "";
  fields.description.value = module.description || "";
  fields.status.value = module.status || (module.published ? "published" : "coming-soon");
  fields.requiredPlan.value = module.requiredPlan || "free";
  fields.sortOrder.value = module.sortOrder ?? module.order ?? 0;
  fields.isPaid.checked = module.isPaid === true;
  fields.thumbnailPath.value = module.thumbnailPath || "";
  fields.thumbnailUrl.value = module.thumbnailUrl || "";

  const preview = document.getElementById("thumbnailPreview");
  preview.hidden = !module.thumbnailUrl;
  if (module.thumbnailUrl) preview.src = module.thumbnailUrl;
  document.getElementById("moduleFormTitle").textContent = `Edit ${module.title || id}`;
  showForm();
}

async function loadModules() {
  const snapshot = await getDocs(collection(db, "modules"));
  modules = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(a.sortOrder ?? a.order ?? 0) - Number(b.sortOrder ?? b.order ?? 0));

  list.innerHTML = modules.map((module) => {
    const moduleStatus = module.status || (module.published ? "published" : "coming-soon");
    return `
      <article class="admin-list-item">
        <div>
          <strong>${escapeHtml(module.title || module.id)}</strong>
          <p>${escapeHtml(module.id)} · ${escapeHtml(moduleStatus)} · ${escapeHtml(module.requiredPlan || "free")} · ${module.isPaid ? "Paid" : "Free"}</p>
        </div>
        <div class="admin-item-actions">
          <button class="admin-button admin-button-secondary" data-edit="${escapeHtml(module.id)}" type="button">View / Edit</button>
          <button class="admin-button admin-button-danger" data-archive="${escapeHtml(module.id)}" type="button" ${context.canWrite && moduleStatus !== "archived" ? "" : "disabled"}>Archive</button>
        </div>
      </article>
    `;
  }).join("") || "No Firestore modules yet.";

  list.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editModule(button.dataset.edit)));
  list.querySelectorAll("[data-archive]").forEach((button) => button.addEventListener("click", () => archiveModule(button.dataset.archive)));
}

async function saveModule(targetStatus) {
  if (!context.canWrite || !form.reportValidity()) return;

  const id = slugify(fields.id.value || fields.title.value);
  if (!id) return showAdminMessage("Module ID is required.", "error");

  try {
    setBusy(true);
    let thumbnailPath = fields.thumbnailPath.value;
    let thumbnailUrl = fields.thumbnailUrl.value;
    const upload = await uploadAdminFile(fields.thumbnailFile.files[0], `modules/${id}/thumbnail`);
    if (upload) {
      thumbnailPath = upload.path;
      thumbnailUrl = upload.url;
    }

    const existing = modules.find((module) => module.id === id);
    await setDoc(doc(db, "modules", id), {
      title: fields.title.value.trim(),
      description: fields.description.value.trim(),
      status: targetStatus,
      requiredPlan: fields.requiredPlan.value,
      sortOrder: Number(fields.sortOrder.value || 0),
      isPaid: fields.isPaid.checked,
      thumbnailPath,
      thumbnailUrl,
      order: Number(fields.sortOrder.value || 0),
      published: targetStatus === "published",
      path: existing?.path || `modules/${id}/index.html`,
      updatedAt: serverTimestamp()
    }, { merge: true });

    showAdminMessage(`Module saved as ${targetStatus}.`);
    resetForm();
    showList();
    await loadModules();
  } catch (error) {
    console.error("Module save failed:", error);
    showAdminMessage(`Unable to save module: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

async function archiveModule(id) {
  if (!context.canWrite) return;
  try {
    await setDoc(doc(db, "modules", id), {
      status: "archived",
      published: false,
      updatedAt: serverTimestamp()
    }, { merge: true });
    showAdminMessage("Module archived.");
    await loadModules();
  } catch (error) {
    console.error("Module archive failed:", error);
    showAdminMessage(`Unable to archive module: ${error.message}`, "error");
  }
}

function setBusy(busy) {
  writeButtons.forEach((button) => { button.disabled = busy || !context.canWrite; });
  fields.thumbnailFile.disabled = busy || !context.canWrite;
}

document.getElementById("newModuleBtn").addEventListener("click", () => { resetForm(); showForm(); });
form.addEventListener("submit", (event) => event.preventDefault());
document.getElementById("cancelModuleBtn").addEventListener("click", showList);
document.getElementById("saveModuleStatusBtn").addEventListener("click", () => saveModule(fields.status.value));
document.getElementById("saveModuleDraftBtn").addEventListener("click", () => saveModule("draft"));
document.getElementById("publishModuleBtn").addEventListener("click", () => saveModule("published"));
fields.thumbnailFile.addEventListener("change", () => {
  const file = fields.thumbnailFile.files[0];
  const preview = document.getElementById("thumbnailPreview");
  if (!file) return;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
});

await loadModules();
