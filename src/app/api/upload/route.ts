import { NextRequest, NextResponse } from 'next/server';
import { updateDoc, collections, findProfileByFirebaseUid } from '@/lib/firestore-db';
import { getAuthUser } from '@/lib/route-guard';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Se requiere autenticación' }, { status: 401 });
    }

    const { profileId, base64, contentType } = await request.json();
    if (!profileId || !base64) {
      return NextResponse.json({ error: 'profileId y base64 son requeridos' }, { status: 400 });
    }

    // Solo el propio usuario o un admin puede cambiar la foto
    const profile = await findProfileByFirebaseUid(auth.uid);
    const isAdmin = profile?.role === 'admin';
    if (auth.uid !== profileId && !isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const mime = contentType || 'image/png';
    const maxSize = 500 * 1024;
    const buf = Buffer.from(base64, 'base64');
    if (buf.length > maxSize) {
      return NextResponse.json({ error: 'La imagen es demasiado grande (máx 500KB)' }, { status: 400 });
    }

    const photoUrl = `data:${mime};base64,${base64}`;

    await updateDoc(collections.profiles, profileId, { photoUrl });

    return NextResponse.json({ url: photoUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al subir' }, { status: 500 });
  }
}
