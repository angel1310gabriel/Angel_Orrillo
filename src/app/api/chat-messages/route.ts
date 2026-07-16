import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, createDoc, updateDoc, deleteDoc, collections } from '@/lib/firestore-db';

function toISO(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (val && typeof val === 'object' && 'toDate' in val) return (val as any).toDate().toISOString();
  return String(val);
}

async function resolveUid(input: string): Promise<string> {
  const profile = await findFirst(collections.profiles, { firebaseUid: input });
  return profile ? profile.id : input;
}

function getUuid(input: string): string {
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
      const sent = await findMany(collections.chatMessages, { senderId: uuid });
      const received = await findMany(collections.chatMessages, { receiverId: uuid });
      const allMessages = [...sent, ...received];

      const seen = new Set<string>();
      const messages = allMessages.filter((m: any) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      messages.sort((a: any, b: any) => {
        const aDate = typeof a.createdAt === 'string' ? a.createdAt : '';
        const bDate = typeof b.createdAt === 'string' ? b.createdAt : '';
        return bDate.localeCompare(aDate);
      });

      const contactIds = new Set<string>();
      messages.forEach((m: any) => {
        if (m.senderId !== uuid) contactIds.add(m.senderId);
        if (m.receiverId !== uuid) contactIds.add(m.receiverId);
      });

      const profiles = await findMany(collections.profiles);
      const filteredProfiles = profiles.filter((p: any) => contactIds.has(p.id));

      const latestPerContact: Record<string, any> = {};
      messages.forEach((m: any) => {
        const contactId = m.senderId === uuid ? m.receiverId : m.senderId;
        const mDate = typeof m.createdAt === 'string' ? m.createdAt : '';
        if (!latestPerContact[contactId]) {
          latestPerContact[contactId] = m;
        } else {
          const existingDate = typeof latestPerContact[contactId].createdAt === 'string'
            ? latestPerContact[contactId].createdAt : '';
          if (mDate > existingDate) {
            latestPerContact[contactId] = m;
          }
        }
      });

      const contacts = filteredProfiles.map((p: any) => {
        const lastMsg = latestPerContact[p.id];
        return {
          id: p.id,
          name: p.name,
          email: p.email || '',
          role: p.role,
          isActive: p.isActive,
          lastMessage: lastMsg ? {
            message: lastMsg.message,
            createdAt: toISO(lastMsg.createdAt),
            isRead: lastMsg.isRead,
            senderId: lastMsg.senderId,
          } : null,
          unread: messages.filter((m: any) => m.senderId === p.id && !m.isRead).length,
        };
      });

      return NextResponse.json({ contacts });
    }

    if (senderId && receiverId) {
      const uuid1 = await resolveUid(senderId);
      const uuid2 = await resolveUid(receiverId);
      const msgs1 = await findMany(collections.chatMessages, { senderId: uuid1, receiverId: uuid2 });
      const msgs2 = await findMany(collections.chatMessages, { senderId: uuid2, receiverId: uuid1 });
      const messages = [...msgs1, ...msgs2].sort((a: any, b: any) => {
        const aDate = typeof a.createdAt === 'string' ? a.createdAt : '';
        const bDate = typeof b.createdAt === 'string' ? b.createdAt : '';
        return aDate.localeCompare(bDate);
      });

      return NextResponse.json({
        messages: messages.map((m: any) => ({
          id: m.id,
          senderId: m.senderId,
          receiverId: m.receiverId,
          message: m.message,
          isRead: m.isRead,
          createdAt: toISO(m.createdAt),
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

    const msg = await createDoc(collections.chatMessages, {
      senderId: uuidSender,
      receiverId: uuidReceiver,
      message,
      isRead: false,
    });

    return NextResponse.json({
      id: msg.id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      message: msg.message,
      isRead: msg.isRead,
      createdAt: msg.createdAt,
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

    await Promise.all(
      messageIds.map((id: string) => updateDoc(collections.chatMessages, id, { isRead: true }))
    );

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

    const msgs1 = await findMany(collections.chatMessages, { senderId: uuidUser, receiverId: uuidContact });
    const msgs2 = await findMany(collections.chatMessages, { senderId: uuidContact, receiverId: uuidUser });
    const allIds = [...msgs1.map((m: any) => m.id), ...msgs2.map((m: any) => m.id)];

    await Promise.all(allIds.map((id: string) => deleteDoc(collections.chatMessages, id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ChatMessages] Error deleting:', error);
    return NextResponse.json({ error: 'Error al eliminar conversación' }, { status: 500 });
  }
}
