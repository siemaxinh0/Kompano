"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bike,
  Briefcase,
  Car,
  CheckCircle2,
  ClipboardList,
  Dog,
  Footprints,
  House,
  MapPin,
  MessageSquareText,
  Navigation,
  Power,
  ShoppingBag,
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

type JobService = "dog" | "home" | "shopping";

type JobOffer = {
  id: string;
  service: JobService;
  title: string;
  duration: string;
  payZl: number;
  clientName: string;
  clientAge: number;
  address: string;
  distanceKm: number;
  note: string;
};

type ActiveJob = JobOffer & { stage: "en_route" | "on_site" };

/** Przykładowe zlecenia demo — wpadają po kolei, gdy pomocnik jest online. */
const SAMPLE_OFFERS: JobOffer[] = [
  {
    id: "dog",
    service: "dog",
    title: "Wyprowadzenie psa",
    duration: "30 min",
    payZl: 39,
    clientName: "Helena",
    clientAge: 78,
    address: "ul. Karmelicka 12/4, Kraków",
    distanceKm: 0.8,
    note: "Labrador Kajtek, średni, spokojny. Smycz wisi przy drzwiach.",
  },
  {
    id: "shopping",
    service: "shopping",
    title: "Zakupy",
    duration: "1 h",
    payZl: 79,
    clientName: "Stanisław",
    clientAge: 82,
    address: "ul. Długa 5/2, Kraków",
    distanceKm: 1.2,
    note: "Chleb, mleko, jabłka i leki z apteki (recepta w aplikacji).",
  },
  {
    id: "home",
    service: "home",
    title: "Drobna pomoc domowa",
    duration: "1 h",
    payZl: 65,
    clientName: "Zofia",
    clientAge: 75,
    address: "ul. Starowiślna 30/7, Kraków",
    distanceKm: 1.5,
    note: "Pomoc przy praniu i odkurzaniu. Domofon: 7.",
  },
];

const SERVICE_STYLE: Record<JobService, { icon: typeof Dog; tile: string }> = {
  dog: { icon: Dog, tile: "bg-emerald-500" },
  home: { icon: House, tile: "bg-violet-500" },
  shopping: { icon: ShoppingBag, tile: "bg-amber-500" },
};

const OFFER_DELAY_MS = 3000;
const OFFER_TIMEOUT_S = 30;

const SPEED_KM_PER_MIN: Record<HelperTransport, number> = {
  car: 0.45,
  bike: 0.25,
  scooter: 0.28,
  walk: 0.08,
};

const TRANSPORT_VERB: Record<HelperTransport, string> = {
  car: "samochodem",
  bike: "rowerem",
  scooter: "hulajnogą",
  walk: "pieszo",
};

function formatKm(km: number): string {
  return `${km.toFixed(1).replace(".", ",")} km`;
}

function travelLabel(km: number, transport: HelperTransport | null): string {
  const t = transport ?? "walk";
  const minutes = Math.max(2, Math.round(km / SPEED_KM_PER_MIN[t]));
  return `${formatKm(km)} · ok. ${minutes} min ${TRANSPORT_VERB[t]}`;
}

function pluralPl(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}

function completedJobsLabel(count: number): string {
  return `${count} ${pluralPl(count, "zakończone zlecenie", "zakończone zlecenia", "zakończonych zleceń")}`;
}

