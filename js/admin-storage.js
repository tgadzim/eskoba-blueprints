import { storage } from "../firebase/config.js";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

function safeFilename(filename) {
  return String(filename || "file")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";
}

export async function uploadAdminFile(file, folderPath) {
  if (!file) return null;

  const path = `${folderPath}/${Date.now()}-${safeFilename(file.name)}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream"
  });

  return {
    path,
    url: await getDownloadURL(storageRef)
  };
}
