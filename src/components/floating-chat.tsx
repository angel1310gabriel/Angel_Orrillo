'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, User, ChevronDown, X, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface ChatContact {
  id: string; name: string; email: string; role: string; isActive: boolean;
}

interface ChatMsg {
  id: string; senderId: string; receiverId: string; message: string;
  isRead: boolean; createdAt: string;
}

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', supervisor: 'Supervisor', collector: 'Cobrador' };
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  supervisor: 'bg-amber-100 text-amber-700 border-amber-200',
  collector: 'bg-background/70 text-foreground/80 border-input',
};

export default function FloatingChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<(ChatContact & { lastMessage?: { message: string; createdAt: string; isRead: boolean; senderId: string }; unread?: number })[]>([]);
  const [allStaff, setAllStaff] = useState<ChatContact[]>([]);
  const [showStaffList, setShowStaffList] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    try {
      const [contactsRes, staffRes] = await Promise.all([
        fetch('/api/chat-messages?userId=' + user.id),
        fetch('/api/collectors?limit=200'),
      ]);
      const json = await contactsRes.json();
      if (json.contacts) setContacts(json.contacts);
      const staffJson = await staffRes.json();
      const staffList = staffJson?.collectors || [];
      setAllStaff(staffList.filter((s: ChatContact) => s.id !== user.id));
    } catch {}
  }, [user]);

  const fetchMessages = useCallback(async (contactId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/chat-messages?senderId=${user.id}&receiverId=${contactId}`);
      const json = await res.json();
      if (json.messages) setMessages(json.messages);
    } catch {}
  }, [user]);

  const markAsRead = useCallback(async (msgIds: string[]) => {
    if (msgIds.length === 0) return;
    try {
      await fetch('/api/chat-messages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageIds: msgIds }) });
    } catch {}
  }, []);

  useEffect(() => { if (open) fetchContacts(); }, [open, fetchContacts]);

  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
      intervalRef.current = setInterval(() => { fetchMessages(selectedContact.id); }, 5000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
  }, [selectedContact, fetchMessages]);

  useEffect(() => {
    if (!user || !selectedContact || messages.length === 0) return;
    const unreadIds = messages.filter(m => m.senderId === selectedContact.id && !m.isRead).map(m => m.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
      setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, isRead: true } : m));
      fetchContacts();
    }
  }, [selectedContact, messages, user, markAsRead, fetchContacts]);

  const handleSend = async () => {
    if (!user || !selectedContact || !newMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/chat-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderId: user.id, receiverId: selectedContact.id, message: newMessage.trim() }) });
      const json = await res.json();
      if (json.id) { setMessages(prev => [...prev, json]); setNewMessage(''); fetchContacts(); }
      else toast({ title: 'Error', description: json.error || 'Error al enviar', variant: 'destructive' });
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }); }
    finally { setSending(false); }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    return now.getTime() - date.getTime() < 86400000
      ? date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (!open || !user) return null;
  const unreadCount = contacts.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[500px] max-h-[70vh] flex flex-col rounded-2xl border border-emerald-500/15 shadow-2xl shadow-emerald-500/10 bg-[#05060b]/95 backdrop-blur-2xl overflow-hidden entrance-scale">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/10 bg-gradient-to-r from-emerald-500/10 to-teal-500/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <MessageCircle className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">
            {selectedContact ? selectedContact.name : 'Mensajes'}
          </span>
          {unreadCount > 0 && !selectedContact && (
            <Badge className="bg-red-500 text-white text-[9px] px-1.5 py-0 ml-1">{unreadCount}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Contacts / Chat */}
      <div className="flex-1 flex flex-col min-h-0">
        {!selectedContact ? (
          <>
            {/* Contacts list */}
            <div className="px-3 py-2 border-b border-emerald-500/5">
              <Button variant="neu" size="sm" className="w-full text-xs h-7" onClick={() => setShowStaffList(!showStaffList)}>
                <User className="h-3 w-3 mr-1" /> {showStaffList ? 'Cerrar' : 'Nuevo chat'}
              </Button>
              {showStaffList && (
                <div className="mt-2 max-h-28 overflow-y-auto rounded-lg border border-emerald-500/10">
                  {allStaff.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">Sin contactos</p>
                  ) : allStaff.map(s => (
                    <button key={s.id} onClick={() => { setSelectedContact(s); setShowStaffList(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-emerald-500/10 transition-colors border-b border-emerald-500/5 last:border-0">
                      <Avatar className="h-5 w-5"><AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-[8px]">{(s.name||'U')[0]}</AvatarFallback></Avatar>
                      <span className="font-medium text-white/80 truncate">{s.name}</span>
                      <Badge variant="outline" className={`text-[8px] px-1 py-0 ${ROLE_COLORS[s.role] || ''}`}>{ROLE_LABELS[s.role] || s.role}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <MessageCircle className="h-8 w-8 text-emerald-500/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Sin conversaciones</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Inicia un nuevo chat</p>
                </div>
              ) : contacts.map(c => (
                <button key={c.id} onClick={() => setSelectedContact(c)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-emerald-500/5 transition-colors border-b border-emerald-500/5 last:border-0">
                  <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs">{(c.name||'U')[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white/90 truncate">{c.name}</span>
                      {c.lastMessage && <span className="text-[9px] text-muted-foreground shrink-0 ml-1">{formatTime(c.lastMessage.createdAt)}</span>}
                    </div>
                    {c.lastMessage && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{c.lastMessage.senderId === user.id && 'Tú: '}{c.lastMessage.message}</p>}
                  </div>
                  {(c.unread || 0) > 0 && <div className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[8px] font-medium flex items-center justify-center shrink-0">{c.unread}</div>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Chat messages */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-500/10">
              <button onClick={() => setSelectedContact(null)} className="p-0.5 rounded hover:bg-white/10 text-muted-foreground">
                <ChevronDown className="h-3.5 w-3.5 rotate-90" />
              </button>
              <Avatar className="h-6 w-6"><AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-[9px]">{(selectedContact.name||'U')[0]}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/90 truncate">{selectedContact.name}</p>
                <Badge variant="outline" className={`text-[8px] px-1 py-0 ${ROLE_COLORS[selectedContact.role] || ''}`}>{ROLE_LABELS[selectedContact.role] || selectedContact.role}</Badge>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Sin mensajes</div>
              ) : messages.map(msg => {
                const isSent = msg.senderId === user.id;
                return (
                  <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed ${isSent ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-sm' : 'bg-white/10 text-white/90 rounded-bl-sm'}`}>
                      <p>{msg.message}</p>
                      <div className={`flex items-center gap-1 mt-0.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[8px] ${isSent ? 'text-emerald-200' : 'text-muted-foreground'}`}>{formatTime(msg.createdAt)}</span>
                        {isSent && <span className="text-[8px] text-emerald-200">{msg.isRead ? '✓✓' : '✓'}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t border-emerald-500/10">
              <div className="flex items-center gap-2">
                <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Escribe..." className="flex-1 h-8 text-xs bg-white/5 border-emerald-500/10 text-white placeholder:text-muted-foreground" disabled={sending} />
                <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon" className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"><Send className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
