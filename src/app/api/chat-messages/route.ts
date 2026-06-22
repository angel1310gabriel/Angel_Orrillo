import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// DELETE /api/chat-messages?userId=xxx&contactId=xxx - Delete conversation
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const contactId = searchParams.get('contactId');

    if (!userId || !contactId) {
      return NextResponse.json({ error: 'userId y contactId son requeridos' }, { status: 400 });
    }

    const supabase = await getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .or(`and(sender_id.eq.${userId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userId})`);

        if (!error) {
          // Also delete local
          if (!isVercel) {
            await db.chatMessage.deleteMany({
              where: {
                OR: [
                  { senderId: userId, receiverId: contactId },
                  { senderId: contactId, receiverId: userId },
                ],
              },
            });
          }
          return NextResponse.json({ success: true });
        }
      } catch (error) {
        console.error('Supabase delete failed, falling back:', error);
      }
    }

    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma
    await db.chatMessage.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: contactId },
          { senderId: contactId, receiverId: userId },
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Error al eliminar conversación' }, { status: 500 });
  }
}

async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }
    if (!isVercel) {
      const urlSetting = await db.setting.findUnique({ where: { key: 'supabase_url' } });
      const keySetting = await db.setting.findUnique({ where: { key: 'supabase_anon_key' } });
      const serviceKeySetting = await db.setting.findUnique({ where: { key: 'supabase_service_role_key' } });
      const url = urlSetting?.value;
      const key = serviceKeySetting?.value || keySetting?.value;
      if (url && key) {
        const { createClient } = await import('@supabase/supabase-js');
        return createClient(url, key);
      }
    }
  } catch { /* not configured */ }
  return null;
}

// GET /api/chat-messages - Get messages or conversations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const senderId = searchParams.get('senderId');
    const receiverId = searchParams.get('receiverId');
    const userId = searchParams.get('userId');

    // Try Supabase first
    const supabase = await getSupabase();
    if (supabase) {
      try {
        if (userId) {
          // Get conversations (unique contacts) for a user
          const { data: sent, error: sentErr } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('sender_id', userId)
            .order('created_at', { ascending: false });

          const { data: received, error: recvErr } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('receiver_id', userId)
            .order('created_at', { ascending: false });

          if (!sentErr && !recvErr) {
            const allMessages = [...(sent || []), ...(received || [])];
            const contactIds = new Set<string>();
            allMessages.forEach((m: Record<string, unknown>) => {
              if (m.sender_id !== userId) contactIds.add(m.sender_id as string);
              if (m.receiver_id !== userId) contactIds.add(m.receiver_id as string);
            });

            // Sync to local in background
            syncMessagesToLocal(sent || []).catch(() => {});
            syncMessagesToLocal(received || []).catch(() => {});

            // Get latest message per contact
            const latestPerContact: Record<string, Record<string, unknown>> = {};
            allMessages.forEach((m: Record<string, unknown>) => {
              const contactId = m.sender_id === userId ? m.receiver_id : m.sender_id;
              const createdAt = m.created_at as string;
              if (!latestPerContact[contactId as string] || createdAt > (latestPerContact[contactId as string].created_at as string)) {
                latestPerContact[contactId as string] = {
                  ...m,
                  contactId,
                };
              }
            });

            // Get profiles for contacts
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, name, email, role, is_active')
              .in('id', Array.from(contactIds));

            const contacts = (profiles || []).map((p: Record<string, unknown>) => {
              const lastMsg = latestPerContact[p.id as string];
              return {
                id: p.id,
                name: p.name,
                email: p.email || '',
                role: p.role,
                isActive: p.is_active ?? true,
                lastMessage: lastMsg ? {
                  message: lastMsg.message,
                  createdAt: lastMsg.created_at,
                  isRead: lastMsg.is_read,
                  senderId: lastMsg.sender_id,
                } : null,
                unread: received?.filter((r: Record<string, unknown>) => r.sender_id === p.id && !r.is_read).length || 0,
              };
            });

            return NextResponse.json({ contacts, dataSource: 'supabase' });
          }
        } else if (senderId && receiverId) {
          // Get conversation between two users
          const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
            .order('created_at', { ascending: true });

          if (!error && data) {
            syncMessagesToLocal(data).catch(() => {});
            const messages = data.map((m: Record<string, unknown>) => ({
              id: m.id,
              senderId: m.sender_id,
              receiverId: m.receiver_id,
              message: m.message,
              isRead: m.is_read,
              createdAt: m.created_at,
            }));
            return NextResponse.json({ messages, dataSource: 'supabase' });
          }
        }
      } catch (error) {
        console.error('Supabase chat-messages failed, falling back:', error);
      }
    }

    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma
    if (userId) {
      const messages = await db.chatMessage.findMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      const contactIds = new Set<string>();
      messages.forEach((m) => {
        if (m.senderId !== userId) contactIds.add(m.senderId);
        if (m.receiverId !== userId) contactIds.add(m.receiverId);
      });

      const profiles = await db.profile.findMany({
        where: { id: { in: Array.from(contactIds) } },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });

      const latestPerContact: Record<string, typeof messages[0]> = {};
      messages.forEach((m) => {
        const contactId = m.senderId === userId ? m.receiverId : m.senderId;
        if (!latestPerContact[contactId] || m.createdAt > latestPerContact[contactId].createdAt) {
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
            createdAt: lastMsg.createdAt.toISOString(),
            isRead: lastMsg.isRead,
            senderId: lastMsg.senderId,
          } : null,
          unread: messages.filter((m) => m.senderId === p.id && !m.isRead).length,
        };
      });

      return NextResponse.json({ contacts });
    }

    if (senderId && receiverId) {
      const messages = await db.chatMessage.findMany({
        where: {
          OR: [
            { senderId, receiverId },
            { senderId: receiverId, receiverId: senderId },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({ messages });
    }

    return NextResponse.json({ error: 'senderId and receiverId, or userId required' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Error al obtener mensajes' }, { status: 500 });
  }
}

// POST /api/chat-messages - Create a new message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderId, receiverId, message } = body;

    if (!senderId || !receiverId || !message) {
      return NextResponse.json({ error: 'senderId, receiverId y message son requeridos' }, { status: 400 });
    }

    // Try Supabase first
    const supabase = await getSupabase();
    if (supabase) {
      try {
        const msgId = crypto.randomUUID();
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            id: msgId,
            sender_id: senderId,
            receiver_id: receiverId,
            message,
            is_read: false,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          // Sync to local in background
          syncMessageToLocal({
            id: data.id,
            senderId,
            receiverId,
            message,
            isRead: false,
            createdAt: data.created_at,
          }).catch(() => {});

          return NextResponse.json({
            id: data.id,
            senderId,
            receiverId,
            message,
            isRead: false,
            createdAt: data.created_at,
          }, { status: 201 });
        }
      } catch (error) {
        console.error('Supabase create message failed, falling back:', error);
      }
    }

    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma
    const msg = await db.chatMessage.create({
      data: { senderId, receiverId, message },
    });

    // Push to Supabase in background
    if (supabase) {
      supabase.from('chat_messages').insert({
        id: msg.id,
        sender_id: senderId,
        receiver_id: receiverId,
        message,
        is_read: false,
        created_at: msg.createdAt.toISOString(),
      }).then(({ error }) => {
        if (error) console.error('[Chat] Push to Supabase error:', error.message);
      });
    }

    return NextResponse.json(msg, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 });
  }
}

