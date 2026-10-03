"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import { Coords, FALLBACK_CENTER, KRAKOW_MAP_BOUNDS, helperCoordsNear } from "@/lib/geo";
import { helperPinIcon, servicePinIcon } from "@/components/mapIcons";

type LocationMapProps = {
  center: Coords;
  hasPin: boolean;
  showHelper?: boolean;
  showRoute?: boolean;
  compact?: boolean;
  interactive?: boolean;
  className?: string;
};

function RecenterMap({ center, zoom }: { center: Coords; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, zoom, map]);

  return null;
}

export default function LocationMap({
  center,
  hasPin,
  showHelper = false,
  showRoute = false,
  compact = false,
  interactive = false,
  className = "",
}: LocationMapProps) {
  const zoom = hasPin ? (compact ? 16 : 17) : 13;
  const mapCenter = hasPin ? center : FALLBACK_CENTER;

  const helper = useMemo(
    () => helperCoordsNear(hasPin ? center : FALLBACK_CENTER),
    [center.lat, center.lng, hasPin],
  );

  const route: [number, number][] = showRoute
    ? [
        [helper.lat, helper.lng],
        [mapCenter.lat, mapCenter.lng],
      ]
    : [];

  const heightClass = compact ? "h-36" : "h-52";

  return (
    <div
      className={`relative w-full overflow-hidden ${heightClass} ${
        compact ? "rounded-2xl border border-neutral-200" : "rounded-b-3xl"
      } ${className}`}
    >
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={zoom}
        minZoom={11}
        maxBounds={KRAKOW_MAP_BOUNDS}
        maxBoundsViscosity={1}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={false}
        className="z-0 h-full w-full"
        attributionControl={compact}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap center={mapCenter} zoom={zoom} />

        {hasPin && (
          <Marker
            position={[mapCenter.lat, mapCenter.lng]}
            icon={servicePinIcon}
          />
        )}

        {(showHelper || showRoute) && (
          <Marker position={[helper.lat, helper.lng]} icon={helperPinIcon} />
        )}

        {showRoute && route.length === 2 && (
          <Polyline
            positions={route}
            pathOptions={{
              color: "#059669",
              weight: 5,
              opacity: 0.85,
              dashArray: "10 8",
            }}
          />
        )}
      </MapContainer>

      {!compact && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[400] h-14 bg-gradient-to-t from-neutral-50 to-transparent" />
      )}
    </div>
  );
}
