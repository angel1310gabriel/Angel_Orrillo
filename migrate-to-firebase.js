// Create Firebase Auth users + Firestore profiles via REST API
const API_KEY = 'AIzaSyCYbYHvlGwOLY071631rtb2A-j0MVPQeMo';
const FIREBASE_URL = 'https://identitytoolkit.googleapis.com/v1';
const FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/cobranzas-kc/databases/(default)/documents';

const users = [
  { email: 'keysyotero@gmail.com', password: '123456', role: 'admin', name: 'Keysy Otero', dni: '12345678', phone: '999888777' },
  { email: 'angelorrillo1@gmail.com', password: '123456', role: 'collector', name: 'Angel Orrillo', dni: '87654321', phone: '987654321' },
];

async function createUser(email, password, role, name, dni, phone) {
  // Step 1: Create Firebase Auth user
  const signUpRes = await fetch(`${FIREBASE_URL}/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const userData = await signUpRes.json();
  if (userData.error) {
    if (userData.error.message === 'EMAIL_EXISTS') {
      // User already exists - sign in to get token
      console.log(`  ${email} already exists, signing in...`);
      const signInRes = await fetch(`${FIREBASE_URL}/accounts:signInWithPassword?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      const signInData = await signInRes.json();
      if (signInData.error) { console.error(`  Error signing in ${email}:`, signInData.error.message); return null; }
      return { localId: signInData.localId, idToken: signInData.idToken };
    }
    console.error(`  Error creating ${email}:`, userData.error.message);
    return null;
  }
  console.log(`  ✓ Created ${email} (${userData.localId})`);
  return { localId: userData.localId, idToken: userData.idToken };
}

async function createProfile(localId, idToken, data) {
  const docPath = `${FIRESTORE_URL}/profiles?documentId=${localId}`;
  const fields = {
    email: { stringValue: data.email },
    name: { stringValue: data.name },
    role: { stringValue: data.role },
    dni: { stringValue: data.dni },
    phone: { stringValue: data.phone },
    is_active: { booleanValue: true },
    created_at: { timestampValue: new Date().toISOString() },
  };
  const res = await fetch(docPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields }),
  });
  const data2 = await res.json();
  if (data2.error) console.error(`  Error creating profile for ${data.email}:`, data2.error.message);
  else console.log(`  ✓ Profile created for ${data.email}`);
}

async function main() {
  for (const u of users) {
    console.log(`\nProcessing ${u.email}...`);
    const result = await createUser(u.email, u.password, u.role, u.name, u.dni, u.phone);
    if (result) {
      await createProfile(result.localId, result.idToken, u);
    }
  }
  console.log('\n✅ Migration complete!');
}

main().catch(console.error);
