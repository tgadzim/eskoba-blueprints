import { auth, db } from "../firebase/config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const moduleId = "meta-advertising-andromeda2026";
const lessonId = "lesson-2";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../../login.html";
    return;
  }

  const progressRef = doc(db, "progress", user.uid, "lessons", lessonId);
  const progressSnap = await getDoc(progressRef);

  const btn = document.getElementById("completeBtn");

  if (progressSnap.exists() && progressSnap.data().completed === true) {
    btn.innerText = "Completed ✓";
    btn.disabled = true;
    btn.style.background = "#64748b";
  }
});

window.markComplete = async function() {
  const user = auth.currentUser;

  if (!user) {
    alert("Please login first.");
    return;
  }

  const progressRef = doc(db, "progress", user.uid, "lessons", lessonId);

  await setDoc(progressRef, {
    moduleId: moduleId,
    lessonId: lessonId,
    completed: true,
    completedAt: serverTimestamp()
  });

  const btn = document.getElementById("completeBtn");
  btn.innerText = "Completed ✓";
  btn.disabled = true;
  btn.style.background = "#64748b";

  alert("Lesson marked as complete.");
};
