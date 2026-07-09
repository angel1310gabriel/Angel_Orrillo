import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');

    let uuid: string | undefined;
    if (collectorId) {
      // collectorId could be a Firebase UID → resolve to profile UUID
      const profile = await db.profiles.findFirst({
        where: { firebaseUid: collectorId },
        select: { id: true },
      });
      if (profile) {
        uuid = profile.id;
      } else {
        // Maybe it's already a UUID
        uuid = collectorId;
      }
    }

    const where: Record<string, unknown> = {};
    if (uuid) where.userId = uuid;

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

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
        createdAt: n.createdAt?.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[Notifications] Error:', error);
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 });
  }
}
