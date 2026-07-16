import { createSign } from 'crypto';

let _accessToken: string | null = null;
let _tokenExpiry = 0;

function getServiceAccount() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    try { return JSON.parse(sa); } catch { return null; }
  }
  return {
    project_id: process.env.FIREBASE_PROJECT_ID || 'cobranzas-kc',
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  };
}

async function getAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiry - 60000) return _accessToken;

  const sa = getServiceAccount();
  if (!sa?.private_key || !sa?.client_email) {
    throw new Error('Firestore: missing service account credentials');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const header = { alg: 'RS256', typ: 'JWT' };
  const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signatureInput = `${b64(header)}.${b64(payload)}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(sa.private_key, 'base64url');

  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth2 error: ${err}`);
  }

  const data = await res.json() as any;
  _accessToken = data.access_token;
  _tokenExpiry = now + (data.expires_in || 3600);
  return _accessToken;
}

const API_BASE = 'https://firestore.googleapis.com/v1/projects/cobranzas-kc/databases/(default)/documents';

function toFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') fields[key] = { stringValue: value };
    else if (typeof value === 'number') {
      if (Number.isInteger(value)) fields[key] = { integerValue: value };
      else fields[key] = { doubleValue: value };
    }
    else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
    else if (value instanceof Date) fields[key] = { timestampValue: value.toISOString() };
    else if (Array.isArray(value)) fields[key] = { arrayValue: { values: value.map(v => toFields({ v }).v).filter(Boolean) } };
    else if (typeof value === 'object') fields[key] = { mapValue: { fields: toFields(value) } };
  }
  return fields;
}

function fromFields(fields: Record<string, any>): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value.stringValue !== undefined) obj[key] = value.stringValue;
    else if (value.integerValue !== undefined) obj[key] = Number(value.integerValue);
    else if (value.doubleValue !== undefined) obj[key] = value.doubleValue;
    else if (value.booleanValue !== undefined) obj[key] = value.booleanValue;
    else if (value.timestampValue) obj[key] = value.timestampValue;
    else if (value.arrayValue) {
      obj[key] = (value.arrayValue.values || []).map((v: any) => fromFields(v));
    }
    else if (value.mapValue?.fields) obj[key] = fromFields(value.mapValue.fields);
  }
  return obj;
}

function docToObject(doc: any): Record<string, any> | null {
  if (!doc || !doc.name || !doc.fields) return null;
  const id = doc.name.split('/').pop();
  return { id, ...fromFields(doc.fields) };
}

function toValue(v: any): Record<string, any> {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: v } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  return { stringValue: String(v) };
}

export async function restFindMany(collection: string, where?: Record<string, unknown>, limit?: number): Promise<any[]> {
  const token = await getAccessToken();

  let url = `${API_BASE}/${collection}`;
  if (where && Object.keys(where).length > 0) {
    url = `${API_BASE}:runQuery`;
    const filters: any[] = [];
    for (const [k, v] of Object.entries(where)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v) && v[0] === 'in' && Array.isArray(v[1])) {
        filters.push({
          fieldFilter: { field: { fieldPath: k }, op: 'IN', value: { arrayValue: { values: v[1].map(toValue) } } },
        });
      } else {
        filters.push({ fieldFilter: { field: { fieldPath: k }, op: 'EQUAL', value: toValue(v) } });
      }
    }

    const body: any = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          compositeFilter: { op: 'AND', filters },
        },
      },
    };
    if (limit) body.structuredQuery.limit = limit;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Firestore query error: ${err}`);
    }

    const data = await res.json() as any;
    return (data || []).map((r: any) => docToObject(r.document)).filter(Boolean);
  }

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Firestore fetch error: ${await res.text()}`);
  const data = await res.json() as any;
  return (data.documents || []).map((d: any) => docToObject(d));
}

export async function restFindFirst(collection: string, where: Record<string, unknown>): Promise<any> {
  const results = await restFindMany(collection, where, 1);
  return results.length > 0 ? results[0] : null;
}

export async function restFindById(collection: string, id: string): Promise<any> {
  const token = await getAccessToken();
  const url = `${API_BASE}/${collection}/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore get error: ${await res.text()}`);
  const data = await res.json() as any;
  return docToObject(data);
}

export async function restCreateDoc(collection: string, data: Record<string, unknown>, id?: string): Promise<any> {
  const token = await getAccessToken();
  const fields = toFields({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  let url = `${API_BASE}/${collection}`;
  if (id) url += `?documentId=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore create error: ${await res.text()}`);
  const doc = await res.json() as any;
  return { id: doc.name?.split('/').pop(), ...data };
}

export async function restUpdateDoc(collection: string, id: string, data: Record<string, unknown>): Promise<any> {
  const token = await getAccessToken();
  const allData = { ...data, updatedAt: new Date().toISOString() };
  const fields = toFields(allData);
  const fieldPaths = Object.keys(allData).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`);
  const url = `${API_BASE}/${collection}/${encodeURIComponent(id)}?${fieldPaths.join('&')}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore update error: ${await res.text()}`);
  const doc = await res.json() as any;
  return docToObject(doc);
}

export async function restDeleteDoc(collection: string, id: string) {
  const token = await getAccessToken();
  const url = `${API_BASE}/${collection}/${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Firestore delete error: ${await res.text()}`);
  return { id };
}
