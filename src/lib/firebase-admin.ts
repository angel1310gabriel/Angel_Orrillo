import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) return JSON.parse(sa);
  return {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID || 'cobranzas-kc',
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  };
}

function initAdmin() {
  if (getApps().length) return getApps()[0];
  const sa = getServiceAccount();
  return initializeApp({
    credential: cert(sa as any),
    projectId: 'cobranzas-kc',
    storageBucket: 'cobranzas-kc.firebasestorage.app',
  });
}

const adminApp = initAdmin();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
