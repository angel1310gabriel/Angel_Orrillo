import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function resolveUid(input: string): Promise<string> {
  // Try to resolve Firebase UID → profile UUID
  const profile = await db.profiles.findFirst({
    where: { firebaseUid: input },
    select: { id: true },
  });
  return profile ? profile.id : input;
}

function getUuid(input: string): string {
  // Simple UUID format check (hex-hex-hex-hex-hex)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input) ? input : '';
}

// GET /api/chat-messages — Get conversations (userId) or messages (senderId+receiverId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const senderId = searchParams.get('senderId');
    const receiverId = searchParams.get('receiverId');
    const userId = searchParams.get('userId');

    if (userId) {
      const uuid = await resolveUid(userId);
      const messages = await db.chatMessage.findMany({
        where: {
          OR: [
            { senderId: uuid },
            { receiverId: uuid },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      // Build contacts list
      const contactIds = new Set<string>();
      messages.forEach((m) => {
        if (m.senderId !== uuid) contactIds.add(m.senderId);
        if (m.receiverId !== uuid) contactIds.add(m.receiverId);
      });

      const profiles = await db.profiles.findMany({
        where: { id: { in: Array.from(contactIds) } },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });

      // Track latest message per contact
      const latestPerContact: Record<string, typeof messages[0]> = {};
      messages.forEach((m) => {
        const contactId = m.senderId === uuid ? m.receiverId : m.senderId;
        if (!latestPerContact[contactId] || m.createdAt! > latestPerContact[contactId].createdAt!) {
          latestPerContact[contactId] = m;
        }
      });

      const contacts = profiles.map((p) => {
        const lastMsg = latestPerContact[p.id];
        return {
          id: p.id,
          name: p.name,
          email: p.email || '',
          role: p.role,
          isActive: p.isActive,
          lastMessage: lastMsg ? {
            message: lastMsg.message,
            createdAt: lastMsg.createdAt?.toISOString(),
            isRead: lastMsg.isRead,
            senderId: lastMsg.senderId,
          } : null,
          unread: messages.filter((m) => m.senderId === p.id && !m.isRead).length,
        };
      });

      return NextResponse.json({ contacts });
    }

    if (senderId && receiverId) {
      const uuid1 = await resolveUid(senderId);
      const uuid2 = await resolveUid(receiverId);
      const messages = await db.chatMessage.findMany({
        where: {
          OR: [
            { senderId: uuid1, receiverId: uuid2 },
            { senderId: uuid2, receiverId: uuid1 },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({
        messages: messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          receiverId: m.receiverId,
          message: m.message,
          isRead: m.isRead,
          createdAt: m.createdAt?.toISOString(),
        })),
      });
    }

    return NextResponse.json({ error: 'senderId y receiverId, o userId requeridos' }, { status: 400 });
  } catch (error) {
    console.error('[ChatMessages] Error:', error);
    return NextResponse.json({ error: 'Error al obtener mensajes' }, { status: 500 });
  }
}

// POST /api/chat-messages — Create a new message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderId, receiverId, message } = body;

    if (!senderId || !receiverId || !message) {
      return NextResponse.json({ error: 'senderId, receiverId y message requeridos' }, { status: 400 });
    }

    const uuidSender = await resolveUid(senderId);
    const uuidReceiver = await resolveUid(receiverId);

    const msg = await db.chatMessage.create({
      data: {
        senderId: uuidSender,
        receiverId: uuidReceiver,
        message,
        isRead: false,
      },
    });

    return NextResponse.json({
      id: msg.id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      message: msg.message,
      isRead: msg.isRead,
      createdAt: msg.createdAt?.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[ChatMessages] Error creating:', error);
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 });
  }
}

// PUT /api/chat-messages — Mark messages as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageIds } = body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'messageIds requerido' }, { status: 400 });
    }

    await db.chatMessage.updateMany({
      where: { id: { in: messageIds } },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ChatMessages] Error marking read:', error);
    return NextResponse.json({ error: 'Error al marcar mensajes' }, { status: 500 });
  }
}

// DELETE /api/chat-messages?userId=xxx&contactId=xxx — Delete conversation
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const contactId = searchParams.get('contactId');

    if (!userId || !contactId) {
      return NextResponse.json({ error: 'userId y contactId requeridos' }, { status: 400 });
    }

    const uuidUser = await resolveUid(userId);
    const uuidContact = await resolveUid(contactId);

    await db.chatMessage.deleteMany({
      where: {
        OR: [
          { senderId: uuidUser, receiverId: uuidContact },
          { senderId: uuidContact, receiverId: uuidUser },
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ChatMessages] Error deleting:', error);
    return NextResponse.json({ error: 'Error al eliminar conversación' }, { status: 500 });
  }
}
