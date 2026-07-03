'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { StickyNote, Plus, Trash2, Loader2, Star, AlertTriangle } from 'lucide-react';

interface Note {
  id: string;
  clientId: string;
  createdBy: string | null;
  note: string;
  isImportant: boolean;
  createdAt: string;
}

interface ClientNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  clientName: string;
}

export default function ClientNotesDialog({ open, onOpenChange, clientId, clientName }: ClientNotesDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    fetch(`/api/client-notes?clientId=${clientId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar notas');
        return r.json();
      })
      .then((data) => setNotes(data))
      .catch(() => {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las notas',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !clientId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/client-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, note: newNote.trim(), isImportant }),
      });
      if (!res.ok) throw new Error('Error al agregar nota');
      const added = await res.json();
      setNotes((prev) => [added, ...prev]);
      setNewNote('');
      setIsImportant(false);
      toast({ title: 'Nota agregada' });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo agregar la nota',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/client-notes?id=${noteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar nota');
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast({ title: 'Nota eliminada' });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la nota',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 flex items-center justify-center"><StickyNote className="h-4 w-4 text-white" /></div>
            Notas de {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder="Escribe una nota..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isImportant"
              checked={isImportant}
              onChange={(e) => setIsImportant(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isImportant" className="flex items-center gap-1 text-sm cursor-pointer">
              <Star className="h-3.5 w-3.5 text-yellow-500" />
              Importante
            </Label>
          </div>
          <Button onClick={handleAddNote} disabled={!newNote.trim() || saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Agregar Nota
          </Button>
        </div>

        <Separator className="my-2" />

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="text-sm">Sin notas</p>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm whitespace-pre-wrap flex-1">{note.note}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteNote(note.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {note.isImportant && (
                    <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                      <Star className="h-3 w-3 mr-0.5" />
                      Importante
                    </Badge>
                  )}
                  <span>{note.createdBy ?? 'Sistema'}</span>
                  <span>·</span>
                  <span>{formatDate(note.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
