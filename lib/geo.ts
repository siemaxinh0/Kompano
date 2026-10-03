export type Coords = { lat: number; lng: number };

export type AddressSuggestion = {
  id: string;
  label: string;
  coords: Coords;
};

/** Granice robocze miasta Kraków (Nominatim viewbox + mapa). */
export const KRAKOW_BOUNDS = {
  south: 49.967,
  west: 19.792,
  north: 50.126,
  east: 20.217,
} as const;

/** Leaflet LatLngBounds: [[south, west], [north, east]] */
export const KRAKOW_MAP_BOUNDS: [[number, number], [number, number]] = [
  [KRAKOW_BOUNDS.south, KRAKOW_BOUNDS.west],
  [KRAKOW_BOUNDS.north, KRAKOW_BOUNDS.east],
];

/** Nominatim: left,top,right,bottom = west,north,east,south */
export const KRAKOW_VIEWBOX = [
  KRAKOW_BOUNDS.west,
  KRAKOW_BOUNDS.north,
  KRAKOW_BOUNDS.east,
  KRAKOW_BOUNDS.south,
].join(",");

/** Domyślny widok — Rynek Główny, Kraków. */
export const FALLBACK_CENTER: Coords = { lat: 50.06143, lng: 19.93658 };

export function isInKrakow(coords: Coords): boolean {
  return (
    coords.lat >= KRAKOW_BOUNDS.south &&
    coords.lat <= KRAKOW_BOUNDS.north &&
    coords.lng >= KRAKOW_BOUNDS.west &&
    coords.lng <= KRAKOW_BOUNDS.east
  );
}

export function clampToKrakow(coords: Coords): Coords {
  return {
    lat: Math.min(
      KRAKOW_BOUNDS.north,
      Math.max(KRAKOW_BOUNDS.south, coords.lat),
    ),
    lng: Math.min(
      KRAKOW_BOUNDS.east,
      Math.max(KRAKOW_BOUNDS.west, coords.lng),
    ),
  };
}

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

/** Losowa pozycja pomocnika w promieniu ~200–750 m (stabilna dla tego samego seeda). */
export function randomHelperCoordsNear(user: Coords, seedKey: string): Coords {
  const rnd = createSeededRandom(hashString(seedKey));
  const angle = rnd() * Math.PI * 2;
  const distanceM = 200 + rnd() * 550;
  const latRad = (user.lat * Math.PI) / 180;
  const dLat = (distanceM / 111_320) * Math.cos(angle);
  const dLng =
    (distanceM / (111_320 * Math.cos(latRad))) * Math.sin(angle);
  return clampToKrakow({ lat: user.lat + dLat, lng: user.lng + dLng });
}

/** @deprecated Użyj randomHelperCoordsNear z seedem. */
export function helperCoordsNear(user: Coords): Coords {
  return randomHelperCoordsNear(user, `${user.lat},${user.lng}`);
}

