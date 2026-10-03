"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import { Coords, distanceMeters } from "@/lib/geo";
import {
  createDestinationPinIcon,
  createHelperAvatarIcon,
} from "@/components/mapIcons";

type LatLngTuple = [number, number];

type DogWalkMapProps = {
  home: Coords;
  seedKey: string;
  helperName: string;
  helperAvatarUrl: string;
  /** Date.now() startu spaceru — postęp działa też poza widokiem. */
  startedAtMs: number;
  onWalkComplete?: () => void;
};

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}

function createSeededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function metersToCoords(
  home: Coords,
  eastM: number,
  northM: number,
): Coords {
  const latRad = (home.lat * Math.PI) / 180;
  return {
    lat: home.lat + northM / 111_320,
    lng: home.lng + eastM / (111_320 * Math.cos(latRad)),
  };
}

/** Punkty w okolicy domu — OSRM poprowadzi między nimi po chodnikach. */
function nearbyWalkStops(home: Coords, seedKey: string): Coords[] {
  const rnd = createSeededRandom(hashString(`walk-stops-${seedKey}`));
  const baseAngle = rnd() * Math.PI * 2;
  const stops: Coords[] = [];
  const count = 3;
  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (i * 2 * Math.PI) / count + (rnd() - 0.5) * 0.4;
    const dist = 220 + rnd() * 200;
    stops.push(
      metersToCoords(home, Math.sin(angle) * dist, Math.cos(angle) * dist),
    );
  }
  return stops;
}

