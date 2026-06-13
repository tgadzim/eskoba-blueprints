import { db } from "../firebase/config.js";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
  LESSON_STATUSES,
  escapeHtml,
  requireAdminPage,
  showAdminMessage,
  slugify
} from "./admin-core.js";
import { uploadAdminFile } from "./admin-storage.js";

const context = await requireAdminPage("admin-lessons.html");
const moduleSelect = document.getElementById("moduleSelect");
const listSection = document.getElementById("lessonListSection");
const formSection = document.getElementById("lessonFormSection");
const form = document.getElementById("lessonForm");
const list = document.getElementById("lessonsList");
const fields = {
  id: document.getElementById("lessonId"),
  title: document.getElementById("lessonTitle"),
  description: document.getElementById("lessonDescription"),
  status: document.getElementById("lessonStatus"),
  sortOrder: document.getElementById("lessonSortOrder"),
  contentType: document.getElementById("lessonContentType"),
  youtubeUrl: document.getElementById("youtubeUrl"),
  lessonUrl: document.getElementById("lessonUrl"),
  contentHtml: document.getElementById("lessonContentHtml"),
  quizId: document.getElementById("quizId"),
  videoFile: document.getElementById("videoFile"),
  videoPath: document.getElementById("videoPath"),
  videoUrl: document.getElementById("videoUrl"),
  htmlFile: document.getElementById("htmlFile"),
  htmlFilePath: document.getElementById("htmlFilePath"),
  htmlFileUrl: document.getElementById("htmlFileUrl"),
  resourceFile: document.getElementById("resourceFile"),
  resourcePath: document.getElementById("resourcePath"),
  resourceUrl: document.getElementById("resourceUrl")
};
const writeButtons = [
  document.getElementById("newLessonBtn"),
  document.getElementById("saveLessonStatusBtn"),
  document.getElementById("saveLessonDraftBtn"),
  document.getElementById("publishLessonBtn")
];
const uploadInputs = [fields.videoFile, fields.htmlFile, fields.resourceFile];
let lessons = [];

fields.status.innerHTML = LESSON_STATUSES.map((value) => `<option value="${value}">${value}</option>`).join("");
writeButtons.forEach((button) => { button.disabled = !context.canWrite; });
uploadInputs.forEach((input) => { input.disabled = !context.canWrite; });

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
  fields.sortOrder.value = "0";
  fields.contentType.value = "html";
  ["videoPath", "videoUrl", "htmlFilePath", "htmlFileUrl", "resourcePath", "resourceUrl"].forEach((key) => {
    fields[key].value = "";
  });
  document.getElementById("lessonFormTitle").textContent = "Create lesson";
}

function editLesson(id) {
  const lesson = lessons.find((item) => item.id === id);
  if (!lesson) return;

  fields.id.value = id;
  fields.id.readOnly = true;
  fields.title.value = lesson.title || "";
  fields.description.value = lesson.description || "";
  fields.status.value = lesson.status || (lesson.published ? "published" : "draft");
  fields.sortOrder.value = lesson.sortOrder ?? lesson.order ?? 0;
  fields.contentType.value = lesson.lessonContentType || "html";
  fields.youtubeUrl.value = lesson.youtubeUrl || lesson.youtubeVideoUrl || "";
  fields.lessonUrl.value = lesson.url || lesson.path || "";
  fields.contentHtml.value = lesson.lessonContentHtml || "";
  fields.quizId.value = lesson.quizId || "";
  fields.videoPath.value = lesson.videoPath || "";
  fields.videoUrl.value = lesson.videoUrl || "";
  fields.htmlFilePath.value = lesson.htmlFilePath || "";
  fields.htmlFileUrl.value = lesson.htmlFileUrl || "";
  fields.resourcePath.value = lesson.resourcePath || "";
  fields.resourceUrl.value = lesson.resourceUrl || "";
  document.getElementById("lessonFormTitle").textContent = `Edit ${lesson.title || id}`;
  showForm();
}

async function loadModules() {
  const snapshot = await getDocs(collection(db, "modules"));
  const modules = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(a.sortOrder ?? a.order ?? 0) - Number(b.sortOrder ?? b.order ?? 0));
  moduleSelect.innerHTML = `<option value="">Select module</option>${modules.map((module) => `<option value="${escapeHtml(module.id)}">${escapeHtml(module.title || module.id)}</option>`).join("")}`;
}

