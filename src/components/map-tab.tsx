'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import { Loader2, Navigation, RefreshCw, Clock, Zap } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';

interface CollectorLocation {
  collectorId: string;
  collectorName: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  timestamp: string;
}

function createMotorcycleIcon(): L.DivIcon {
  return L.divIcon({
    html: '<div style="background:#10b981;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">🏍️</div>',
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}

function createMotorcycleIconDark(): L.DivIcon {
  return L.divIcon({
    html: '<div style="background:#059669;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #1e293b;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">🏍️</div>',
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}

export default function MapTab() {
  const [locations, setLocations] = useState<CollectorLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    setThemeState(html.classList.contains('dark') ? 'dark' : 'light');
    const observer = new MutationObserver(() => {
      setThemeState(html.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/locations');
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations || []);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    intervalRef.current = setInterval(fetchLocations, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLocations]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLocations();
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Lima' });
    } catch {
      return '—';
    }
  };

  const formatDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
    } catch {
      return '—';
    }
  };

  const motoIcon = useMemo(() => theme === 'dark' ? createMotorcycleIconDark() : createMotorcycleIcon(), [theme]);

  const defaultCenter = useMemo((): LatLngExpression => locations.length > 0
    ? [locations[0].latitude, locations[0].longitude] as LatLngExpression
    : userPosition || ([-12.0464, -77.0428] as LatLngExpression), [locations, userPosition]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Mapa de Cobradores
          </h3>
          <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-xs">
            {locations.length} en línea
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-200"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {loading ? (
        <Card className="border-0 shadow-md">
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-3" />
            <p className="text-slate-500">Cargando ubicaciones...</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-[600px] w-full relative z-0">
            <MapContainer
              center={defaultCenter}
              zoom={13}
              className="h-full w-full"
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url={theme === 'dark'
                  ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                }
              />
              {locations.map((loc) => (
                <Marker
                  key={loc.collectorId}
                  position={[loc.latitude, loc.longitude]}
                  icon={motoIcon}
                >
                  <Popup>
                    <div className="text-sm space-y-1 min-w-[180px]">
                      <p className="font-semibold text-slate-800">{loc.collectorName}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        {formatDate(loc.timestamp)}
                      </div>
                      {loc.speed !== null && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Zap className="h-3 w-3" />
                          {loc.speed.toFixed(1)} m/s
                        </div>
                      )}
                      {loc.accuracy !== null && (
                        <p className="text-xs text-slate-400">
                          Precisión: ±{loc.accuracy.toFixed(0)}m
                        </p>
                      )}
                      <p className="text-xs text-slate-400 font-mono">
                        {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>
      )}

      {/* Locations list below map */}
      {locations.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Cobradores activos ({locations.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {locations.map((loc) => (
                <div
                  key={loc.collectorId}
                  className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                    <Navigation className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {loc.collectorName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatTime(loc.timestamp)}
                      {loc.speed !== null && ` · ${loc.speed.toFixed(1)} m/s`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