export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formatDistancePl(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Ujednolicenie nazwy ulicy do wyświetlania (ul. / al. / pl.). */
function formatRoadDisplay(road: string): string {
  const r = road.trim().replace(/\s+/g, " ");
  if (
    /^(ul\.|ulica|al\.|aleja|pl\.|plac|os\.|osiedle|rondo|skwer)\b/i.test(r)
  ) {
    return r
      .replace(/^ulica\b/i, "ul.")
      .replace(/^aleja\b/i, "al.")
      .replace(/^plac\b/i, "pl.")
      .replace(/^osiedle\b/i, "os.");
  }
  return `ul. ${r}`;
}

/** Klucz deduplikacji — bez dublowania tej samej ulicy / numeru. */
function normalizeStreetKey(road: string): string {
  return road
    .toLocaleLowerCase("pl-PL")
    .replace(/^(ul\.|ulica|al\.|aleja|pl\.|plac|os\.|osiedle)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isKrakowAddress(row: {
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
}): boolean {
  const coords = { lat: Number(row.lat), lng: Number(row.lon) };
  if (isInKrakow(coords)) return true;
  const a = row.address;
  if (!a) return false;
  const hay = [a.city, a.town, a.municipality, a.county]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pl-PL");
  return /krak[oó]w/.test(hay);
}

export async function reverseGeocodePl(coords: Coords): Promise<string> {
  const pinned = clampToKrakow(coords);
  const params = new URLSearchParams({
    lat: String(pinned.lat),
    lon: String(pinned.lng),
    format: "json",
    addressdetails: "1",
    "accept-language": "pl",
    zoom: "18",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!res.ok) throw new Error("reverse geocode failed");

  const data = (await res.json()) as {
    address?: {
      road?: string;
      pedestrian?: string;
      footway?: string;
      path?: string;
      house_number?: string;
      city?: string;
      town?: string;
      village?: string;
      suburb?: string;
      city_district?: string;
    };
    display_name?: string;
  };

  const a = data.address;
  const road =
    a?.road ?? a?.pedestrian ?? a?.footway ?? a?.path ?? undefined;
  if (road) {
    const street = formatRoadDisplay(road);
    const withNr = a?.house_number ? `${street} ${a.house_number}` : street;
    const district = a?.suburb ?? a?.city_district;
    return [withNr, district, "Kraków"].filter(Boolean).join(", ");
  }

  if (data.display_name) {
    const parts = data.display_name.split(",").map((p) => p.trim());
    const short = parts.slice(0, 2).join(", ");
    return /krak[oó]w/i.test(short) ? short : `${short}, Kraków`;
  }

  return `${pinned.lat.toFixed(5)}, ${pinned.lng.toFixed(5)}`;
}

type NominatimSearchRow = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    footway?: string;
    house_number?: string;
    suburb?: string;
    city_district?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
};

function roadFromRow(row: NominatimSearchRow): string | undefined {
  const a = row.address;
  return a?.road ?? a?.pedestrian ?? a?.footway ?? undefined;
}

function formatSearchLabel(row: NominatimSearchRow): string {
  const a = row.address;
  const road = roadFromRow(row);
  if (road) {
    const street = a?.house_number
      ? `${formatRoadDisplay(road)} ${a.house_number}`
      : formatRoadDisplay(road);
    const district =
      a?.suburb ?? a?.city_district ?? a?.neighbourhood ?? undefined;
    return [street, district, "Kraków"].filter(Boolean).join(", ");
  }

  const parts = row.display_name.split(",").map((p) => p.trim());
  const short = parts.slice(0, 2).join(", ");
  return /krak[oó]w/i.test(short) ? short : `${short}, Kraków`;
}

function searchResultRank(row: NominatimSearchRow): number {
  const hasNr = Boolean(row.address?.house_number);
  if (row.class === "highway" && hasNr) return 0;
  if (row.class === "place" && row.type === "house") return 1;
  if (row.class === "building" && hasNr) return 2;
  if (row.class === "highway") return 3;
  if (row.class === "building") return 4;
  if (row.class === "place") return 5;
  return 6;
}

function suggestionDedupeKey(row: NominatimSearchRow): string {
  const road = roadFromRow(row);
  if (road) {
    const streetKey = normalizeStreetKey(road);
    const nr = row.address?.house_number?.trim().toLocaleLowerCase("pl-PL") ?? "";
    // Bez numeru budynku — jedna propozycja na ulicę (bez dublowania segmentów OSM).
    return nr ? `addr:${streetKey}|${nr}` : `street:${streetKey}`;
  }
  return `other:${formatSearchLabel(row).toLocaleLowerCase("pl-PL")}`;
}

export async function searchAddressPl(
  query: string,
): Promise<AddressSuggestion[]> {
  const raw = query.trim();
  if (raw.length < 2) return [];

  const q = /krak[oó]w/i.test(raw) ? raw : `${raw}, Kraków`;

  const params = new URLSearchParams({
    q,
    format: "json",
    addressdetails: "1",
    limit: "30",
    countrycodes: "pl",
    "accept-language": "pl",
    viewbox: KRAKOW_VIEWBOX,
    bounded: "1",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { Accept: "application/json" } },
  );

  if (!res.ok) return [];

  const rows = ((await res.json()) as NominatimSearchRow[]).filter(
    isKrakowAddress,
  );

  const sorted = [...rows].sort(
    (a, b) => searchResultRank(a) - searchResultRank(b),
  );

  const seen = new Set<string>();
  const unique: AddressSuggestion[] = [];

  for (const row of sorted) {
    const key = suggestionDedupeKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const label = formatSearchLabel(row);
    unique.push({
      id: String(row.place_id),
      label,
      coords: clampToKrakow({
        lat: Number(row.lat),
        lng: Number(row.lon),
      }),
    });

    if (unique.length >= 8) break;
  }

  return unique;
}
