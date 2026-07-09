import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function resolveUid(input: string): Promise<string> {
  // Try to resolve Firebase UID → profile UUID
  const profile = await db.profiles.findFirst({
    where: { firebase_uid: input },
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
      const messages = await db.chat_messages.findMany({
        where: {
          OR: [
            { sender_id: uuid },
            { receiver_id: uuid },
          ],
        },
        orderBy: { created_at: 'desc' },
      });

      // Build contacts list
      const contactIds = new Set<string>();
      messages.forEach((m) => {
        if (m.sender_id !== uuid) contactIds.add(m.sender_id);
        if (m.receiver_id !== uuid) contactIds.add(m.receiver_id);
      });

      const profiles = await db.profiles.findMany({
        where: { id: { in: Array.from(contactIds) } },
        select: { id: true, name: true, email: true, role: true, is_active: true },
      });

      // Track latest message per contact
      const latestPerContact: Record<string, typeof messages[0]> = {};
      messages.forEach((m) => {
        const contactId = m.sender_id === uuid ? m.receiver_id : m.sender_id;
        if (!latestPerContact[contactId] || m.created_at! > latestPerContact[contactId].created_at!) {
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
          isActive: p.is_active,
          lastMessage: lastMsg ? {
            message: lastMsg.message,
            createdAt: lastMsg.created_at?.toISOString(),
            isRead: lastMsg.is_read,
            senderId: lastMsg.sender_id,
          } : null,
          unread: messages.filter((m) => m.sender_id === p.id && !m.is_read).length,
        };
      });

      return NextResponse.json({ contacts });
    }

    if (senderId && receiverId) {
      const uuid1 = await resolveUid(senderId);
      const uuid2 = await resolveUid(receiverId);
      const messages = await db.chat_messages.findMany({
        where: {
          OR: [
            { sender_id: uuid1, receiver_id: uuid2 },
            { sender_id: uuid2, receiver_id: uuid1 },
          ],
        },
        orderBy: { created_at: 'asc' },
      });

      return NextResponse.json({
        messages: messages.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          receiverId: m.receiver_id,
          message: m.message,
          isRead: m.is_read,
          createdAt: m.created_at?.toISOString(),
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

    const msg = await db.chat_messages.create({
      data: {
        sender_id: uuidSender,
        receiver_id: uuidReceiver,
        message,
        is_read: false,
      },
    });

    return NextResponse.json({
      id: msg.id,
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      message: msg.message,
      isRead: msg.is_read,
      createdAt: msg.created_at?.toISOString(),
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

    await db.chat_messages.updateMany({
      where: { id: { in: messageIds } },
      data: { is_read: true },
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

    await db.chat_messages.deleteMany({
      where: {
        OR: [
          { sender_id: uuidUser, receiver_id: uuidContact },
          { sender_id: uuidContact, receiver_id: uuidUser },
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ChatMessages] Error deleting:', error);
    return NextResponse.json({ error: 'Error al eliminar conversación' }, { status: 500 });
  }
}
