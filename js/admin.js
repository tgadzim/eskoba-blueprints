import { auth, db } from "../firebase/config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const lessons = ["lesson-1", "lesson-2"];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const usersList = document.getElementById("usersList");
  usersList.innerHTML = "";

  const usersSnapshot = await getDocs(collection(db, "users"));

  for (const userDoc of usersSnapshot.docs) {
    const data = userDoc.data();
    const userId = userDoc.id;

    let completed = 0;

    for (const lessonId of lessons) {
      const progressRef = doc(db, "progress", userId, "lessons", lessonId);
      const progressSnap = await getDoc(progressRef);

      if (progressSnap.exists() && progressSnap.data().completed === true) {
        completed++;
      }
    }

    const percent = Math.round((completed / lessons.length) * 100);

    usersList.innerHTML += `
      <div style="padding:18px; border-bottom:1px solid #e5e7eb;">
        <strong>${data.name}</strong><br>
        ${data.email}<br>
        ${data.role} • ${data.company}<br><br>

        <strong>Progress:</strong> ${completed} / ${lessons.length} lessons completed (${percent}%)

        <div style="background:#e5e7eb; height:10px; border-radius:999px; overflow:hidden; margin-top:10px;">
          <div style="background:#2563eb; height:100%; width:${percent}%;"></div>
        </div>
      </div>
    `;
  }
});
