import { auth } from "../firebase/config.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginError = document.getElementById("loginError");

function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginBtnText.textContent = isLoading ? "Signing in" : "Sign in";
}

function showError(message) {
  loginError.textContent = message;
  loginError.hidden = false;
}

function getLoginErrorMessage(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email or password is incorrect. Please check your credentials and try again.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many unsuccessful attempts. Please wait a moment before trying again.";
    case "auth/network-request-failed":
      return "Unable to reach Firebase Authentication. Check your connection and try again.";
    case "auth/unauthorized-domain":
      return "This address is not authorized for sign-in. Open the LMS at http://localhost:5500.";
    default:
      return error.message || "Unable to sign in. Please try again.";
  }
}

async function loginUser() {
  loginError.hidden = true;
  setLoading(true);

  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );

    window.location.assign("dashboard.html");
  } catch (error) {
    console.error("Sign-in error:", error);
    showError(getLoginErrorMessage(error));
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loginUser();
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.assign("dashboard.html");
  }
});
