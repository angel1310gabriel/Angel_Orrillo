import { NextRequest, NextResponse } from 'next/server';
import { findFirst, findMany, collections } from '@/lib/firestore-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');

    let uuid: string | undefined;
    if (collectorId) {
      const profile = await findFirst(collections.profiles, { firebaseUid: collectorId });
      if (profile) {
        uuid = profile.id;
      } else {
        uuid = collectorId;
      }
    }

    const where: Record<string, unknown> = {};
    if (uuid) where.userId = uuid;

    const notifications = await findMany(collections.notifications, where, { field: 'createdAt', direction: 'desc' }, 50);

    return NextResponse.json(
      notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        title: n.title,
        body: n.body,
        type: n.type,
        referenceType: n.referenceType,
        referenceId: n.referenceId,
        isRead: n.isRead,
        createdAt: n.createdAt,
      }))
    );
  } catch (error) {
    console.error('[Notifications] Error:', error);
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 });
  }
}
