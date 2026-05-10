import admin from "firebase-admin";
import { createRequire } from "module";
import path from "path";
import { ENV } from "./env.js";

const require = createRequire(import.meta.url);

let initialized = false;

const initializeFirebaseAdmin = () => {
  if (admin.apps.length > 0) {
    initialized = true;
    return admin.apps[0];
  }

  const env = ENV();
  const serviceAccountPath = env.firebase_service_account_key;

  if (!serviceAccountPath) {
    console.warn(
      "[Firebase Admin] ⚠️  FIREBASE_SERVICE_ACCOUNT_KEY is not set. " +
      "Push notifications will be unavailable until you add it."
    );
    return null;
  }

  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);

  let serviceAccount;
  try {
    serviceAccount = require(resolvedPath);
  } catch {
    console.warn(
      `[Firebase Admin] ⚠️  Could not load service account key from: ${resolvedPath}\n` +
      "  → Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key\n" +
      "  → Save it as: src/firebaseServiceAccountKey.json\n" +
      "  Push notifications will be unavailable until the file is in place."
    );
    return null;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log("[Firebase Admin] ✓ Initialized successfully");
    return admin.apps[0];
  } catch (err) {
    console.warn(`[Firebase Admin] ⚠️  Initialization failed: ${err.message}`);
    return null;
  }
};


initializeFirebaseAdmin();


export const firebaseMessaging = () => {
  if (!initialized || admin.apps.length === 0) {
    throw new Error(
      "Firebase Admin is not initialized. " +
      "Please add your service account key at src/firebaseServiceAccountKey.json " +
      "and set FIREBASE_SERVICE_ACCOUNT_KEY in src/.env."
    );
  }
  return admin.messaging();
};

export const firebaseAdmin = admin;
export const isFirebaseReady = () => initialized;
