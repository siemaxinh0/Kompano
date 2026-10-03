"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Coords,
  FALLBACK_CENTER,
  clampToKrakow,
  reverseGeocodePl,
} from "@/lib/geo";

export type LocationStatus =
  | "idle"
  | "loading"
  | "granted"
  | "denied"
  | "unavailable";

export function useServiceLocation() {
  const [serviceCoords, setServiceCoords] = useState<Coords | null>(null);
  const [streetAddress, setStreetAddress] = useState("");
  const [apartmentNumber, setApartmentNumber] = useState("");
  const [gpsStatus, setGpsStatus] = useState<LocationStatus>("idle");
  const [isGeocoding, setIsGeocoding] = useState(false);

  const applyCoords = useCallback(async (coords: Coords, street?: string) => {
    const pinned = clampToKrakow(coords);
    setServiceCoords(pinned);
    if (street) {
      setStreetAddress(street);
      return;
    }
    setIsGeocoding(true);
    try {
      const label = await reverseGeocodePl(pinned);
      setStreetAddress(label);
    } catch {
      setStreetAddress(
        `${pinned.lat.toFixed(5)}, ${pinned.lng.toFixed(5)}`,
      );
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  const requestGps = useCallback(async (): Promise<Coords | null> => {
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      return null;
    }

    setGpsStatus("loading");

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const next: Coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setGpsStatus("granted");
          await applyCoords(next);
          resolve(next);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setGpsStatus("denied");
          } else {
            setGpsStatus("unavailable");
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 60_000,
        },
      );
    });
  }, [applyCoords]);

  const confirmLocation = useCallback(
    async (coords: Coords, apartment: string, street?: string) => {
      setApartmentNumber(apartment.trim());
      await applyCoords(coords, street);
    },
    [applyCoords],
  );

  const displayCenter = serviceCoords ?? FALLBACK_CENTER;
  const hasPin = serviceCoords !== null;
  const apt = apartmentNumber.trim();
  const isReadyToOrder = hasPin && apt.length > 0;

  const displayAddress = useMemo(() => {
    if (!hasPin) return "";
    if (!apt) return `${streetAddress} — dodaj nr mieszkania`;
    return `${streetAddress}, m. ${apt}`;
  }, [apt, hasPin, streetAddress]);

  const searchBarLabel = hasPin
    ? displayAddress
    : "Wpisz miejsce pomocy";

  return {
    serviceCoords,
    streetAddress,
    apartmentNumber,
    gpsStatus,
    isGeocoding,
    requestGps,
    confirmLocation,
    displayCenter,
    hasPin,
    isReadyToOrder,
    displayAddress,
    searchBarLabel,
  };
}
