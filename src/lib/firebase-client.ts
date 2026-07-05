import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCYbYHvlGwOLY071631rtb2A-j0MVPQeMo",
  authDomain: "cobranzas-kc.firebaseapp.com",
  projectId: "cobranzas-kc",
  storageBucket: "cobranzas-kc.firebasestorage.app",
  messagingSenderId: "660529791450",
  appId: "1:660529791450:web:412e3e4f86cb8de75100e3",
  measurementId: "G-YS4HDN35KM"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
