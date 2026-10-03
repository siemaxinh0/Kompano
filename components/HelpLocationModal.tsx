"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  Coords,
  KRAKOW_MAP_BOUNDS,
  clampToKrakow,
  isInKrakow,
  reverseGeocodePl,
  searchAddressPl,
  type AddressSuggestion,
} from "@/lib/geo";
import { servicePinIcon } from "@/components/mapIcons";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Navigation,
  Search,
  X,
} from "lucide-react";

type HelpLocationModalProps = {
  open: boolean;
  initialCoords: Coords;
  initialApartment: string;
  initialStreet: string;
  isGeocoding: boolean;
  gpsLoading: boolean;
  onClose: () => void;
  onConfirm: (coords: Coords, apartment: string, street?: string) => void;
  onRequestGps: () => Promise<Coords | null>;
};

type Mode = "address" | "map";

function RecenterMap({ center, zoom }: { center: Coords; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, zoom, map]);
  return null;
}

function MapClickPicker({ onPick }: { onPick: (coords: Coords) => void }) {
  useMapEvents({
    click(e) {
      onPick(clampToKrakow({ lat: e.latlng.lat, lng: e.latlng.lng }));
    },
  });
  return null;
}

function KrakowMapLimits() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(KRAKOW_MAP_BOUNDS);
    map.setMinZoom(11);
  }, [map]);
  return null;
}