function clientLabel(job: JobOffer): string {
  return `${job.clientName}, ${job.clientAge} ${pluralPl(job.clientAge, "rok", "lata", "lat")}`;
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
  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [lastCompleted, setLastCompleted] = useState<JobOffer | null>(null);
  const [earnings, setEarnings] = useState({ totalZl: 0, count: 0 });
  const nextOfferIndex = useRef(0);

  useEffect(() => {
    if (!ready || !online || startingShift || offer || activeJob) return;
    const t = window.setTimeout(() => {
      const next = SAMPLE_OFFERS[nextOfferIndex.current % SAMPLE_OFFERS.length];
      nextOfferIndex.current += 1;
      setOffer({ ...next, id: `${next.id}-${Date.now()}` });
    }, OFFER_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [ready, online, startingShift, offer, activeJob]);

  const declineOffer = useCallback(() => setOffer(null), []);

  const acceptOffer = useCallback(() => {
    if (!offer) return;
    setActiveJob({ ...offer, stage: "en_route" });
    setOffer(null);
    setLastCompleted(null);
    setTab("active");
  }, [offer]);

  const completeJob = useCallback(() => {
    if (!activeJob) return;
    setEarnings((e) => ({ totalZl: e.totalZl + activeJob.payZl, count: e.count + 1 }));
    setLastCompleted(activeJob);
    setActiveJob(null);
    setTab("jobs");
  }, [activeJob]);

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
    setOffer(null);
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
            activeJob={activeJob}
            lastCompleted={lastCompleted}
            onStartShift={openStartShift}
            onGoOffline={goOffline}
            onOpenActive={() => setTab("active")}
          />
        )}

        {tab === "active" && (
          <ActiveTab
            online={online}
            transport={transport}
            job={activeJob}
            onStartShift={openStartShift}
            onArrived={() =>
              setActiveJob((j) => (j ? { ...j, stage: "on_site" } : j))
            }
            onComplete={completeJob}
          />
        )}

        {tab === "earnings" && (
          <EarningsTab totalZl={earnings.totalZl} count={earnings.count} />
        )}

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
            badge={Boolean(activeJob)}
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

      {offer && (
        <IncomingOfferSheet
          key={offer.id}
          offer={offer}
          transport={transport}
          onAccept={acceptOffer}
          onDecline={declineOffer}
        />
      )}
    </div>
  );
}

function ServiceTile({ service, size = "md" }: { service: JobService; size?: "md" | "lg" }) {
  const { icon: Icon, tile } = SERVICE_STYLE[service];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl text-white ${tile} ${
        size === "lg" ? "h-14 w-14" : "h-12 w-12"
      }`}
    >
      <Icon className={size === "lg" ? "h-7 w-7" : "h-6 w-6"} strokeWidth={2.5} />
    </span>
  );
}

function ClientAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-800">
      {name[0]}
    </span>
  );
}

function JobDetails({ job, transport }: { job: JobOffer; transport: HelperTransport | null }) {
  return (
    <ul className="flex flex-col gap-3">
      <li className="flex items-center gap-3">
        <ClientAvatar name={job.clientName} />
        <p className="text-lg font-bold text-black">{clientLabel(job)}</p>
      </li>
      <li className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" strokeWidth={2.5} />
        <div>
          <p className="text-lg font-bold leading-snug text-black">{job.address}</p>
          <p className="text-base font-bold text-neutral-500">
            {travelLabel(job.distanceKm, transport)}
          </p>
        </div>
      </li>
      <li className="flex items-start gap-3">
        <MessageSquareText className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" strokeWidth={2.5} />
        <p className="text-base font-bold leading-snug text-neutral-700">{job.note}</p>
      </li>
    </ul>
  );
}

function IncomingOfferSheet({
  offer,
  transport,
  onAccept,
  onDecline,
}: {
  offer: JobOffer;
  transport: HelperTransport | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(OFFER_TIMEOUT_S);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) onDecline();
  }, [secondsLeft, onDecline]);

  return (
    <>
      <div
        className="fixed inset-0 z-[70] mx-auto max-w-md animate-[fade-in_200ms_ease-out] bg-black/45"
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nowe zlecenie"
        className="fixed inset-x-0 bottom-0 z-[80] mx-auto max-w-md animate-[sheet-in_320ms_cubic-bezier(0.2,0.9,0.3,1)] rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-emerald-800">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
            </span>
            Nowe zlecenie
          </span>
          <span className="text-lg font-bold tabular-nums text-neutral-600">
            {secondsLeft} s
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width] duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / OFFER_TIMEOUT_S) * 100}%` }}
          />
        </div>

        <div className="mt-5 flex items-center gap-4">
          <ServiceTile service={offer.service} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold leading-tight text-black">{offer.title}</p>
            <p className="text-lg font-bold text-neutral-500">{offer.duration}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold leading-none text-emerald-700">{offer.payZl} zł</p>
            <p className="mt-1 text-sm font-bold text-neutral-500">dla Ciebie</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
          <JobDetails job={offer} transport={transport} />
        </div>

        <div className="mt-5 grid grid-cols-[1fr_2fr] gap-3">
          <button
            type="button"
            onClick={onDecline}
            className="rounded-2xl bg-neutral-100 py-4 text-xl font-bold text-neutral-700"
          >
            Odrzuć
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white"
          >
            Akceptuj
          </button>
        </div>
      </div>
    </>
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
  activeJob,
  lastCompleted,
  onStartShift,
  onGoOffline,
  onOpenActive,
}: {
  online: boolean;
  transport: HelperTransport | null;
  activeJob: ActiveJob | null;
  lastCompleted: JobOffer | null;
  onStartShift: () => void;
  onGoOffline: () => void;
  onOpenActive: () => void;
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
      {lastCompleted && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-700 px-4 py-4 text-white">
          <CheckCircle2 className="h-8 w-8 shrink-0" strokeWidth={2.5} />
          <div>
            <p className="text-lg font-bold">Zlecenie zakończone</p>
            <p className="text-base font-bold text-emerald-100">
              {lastCompleted.title} · +{lastCompleted.payZl} zł
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div>
          <p className="text-lg font-bold text-emerald-900">
            {activeJob ? "Masz aktywne zlecenie" : "Szukam zleceń…"}
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

      {activeJob ? (
        <button
          type="button"
          onClick={onOpenActive}
          className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm"
        >
          <ServiceTile service={activeJob.service} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-black">{activeJob.title}</p>
            <p className="truncate text-base font-bold text-neutral-500">
              {activeJob.address}
            </p>
          </div>
          <span className="shrink-0 text-base font-bold text-emerald-700">
            Otwórz
          </span>
        </button>
      ) : (
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
      )}
    </section>
  );
}

