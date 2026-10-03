"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import {
  Coords,
  distanceMeters,
  randomHelperCoordsNear,
} from "@/lib/geo";
import {
  createHelperAvatarIcon,
  createDestinationPinIcon,
} from "@/components/mapIcons";

type LatLngTuple = [number, number];

export type HelperTransport = "car" | "bike" | "walk" | "scooter";

/** Tempo animacji demo (m/s) — wystarczająco szybkie, żeby dało się obejrzeć. */
const ANIM_SPEED_MPS: Record<HelperTransport, number> = {
  car: 11,
  bike: 6.5,
  scooter: 7,
  walk: 3.2,
};

/** Tempo do wyświetlanego ETA (realistyczne minuty). */
const DISPLAY_SPEED_MPS: Record<HelperTransport, number> = {
  car: 8.5,
  bike: 4.2,
  scooter: 4.8,
  walk: 1.35,
};

const OSRM_PROFILE: Record<HelperTransport, string> = {
  car: "driving",
  bike: "cycling",
  scooter: "cycling",
  walk: "walking",
};

const MIN_TRIP_SEC = 26;
const MAX_TRIP_SEC = 80;
const ARRIVAL_THRESHOLD = 0.985;

type LiveTrackingMapProps = {
  destination: Coords;
  hasPin: boolean;
  seedKey: string;
  helperName: string;
  helperAvatarUrl: string;
  destinationLabel?: string;
  helperRating?: string;
  transport?: HelperTransport;
  motionVerb?: string;
  /** Date.now() startu dojazdu — postęp działa też poza widokiem. */
  startedAtMs?: number;
  /** Niższa mapa — wszystkie akcje mieszczą się na ekranie. */
  dense?: boolean;
  onArrived?: () => void;
};

type TripMetrics = {
  etaSec: number;
  progress: number;
  arrived: boolean;
};

function formatEtaMinutes(seconds: number): string {
  const mins = Math.max(1, Math.ceil(Math.max(0, seconds) / 60));
  return `${mins} min`;
}

type RouteGeometry = {
  points: LatLngTuple[];
  cumulative: number[];
  totalMeters: number;
};

function buildRouteGeometry(points: LatLngTuple[]): RouteGeometry {
  const cumulative = [0];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[i + 1];
    total += distanceMeters(
      { lat: lat1, lng: lng1 },
      { lat: lat2, lng: lng2 },
    );
    cumulative.push(total);
  }
  return { points, cumulative, totalMeters: total };
}

function pointAtDistance(
  geometry: RouteGeometry,
  meters: number,
): LatLngTuple {
  const { points, cumulative, totalMeters } = geometry;
  if (points.length === 0) return [0, 0];
  if (points.length === 1 || totalMeters <= 0) return points[0];

  const target = Math.min(Math.max(0, meters), totalMeters);
  if (target >= totalMeters) return points[points.length - 1];

  let i = 0;
  while (i < cumulative.length - 1 && cumulative[i + 1] < target) i++;

  const segStart = cumulative[i];
  const segEnd = cumulative[i + 1];
  const segLen = segEnd - segStart;
  const t = segLen > 0 ? (target - segStart) / segLen : 0;
  const [lat1, lng1] = points[i];
  const [lat2, lng2] = points[i + 1];
  return [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t];
}

function splitRouteAtProgress(
  geometry: RouteGeometry,
  progress: number,
): { traveled: LatLngTuple[]; remaining: LatLngTuple[] } {
  const { points, totalMeters } = geometry;
  if (points.length < 2) {
    return { traveled: points, remaining: points };
  }

  const clamped = Math.min(1, Math.max(0, progress));
  const at = pointAtDistance(geometry, totalMeters * clamped);

  if (clamped <= 0.001) {
    return { traveled: [points[0]], remaining: points };
  }
  if (clamped >= 0.999) {
    return { traveled: points, remaining: [points[points.length - 1]] };
  }

  let insertAfter = 0;
  const targetM = totalMeters * clamped;
  for (let i = 0; i < geometry.cumulative.length - 1; i++) {
    if (geometry.cumulative[i + 1] >= targetM) {
      insertAfter = i;
      break;
    }
  }

  const traveled = [...points.slice(0, insertAfter + 1), at];
  const remaining = [at, ...points.slice(insertAfter + 1)];
  return { traveled, remaining };
}

