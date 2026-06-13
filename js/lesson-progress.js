import { auth } from "../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { completeLesson, getLessonProgress } from "./progress-service.js";

const moduleId = document.body.dataset.module;
const lessonId = document.body.dataset.lesson;

function setCompletedButton() {
  const btn = document.getElementById("completeBtn");

  if (!btn) return;

  btn.innerText = "Completed \u2713";
  btn.disabled = true;
  btn.style.background = "#64748b";
  btn.style.borderColor = "#64748b";
  btn.style.cursor = "not-allowed";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../../login.html";
    return;
  }

  const progress = await getLessonProgress(user.uid, moduleId, lessonId);

  if (progress?.completed === true) {
    setCompletedButton();
  }
});

window.markComplete = async function() {
  const user = auth.currentUser;

  if (!user) {
    alert("Please login first.");
    return;
  }

  await completeLesson(user.uid, moduleId, lessonId);
  setCompletedButton();
  alert("Lesson Completed!");
};
