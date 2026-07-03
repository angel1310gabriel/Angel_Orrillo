'use client';

import { useState, useEffect } from 'react';
import { Link2, Plus, Trash2, Loader2, ExternalLink, QrCode, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format-helpers';

interface PaymentLink {
  id: string;
  loanId: string;
  clientId: string;
  amount: number;
  linkUrl: string | null;
  qrCodeUrl: string | null;
  status: string;
  sentVia: string | null;
  sentAt: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface PaymentLinksPanelProps {
  loanId: string | null;
  clientId: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  completed: 'Completado',
  expired: 'Expirado',
};

const STATUS_VARIANTS: Record<string, string> = {
  active: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
  completed: 'bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800',
  expired: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};

const SENT_VIA_LABELS: Record<string, string> = {
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia',
  bancolombia: 'Bancolombia',
};

export default function PaymentLinksPanel({ loanId, clientId }: PaymentLinksPanelProps) {
  const { toast } = useToast();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [sentVia, setSentVia] = useState('yape');

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (loanId) params.set('loanId', loanId);
      else if (clientId) params.set('clientId', clientId);
      if (!loanId && !clientId) { setLinks([]); return; }
      const res = await fetch(`/api/payment-links?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLinks(data?.links || data || []);
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los links de pago', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [loanId, clientId]);

  const handleCreate = async () => {
    if (!loanId && !clientId) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast({ title: 'Monto inválido', description: 'Ingrese un monto válido', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/payment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId, clientId, amount: numAmount, sentVia }),
      });
      if (res.ok) {
        toast({ title: 'Link creado', description: 'El link de pago fue generado exitosamente' });
        setAmount('');
        setSentVia('yape');
        setShowForm(false);
        await fetchLinks();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo crear el link', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/payment-links?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Link eliminado', description: 'El link de pago fue eliminado' });
        await fetchLinks();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo eliminar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Link2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          Links de Pago
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create Form */}
        {showForm ? (
          <div className="space-y-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30">
            <div>
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Monto</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enviar por</Label>
              <Select value={sentVia} onValueChange={setSentVia}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yape">Yape</SelectItem>
                  <SelectItem value="plin">Plin</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="bancolombia">Bancolombia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleCreate}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Generar Link
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Link de Pago
          </Button>
        )}

        <Separator />

        {/* Links List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-3">
              <Link2 className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin links de pago</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div
                key={link.id}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(link.amount)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-xs ${STATUS_VARIANTS[link.status] || STATUS_VARIANTS.active}`}>
                      {STATUS_LABELS[link.status] || link.status}
                    </Badge>
                    {link.sentVia && (
                      <Badge variant="outline" className="text-xs bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">
                        {SENT_VIA_LABELS[link.sentVia] || link.sentVia}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(link.createdAt)}
                </div>
                <div className="flex items-center gap-2">
                  {link.linkUrl && (
                    <a
                      href={link.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-300 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir Link
                    </a>
                  )}
                  {link.qrCodeUrl && (
                    <a
                      href={link.qrCodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-300 hover:underline"
                    >
                      <QrCode className="h-3 w-3" />
                      Ver QR
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-auto text-slate-400 hover:text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                    onClick={() => handleDelete(link.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