function displayEtaStartSec(
  totalMeters: number,
  transport: HelperTransport,
): number {
  const speed = DISPLAY_SPEED_MPS[transport];
  const raw = totalMeters / speed;
  return Math.min(18 * 60, Math.max(3 * 60, raw));
}

async function fetchRoute(
  from: Coords,
  to: Coords,
  transport: HelperTransport,
): Promise<LatLngTuple[] | null> {
  const profile = OSRM_PROFILE[transport];
  const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) return null;
    return coords.map(([lng, lat]) => [lat, lng] as LatLngTuple);
  } catch {
    return null;
  }
}

function FitOnce({
  points,
  fitKey,
}: {
  points: LatLngTuple[];
  fitKey: string;
}) {
  const map = useMap();
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (points.length < 2 || done.current === fitKey) return;
    done.current = fitKey;
    map.fitBounds(L.latLngBounds(points).pad(0.2), {
      animate: false,
      maxZoom: 16,
      padding: [28, 28],
    });
  }, [map, points, fitKey]);

  return null;
}

function FollowHelper({
  position,
  enabled,
}: {
  position: LatLngTuple | null;
  enabled: boolean;
}) {
  const map = useMap();
  const last = useRef(0);

  useEffect(() => {
    if (!enabled || !position) return;
    const now = performance.now();
    if (now - last.current < 2500) return;
    last.current = now;
    map.panTo(position, { animate: true, duration: 1.1, easeLinearity: 0.2 });
  }, [map, position, enabled]);

  return null;
}

function SmoothHelperMotion({
  geometry,
  avatarUrl,
  helperName,
  motionVerb,
  transport,
  runKey,
  startedAtMs,
  onMetrics,
}: {
  geometry: RouteGeometry;
  avatarUrl: string;
  helperName: string;
  motionVerb: string;
  transport: HelperTransport;
  runKey: string;
  startedAtMs: number;
  onMetrics: (m: TripMetrics & { position: LatLngTuple }) => void;
}) {
  const map = useMap();
  const icon = useMemo(() => createHelperAvatarIcon(avatarUrl), [avatarUrl]);

  useEffect(() => {
    if (geometry.points.length < 2 || geometry.totalMeters < 1) return;

    const animSpeed = ANIM_SPEED_MPS[transport];
    const tripSec = Math.min(
      MAX_TRIP_SEC,
      Math.max(MIN_TRIP_SEC, geometry.totalMeters / animSpeed),
    );
    const speedMps = geometry.totalMeters / tripSec;
    const etaTotal = displayEtaStartSec(geometry.totalMeters, transport);

    const startPos = geometry.points[0];
    const marker = L.marker(startPos, {
      icon,
      zIndexOffset: 800,
      interactive: true,
    });
    marker.bindPopup(
      `<div style="font:600 14px system-ui,sans-serif;padding:2px 0">${helperName}<br/><span style="color:#64748b;font-weight:600">${motionVerb} do Ciebie</span></div>`,
    );
    marker.addTo(map);

    let frameId = 0;
    let lastUi = 0;

    const tick = (now: number) => {
      const elapsed = Math.max(0, (Date.now() - startedAtMs) / 1000);
      const traveled = Math.min(
        geometry.totalMeters * ARRIVAL_THRESHOLD,
        elapsed * speedMps,
      );
      const progress = traveled / geometry.totalMeters;
      const pos = pointAtDistance(geometry, traveled);
      marker.setLatLng(pos);

      if (now - lastUi > 200 || progress >= ARRIVAL_THRESHOLD) {
        lastUi = now;
        const remainingProgress = Math.max(0, 1 - progress);
        onMetrics({
          etaSec: remainingProgress * etaTotal,
          progress,
          arrived: progress >= ARRIVAL_THRESHOLD,
          position: pos,
        });
      }

      if (progress < ARRIVAL_THRESHOLD) {
        frameId = requestAnimationFrame(tick);
      }
    };

    // Natychmiastowa pozycja wg czasu ściennego (np. po powrocie na widok)
    {
      const elapsed = Math.max(0, (Date.now() - startedAtMs) / 1000);
      const traveled = Math.min(
        geometry.totalMeters * ARRIVAL_THRESHOLD,
        elapsed * speedMps,
      );
      const progress = traveled / geometry.totalMeters;
      const pos = pointAtDistance(geometry, traveled);
      marker.setLatLng(pos);
      onMetrics({
        etaSec: Math.max(0, 1 - progress) * etaTotal,
        progress,
        arrived: progress >= ARRIVAL_THRESHOLD,
        position: pos,
      });
      if (progress < ARRIVAL_THRESHOLD) {
        frameId = requestAnimationFrame(tick);
      }
    }

    return () => {
      cancelAnimationFrame(frameId);
      map.removeLayer(marker);
    };
  }, [
    map,
    geometry,
    icon,
    helperName,
    motionVerb,
    transport,
    runKey,
    startedAtMs,
    onMetrics,
  ]);

  return null;
}

