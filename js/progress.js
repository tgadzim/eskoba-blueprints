import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRrUPI-z0JWD-q5UdmLf_7V09zRDHKbYY",
  authDomain: "eskoba-marketing.firebaseapp.com",
  projectId: "eskoba-marketing",
  storageBucket: "eskoba-marketing.firebasestorage.app",
  messagingSenderId: "940559185905",
  appId: "1:940559185905:web:f561e9b3b863f737097650",
  measurementId: "G-9CCPK3Q9K8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const moduleId = "meta-advertising-andromeda2026";
const lessonId = "lesson-2";

function setCompletedButton() {
  const btn = document.getElementById("completeBtn");

  if (!btn) return;

  btn.innerText = "Completed ✓";
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

  const progressRef = doc(db, "progress", user.uid, "lessons", lessonId);
  const progressSnap = await getDoc(progressRef);

  if (progressSnap.exists() && progressSnap.data().completed === true) {
    setCompletedButton();
  }
});

window.markComplete = async function() {
  const user = auth.currentUser;

  if (!user) {
    alert("Please login first");
    return;
  }

  await setDoc(
    doc(db, "progress", user.uid, "lessons", lessonId),
    {
      moduleId: moduleId,
      lessonId: lessonId,
      completed: true,
      completedAt: new Date()
    }
  );

  setCompletedButton();

  alert("Lesson Completed!");
};
