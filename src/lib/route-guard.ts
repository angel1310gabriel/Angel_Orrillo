import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken, type VerifiedUser } from './auth-verify';
import { findProfileByFirebaseUid } from './firestore-db';

export function getTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function getAuthUser(request: NextRequest): Promise<VerifiedUser | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  try {
    return await verifyFirebaseToken(token);
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<VerifiedUser | NextResponse> {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: 'Se requiere autenticación' }, { status: 401 });
  }
  try {
    return await verifyFirebaseToken(token);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Token inválido' }, { status: 401 });
  }
}

export async function requireRole(request: NextRequest, roles: string[]): Promise<{ user: VerifiedUser; profile: any } | NextResponse> {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  let profile: any;
  try {
    profile = await findProfileByFirebaseUid(user.uid);
  } catch {
    return NextResponse.json({ error: 'Error al verificar permisos' }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
  }

  if (!roles.includes(profile.role as string)) {
    return NextResponse.json({ error: `Se requiere rol: ${roles.join(' o ')}` }, { status: 403 });
  }

  return { user, profile };
}