export default function LiveTrackingMap({
  destination,
  hasPin,
  seedKey,
  helperName,
  helperAvatarUrl,
  destinationLabel = "Twój adres",
  helperRating = "4.9",
  transport = "car",
  motionVerb = "Jedzie",
  startedAtMs,
  dense = false,
  onArrived,
}: LiveTrackingMapProps) {
  const fallbackStartRef = useRef(Date.now());
  const tripStartedAtMs = startedAtMs ?? fallbackStartRef.current;
  const helperStart = useMemo(
    () => randomHelperCoordsNear(destination, seedKey),
    [destination.lat, destination.lng, seedKey],
  );

  const [routePoints, setRoutePoints] = useState<LatLngTuple[] | null>(null);
  const [routeLoading, setRouteLoading] = useState(true);
  const [routeFallback, setRouteFallback] = useState(false);
  const [metrics, setMetrics] = useState<TripMetrics>({
    etaSec: 5 * 60,
    progress: 0,
    arrived: false,
  });
  const [helperPos, setHelperPos] = useState<LatLngTuple | null>(null);
  const arrivedNotified = useRef(false);

  useEffect(() => {
    arrivedNotified.current = false;
  }, [seedKey]);

  const destinationIcon = useMemo(() => createDestinationPinIcon(), []);

  const onMetrics = useCallback(
    (m: TripMetrics & { position: LatLngTuple }) => {
      setMetrics({
        etaSec: m.etaSec,
        progress: m.progress,
        arrived: m.arrived,
      });
      setHelperPos(m.position);
      if (m.arrived && !arrivedNotified.current) {
        arrivedNotified.current = true;
        onArrived?.();
      }
    },
    [onArrived],
  );

  useEffect(() => {
    if (!hasPin) {
      setRouteLoading(false);
      setRoutePoints(null);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);
    setRouteFallback(false);
    setRoutePoints(null);
    setHelperPos(null);

    void fetchRoute(helperStart, destination, transport).then((line) => {
      if (cancelled) return;
      if (line && line.length >= 2) {
        setRoutePoints(line);
        setRouteFallback(false);
      } else {
        setRouteFallback(true);
        setRoutePoints([
          [helperStart.lat, helperStart.lng],
          [destination.lat, destination.lng],
        ]);
      }
      setRouteLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [hasPin, helperStart, destination, seedKey, transport]);

  const geometry = useMemo(() => {
    if (!routePoints || routePoints.length < 2) return null;
    return buildRouteGeometry(routePoints);
  }, [routePoints]);

  const { traveled, remaining } = useMemo(() => {
    if (!geometry) {
      return {
        traveled: [] as LatLngTuple[],
        remaining: [] as LatLngTuple[],
      };
    }
    return splitRouteAtProgress(geometry, metrics.progress);
  }, [geometry, metrics.progress]);

  const routeReady = Boolean(geometry) && !routeLoading;
  const statusLine = metrics.arrived
    ? "Pomocnik jest na miejscu"
    : `${motionVerb} do Ciebie`;

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-md">
      <div
        className={`relative w-full bg-neutral-100 ${
          dense ? "h-44" : "h-[22rem]"
        }`}
      >
        {routeLoading && (
          <div
            className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[2px]"
            aria-live="polite"
          >
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
            <p className="text-lg font-bold text-neutral-700">
              Łączę z lokalizacją pomocnika…
            </p>
          </div>
        )}

        <MapContainer
          center={[destination.lat, destination.lng]}
          zoom={15}
          scrollWheelZoom
          dragging
          zoomControl={false}
          className="z-0 h-full w-full [&_.leaflet-control-attribution]:text-[10px]"
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {routePoints && (
            <FitOnce
              points={routePoints}
              fitKey={`${seedKey}-${routePoints.length}`}
            />
          )}
          <FollowHelper position={helperPos} enabled={routeReady} />

          {hasPin && (
            <Marker
              position={[destination.lat, destination.lng]}
              icon={destinationIcon}
              zIndexOffset={400}
            />
          )}

          {traveled.length >= 2 && (
            <Polyline
              positions={traveled}
              pathOptions={{
                color: "#94a3b8",
                weight: 5,
                opacity: 0.7,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          )}

          {remaining.length >= 2 && (
            <Polyline
              positions={remaining}
              pathOptions={{
                color: "#059669",
                weight: 6,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          )}

          {hasPin && routeReady && geometry && (
            <SmoothHelperMotion
              geometry={geometry}
              avatarUrl={helperAvatarUrl}
              helperName={helperName}
              motionVerb={motionVerb}
              transport={transport}
              runKey={seedKey}
              startedAtMs={tripStartedAtMs}
              onMetrics={onMetrics}
            />
          )}
        </MapContainer>

        {routeReady && (
          <div className="pointer-events-none absolute left-3 top-3 z-[450]">
            <div className="rounded-2xl bg-white/95 px-4 py-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                {metrics.arrived ? "Na miejscu" : "Przyjazd"}
              </p>
              <p className="text-3xl font-bold leading-none text-black">
                {metrics.arrived ? "Teraz" : formatEtaMinutes(metrics.etaSec)}
              </p>
            </div>
          </div>
        )}

        {!metrics.arrived && onArrived && (
          <button
            type="button"
            onClick={() => {
              if (!arrivedNotified.current) {
                arrivedNotified.current = true;
                onArrived();
              }
            }}
            className="absolute bottom-3 left-3 right-3 z-[450] rounded-2xl bg-white/95 py-3 text-center text-lg font-bold text-emerald-800 shadow-md ring-1 ring-black/5"
          >
            Pomocnik już na miejscu
          </button>
        )}
      </div>

      <div
        className={`border-t border-neutral-100 px-4 ${
          dense ? "py-3" : "py-4"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <img
              src={helperAvatarUrl}
              alt={helperName}
              className={`rounded-full object-cover ring-2 ring-emerald-500 ring-offset-2 ${
                dense ? "h-11 w-11" : "h-14 w-14"
              }`}
              width={dense ? 44 : 56}
              height={dense ? 44 : 56}
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                metrics.arrived ? "bg-emerald-500" : "bg-sky-500"
              }`}
              aria-hidden
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold text-black">
              {helperName}
              <span className="ml-2 text-lg font-bold text-neutral-500">
                {helperRating}★
              </span>
            </p>
            <p className="text-lg font-bold text-emerald-700">{statusLine}</p>
            {!dense && (
              <p className="truncate text-base font-bold text-neutral-500">
                {destinationLabel}
              </p>
            )}
          </div>

          {!metrics.arrived && (
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold text-black">
                {formatEtaMinutes(metrics.etaSec)}
              </p>
              <p className="text-sm font-bold text-neutral-500">ETA</p>
            </div>
          )}
        </div>

        <div
          className={`h-1.5 overflow-hidden rounded-full bg-neutral-100 ${
            dense ? "mt-2.5" : "mt-4"
          }`}
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 ease-linear"
            style={{
              width: `${Math.min(100, Math.max(2, metrics.progress * 100))}%`,
            }}
          />
        </div>

        {routeFallback && routeReady && (
          <p className="mt-2 text-sm font-bold text-neutral-400">
            Tryb offline — trasa przybliżona
          </p>
        )}
      </div>
    </div>
  );
}