// PUT /api/chat-messages - Mark messages as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageIds } = body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'messageIds es requerido' }, { status: 400 });
    }

    // Try Supabase first
    const supabase = await getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .in('id', messageIds);

        if (!error) {
          // Sync to local in background
          markReadLocal(messageIds).catch(() => {});
          return NextResponse.json({ success: true });
        }
      } catch (error) {
        console.error('Supabase mark read failed, falling back:', error);
      }
    }

    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma
    await db.chatMessage.updateMany({
      where: { id: { in: messageIds } },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json({ error: 'Error al marcar mensajes' }, { status: 500 });
  }
}

// ============================================================
// Helpers: Sync to local
// ============================================================

async function syncMessageToLocal(msg: { id: string; senderId: string; receiverId: string; message: string; isRead: boolean; createdAt: string }) {
  if (isVercel) return;
  try {
    await db.chatMessage.upsert({
      where: { id: msg.id },
      update: { isRead: msg.isRead },
      create: {
        id: msg.id,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        message: msg.message,
        isRead: msg.isRead,
        createdAt: new Date(msg.createdAt),
      },
    });
  } catch (err) {
    console.error('[Chat] Sync message to local error:', err);
  }
}

async function syncMessagesToLocal(messages: Record<string, unknown>[]) {
  if (isVercel) return;
  try {
    for (const msg of messages) {
      await db.chatMessage.upsert({
        where: { id: msg.id as string },
        update: { isRead: msg.is_read as boolean },
        create: {
          id: msg.id as string,
          senderId: msg.sender_id as string,
          receiverId: msg.receiver_id as string,
          message: msg.message as string,
          isRead: (msg.is_read as boolean) ?? false,
          createdAt: new Date(msg.created_at as string),
        },
      });
    }
  } catch (err) {
    console.error('[Chat] Sync messages to local error:', err);
  }
}

async function markReadLocal(messageIds: string[]) {
  if (isVercel) return;
  try {
    await db.chatMessage.updateMany({
      where: { id: { in: messageIds } },
      data: { isRead: true },
    });
  } catch (err) {
    console.error('[Chat] Mark read local error:', err);
  }
}
