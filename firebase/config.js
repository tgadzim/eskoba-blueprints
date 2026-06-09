import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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

export const auth = getAuth(app);
export const db = getFirestore(app);
