import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    try { return JSON.parse(sa); } catch { return null; }
  }
  return {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID || 'cobranzas-kc',
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  };
}

let _app: App | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function ensureApp(): App | null {
  if (_app) return _app;
  if (getApps().length) { _app = getApps()[0]; return _app; }
  try {
    const sa = getServiceAccount();
    if (!sa || !sa.private_key || !sa.client_email) return null;
    _app = initializeApp({
      credential: cert(sa as any),
      projectId: 'cobranzas-kc',
      storageBucket: 'cobranzas-kc.firebasestorage.app',
    });
    return _app;
  } catch { return null; }
}

export function getAdminAuth(): Auth | null {
  if (_auth) return _auth;
  const app = ensureApp();
  if (!app) return null;
  _auth = getAuth(app);
  return _auth;
}

export function getAdminDb(): Firestore | null {
  if (_db) return _db;
  const app = ensureApp();
  if (!app) return null;
  _db = getFirestore(app);
  return _db;
}
