import { requireAdminPage } from "./admin-core.js";

const page = document.body.dataset.adminPage;
const title = document.body.dataset.adminTitle;
await requireAdminPage(page);
document.getElementById("placeholderTitle").textContent = title;
document.getElementById("placeholderText").textContent =
  `${title} is ready for a future Firestore workflow.`;
