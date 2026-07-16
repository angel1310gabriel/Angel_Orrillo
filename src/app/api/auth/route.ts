import { NextRequest, NextResponse } from 'next/server';
import {
  findFirst,
  findById,
  findProfileByEmail,
  findProfileByFirebaseUid,
  findManyProfiles,
  collections,
} from '@/lib/firestore-db';
import { requireRole } from '@/lib/route-guard';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'login':
        return await handleLogin(body);
      case 'change-password':
        return await handleChangePassword(request, body);
      case 'sync-users':
        return await handleSyncUsers();
      case 'sync-data':
        return await handleSyncData();
      default:
        return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Auth API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', detail: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = authHeader?.replace('Bearer ', '');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    let profile = await findById(collections.profiles, userId);
    if (!profile) profile = await findProfileByFirebaseUid(userId);

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role || 'collector',
        phone: profile.phone,
        documentNumber: profile.dni || profile.documentNumber,
        isActive: profile.is_active ?? profile.isActive ?? true,
      },
    });
  } catch (error) {
    console.error('[Auth API] GET error:', error);
    return NextResponse.json({ success: false, error: 'Error de sesión' }, { status: 500 });
  }
}

async function handleLogin(body: { username: string; password: string }) {
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json(
      { success: false, error: 'DNI/correo y contraseña son requeridos' },
      { status: 400 }
    );
  }

  const isEmail = username.includes('@');
  const isPhone = /^9\d{8}$/.test(username);

  let emailToTry = username;
  let step1ProfileId: string | null = null;

  if (!isEmail) {
    let profileLookup: Record<string, unknown> | null = null;

    if (isPhone) {
      profileLookup = await findFirst(collections.profiles, { phone: username });
    } else {
      profileLookup = await findFirst(collections.profiles, { documentNumber: username });
    }

    if (!profileLookup && !isPhone) {
      profileLookup = await findFirst(collections.profiles, { phone: username });
    } else if (!profileLookup && isPhone) {
      profileLookup = await findFirst(collections.profiles, { documentNumber: username });
    }

    if (profileLookup?.email) {
      emailToTry = String(profileLookup.email);
      step1ProfileId = String(profileLookup.id || '');
    } else {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado en el sistema' },
        { status: 401 }
      );
    }
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCYbYHvlGwOLY071631rtb2A-j0MVPQeMo';

  let firebaseUser: { localId: string; email: string; displayName?: string; registered: boolean };
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToTry, password, returnSecureToken: true }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error('[Auth] Firebase signIn error:', data.error?.message);
      return NextResponse.json(
        { success: false, error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }
    firebaseUser = data;
  } catch (err) {
    console.error('[Auth] Firebase signIn network error:', err);
    return NextResponse.json(
      { success: false, error: 'Error de conexión con el servidor de autenticación' },
      { status: 500 }
    );
  }

  let profile = await findById(collections.profiles, firebaseUser.localId);
  if (!profile) profile = await findProfileByFirebaseUid(firebaseUser.localId);
  if (!profile) profile = await findProfileByEmail(emailToTry);
  if (!profile && step1ProfileId) profile = await findById(collections.profiles, step1ProfileId);

  const userRole = profile?.role || 'collector';

  const user = {
    id: firebaseUser.localId,
    email: profile?.email || firebaseUser.email || emailToTry,
    name: profile?.name || firebaseUser.displayName || emailToTry.split('@')[0],
    role: userRole,
    phone: profile?.phone || null,
    documentNumber: profile?.documentNumber || null,
    isActive: profile?.isActive ?? true,
  };

  return NextResponse.json({ success: true, user });
}

async function handleChangePassword(request: NextRequest, body: { userId: string; newPassword: string }) {
  const auth = await requireRole(request, ['admin']);
  if (auth instanceof NextResponse) return auth;

  const { userId, newPassword } = body;

  if (!userId || !newPassword) {
    return NextResponse.json(
      { success: false, error: 'Todos los campos son requeridos' },
      { status: 400 }
    );
  }

  try {
    const { createSign } = await import('crypto');
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/identitytoolkit',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const sigInput = `${b64(header)}.${b64(jwtPayload)}`;
    const sign = createSign('RSA-SHA256');
    sign.update(sigInput);
    const signature = sign.sign(sa.private_key, 'base64url');
    const jwt = `${sigInput}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'OAuth error');

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCYbYHvlGwOLY071631rtb2A-j0MVPQeMo'}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: userId, password: newPassword, returnSecureToken: false }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Firebase error');

    return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error: any) {
    console.error('[Auth] Firebase updateUser error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar contraseña' },
      { status: 500 }
    );
  }
}

async function handleSyncUsers() {
  try {
    const profiles = await findManyProfiles();
    return NextResponse.json({
      success: true,
      message: `${profiles.length} usuarios disponibles`,
      synced: profiles.length,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error al sincronizar' },
      { status: 500 }
    );
  }
}

async function handleSyncData() {
  return NextResponse.json({
    success: true,
    message: 'Usando Firestore directamente - no se necesita sync',
  });
}
