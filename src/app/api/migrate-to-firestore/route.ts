import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GoogleAuth } from 'google-auth-library';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'cobranzas-kc';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function getCredentials() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    try { return JSON.parse(sa); } catch {}
  }
  return {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    project_id: PROJECT_ID,
  };
}

let _token: string | null = null;
let _tokenExpiry = 0;

async function getAuthToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const creds = getCredentials();
  if (!creds.client_email || !creds.private_key) throw new Error('Credenciales Firebase no configuradas');
  const auth = new GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/datastore'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  _token = token.token;
  _tokenExpiry = Date.now() + 55 * 60 * 1000;
  return _token;
}

async function firestoreWrite(collection: string, docId: string, data: any) {
  const token = await getAuthToken();
  const url = `${FIRESTORE_URL}/${collection}?documentId=${docId}`;
  const body = { fields: toDocumentFields(data) };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Firestore error ${res.status}: ${err.substring(0, 200)}`);
  }
}

function toDocumentFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) {
      if (typeof v === 'string' && v.length > 500000) {
        console.warn(`Skipping oversized field "${k}" (${v.length} bytes)`);
        continue;
      }
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

function toFirestoreValue(obj: any): any {
  if (obj === null || obj === undefined) return { nullValue: null };
  if (typeof obj === 'string') return { stringValue: obj };
  if (typeof obj === 'number') return Number.isInteger(obj) && Math.abs(obj) < 9007199254740991 ? { integerValue: String(obj) } : { doubleValue: obj };
  if (typeof obj === 'boolean') return { booleanValue: obj };
  if (typeof obj.toNumber === 'function') {
    const n = obj.toNumber();
    return Number.isInteger(n) && Math.abs(n) < 9007199254740991 ? { integerValue: String(Math.floor(n)) } : { doubleValue: n };
  }
  if (obj instanceof Date) return { timestampValue: obj.toISOString() };
  if (Array.isArray(obj)) return { arrayValue: { values: obj.map(toFirestoreValue) } };
  if (typeof obj === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(obj) };
}

function toPlainObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'object') {
    if (typeof obj.toNumber === 'function') return obj.toNumber();
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(toPlainObject);
    const plain: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined) plain[k] = toPlainObject(v);
    }
    return plain;
  }
  return obj;
}

async function migrateCollection(name: string) {
  const data = await (db as any)[name].findMany();
  if (data.length === 0) return 0;
  if (name === 'profiles') {
    console.log('First profile:', JSON.stringify(toPlainObject(data[0])).substring(0, 1000));
  }
  let count = 0;
  for (const record of data) {
    const doc = toPlainObject(record);
    const id = doc.id;
    delete doc.id;
    await firestoreWrite(name, id, doc);
    count++;
  }
  return count;
}

const COLLECTIONS = [
  'profiles', 'clients', 'loans', 'payments', 'guarantors',
  'zones', 'collector_zones', 'audit_logs', 'daily_settlements',
  'capital_movements', 'late_fees', 'notifications', 'chat_messages',
  'payment_links', 'payment_schedule', 'collector_expenses',
  'caja_movements', 'charge_off_history', 'client_notes',
  'collector_locations', 'collector_current_location', 'settings',
];

export async function GET() {
  try {
    const token = await getAuthToken();
    return NextResponse.json({ status: 'firestore ok', tokenPrefix: token?.substring(0, 10) + '...', collections: COLLECTIONS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const results: Record<string, number> = {};
    for (const col of COLLECTIONS) {
      try {
        const c = await migrateCollection(col);
        results[col] = c;
      } catch (e: any) {
        results[col + '_error'] = e.message;
      }
    }
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
