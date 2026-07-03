'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation, Loader2, ExternalLink, Clock, Crosshair } from 'lucide-react';

interface Location {
  id: string;
  collectorId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  timestamp: string;
  createdAt: string;
}

interface CollectorLocationsMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectorId: string | null;
  collectorName: string;
}

export default function CollectorLocationsMap({ open, onOpenChange, collectorId, collectorName }: CollectorLocationsMapProps) {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !collectorId) return;
    setLoading(true);
    fetch(`/api/locations?collectorId=${collectorId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar ubicaciones');
        return r.json();
      })
      .then((data) => setLocations(data.locations || data || []))
      .catch(() => {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las ubicaciones',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [open, collectorId]);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('es-PE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const latest = locations.length > 0 ? locations[0] : null;
  const recent = locations.slice(0, 20);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 flex items-center justify-center"><MapPin className="h-4 w-4 text-white" /></div>
            Ubicaciones de {collectorName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Navigation className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">Sin ubicaciones registradas. El cobrador debe tener el tracking activado.</p>
          </div>
        ) : (
          <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            {latest && (
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      Última ubicación
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={`https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>

                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold tracking-tight text-slate-800 dark:text-slate-100">
                      {latest.latitude.toFixed(6)}, {latest.longitude.toFixed(6)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                    {latest.accuracy !== null && (
                      <span className="flex items-center gap-1">
                        <Crosshair className="h-3 w-3" />
                        Precisión: ±{latest.accuracy.toFixed(0)}m
                      </span>
                    )}
                    {latest.speed !== null && (
                      <span className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        Velocidad: {latest.speed.toFixed(1)} m/s
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(latest.timestamp)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex-1 min-h-0">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Últimas ubicaciones
              </p>
              <ScrollArea className="h-full max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Latitud</TableHead>
                      <TableHead>Longitud</TableHead>
                      <TableHead>Precisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell className="font-mono text-xs">{formatTime(loc.timestamp)}</TableCell>
                        <TableCell className="font-mono text-xs">{loc.latitude.toFixed(6)}</TableCell>
                        <TableCell className="font-mono text-xs">{loc.longitude.toFixed(6)}</TableCell>
                        <TableCell className="font-mono text-xs">{loc.accuracy !== null ? `±${loc.accuracy.toFixed(0)}m` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
