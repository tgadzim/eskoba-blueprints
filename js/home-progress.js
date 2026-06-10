import { auth, db } from "../firebase/config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const lessons = ["lesson-1", "lesson-2"];

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  let completed = 0;

  for (const lessonId of lessons) {
    const ref = doc(db, "progress", user.uid, "lessons", lessonId);
    const snap = await getDoc(ref);

    if (snap.exists() && snap.data().completed === true) {
      completed++;
    }
  }

  const percent = Math.round((completed / lessons.length) * 100);

  document.getElementById("moduleProgressText").innerText = `${percent}% completed`;
  document.getElementById("moduleProgressBar").style.width = `${percent}%`;
});