async function fetchOsrmWalking(chain: Coords[]): Promise<LatLngTuple[] | null> {
  if (chain.length < 2) return null;
  const coords = chain.map((c) => `${c.lng},${c.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/walking/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    if (data.code && data.code !== "Ok") return null;
    const raw = data.routes?.[0]?.geometry?.coordinates;
    if (!raw || raw.length < 2) return null;
    return raw.map(([lng, lat]) => [lat, lng] as LatLngTuple);
  } catch {
    return null;
  }
}

/** Pętla spacerowa po chodnikach/ulicach (OSRM walking) — bez wchodzenia w budynki. */
async function fetchWalkingCircuit(home: Coords, seedKey: string): Promise<LatLngTuple[] | null> {
  const stops = nearbyWalkStops(home, seedKey);

  // Pełna pętla: dom → 3 punkty w okolicy → dom
  const circuit = await fetchOsrmWalking([home, ...stops, home]);
  if (circuit) return circuit;

  // Uproszczona trasa: do najbliższego przystanku i z powrotem (też po ulicach)
  for (const stop of stops) {
    const outAndBack = await fetchOsrmWalking([home, stop, home]);
    if (outAndBack) return outAndBack;
  }

  return null;
}

/** Ostatni fallback gdy OSRM niedostępny — wyjście i powrót (prosta linia). */
function buildFallbackOutAndBack(home: Coords, seedKey: string): LatLngTuple[] {
  const rnd = createSeededRandom(hashString(`walk-fb-${seedKey}`));
  const angle = rnd() * Math.PI * 2;
  const dist = 200 + rnd() * 120;
  const mid = metersToCoords(
    home,
    Math.sin(angle) * dist,
    Math.cos(angle) * dist,
  );
  const points: LatLngTuple[] = [[home.lat, home.lng]];
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    points.push([
      home.lat + (mid.lat - home.lat) * t,
      home.lng + (mid.lng - home.lng) * t,
    ]);
  }
  for (let i = 11; i >= 0; i--) {
    points.push(points[i]);
  }
  return points;
}

function routeLengthMeters(line: LatLngTuple[]): number {
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) {
    total += distanceMeters(
      { lat: line[i][0], lng: line[i][1] },
      { lat: line[i + 1][0], lng: line[i + 1][1] },
    );
  }
  return total;
}

function pointAtDistance(line: LatLngTuple[], meters: number): LatLngTuple {
  if (line.length === 0) return [0, 0];
  if (line.length === 1) return line[0];

  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const len = distanceMeters(
      { lat: line[i][0], lng: line[i][1] },
      { lat: line[i + 1][0], lng: line[i + 1][1] },
    );
    segLens.push(len);
    total += len;
  }
  if (total <= 0) return line[0];

  const target = Math.min(Math.max(0, meters), total);
  let walked = 0;
  for (let i = 0; i < segLens.length; i++) {
    const seg = segLens[i];
    if (walked + seg >= target) {
      const t = seg > 0 ? (target - walked) / seg : 0;
      const [lat1, lng1] = line[i];
      const [lat2, lng2] = line[i + 1];
      return [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t];
    }
    walked += seg;
  }
  return line[line.length - 1];
}

function FollowWalker({
  position,
  home,
}: {
  position: LatLngTuple;
  home: Coords;
}) {
  const map = useMap();
  const fitted = useRef(false);
  const lastPan = useRef(0);

  useEffect(() => {
    if (!fitted.current) {
      fitted.current = true;
      map.setView([home.lat, home.lng], 16, { animate: false });
      return;
    }
    const now = performance.now();
    if (now - lastPan.current < 2200) return;
    lastPan.current = now;
    map.panTo(position, { animate: true, duration: 1.0, easeLinearity: 0.25 });
  }, [map, position, home.lat, home.lng]);

  return null;
}

const WALK_SPEED_MPS = 2.0;

export default function DogWalkMap({
  home,
  seedKey,
  helperName,
  helperAvatarUrl,
  startedAtMs,
  onWalkComplete,
}: DogWalkMapProps) {
  const [path, setPath] = useState<LatLngTuple[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<LatLngTuple>([home.lat, home.lng]);
  const [elapsedSec, setElapsedSec] = useState(() =>
    Math.max(0, (Date.now() - startedAtMs) / 1000),
  );
  const [traveledM, setTraveledM] = useState(0);
  const completedRef = useRef(false);

  const homeIcon = useMemo(() => createDestinationPinIcon(), []);
  const helperIcon = useMemo(
    () => createHelperAvatarIcon(helperAvatarUrl),
    [helperAvatarUrl],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPath(null);
    setPosition([home.lat, home.lng]);
    completedRef.current = false;

    void fetchWalkingCircuit(home, seedKey).then((line) => {
      if (cancelled) return;
      if (line && line.length >= 2) {
        // Upewnij się, że pierwszy punkt to dom
        setPath([[home.lat, home.lng], ...line.slice(1)]);
      } else {
        setPath(buildFallbackOutAndBack(home, seedKey));
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [home.lat, home.lng, seedKey]);

  const totalM = useMemo(
    () => (path && path.length >= 2 ? routeLengthMeters(path) : 0),
    [path],
  );

  useEffect(() => {
    if (!path || path.length < 2 || totalM < 1 || loading) return;
    let frame = 0;

    const tick = () => {
      const elapsed = Math.max(0, (Date.now() - startedAtMs) / 1000);
      const traveled = elapsed * WALK_SPEED_MPS;
      setElapsedSec(elapsed);
      setTraveledM(Math.min(traveled, totalM));
      const capped = Math.min(traveled, totalM * 0.995);
      setPosition(pointAtDistance(path, capped));

      if (traveled >= totalM * 0.98 && !completedRef.current) {
        completedRef.current = true;
        onWalkComplete?.();
        return;
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [path, totalM, loading, seedKey, startedAtMs, onWalkComplete]);

  const elapsedLabel = useMemo(() => {
    const m = Math.floor(elapsedSec / 60);
    const s = Math.floor(elapsedSec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [elapsedSec]);

  const distanceLabel =
    traveledM < 1000
      ? `${Math.round(traveledM)} m`
      : `${(traveledM / 1000).toFixed(1)} km`;

  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div>
          <p className="text-lg font-bold text-emerald-700">Spacer z psem</p>
          <p className="text-xl font-bold text-black">
            {helperName} jest na spacerze
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-black">{elapsedLabel}</p>
          <p className="text-sm font-bold text-neutral-500">{distanceLabel}</p>
        </div>
      </div>

      <div className="relative h-72 w-full bg-neutral-100">
        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/75 text-lg font-bold text-neutral-600">
            Wyznaczam trasę spaceru…
          </div>
        )}
        <MapContainer
          center={[home.lat, home.lng]}
          zoom={16}
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
          <FollowWalker position={position} home={home} />
          <Marker position={[home.lat, home.lng]} icon={homeIcon} />
          <Marker position={position} icon={helperIcon} zIndexOffset={800} />
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-4 px-4 py-3 text-lg font-bold text-neutral-600">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-600" />
          Dom / start
        </span>
        <span className="flex items-center gap-2">
          <img
            src={helperAvatarUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
            width={28}
            height={28}
          />
          {helperName} + pies
        </span>
      </div>
    </div>
  );
}
