"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bike,
  Briefcase,
  Car,
  ClipboardList,
  Footprints,
  MapPin,
  Power,
  User,
  Wallet,
  Zap,
} from "lucide-react";

type HelperTab = "jobs" | "active" | "earnings" | "profile";
type HelperTransport = "car" | "bike" | "walk" | "scooter";

type TransportOption = {
  id: HelperTransport;
  label: string;
  hint: string;
  icon: typeof Car;
};

const TRANSPORT_OPTIONS: TransportOption[] = [
  {
    id: "car",
    label: "Samochód",
    hint: "Szybkie dojazdy dalej",
    icon: Car,
  },
  {
    id: "bike",
    label: "Rower",
    hint: "Miasto i krótkie trasy",
    icon: Bike,
  },
  {
    id: "scooter",
    label: "Hulajnoga",
    hint: "Elastycznie po okolicy",
    icon: Zap,
  },
  {
    id: "walk",
    label: "Pieszo",
    hint: "Najbliższe zlecenia",
    icon: Footprints,
  },
];

const SESSION_KEY = "helpovski-helper-session";

type HelperSession = {
  online: boolean;
  transport: HelperTransport | null;
};

function readSession(): HelperSession {
  if (typeof window === "undefined") {
    return { online: false, transport: null };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { online: false, transport: null };
    const parsed = JSON.parse(raw) as HelperSession;
    if (
      typeof parsed.online === "boolean" &&
      (parsed.transport === null ||
        TRANSPORT_OPTIONS.some((t) => t.id === parsed.transport))
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return { online: false, transport: null };
}

function writeSession(session: HelperSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

function transportLabel(id: HelperTransport | null): string {
  return TRANSPORT_OPTIONS.find((t) => t.id === id)?.label ?? "—";
}

/**
 * Widok zleceniobiorcy — aktywność online jak Glovo Rider + wybór transportu.
 * Przełączanie z widoku klienta: Ctrl+Alt+H
 */
export default function HelperApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<HelperTab>("jobs");
  const [online, setOnline] = useState(false);
  const [transport, setTransport] = useState<HelperTransport | null>(null);
  /** Ekran startu aktywności (wybór środka transportu). */
  const [startingShift, setStartingShift] = useState(false);
  const [pickedTransport, setPickedTransport] =
    useState<HelperTransport | null>(null);

  useEffect(() => {
    const s = readSession();
    setOnline(s.online);
    setTransport(s.transport);
    setReady(true);
  }, []);

  const persist = useCallback((next: HelperSession) => {
    setOnline(next.online);
    setTransport(next.transport);
    writeSession(next);
  }, []);

  const openStartShift = () => {
    setPickedTransport(transport);
    setStartingShift(true);
  };

  const confirmGoOnline = useCallback(
    (chosen: HelperTransport) => {
      persist({ online: true, transport: chosen });
      setStartingShift(false);
      setTab("jobs");
    },
    [persist],
  );

  const goOffline = () => {
    persist({ online: false, transport });
    setStartingShift(false);
  };

  if (!ready) {
    return (
      <div className="mx-auto flex h-dvh max-w-md items-center justify-center bg-neutral-50">
        <span className="text-lg font-bold text-neutral-500">Ładowanie…</span>
      </div>
    );
  }

  if (startingShift) {
    return (
      <StartShiftScreen
        alreadyOnline={online}
        picked={pickedTransport}
        onPick={setPickedTransport}
        onCancel={() => setStartingShift(false)}
        onConfirm={confirmGoOnline}
      />
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col overflow-hidden bg-neutral-50 text-black shadow-xl shadow-black/5">
      <header
        className={`px-5 pb-5 pt-6 text-white ${
          online ? "bg-emerald-700" : "bg-neutral-800"
        }`}
      >
        <p className="text-sm font-bold uppercase tracking-wide text-white/70">
          Kompano · pomocnik
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">
          {tab === "jobs"
            ? "Dostępne zlecenia"
            : tab === "active"
              ? "Aktywne"
              : tab === "earnings"
                ? "Zarobki"
                : "Twój profil"}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${
              online
                ? "bg-emerald-500/30 text-emerald-50"
                : "bg-white/15 text-neutral-200"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                online ? "bg-lime-300" : "bg-neutral-400"
              }`}
              aria-hidden
            />
            {online ? "Aktywność włączona" : "Offline"}
          </span>
          {online && transport && (
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold text-emerald-50">
              {transportLabel(transport)}
            </span>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-5">
        {tab === "jobs" && (
          <JobsTab
            online={online}
            transport={transport}
            onStartShift={openStartShift}
            onGoOffline={goOffline}
          />
        )}

        {tab === "active" && (
          <ActiveTab online={online} onStartShift={openStartShift} />
        )}

        {tab === "earnings" && <EarningsTab />}

        {tab === "profile" && (
          <ProfileTab
            online={online}
            transport={transport}
            onStartShift={openStartShift}
            onGoOffline={goOffline}
          />
        )}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md border-t border-neutral-200 bg-white/95 backdrop-blur-md"
        aria-label="Nawigacja pomocnika"
      >
        <div className="flex items-stretch justify-around px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <HelperNavButton
            label="Oferty"
            icon={ClipboardList}
            active={tab === "jobs"}
            onClick={() => setTab("jobs")}
          />
          <HelperNavButton
            label="Aktywne"
            icon={Briefcase}
            active={tab === "active"}
            onClick={() => setTab("active")}
          />
          <HelperNavButton
            label="Zarobki"
            icon={Wallet}
            active={tab === "earnings"}
            onClick={() => setTab("earnings")}
          />
          <HelperNavButton
            label="Profil"
            icon={User}
            active={tab === "profile"}
            onClick={() => setTab("profile")}
          />
        </div>
      </nav>
    </div>
  );
}

function StartShiftScreen({
  alreadyOnline,
  picked,
  onPick,
  onCancel,
  onConfirm,
}: {
  alreadyOnline: boolean;
  picked: HelperTransport | null;
  onPick: (t: HelperTransport) => void;
  onCancel: () => void;
  onConfirm: (chosen: HelperTransport) => void;
}) {
  return (
    <div className="relative z-[90] mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col overflow-hidden bg-neutral-50 text-black shadow-xl shadow-black/5">
      <header className="bg-emerald-700 px-5 pb-5 pt-6 text-white">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-100">
          {alreadyOnline ? "Transport" : "Start aktywności"}
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">
          Jak się dziś poruszasz?
        </h1>
        <p className="mt-2 text-lg font-bold text-emerald-50">
          Wybierz środek transportu — dopasujemy zlecenia w okolicy.
        </p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
        {TRANSPORT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = picked === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPick(opt.id)}
              className={`flex min-h-[88px] w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition ${
                selected
                  ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600"
                  : "border-neutral-200 bg-white shadow-sm"
              }`}
            >
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                  selected
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                <Icon className="h-7 w-7" strokeWidth={2.5} />
              </span>
              <span className="min-w-0">
                <span className="block text-xl font-bold text-black">
                  {opt.label}
                </span>
                <span className="mt-0.5 block text-lg font-bold text-neutral-500">
                  {opt.hint}
                </span>
              </span>
            </button>
          );
        })}
      </main>

      <div className="relative z-[100] border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          disabled={!picked}
          onClick={() => {
            if (!picked) return;
            onConfirm(picked);
          }}
          className="w-full rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {alreadyOnline ? "Zapisz i kontynuuj" : "Rozpocznij aktywność"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full rounded-2xl py-3 text-lg font-bold text-neutral-600"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

function JobsTab({
  online,
  transport,
  onStartShift,
  onGoOffline,
}: {
  online: boolean;
  transport: HelperTransport | null;
  onStartShift: () => void;
  onGoOffline: () => void;
}) {
  if (!online) {
    return (
      <section className="flex flex-col gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <Power
            className="h-10 w-10 text-neutral-400"
            strokeWidth={2.5}
          />
          <p className="mt-3 text-2xl font-bold text-black">
            Jesteś offline
          </p>
          <p className="mt-2 text-lg font-bold leading-snug text-neutral-600">
            Włącz aktywność, wybierz jak się dziś poruszasz — dopiero wtedy
            możesz przyjmować zlecenia.
          </p>
          <button
            type="button"
            onClick={onStartShift}
            className="mt-5 w-full rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white"
          >
            Rozpocznij aktywność
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div>
          <p className="text-lg font-bold text-emerald-900">
            Szukam zleceń…
          </p>
          <p className="text-base font-bold text-emerald-800">
            Transport: {transportLabel(transport)}
          </p>
        </div>
        <button
          type="button"
          onClick={onGoOffline}
          className="shrink-0 rounded-xl bg-white px-3 py-2 text-base font-bold text-neutral-800 ring-1 ring-neutral-200"
        >
          Zakończ
        </button>
      </div>

      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center">
        <MapPin
          className="mx-auto h-10 w-10 text-emerald-600"
          strokeWidth={2.5}
        />
        <p className="mt-3 text-xl font-bold text-black">
          Brak zleceń w pobliżu
        </p>
        <p className="mt-2 text-lg font-bold text-neutral-500">
          Gdy klient zamówi pomoc, zobaczysz ją tutaj.
        </p>
      </div>
    </section>
  );
}

function ActiveTab({
  online,
  onStartShift,
}: {
  online: boolean;
  onStartShift: () => void;
}) {
  if (!online) {
    return (
      <section className="flex flex-col gap-4">
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center">
          <Briefcase
            className="mx-auto h-10 w-10 text-neutral-400"
            strokeWidth={2.5}
          />
          <p className="mt-3 text-xl font-bold text-black">
            Najpierw włącz aktywność
          </p>
          <p className="mt-2 text-lg font-bold text-neutral-500">
            Bez włączonej aktywności nie przyjmujesz zleceń.
          </p>
          <button
            type="button"
            onClick={onStartShift}
            className="mt-5 w-full rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white"
          >
            Rozpocznij aktywność
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-xl font-bold text-neutral-700">
        Trwające i przyjęte zlecenia.
      </p>
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center">
        <Briefcase
          className="mx-auto h-10 w-10 text-neutral-400"
          strokeWidth={2.5}
        />
        <p className="mt-3 text-xl font-bold text-black">Nic w trakcie</p>
        <p className="mt-2 text-lg font-bold text-neutral-500">
          Przyjmij zlecenie z listy ofert.
        </p>
      </div>
    </section>
  );
}

function EarningsTab() {
  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <p className="text-lg font-bold text-emerald-700">Ten tydzień</p>
        <p className="mt-1 text-4xl font-bold text-black">0 zł</p>
        <p className="mt-2 text-lg font-bold text-neutral-500">
          0 zakończonych zleceń
        </p>
      </div>
      <p className="text-lg font-bold text-neutral-500">
        Historia wypłat pojawi się po pierwszych zleceniach.
      </p>
    </section>
  );
}

function ProfileTab({
  online,
  transport,
  onStartShift,
  onGoOffline,
}: {
  online: boolean;
  transport: HelperTransport | null;
  onStartShift: () => void;
  onGoOffline: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <img
          src="https://i.pravatar.cc/300?img=33"
          alt=""
          className="h-16 w-16 rounded-full object-cover"
          width={64}
          height={64}
        />
        <div>
          <p className="text-2xl font-bold text-black">Mateusz</p>
          <p className="text-lg font-bold text-neutral-500">4.9★</p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-xl font-bold text-black">Status aktywności</p>
        <p
          className={`mt-2 text-lg font-bold ${
            online ? "text-emerald-700" : "text-neutral-600"
          }`}
        >
          {online
            ? `Online · ${transportLabel(transport)}`
            : "Offline — nie przyjmujesz zleceń"}
        </p>
        {online ? (
          <button
            type="button"
            onClick={onGoOffline}
            className="mt-4 w-full rounded-2xl bg-neutral-900 py-4 text-xl font-bold text-white"
          >
            Zakończ aktywność
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartShift}
            className="mt-4 w-full rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white"
          >
            Rozpocznij aktywność
          </button>
        )}
        {online && (
          <button
            type="button"
            onClick={onStartShift}
            className="mt-2 w-full rounded-2xl bg-neutral-100 py-3 text-lg font-bold text-neutral-800"
          >
            Zmień środek transportu
          </button>
        )}
      </div>
    </section>
  );
}

function HelperNavButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof User;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 ${
        active ? "text-emerald-700" : "text-neutral-500"
      }`}
    >
      <Icon className="h-6 w-6" strokeWidth={active ? 2.75 : 2.25} />
      <span className="truncate text-sm font-bold">{label}</span>
    </button>
  );
}