async function loadLessons() {
  const moduleId = moduleSelect.value;
  showList();
  if (!moduleId) {
    lessons = [];
    list.textContent = "Select a module.";
    return;
  }

  const snapshot = await getDocs(collection(db, "modules", moduleId, "lessons"));
  lessons = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(a.sortOrder ?? a.order ?? 0) - Number(b.sortOrder ?? b.order ?? 0));

  list.innerHTML = lessons.map((lesson) => {
    const lessonStatus = lesson.status || (lesson.published ? "published" : "draft");
    return `
      <article class="admin-list-item">
        <div>
          <strong>${escapeHtml(lesson.title || lesson.id)}</strong>
          <p>${escapeHtml(lesson.id)} · ${escapeHtml(lessonStatus)} · ${escapeHtml(lesson.lessonContentType || "html")}</p>
        </div>
        <div class="admin-item-actions">
          <button class="admin-button admin-button-secondary" data-edit="${escapeHtml(lesson.id)}" type="button">View / Edit</button>
          <button class="admin-button admin-button-danger" data-archive="${escapeHtml(lesson.id)}" type="button" ${context.canWrite && lessonStatus !== "archived" ? "" : "disabled"}>Archive</button>
        </div>
      </article>
    `;
  }).join("") || "No lessons in this module.";

  list.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editLesson(button.dataset.edit)));
  list.querySelectorAll("[data-archive]").forEach((button) => button.addEventListener("click", () => archiveLesson(button.dataset.archive)));
}

async function saveLesson(targetStatus) {
  if (!context.canWrite || !form.reportValidity()) return;
  const moduleId = moduleSelect.value;
  if (!moduleId) return showAdminMessage("Select a module first.", "error");
  const id = slugify(fields.id.value || fields.title.value);
  if (!id) return showAdminMessage("Lesson ID is required.", "error");

  try {
    setBusy(true);
    const basePath = `modules/${moduleId}/lessons/${id}`;
    const [videoUpload, htmlUpload, resourceUpload] = await Promise.all([
      uploadAdminFile(fields.videoFile.files[0], `${basePath}/video`),
      uploadAdminFile(fields.htmlFile.files[0], `${basePath}/html`),
      uploadAdminFile(fields.resourceFile.files[0], `${basePath}/resources`)
    ]);

    await setDoc(doc(db, "modules", moduleId, "lessons", id), {
      title: fields.title.value.trim(),
      description: fields.description.value.trim(),
      status: targetStatus,
      sortOrder: Number(fields.sortOrder.value || 0),
      lessonContentType: fields.contentType.value,
      youtubeUrl: fields.youtubeUrl.value.trim(),
      youtubeVideoUrl: fields.youtubeUrl.value.trim(),
      lessonContentHtml: fields.contentHtml.value,
      quizId: fields.quizId.value.trim(),
      videoPath: videoUpload?.path || fields.videoPath.value,
      videoUrl: videoUpload?.url || fields.videoUrl.value,
      htmlFilePath: htmlUpload?.path || fields.htmlFilePath.value,
      htmlFileUrl: htmlUpload?.url || fields.htmlFileUrl.value,
      resourcePath: resourceUpload?.path || fields.resourcePath.value,
      resourceUrl: resourceUpload?.url || fields.resourceUrl.value,
      url: fields.lessonUrl.value.trim(),
      path: fields.lessonUrl.value.trim(),
      order: Number(fields.sortOrder.value || 0),
      published: targetStatus === "published",
      updatedAt: serverTimestamp()
    }, { merge: true });

    showAdminMessage(`Lesson saved as ${targetStatus}.`);
    resetForm();
    showList();
    await loadLessons();
  } catch (error) {
    console.error("Lesson save failed:", error);
    showAdminMessage(`Unable to save lesson: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

async function archiveLesson(id) {
  if (!context.canWrite || !moduleSelect.value) return;
  try {
    await setDoc(doc(db, "modules", moduleSelect.value, "lessons", id), {
      status: "archived",
      published: false,
      updatedAt: serverTimestamp()
    }, { merge: true });
    showAdminMessage("Lesson archived.");
    await loadLessons();
  } catch (error) {
    console.error("Lesson archive failed:", error);
    showAdminMessage(`Unable to archive lesson: ${error.message}`, "error");
  }
}

function setBusy(busy) {
  writeButtons.forEach((button) => { button.disabled = busy || !context.canWrite; });
  uploadInputs.forEach((input) => { input.disabled = busy || !context.canWrite; });
}

moduleSelect.addEventListener("change", loadLessons);
form.addEventListener("submit", (event) => event.preventDefault());
document.getElementById("newLessonBtn").addEventListener("click", () => {
  if (!moduleSelect.value) return showAdminMessage("Select a module first.", "error");
  resetForm();
  showForm();
});
document.getElementById("cancelLessonBtn").addEventListener("click", showList);
document.getElementById("saveLessonStatusBtn").addEventListener("click", () => saveLesson(fields.status.value));
document.getElementById("saveLessonDraftBtn").addEventListener("click", () => saveLesson("draft"));
document.getElementById("publishLessonBtn").addEventListener("click", () => saveLesson("published"));

await loadModules();