export default function HelpLocationModal({
  open,
  initialCoords,
  initialApartment,
  initialStreet,
  isGeocoding,
  gpsLoading,
  onClose,
  onConfirm,
  onRequestGps,
}: HelpLocationModalProps) {
  const [mode, setMode] = useState<Mode>("address");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<AddressSuggestion | null>(null);
  const [draftApartment, setDraftApartment] = useState(initialApartment);
  const [draftPin, setDraftPin] = useState<Coords>(initialCoords);
  const [mapAddress, setMapAddress] = useState(initialStreet);

  useEffect(() => {
    if (!open) return;
    setMode("address");
    setQuery(initialStreet);
    setSelected(null);
    setDraftApartment(initialApartment);
    setDraftPin(initialCoords);
    setMapAddress(initialStreet);
    setSuggestions([]);
  }, [open, initialApartment, initialStreet, initialCoords.lat, initialCoords.lng]);

  useEffect(() => {
    if (!open || mode !== "address") return;
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchAddressPl(q);
        setSuggestions(results);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query, open, mode]);

  useEffect(() => {
    if (!open || mode !== "map") return;
    let cancelled = false;
    setMapAddress("Odczytuję adres…");
    reverseGeocodePl(draftPin)
      .then((label) => {
        if (!cancelled) setMapAddress(label);
      })
      .catch(() => {
        if (!cancelled) {
          setMapAddress(
            `${draftPin.lat.toFixed(5)}, ${draftPin.lng.toFixed(5)}`,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [draftPin, mode, open]);

  useEffect(() => {
    if (!open || mode !== "map") return;
    setDraftPin(initialCoords);
  }, [initialCoords.lat, initialCoords.lng, mode, open]);

  if (!open) return null;

  const aptOk = draftApartment.trim().length > 0;
  const confirmFromAddress = async () => {
    if (!aptOk) return;
    if (selected) {
      onConfirm(selected.coords, draftApartment.trim(), selected.label);
      return;
    }
    const results = await searchAddressPl(query);
    if (!results[0]) return;
    onConfirm(results[0].coords, draftApartment.trim(), results[0].label);
  };

  const confirmFromMap = () => {
    if (!aptOk) return;
    onConfirm(draftPin, draftApartment.trim(), mapAddress);
  };

  return (
    <div
      className="fixed inset-0 z-[1000] mx-auto flex max-w-md flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-location-title"
    >
      {mode === "address" ? (
        <>
          <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-neutral-600"
              aria-label="Zamknij"
            >
              <X className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <h2
              id="help-location-title"
              className="text-2xl font-bold text-black"
            >
              Miejsce pomocy
            </h2>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <p className="mb-3 text-xl font-bold text-neutral-600">
              Adres pomocy w Krakowie. Wpisz ulicę — dokładny nr mieszkania
              podasz poniżej.
            </p>

            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                }}
                placeholder="np. ul. Floriańska, Grodzka…"
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-100 py-4 pl-12 pr-4 text-xl font-bold text-black outline-none ring-emerald-600 focus:bg-white focus:ring-2"
              />
            </label>

            {(searching || suggestions.length > 0) && (
              <ul className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                {searching && (
                  <li className="flex items-center gap-3 px-4 py-4 text-xl font-bold text-neutral-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Szukam adresów…
                  </li>
                )}
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(item);
                        setQuery(item.label);
                        setSuggestions([]);
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-4 text-left text-xl font-bold ${
                        selected?.id === item.id
                          ? "bg-emerald-50 text-emerald-900"
                          : "text-black hover:bg-neutral-50"
                      }`}
                    >
                      <MapPin className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="mt-5 block">
              <span className="text-xl font-bold text-black">
                Nr mieszkania / lokalu{" "}
                <span className="text-emerald-700">*</span>
              </span>
              <input
                type="text"
                inputMode="text"
                placeholder="np. 12A"
                value={draftApartment}
                onChange={(e) => setDraftApartment(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4 text-xl font-bold outline-none ring-emerald-600 focus:ring-2"
              />
            </label>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                disabled={gpsLoading}
                onClick={async () => {
                  const coords = await onRequestGps();
                  if (!coords) return;
                  const pinned = isInKrakow(coords)
                    ? coords
                    : clampToKrakow(coords);
                  if (!isInKrakow(coords)) {
                    window.alert(
                      "Lokalizacja GPS jest poza Krakowem. Ustawiamy pin w granicach miasta — możesz go przesunąć na mapie.",
                    );
                  }
                  setDraftPin(pinned);
                  const label = await reverseGeocodePl(pinned).catch(
                    () =>
                      `${pinned.lat.toFixed(5)}, ${pinned.lng.toFixed(5)}`,
                  );
                  setQuery(label);
                  setSelected({ id: "gps", label, coords: pinned });
                }}
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-4 text-xl font-bold text-neutral-800"
              >
                {gpsLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                ) : (
                  <Navigation className="h-6 w-6 text-emerald-600" />
                )}
                Użyj mojej lokalizacji
              </button>
              <button
                type="button"
                onClick={() => setMode("map")}
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-4 text-xl font-bold text-neutral-800"
              >
                <MapPin className="h-6 w-6 text-emerald-600" />
                Zaznacz na mapie
              </button>
            </div>
          </div>

          <footer className="border-t border-neutral-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={!aptOk || query.trim().length < 2}
              onClick={() => void confirmFromAddress()}
              className="w-full rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white disabled:bg-neutral-300"
            >
              {isGeocoding ? "Zapisuję…" : "Potwierdź adres"}
            </button>
          </footer>
        </>
      ) : (
        <>
          <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-4">
            <button
              type="button"
              onClick={() => setMode("address")}
              className="rounded-xl p-2 text-neutral-600"
              aria-label="Wróć do wpisywania adresu"
            >
              <ArrowLeft className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <h2 className="text-2xl font-bold text-black">Zaznacz na mapie</h2>
          </header>

          <div className="relative min-h-0 flex-1">
            <MapContainer
              center={[draftPin.lat, draftPin.lng]}
              zoom={15}
              minZoom={11}
              maxBounds={KRAKOW_MAP_BOUNDS}
              maxBoundsViscosity={1}
              scrollWheelZoom
              dragging
              zoomControl={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution="© OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <KrakowMapLimits />
              <RecenterMap center={draftPin} zoom={16} />
              <MapClickPicker onPick={setDraftPin} />
              <Marker
                position={[draftPin.lat, draftPin.lng]}
                icon={servicePinIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    setDraftPin(clampToKrakow({ lat, lng }));
                  },
                }}
              />
            </MapContainer>
          </div>

          <footer className="space-y-3 border-t border-neutral-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="text-lg font-bold text-neutral-700">{mapAddress}</p>
            <label className="block">
              <span className="text-xl font-bold text-black">
                Nr mieszkania / lokalu{" "}
                <span className="text-emerald-700">*</span>
              </span>
              <input
                type="text"
                value={draftApartment}
                onChange={(e) => setDraftApartment(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4 text-xl font-bold outline-none ring-emerald-600 focus:ring-2"
              />
            </label>
            <button
              type="button"
              disabled={!aptOk}
              onClick={confirmFromMap}
              className="w-full rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white disabled:bg-neutral-300"
            >
              Potwierdź lokalizację
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
