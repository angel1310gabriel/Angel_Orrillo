'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, User, ChevronLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface ChatContact {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface ChatMsg {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  collector: 'Cobrador',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  supervisor: 'bg-amber-100 text-amber-700 border-amber-200',
  collector: 'bg-background/70 text-foreground/80 border-input',
};

export default function ChatTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<(ChatContact & { lastMessage?: { message: string; createdAt: string; isRead: boolean; senderId: string }; unread?: number })[]>([]);
  const [allStaff, setAllStaff] = useState<ChatContact[]>([]);
  const [showStaffList, setShowStaffList] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    if (!user) return;
    try {
      const [contactsRes, staffRes] = await Promise.all([
        fetch('/api/chat-messages?userId=' + user.id),
        fetch('/api/collectors?limit=200'),
      ]);
      const json = await contactsRes.json();
      if (json.contacts) {
        setContacts(json.contacts);
      }
      const staffJson = await staffRes.json();
      const staffList = staffJson?.collectors || [];
      setAllStaff(staffList.filter((s: ChatContact) => s.id !== user.id));
    } catch (err) {
      console.error('[Chat] Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch messages for selected contact
  const fetchMessages = useCallback(async (contactId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/chat-messages?senderId=${user.id}&receiverId=${contactId}`);
      const json = await res.json();
      if (json.messages) {
        setMessages(json.messages);
      }
    } catch (err) {
      console.error('[Chat] Error fetching messages:', err);
    }
  }, [user]);

  // Mark messages as read
  const markAsRead = useCallback(async (msgIds: string[]) => {
    if (msgIds.length === 0) return;
    try {
      await fetch('/api/chat-messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: msgIds }),
      });
    } catch (err) {
      console.error('[Chat] Error marking read:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
      intervalRef.current = setInterval(() => {
        fetchMessages(selectedContact.id);
      }, 5000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [selectedContact, fetchMessages]);

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (!user || !selectedContact || messages.length === 0) return;
    const unreadIds = messages
      .filter((m) => m.senderId === selectedContact.id && !m.isRead)
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
      // Update local state
      setMessages((prev) =>
        prev.map((m) =>
          unreadIds.includes(m.id) ? { ...m, isRead: true } : m
        )
      );
      // Refresh contacts to update unread counts
      fetchContacts();
    }
  }, [selectedContact, messages, user, markAsRead, fetchContacts]);

  // Send message
  const handleSend = async () => {
    if (!user || !selectedContact || !newMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/chat-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          receiverId: selectedContact.id,
          message: newMessage.trim(),
        }),
      });
      const json = await res.json();
      if (json.id) {
        setMessages((prev) => [...prev, json]);
        setNewMessage('');
        fetchContacts();
      } else {
        toast({ title: 'Error', description: json.error || 'Error al enviar mensaje', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!user || !selectedContact) return;
    if (!confirm('¿Eliminar toda la conversación con ' + selectedContact.name + '?')) return;
    try {
      const res = await fetch(`/api/chat-messages?userId=${user.id}&contactId=${selectedContact.id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
        setSelectedContact(null);
        fetchContacts();
        toast({ title: 'Conversación eliminada' });
      } else {
        toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) {
      return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
    }
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Cargando mensajes...</div>
      </div>
    );
  }

  if (!user) return null;

  const roleColor = ROLE_COLORS[user.role] || ROLE_COLORS.collector;

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white dark:bg-[#05060b]/80 rounded-2xl border border-input dark:border-emerald-500/10 overflow-hidden shadow-sm">
      {/* Contacts Panel */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-input dark:border-emerald-500/10 flex flex-col ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-input/50 dark:border-emerald-500/10 space-y-2">
          <h3 className="text-sm font-semibold text-foreground dark:text-foreground flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            Mensajes
          </h3>
          <Button variant="outline" size="sm" className="w-full border-emerald-200 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30" onClick={() => setShowStaffList(!showStaffList)}>
            <User className="h-3.5 w-3.5 mr-1.5" />
            {showStaffList ? 'Cerrar contactos' : 'Nuevo chat'}
          </Button>
          {showStaffList && (
            <ScrollArea className="max-h-48 border border-input dark:border-emerald-500/5 rounded-lg">
              {allStaff.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No hay personal disponible</p>
              ) : (
                allStaff.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => { setSelectedContact(staff); setShowStaffList(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors border-b border-slate-50 dark:border-emerald-500/10/50 last:border-0"
                  >
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-[10px] font-medium">
                        {(staff.name || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{staff.name}</p>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${ROLE_COLORS[staff.role] || ROLE_COLORS.collector}`}>
                        {ROLE_LABELS[staff.role] || staff.role}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          )}
        </div>
        <ScrollArea className="flex-1">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageCircle className="h-10 w-10 text-slate-300 dark:text-foreground/70 mb-3" />
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">No hay conversaciones</p>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">Seleccione un contacto del panel para iniciar</p>
            </div>
          ) : (
            contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-background/50 dark:hover:bg-white/10/50 border-b border-slate-50 dark:border-emerald-500/10/50 ${selectedContact?.id === contact.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-sm font-medium">
                    {(contact.name || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground dark:text-foreground truncate">
                      {contact.name}
                    </span>
                    {contact.lastMessage && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatTime(contact.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${ROLE_COLORS[contact.role] || ROLE_COLORS.collector}`}>
                      {ROLE_LABELS[contact.role] || contact.role}
                    </Badge>
                    {!contact.isActive && (
                      <span className="text-[9px] text-red-400">Inactivo</span>
                    )}
                  </div>
                  {contact.lastMessage && (
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate mt-1">
                      {contact.lastMessage.senderId === user.id && 'Tú: '}
                      {contact.lastMessage.message}
                    </p>
                  )}
                </div>
                {(contact.unread || 0) > 0 && (
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-medium flex items-center justify-center">
                    {contact.unread}
                  </div>
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!selectedContact ? 'hidden md:flex' : 'flex'}`}>
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-input dark:border-emerald-500/10 bg-background/50/50 dark:bg-[#05060b]/70">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={() => setSelectedContact(null)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-sm font-medium">
                  {(selectedContact.name || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground dark:text-foreground truncate">
                  {selectedContact.name}
                </p>
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${ROLE_COLORS[selectedContact.role] || ROLE_COLORS.collector}`}>
                  {ROLE_LABELS[selectedContact.role] || selectedContact.role}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={handleDeleteChat}
                title="Eliminar conversación"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  No hay mensajes aún. Envíe un mensaje para iniciar la conversación.
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isSent = msg.senderId === user.id;
                    return (
                      <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                            isSent
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-br-md'
                              : 'bg-background/70 dark:bg-[#05060b]/70 text-foreground dark:text-foreground rounded-bl-md'
                          }`}
                        >
                          <p>{msg.message}</p>
                          <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
                            <span className={`text-[10px] ${isSent ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                              {formatTime(msg.createdAt)}
                            </span>
                            {isSent && (
                              <span className="text-[10px] text-emerald-100">
                                {msg.isRead ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-input dark:border-emerald-500/10 bg-background/50/50 dark:bg-[#05060b]/70">
              <div className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escriba un mensaje..."
                  className="flex-1 bg-white dark:bg-[#05060b]/80 border-input dark:border-emerald-500/5 focus-visible:ring-emerald-500"
                  disabled={sending}
                />
                <Button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0"
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-slate-300 dark:text-foreground/70 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">Seleccione un contacto para iniciar un chat</p>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                Los mensajes se sincronizan con la app móvil
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