function ActiveTab({
  online,
  transport,
  job,
  onStartShift,
  onArrived,
  onComplete,
}: {
  online: boolean;
  transport: HelperTransport | null;
  job: ActiveJob | null;
  onStartShift: () => void;
  onArrived: () => void;
  onComplete: () => void;
}) {
  if (job) {
    const enRoute = job.stage === "en_route";
    return (
      <section className="flex flex-col gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wide ${
              enRoute ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {enRoute ? "Dojazd do klienta" : "W trakcie"}
          </span>
          <div className="mt-4 flex items-center gap-4">
            <ServiceTile service={job.service} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold leading-tight text-black">{job.title}</p>
              <p className="text-lg font-bold text-neutral-500">{job.duration}</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{job.payZl} zł</p>
          </div>
          <div className="mt-5 border-t border-neutral-100 pt-4">
            <JobDetails job={job} transport={transport} />
          </div>
        </div>

        {enRoute ? (
          <>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-4 text-xl font-bold text-white"
            >
              <Navigation className="h-6 w-6" strokeWidth={2.5} />
              Nawiguj
            </a>
            <button
              type="button"
              onClick={onArrived}
              className="w-full rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white"
            >
              Jestem na miejscu
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onComplete}
            className="w-full rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white"
          >
            Zakończ zlecenie
          </button>
        )}
      </section>
    );
  }

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

function EarningsTab({ totalZl, count }: { totalZl: number; count: number }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <p className="text-lg font-bold text-emerald-700">Ten tydzień</p>
        <p className="mt-1 text-4xl font-bold text-black">{totalZl} zł</p>
        <p className="mt-2 text-lg font-bold text-neutral-500">
          {completedJobsLabel(count)}
        </p>
      </div>
      {count === 0 && (
        <p className="text-lg font-bold text-neutral-500">
          Historia wypłat pojawi się po pierwszych zleceniach.
        </p>
      )}
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
  badge = false,
  onClick,
}: {
  label: string;
  icon: typeof User;
  active: boolean;
  badge?: boolean;
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
      <span className="relative">
        <Icon className="h-6 w-6" strokeWidth={active ? 2.75 : 2.25} />
        {badge && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        )}
      </span>
      <span className="truncate text-sm font-bold">{label}</span>
    </button>
  );
}
