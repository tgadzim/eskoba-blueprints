import { auth } from "../firebase/config.js";

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

window.loginUser = async function() {

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    window.location.href = "home.html";

  } catch(error) {

    alert(error.message);

  }

}
