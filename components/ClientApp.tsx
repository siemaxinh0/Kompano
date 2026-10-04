"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dog,
  Home as HomeHelpIcon,
  Loader2,
  Phone,
  ClipboardList,
  User,
  ShieldCheck,
  Search,
  Receipt,
  ArrowLeft,
  ChevronRight,
  MapPin,
  ShoppingBag,
  Plus,
  Trash2,
  AlertCircle,
  PhoneCall,
  KeyRound,
} from "lucide-react";
import { useServiceLocation } from "@/hooks/useServiceLocation";
import {
  DEMO_JUMP_EVENT,
  DEMO_JUMP_STORAGE_KEY,
  consumeDemoJump,
  type DemoJumpPayload,
} from "@/lib/demoShortcuts";

const LocationMap = dynamic(() => import("@/components/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="h-52 w-full animate-pulse rounded-b-3xl bg-neutral-200" />
  ),
});

const LiveTrackingMap = dynamic(
  () => import("@/components/LiveTrackingMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 w-full animate-pulse rounded-2xl bg-neutral-200" />
    ),
  },
);

const DogWalkMap = dynamic(() => import("@/components/DogWalkMap"), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full animate-pulse rounded-2xl bg-neutral-200" />
  ),
});

const HelpLocationModal = dynamic(
  () => import("@/components/HelpLocationModal"),
  { ssr: false },
);

type FlowStep = "home" | "checkout" | "searching" | "success";
type OrderFor = "self" | "other";

type RecipientDetails = {
  firstName: string;
  lastName: string;
  phone: string;
};

type RecipientFieldErrors = {
  firstName?: boolean;
  lastName?: boolean;
  phone?: boolean;
};

const EMPTY_RECIPIENT: RecipientDetails = {
  firstName: "",
  lastName: "",
  phone: "",
};

function isValidContactPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9;
}

type DogSize = "small" | "medium" | "large" | "xlarge";
type DogWalkDuration = "15min" | "30min" | "45min" | "1h";

type DogDetails = {
  breed: string;
  size: DogSize | "";
  duration: DogWalkDuration | "";
  notes: string;
};

type DogFieldErrors = {
  breed?: boolean;
  size?: boolean;
  duration?: boolean;
};

const EMPTY_DOG_DETAILS: DogDetails = {
  breed: "",
  size: "",
  duration: "",
  notes: "",
};

const DOG_SIZE_OPTIONS: {
  id: DogSize;
  label: string;
  hint: string;
}[] = [
  { id: "small", label: "Mały", hint: "do 10 kg" },
  { id: "medium", label: "Średni", hint: "10–25 kg" },
  { id: "large", label: "Duży", hint: "25–40 kg" },
  { id: "xlarge", label: "Bardzo duży", hint: "pow. 40 kg" },
];

const DOG_WALK_DURATION_MINUTES: Record<DogWalkDuration, number> = {
  "15min": 15,
  "30min": 30,
  "45min": 45,
  "1h": 60,
};

const DOG_WALK_DURATION_LABELS: Record<DogWalkDuration, string> = {
  "15min": "15 minut",
  "30min": "30 minut",
  "45min": "45 minut",
  "1h": "1 godzina",
};

function getDogWalkMinutes(duration: DogWalkDuration | ""): number {
  if (!duration) return 30;
  return DOG_WALK_DURATION_MINUTES[duration];
}

type NavTab = "order" | "activity" | "profile";

type OrderStatus = "in_progress" | "completed";
type VisitPhase = "en_route" | "awaiting_pin" | "in_service" | "dog_handoff";

type HelperTransport = "car" | "bike" | "walk" | "scooter";

type HelperProfile = {
  id: string;
  name: string;
  rating: string;
  avatar: string;
  verification: string;
  transport: HelperTransport;
  transportLabel: string;
  /** „Jedzie” / „Idzie” — do statusu na mapie */
  motionVerb: string;
};

const HELPERS: HelperProfile[] = [
  {
    id: "mateusz",
    name: "Mateusz",
    rating: "4.9",
    avatar: "https://i.pravatar.cc/300?img=33",
    verification: "Weryfikacja tożsamości mObywatel",
    transport: "car",
    transportLabel: "Samochód",
    motionVerb: "Jedzie",
  },
  {
    id: "anna",
    name: "Anna",
    rating: "4.8",
    avatar: "https://i.pravatar.cc/300?img=47",
    verification: "Weryfikacja tożsamości mObywatel",
    transport: "bike",
    transportLabel: "Rower",
    motionVerb: "Jedzie",
  },
  {
    id: "piotr",
    name: "Piotr",
    rating: "4.7",
    avatar: "https://i.pravatar.cc/300?img=12",
    verification: "Weryfikacja tożsamości mObywatel",
    transport: "walk",
    transportLabel: "Pieszo",
    motionVerb: "Idzie",
  },
  {
    id: "kasia",
    name: "Kasia",
    rating: "5.0",
    avatar: "https://i.pravatar.cc/300?img=5",
    verification: "Weryfikacja tożsamości mObywatel",
    transport: "scooter",
    transportLabel: "Hulajnoga",
    motionVerb: "Jedzie",
  },
  {
    id: "tomek",
    name: "Tomek",
    rating: "4.6",
    avatar: "https://i.pravatar.cc/300?img=68",
    verification: "Weryfikacja tożsamości mObywatel",
    transport: "bike",
    transportLabel: "Rower",
    motionVerb: "Jedzie",
  },
];

/** Bliska osoba do powiadomienia przy „Potrzebuję pomocy” (demo). */
const TRUSTED_CONTACT = {
  name: "Anna Kowalska",
  relation: "córka",
  phoneDisplay: "+48 600 100 200",
};

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}

function pickHelper(seedKey: string): HelperProfile {
  return HELPERS[hashSeed(seedKey) % HELPERS.length];
}

type OrderRecord = {
  id: string;
  serviceTitle: string;
  address: string;
  dateLabel: string;
  status: OrderStatus;
  serviceId?: string;
  /** Postęp wizyty — zachowany przy zmianie zakładki. */
  visitPhase?: VisitPhase;
  /** Date.now() startu bieżącej fazy — postęp działa w tle. */
  phaseStartedAtMs?: number;
  /** Przedłużenia pomocy domowej (zachowane przy zmianie widoku). */
  homeExtensions?: number;
  homeJobEnded?: boolean;
  packageMinutes?: number;
  packagePrice?: number;
  serviceFee?: number;
  helperName?: string;
  helperId?: string;
  helperAvatar?: string;
  helperRating?: string;
  helperTransport?: HelperTransport;
  helperTransportLabel?: string;
  helperMotionVerb?: string;
  helperVerification?: string;
};

const MOCK_ORDER_HISTORY: OrderRecord[] = [
  {
    id: "hist-1",
    serviceTitle: "Drobna pomoc domowa",
    address: "ul. Floriańska 12, m. 2, Kraków",
    dateLabel: "28 września 2025",
    status: "completed",
    helperName: "Anna",
  },
  {
    id: "hist-2",
    serviceTitle: "Wyprowadzenie psa",
    address: "ul. Grodzka 8, m. 2, Kraków",
    dateLabel: "12 września 2025",
    status: "completed",
    helperName: "Piotr",
  },
];

const SERVICES = [
  {
    id: "dog",
    title: "Wyprowadzenie psa",
    description: "Spacer i opieka nad pupilem",
    icon: Dog,
    accent: "bg-emerald-500",
  },
  {
    id: "home",
    title: "Drobna pomoc domowa",
    description: "Porządki, posiłki, paczki w domu",
    icon: HomeHelpIcon,
    accent: "bg-violet-500",
  },
  {
    id: "shopping",
    title: "Zakupy",
    description: "Lista produktów, sklep, dostawa do domu",
    icon: ShoppingBag,
    accent: "bg-amber-500",
  },
] as const;

type PriceRange = {
  min: number;
  max: number;
  /** Domyślna propozycja w środku rozsądnego zakresu. */
  suggested: number;
};

type HomeHelpDuration = "30min" | "1h" | "2h" | "longer";

/** Opłata serwisowa = 10% wynagrodzenia pomocnika (zaokrąglone). */
const SERVICE_FEE_RATE = 0.1;

function getServiceFeeFromOffer(offerZl: number): number {
  if (!Number.isFinite(offerZl) || offerZl <= 0) return 0;
  return Math.max(1, Math.round(offerZl * SERVICE_FEE_RATE));
}

/** Sugerowane wynagrodzenie pomocnika (zł) wg długości spaceru. */
const DOG_WALK_PRICE_RANGES: Record<DogWalkDuration, PriceRange> = {
  "15min": { min: 20, max: 40, suggested: 28 },
  "30min": { min: 29, max: 55, suggested: 39 },
  "45min": { min: 38, max: 70, suggested: 49 },
  "1h": { min: 45, max: 85, suggested: 59 },
};

const DEFAULT_DOG_WALK_PRICE_RANGE = DOG_WALK_PRICE_RANGES["30min"];

function getDogWalkPriceRange(
  duration: DogWalkDuration | "",
): PriceRange | null {
  if (!duration) return null;
  return DOG_WALK_PRICE_RANGES[duration];
}

const HOME_PRICE_RANGES: Record<HomeHelpDuration, PriceRange> = {
  "30min": { min: 35, max: 65, suggested: 45 },
  "1h": { min: 50, max: 95, suggested: 65 },
  "2h": { min: 75, max: 130, suggested: 95 },
  longer: { min: 95, max: 160, suggested: 120 },
};

/** Czas pakietu startowego (minuty zegarowe). */
const HOME_DURATION_MINUTES: Record<HomeHelpDuration, number> = {
  "30min": 30,
  "1h": 60,
  "2h": 90,
  longer: 120,
};

/** Przedłużenie za zgodą klienta (cena liczona od oferty pakietu). */
const HOME_EXTENSION = {
  minutes: 15,
} as const;

/** Demo: 1 minuta pakietu ≈ 0,9 s rzeczywistego. */
const HOME_DEMO_MS_PER_MINUTE = 900;

function clampOffer(value: number, range: PriceRange): number {
  if (!Number.isFinite(value)) return range.suggested;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

function getHomePriceRange(
  duration: HomeHelpDuration | "",
): PriceRange | null {
  if (!duration) return null;
  return HOME_PRICE_RANGES[duration];
}

function getHomePackageMinutes(duration: HomeHelpDuration | ""): number {
  if (!duration) return 30;
  return HOME_DURATION_MINUTES[duration];
}

/** Sugerowana cena przedłużenia proporcjonalna do oferty pakietu. */
function getHomeExtensionPrice(
  packagePrice: number,
  packageMinutes: number,
): number {
  const raw = (packagePrice * HOME_EXTENSION.minutes) / Math.max(1, packageMinutes);
  return Math.min(45, Math.max(12, Math.round(raw)));
}

function formatRangeHint(range: PriceRange): string {
  return `${range.min}–${range.max} zł`;
}

const DOG_WALK_DURATION_OPTIONS: {
  id: DogWalkDuration;
  label: string;
  hint: string;
}[] = [
  {
    id: "15min",
    label: "15 min",
    hint: formatRangeHint(DOG_WALK_PRICE_RANGES["15min"]),
  },
  {
    id: "30min",
    label: "30 min",
    hint: formatRangeHint(DOG_WALK_PRICE_RANGES["30min"]),
  },
  {
    id: "45min",
    label: "45 min",
    hint: formatRangeHint(DOG_WALK_PRICE_RANGES["45min"]),
  },
  {
    id: "1h",
    label: "1 h",
    hint: formatRangeHint(DOG_WALK_PRICE_RANGES["1h"]),
  },
];

type ScheduleMode = "now" | "later";

type HelpSchedule = {
  mode: ScheduleMode;
  date: string;
  time: string;
};

type ScheduleFieldErrors = {
  date?: boolean;
  time?: boolean;
  past?: boolean;
};

const EMPTY_SCHEDULE: HelpSchedule = {
  mode: "now",
  date: "",
  time: "",
};

function getScheduleErrors(schedule: HelpSchedule): ScheduleFieldErrors {
  if (schedule.mode === "now") return {};
  const errors: ScheduleFieldErrors = {};
  if (!schedule.date.trim()) errors.date = true;
  if (!schedule.time.trim()) errors.time = true;
  if (!errors.date && !errors.time) {
    const when = new Date(`${schedule.date}T${schedule.time}`);
    if (!Number.isNaN(when.getTime()) && when.getTime() < Date.now()) {
      errors.past = true;
    }
  }
  return errors;
}

function formatScheduleLabel(schedule: HelpSchedule): string | null {
  if (schedule.mode === "now") return null;
  if (!schedule.date || !schedule.time) return null;
  const when = new Date(`${schedule.date}T${schedule.time}`);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleString("pl-PL", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type HomeTaskType =
  | "cleaning"
  | "meal"
  | "heavy_package"
  | "other";

type HomeHelpDetails = {
  taskType: HomeTaskType | "";
  description: string;
  duration: HomeHelpDuration | "";
  notes: string;
};

type HomeHelpFieldErrors = {
  taskType?: boolean;
  description?: boolean;
  duration?: boolean;
};

const EMPTY_HOME_HELP: HomeHelpDetails = {
  taskType: "",
  description: "",
  duration: "",
  notes: "",
};

const HOME_TASK_OPTIONS: {
  id: HomeTaskType;
  label: string;
}[] = [
  { id: "cleaning", label: "Porządki" },
  { id: "meal", label: "Posiłek" },
  { id: "heavy_package", label: "Coś ciężkiego" },
  { id: "other", label: "Inne" },
];

const HOME_DURATION_OPTIONS: {
  id: HomeHelpDuration;
  label: string;
  hint: string;
}[] = [
  {
    id: "30min",
    label: "30 min",
    hint: formatRangeHint(HOME_PRICE_RANGES["30min"]),
  },
  {
    id: "1h",
    label: "ok. 1 h",
    hint: formatRangeHint(HOME_PRICE_RANGES["1h"]),
  },
  {
    id: "2h",
    label: "1–2 h",
    hint: formatRangeHint(HOME_PRICE_RANGES["2h"]),
  },
  {
    id: "longer",
    label: "Dłużej",
    hint: formatRangeHint(HOME_PRICE_RANGES.longer),
  },
];

const SHOPPING_PRICE_RANGES: Record<HomeHelpDuration, PriceRange> = {
  "30min": { min: 40, max: 75, suggested: 55 },
  "1h": { min: 60, max: 100, suggested: 79 },
  "2h": { min: 85, max: 140, suggested: 109 },
  longer: { min: 105, max: 170, suggested: 135 },
};

function getShoppingPriceRange(
  duration: HomeHelpDuration | "",
): PriceRange | null {
  if (!duration) return null;
  return SHOPPING_PRICE_RANGES[duration];
}

type ShoppingListItem = {
  id: string;
  name: string;
  quantity: string;
  allowSimilar: boolean;
};

type ShoppingOrderDetails = {
  store: string;
  allowSimilarPurchases: boolean;
  items: ShoppingListItem[];
  duration: HomeHelpDuration | "";
  notes: string;
};

type ShoppingFieldErrors = {
  store?: boolean;
  items?: boolean;
  duration?: boolean;
};

function createShoppingListItem(allowSimilar = false): ShoppingListItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    quantity: "",
    allowSimilar,
  };
}

function createInitialShoppingItems(): ShoppingListItem[] {
  return [createShoppingListItem(), createShoppingListItem(), createShoppingListItem()];
}

const EMPTY_SHOPPING_ORDER: ShoppingOrderDetails = {
  store: "",
  allowSimilarPurchases: false,
  items: createInitialShoppingItems(),
  duration: "",
  notes: "",
};

const SHOPPING_DURATION_OPTIONS: {
  id: HomeHelpDuration;
  label: string;
  hint: string;
}[] = [
  {
    id: "30min",
    label: "30 min",
    hint: formatRangeHint(SHOPPING_PRICE_RANGES["30min"]),
  },
  {
    id: "1h",
    label: "ok. 1 h",
    hint: formatRangeHint(SHOPPING_PRICE_RANGES["1h"]),
  },
  {
    id: "2h",
    label: "1–2 h",
    hint: formatRangeHint(SHOPPING_PRICE_RANGES["2h"]),
  },
  {
    id: "longer",
    label: "Dłużej",
    hint: formatRangeHint(SHOPPING_PRICE_RANGES.longer),
  },
];

function getActivePriceRange(
  serviceId: string | null,
  duration: HomeHelpDuration | DogWalkDuration | "",
): PriceRange | null {
  if (serviceId === "dog") return getDogWalkPriceRange(duration as DogWalkDuration | "");
  if (serviceId === "home") return getHomePriceRange(duration as HomeHelpDuration | "");
  if (serviceId === "shopping") return getShoppingPriceRange(duration as HomeHelpDuration | "");
  return null;
}

const CHECKOUT_SERVICE_IDS = new Set(["dog", "home", "shopping"]);

/** Stałe ID demo — ta sama osoba przy każdym Ctrl+Alt+R. */
const DEMO_DOG_HANDOFF_ORDER_ID = "demo-dog-handoff";

export default function ClientApp() {
  const [flowStep, setFlowStep] = useState<FlowStep>("home");
  const [activeTab, setActiveTab] = useState<NavTab>("order");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [orderHistory, setOrderHistory] =
    useState<OrderRecord[]>(MOCK_ORDER_HISTORY);
  const location = useServiceLocation();
  const [orderFor, setOrderFor] = useState<OrderFor>("self");
  const [recipient, setRecipient] =
    useState<RecipientDetails>(EMPTY_RECIPIENT);
  const [recipientErrors, setRecipientErrors] = useState<RecipientFieldErrors>(
    {},
  );
  const [dogDetails, setDogDetails] = useState<DogDetails>(EMPTY_DOG_DETAILS);
  const [dogErrors, setDogErrors] = useState<DogFieldErrors>({});
  const [homeHelpDetails, setHomeHelpDetails] =
    useState<HomeHelpDetails>(EMPTY_HOME_HELP);
  const [homeHelpErrors, setHomeHelpErrors] = useState<HomeHelpFieldErrors>({});
  const [helpSchedule, setHelpSchedule] = useState<HelpSchedule>(EMPTY_SCHEDULE);
  const [scheduleErrors, setScheduleErrors] = useState<ScheduleFieldErrors>({});
  const [shoppingOrder, setShoppingOrder] =
    useState<ShoppingOrderDetails>(EMPTY_SHOPPING_ORDER);
  const [shoppingErrors, setShoppingErrors] = useState<ShoppingFieldErrors>({});
  /** Wynagrodzenie pomocnika ustawiane przez klienta (w sugerowanym zakresie). */
  const [offerPriceZl, setOfferPriceZl] = useState(
    DEFAULT_DOG_WALK_PRICE_RANGE.suggested,
  );

  const activeDuration: HomeHelpDuration | DogWalkDuration | "" =
    selectedService === "dog"
      ? dogDetails.duration
      : selectedService === "home"
        ? homeHelpDetails.duration
        : selectedService === "shopping"
          ? shoppingOrder.duration
          : "";

  const activePriceRange = getActivePriceRange(selectedService, activeDuration);

  useEffect(() => {
    if (!selectedService) return;
    const range = getActivePriceRange(selectedService, activeDuration);
    if (!range) return;
    setOfferPriceZl(range.suggested);
  }, [
    selectedService,
    dogDetails.duration,
    homeHelpDetails.duration,
    shoppingOrder.duration,
    activeDuration,
  ]);

  const applyDemoJump = useCallback(
    (payload: DemoJumpPayload) => {
      if (payload.kind !== "dog_handoff") return;

      const service = SERVICES.find((s) => s.id === "dog");
      if (!service) return;

      setOrderHistory((prev) => {
        const existing = prev.find((o) => o.status === "in_progress");

        // Zachowaj bieżącego helpera, jeśli już jest aktywny spacer
        if (existing?.serviceId === "dog") {
          return prev.map((o) =>
            o.id === existing.id
              ? {
                  ...o,
                  visitPhase: "dog_handoff" as const,
                  phaseStartedAtMs: Date.now(),
                }
              : o,
          );
        }

        const helper = HELPERS[0];
        const current: OrderRecord = {
          id: DEMO_DOG_HANDOFF_ORDER_ID,
          serviceId: "dog",
          serviceTitle: service.title,
          address: location.displayAddress || "Adres zlecenia",
          dateLabel: "Dziś · oddanie psa",
          status: "in_progress",
          visitPhase: "dog_handoff",
          phaseStartedAtMs: Date.now(),
          homeExtensions: 0,
          homeJobEnded: false,
          packagePrice: DEFAULT_DOG_WALK_PRICE_RANGE.suggested,
          serviceFee: getServiceFeeFromOffer(DEFAULT_DOG_WALK_PRICE_RANGE.suggested),
          helperName: helper.name,
          helperId: helper.id,
          helperAvatar: helper.avatar,
          helperRating: helper.rating,
          helperTransport: helper.transport,
          helperTransportLabel: helper.transportLabel,
          helperMotionVerb: helper.motionVerb,
          helperVerification: helper.verification,
        };

        return [
          current,
          ...prev.filter((o) => o.status !== "in_progress"),
        ];
      });
      setSelectedService("dog");
      setFlowStep("success");
      setActiveTab("activity");
    },
    [location.displayAddress],
  );

  useEffect(() => {
    const run = (payload?: DemoJumpPayload | null) => {
      const jump = payload ?? consumeDemoJump();
      if (jump) applyDemoJump(jump);
    };

    run();

    const onJump = (e: Event) => {
      const detail = (e as CustomEvent<DemoJumpPayload>).detail;
      try {
        sessionStorage.removeItem(DEMO_JUMP_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      if (detail) applyDemoJump(detail);
      else run();
    };

    window.addEventListener(DEMO_JUMP_EVENT, onJump);
    return () => window.removeEventListener(DEMO_JUMP_EVENT, onJump);
  }, [applyDemoJump]);

  const resetCheckoutState = useCallback(() => {
    setOrderFor("self");
    setRecipient(EMPTY_RECIPIENT);
    setRecipientErrors({});
    setDogDetails(EMPTY_DOG_DETAILS);
    setDogErrors({});
    setHomeHelpDetails(EMPTY_HOME_HELP);
    setHomeHelpErrors({});
    setHelpSchedule(EMPTY_SCHEDULE);
    setScheduleErrors({});
    setShoppingOrder({
      store: "",
      allowSimilarPurchases: false,
      items: createInitialShoppingItems(),
      duration: "",
      notes: "",
    });
    setShoppingErrors({});
    setOfferPriceZl(DEFAULT_DOG_WALK_PRICE_RANGE.suggested);
  }, []);

  const goBackToServiceList = useCallback(() => {
    setFlowStep("home");
    setSelectedService(null);
    resetCheckoutState();
  }, [resetCheckoutState]);

  const startOrder = useCallback(
    (serviceId: string) => {
      if (!CHECKOUT_SERVICE_IDS.has(serviceId)) return;
      setSelectedService(serviceId);
      setFlowStep("checkout");
      resetCheckoutState();
      setActiveTab("order");
    },
    [resetCheckoutState],
  );

  const confirmCheckoutAndSearch = useCallback(() => {
    if (!location.isReadyToOrder) {
      setLocationModalOpen(true);
      return;
    }
    const nextRecipientErrors: RecipientFieldErrors =
      orderFor === "other"
        ? {
            firstName: !recipient.firstName.trim(),
            lastName: !recipient.lastName.trim(),
            phone: !isValidContactPhone(recipient.phone),
          }
        : {};

    let hasServiceErrors = false;

    if (selectedService === "dog") {
      const nextDogErrors: DogFieldErrors = {
        breed: !dogDetails.breed.trim(),
        size: !dogDetails.size,
        duration: !dogDetails.duration,
      };
      setDogErrors(nextDogErrors);
      hasServiceErrors = Boolean(
        nextDogErrors.breed || nextDogErrors.size || nextDogErrors.duration,
      );
    } else if (selectedService === "home") {
      const nextHomeErrors: HomeHelpFieldErrors = {
        taskType: !homeHelpDetails.taskType,
        description: homeHelpDetails.description.trim().length < 8,
        duration: !homeHelpDetails.duration,
      };
      setHomeHelpErrors(nextHomeErrors);
      hasServiceErrors = Boolean(
        nextHomeErrors.taskType ||
          nextHomeErrors.description ||
          nextHomeErrors.duration,
      );
    } else if (selectedService === "shopping") {
      const hasValidItems = shoppingOrder.items.some(
        (item) => item.name.trim().length >= 2,
      );
      const nextShoppingErrors: ShoppingFieldErrors = {
        store: shoppingOrder.store.trim().length < 3,
        items: !hasValidItems,
        duration: !shoppingOrder.duration,
      };
      setShoppingErrors(nextShoppingErrors);
      hasServiceErrors = Boolean(
        nextShoppingErrors.store ||
          nextShoppingErrors.items ||
          nextShoppingErrors.duration,
      );
    }

    const nextScheduleErrors = getScheduleErrors(helpSchedule);
    setRecipientErrors(nextRecipientErrors);
    setScheduleErrors(nextScheduleErrors);

    const hasRecipientErrors = Boolean(
      nextRecipientErrors.firstName ||
        nextRecipientErrors.lastName ||
        nextRecipientErrors.phone,
    );
    const hasScheduleErrors = Boolean(
      nextScheduleErrors.date ||
        nextScheduleErrors.time ||
        nextScheduleErrors.past,
    );
    if (hasServiceErrors || hasRecipientErrors || hasScheduleErrors) return;

    setFlowStep("searching");
  }, [
    location.isReadyToOrder,
    orderFor,
    recipient,
    dogDetails,
    homeHelpDetails,
    shoppingOrder,
    helpSchedule,
    selectedService,
  ]);

  useEffect(() => {
    if (flowStep !== "searching") return;

    const timer = window.setTimeout(() => {
      setFlowStep("success");
      setActiveTab("activity");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [flowStep]);

  useEffect(() => {
    if (flowStep !== "success" || !selectedService) return;

    const service = SERVICES.find((s) => s.id === selectedService);
    if (!service) return;

    setOrderHistory((prev) => {
      // Nie twórz nowego zlecenia, jeśli już jest aktywne (np. po zmianie zakładki).
      if (prev.some((o) => o.status === "in_progress")) return prev;

      const withoutCurrent = prev.filter((o) => o.status !== "in_progress");
      const planned = formatScheduleLabel(helpSchedule);
      const orderId = `live-${selectedService}-${Date.now()}`;
      const helper = pickHelper(orderId);
      const isHome = selectedService === "home";
      const isDog = selectedService === "dog";
      const packageMinutes = isHome
        ? getHomePackageMinutes(homeHelpDetails.duration)
        : isDog
          ? getDogWalkMinutes(dogDetails.duration)
          : undefined;
      const fee = getServiceFeeFromOffer(offerPriceZl);
      const packagePrice = offerPriceZl;
      const current: OrderRecord = {
        id: orderId,
        serviceId: selectedService,
        serviceTitle: service.title,
        address: location.displayAddress || "Adres zlecenia",
        dateLabel: planned ? `Zaplanowane: ${planned}` : "Dziś · w trakcie",
        status: "in_progress",
        visitPhase: "en_route",
        phaseStartedAtMs: Date.now(),
        homeExtensions: 0,
        homeJobEnded: false,
        packageMinutes,
        packagePrice,
        serviceFee: fee,
        helperName: helper.name,
        helperId: helper.id,
        helperAvatar: helper.avatar,
        helperRating: helper.rating,
        helperTransport: helper.transport,
        helperTransportLabel: helper.transportLabel,
        helperMotionVerb: helper.motionVerb,
        helperVerification: helper.verification,
      };
      return [current, ...withoutCurrent];
    });
  }, [
    flowStep,
    selectedService,
    location.displayAddress,
    helpSchedule,
    homeHelpDetails.duration,
    dogDetails.duration,
    offerPriceZl,
  ]);

  const activeHelperName =
    orderHistory.find((o) => o.status === "in_progress")?.helperName ??
    HELPERS[0].name;

  const handleCall = () => {
    window.alert(`Połączenie z ${activeHelperName}… (demo)`);
  };

  const handleCancelSearch = useCallback(() => {
    setFlowStep("home");
    setSelectedService(null);
    resetCheckoutState();
    setActiveTab("order");
  }, [resetCheckoutState]);

  const handleVisitPhaseChange = useCallback(
    (orderId: string, phase: VisitPhase) => {
      setOrderHistory((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                visitPhase: phase,
                phaseStartedAtMs: Date.now(),
              }
            : order,
        ),
      );
    },
    [],
  );

  const handleHomeExtensionsChange = useCallback(
    (orderId: string, extensions: number) => {
      setOrderHistory((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, homeExtensions: extensions }
            : order,
        ),
      );
    },
    [],
  );

  const handleHomeJobEnded = useCallback((orderId: string) => {
    setOrderHistory((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, homeJobEnded: true } : order,
      ),
    );
  }, []);

  const handleEndActiveOrder = useCallback(
    (orderId: string, totalZl?: number) => {
      setOrderHistory((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: "completed" as const,
                visitPhase: undefined,
                phaseStartedAtMs: undefined,
                homeExtensions: undefined,
                homeJobEnded: undefined,
                dateLabel:
                  totalZl !== undefined
                    ? `Zakończone · ${totalZl} zł`
                    : "Zakończone",
              }
            : order,
        ),
      );
      setFlowStep("home");
      setSelectedService(null);
    },
    [],
  );

  const showOrderHomeHeader =
    activeTab === "order" && flowStep === "home";
  const showOrderCheckoutHeader =
    activeTab === "order" && flowStep === "checkout";

  const checkoutService = SERVICES.find((s) => s.id === selectedService);
  const clampedOffer =
    activePriceRange != null
      ? clampOffer(offerPriceZl, activePriceRange)
      : null;
  const checkoutFee =
    clampedOffer != null ? getServiceFeeFromOffer(clampedOffer) : 0;
  const checkoutTotal =
    clampedOffer != null ? clampedOffer + checkoutFee : null;

  return (
    <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col overflow-hidden bg-neutral-50 text-black shadow-xl shadow-black/5">
      <HelpLocationModal
        open={locationModalOpen}
        initialCoords={location.displayCenter}
        initialApartment={location.apartmentNumber}
        initialStreet={location.streetAddress}
        isGeocoding={location.isGeocoding}
        gpsLoading={location.gpsStatus === "loading"}
        onRequestGps={location.requestGps}
        onClose={() => setLocationModalOpen(false)}
        onConfirm={async (coords, apartment, street) => {
          await location.confirmLocation(coords, apartment, street);
          setLocationModalOpen(false);
        }}
      />

      <header className="bg-white px-5 pb-4 pt-6">
        {showOrderCheckoutHeader ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBackToServiceList}
              className="-ml-2 rounded-xl p-2 text-neutral-700"
              aria-label="Wróć do wyboru usługi"
            >
              <ArrowLeft className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <h1 className="text-2xl font-bold leading-tight text-black">
              {checkoutService?.title ?? "Zamówienie"}
            </h1>
          </div>
        ) : showOrderHomeHeader ? (
          <>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-black sm:text-3xl">
              Jak możemy Ci pomóc?
            </h1>
            <LocationSearchBar
              label={location.searchBarLabel}
              isGeocoding={location.isGeocoding}
              onOpen={() => setLocationModalOpen(true)}
            />
          </>
        ) : (
          <h1 className="mt-1 text-2xl font-bold leading-tight text-black sm:text-3xl">
            {activeTab === "profile"
              ? "Profil"
              : activeTab === "activity"
                ? "Aktywność"
                : flowStep === "searching"
                  ? "Szukam pomocnika"
                  : "Jak możemy Ci pomóc?"}
          </h1>
        )}
      </header>

      <main
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pt-5 ${
          showOrderCheckoutHeader
            ? "pb-[calc(11.5rem+5.75rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(5.75rem+env(safe-area-inset-bottom))]"
        }`}
      >
        {activeTab === "profile" && (
          <section className="flex flex-1 flex-col gap-6">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-xl font-bold">Jan Kowalski</p>
              <p className="mt-2 text-xl font-bold text-neutral-700">
                {location.hasPin
                  ? location.displayAddress
                  : "Nie ustawiono miejsca pomocy"}
              </p>
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="mt-4 text-xl font-bold text-emerald-700 underline"
              >
                Zmień adres
              </button>
              <p className="mt-4 text-xl font-bold text-emerald-700">
                Konto zweryfikowane
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-xl font-bold text-black">Bliska osoba</p>
              <p className="mt-2 text-xl font-bold text-neutral-700">
                {TRUSTED_CONTACT.name} ({TRUSTED_CONTACT.relation})
              </p>
              <p className="mt-1 text-lg font-bold text-neutral-500">
                {TRUSTED_CONTACT.phoneDisplay}
              </p>
              <p className="mt-3 text-lg font-bold text-neutral-500">
                Powiadamiana przy „Potrzebuję pomocy” (112 lub ten numer).
              </p>
            </div>
          </section>
        )}

        {activeTab === "activity" && (
          <ActivitySection
            orders={orderHistory}
            showLiveTracking={
              flowStep === "success" ||
              orderHistory.some((o) => o.status === "in_progress")
            }
            mapCenter={location.displayCenter}
            hasPin={location.hasPin}
            destinationLabel={
              location.hasPin
                ? location.displayAddress
                : "Twój adres"
            }
            onCall={handleCall}
            onEndActiveOrder={handleEndActiveOrder}
            onVisitPhaseChange={handleVisitPhaseChange}
            onHomeExtensionsChange={handleHomeExtensionsChange}
            onHomeJobEnded={handleHomeJobEnded}
          />
        )}

        {activeTab === "order" && flowStep === "home" && (
          <section className="flex flex-col gap-4">
            <p className="text-xl font-bold text-neutral-800">
              Wybierz rodzaj pomocy:
            </p>
            <div className="grid grid-cols-1 gap-3">
              {SERVICES.map((service) => {
                const Icon = service.icon;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => startOrder(service.id)}
                    className="flex min-h-[108px] w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
                  >
                    <span
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${service.accent}`}
                    >
                      <Icon className="h-8 w-8 text-white" strokeWidth={2.25} />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xl font-bold leading-snug text-black">
                        {service.title}
                      </span>
                      <span className="text-xl font-bold text-neutral-500">
                        {service.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "order" &&
          flowStep === "checkout" &&
          selectedService === "dog" && (
            <DogWalkCheckout
              orderFor={orderFor}
              recipient={recipient}
              recipientErrors={recipientErrors}
              dogDetails={dogDetails}
              dogErrors={dogErrors}
              offerPriceZl={offerPriceZl}
              onOfferPriceChange={setOfferPriceZl}
              addressLabel={
                location.hasPin
                  ? location.displayAddress
                  : "Ustaw adres pomocy"
              }
              addressReady={location.isReadyToOrder}
              onOrderForChange={(value) => {
                setOrderFor(value);
                if (value === "self") {
                  setRecipient(EMPTY_RECIPIENT);
                  setRecipientErrors({});
                }
              }}
              onRecipientChange={(field, value) => {
                setRecipient((prev) => ({ ...prev, [field]: value }));
                setRecipientErrors((prev) => ({ ...prev, [field]: false }));
              }}
              onDogChange={(field, value) => {
                setDogDetails((prev) => ({ ...prev, [field]: value }));
                if (field === "breed" || field === "size" || field === "duration") {
                  setDogErrors((prev) => ({ ...prev, [field]: false }));
                }
              }}
              schedule={helpSchedule}
              scheduleErrors={scheduleErrors}
              onScheduleChange={(patch) => {
                setHelpSchedule((prev) => ({ ...prev, ...patch }));
                setScheduleErrors({});
              }}
              onEditAddress={() => setLocationModalOpen(true)}
            />
          )}

        {activeTab === "order" &&
          flowStep === "checkout" &&
          selectedService === "home" && (
            <HomeHelpCheckout
              orderFor={orderFor}
              recipient={recipient}
              recipientErrors={recipientErrors}
              homeHelp={homeHelpDetails}
              homeHelpErrors={homeHelpErrors}
              offerPriceZl={offerPriceZl}
              onOfferPriceChange={setOfferPriceZl}
              addressLabel={
                location.hasPin
                  ? location.displayAddress
                  : "Ustaw adres pomocy"
              }
              addressReady={location.isReadyToOrder}
              onOrderForChange={(value) => {
                setOrderFor(value);
                if (value === "self") {
                  setRecipient(EMPTY_RECIPIENT);
                  setRecipientErrors({});
                }
              }}
              onRecipientChange={(field, value) => {
                setRecipient((prev) => ({ ...prev, [field]: value }));
                setRecipientErrors((prev) => ({ ...prev, [field]: false }));
              }}
              onHomeHelpChange={(field, value) => {
                setHomeHelpDetails((prev) => ({ ...prev, [field]: value }));
                if (field !== "notes") {
                  setHomeHelpErrors((prev) => ({ ...prev, [field]: false }));
                }
              }}
              schedule={helpSchedule}
              scheduleErrors={scheduleErrors}
              onScheduleChange={(patch) => {
                setHelpSchedule((prev) => ({ ...prev, ...patch }));
                setScheduleErrors({});
              }}
              onEditAddress={() => setLocationModalOpen(true)}
            />
          )}

        {activeTab === "order" &&
          flowStep === "checkout" &&
          selectedService === "shopping" && (
            <ShoppingCheckout
              orderFor={orderFor}
              recipient={recipient}
              recipientErrors={recipientErrors}
              shoppingOrder={shoppingOrder}
              shoppingErrors={shoppingErrors}
              offerPriceZl={offerPriceZl}
              onOfferPriceChange={setOfferPriceZl}
              addressLabel={
                location.hasPin
                  ? location.displayAddress
                  : "Ustaw adres dostawy"
              }
              addressReady={location.isReadyToOrder}
              onOrderForChange={(value) => {
                setOrderFor(value);
                if (value === "self") {
                  setRecipient(EMPTY_RECIPIENT);
                  setRecipientErrors({});
                }
              }}
              onRecipientChange={(field, value) => {
                setRecipient((prev) => ({ ...prev, [field]: value }));
                setRecipientErrors((prev) => ({ ...prev, [field]: false }));
              }}
              onShoppingFieldChange={(field, value) => {
                if (field === "allowSimilarPurchases" && typeof value === "boolean") {
                  setShoppingOrder((prev) => ({
                    ...prev,
                    allowSimilarPurchases: value,
                    items: prev.items.map((item) => ({
                      ...item,
                      allowSimilar: value,
                    })),
                  }));
                  return;
                }
                setShoppingOrder((prev) => ({ ...prev, [field]: value }));
                if (field !== "notes") {
                  setShoppingErrors((prev) => ({ ...prev, [field]: false }));
                }
              }}
              onShoppingItemChange={(id, patch) => {
                setShoppingOrder((prev) => {
                  const items = prev.items.map((item) =>
                    item.id === id ? { ...item, ...patch } : item,
                  );
                  return {
                    ...prev,
                    items,
                    allowSimilarPurchases: items.every((item) => item.allowSimilar),
                  };
                });
                setShoppingErrors((prev) => ({ ...prev, items: false }));
              }}
              onAddShoppingItem={() => {
                setShoppingOrder((prev) => ({
                  ...prev,
                  items: [
                    ...prev.items,
                    createShoppingListItem(prev.allowSimilarPurchases),
                  ],
                }));
              }}
              onRemoveShoppingItem={(id) => {
                setShoppingOrder((prev) => {
                  const next = prev.items.filter((item) => item.id !== id);
                  return {
                    ...prev,
                    items:
                      next.length > 0 ? next : [createShoppingListItem()],
                  };
                });
              }}
              schedule={helpSchedule}
              scheduleErrors={scheduleErrors}
              onScheduleChange={(patch) => {
                setHelpSchedule((prev) => ({ ...prev, ...patch }));
                setScheduleErrors({});
              }}
              onEditAddress={() => setLocationModalOpen(true)}
            />
          )}

        {activeTab === "order" && flowStep === "searching" && (
          <SearchingPanel
            serviceId={selectedService}
            schedule={helpSchedule}
            onCancel={handleCancelSearch}
          />
        )}

        {activeTab === "order" && flowStep === "success" && (
          <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <p className="text-2xl font-bold text-black">
              Pomocnik znaleziony
            </p>
            <p className="text-xl font-bold text-neutral-600">
              Śledzenie i przyciski pomocy są w zakładce Aktywność.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className="w-full max-w-sm rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white"
            >
              Przejdź do Aktywności
            </button>
          </section>
        )}
      </main>

      {showOrderCheckoutHeader && (
        <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 mx-auto max-w-md border-t border-neutral-200 bg-white px-5 pb-4 pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="mb-3 flex items-end justify-between gap-3">
            <p className="text-xl font-bold text-neutral-600">
              {selectedService === "home" ? "Czas pomocy" : "Twoja oferta"}
            </p>
            <p className="text-3xl font-bold text-black">
              {checkoutTotal !== null ? `${checkoutTotal} zł` : "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={confirmCheckoutAndSearch}
            className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3.5 text-xl font-bold text-white shadow-sm active:scale-[0.99]"
          >
            Szukaj pomocnika
          </button>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md border-t border-neutral-200 bg-white/95 backdrop-blur-md"
        aria-label="Główna nawigacja"
      >
        <div className="flex items-stretch justify-around px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <NavButton
            label="Zamów"
            icon={ClipboardList}
            active={activeTab === "order"}
            onClick={() => setActiveTab("order")}
          />
          <NavButton
            label="Aktywność"
            icon={Receipt}
            active={activeTab === "activity"}
            onClick={() => setActiveTab("activity")}
            badge={flowStep === "success"}
          />
          <NavButton
            label="Profil"
            icon={User}
            active={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
          />
        </div>
      </nav>
    </div>
  );
}

function fieldClass(hasError: boolean) {
  return `mt-2 w-full rounded-xl border px-4 py-3 text-xl font-bold outline-none ring-emerald-600 focus:ring-2 ${
    hasError
      ? "border-red-400 bg-red-50"
      : "border-neutral-300 bg-neutral-50"
  }`;
}

function CheckoutRecipientSection({
  orderFor,
  recipient,
  recipientErrors,
  onOrderForChange,
  onRecipientChange,
}: {
  orderFor: OrderFor;
  recipient: RecipientDetails;
  recipientErrors: RecipientFieldErrors;
  onOrderForChange: (value: OrderFor) => void;
  onRecipientChange: (field: keyof RecipientDetails, value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xl font-bold text-black">Dla kogo zamawiasz?</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOrderForChange("self")}
          className={`rounded-xl px-3 py-4 text-xl font-bold transition ${
            orderFor === "self"
              ? "bg-emerald-600 text-white"
              : "bg-neutral-100 text-neutral-700"
          }`}
        >
          Dla siebie
        </button>
        <button
          type="button"
          onClick={() => onOrderForChange("other")}
          className={`rounded-xl px-3 py-4 text-xl font-bold transition ${
            orderFor === "other"
              ? "bg-emerald-600 text-white"
              : "bg-neutral-100 text-neutral-700"
          }`}
        >
          Dla kogoś innego
        </button>
      </div>

      {orderFor === "other" && (
        <div className="mt-4 space-y-4">
          <p className="text-xl font-bold text-black">
            Dane osoby, dla której zamawiasz
          </p>
          <label className="block">
            <span className="text-xl font-bold text-black">
              Imię <span className="text-emerald-700">*</span>
            </span>
            <input
              type="text"
              autoComplete="given-name"
              value={recipient.firstName}
              onChange={(e) => onRecipientChange("firstName", e.target.value)}
              placeholder="Jan"
              className={fieldClass(Boolean(recipientErrors.firstName))}
            />
            {recipientErrors.firstName && (
              <p className="mt-1 text-lg font-bold text-red-600">Podaj imię.</p>
            )}
          </label>
          <label className="block">
            <span className="text-xl font-bold text-black">
              Nazwisko <span className="text-emerald-700">*</span>
            </span>
            <input
              type="text"
              autoComplete="family-name"
              value={recipient.lastName}
              onChange={(e) => onRecipientChange("lastName", e.target.value)}
              placeholder="Kowalski"
              className={fieldClass(Boolean(recipientErrors.lastName))}
            />
            {recipientErrors.lastName && (
              <p className="mt-1 text-lg font-bold text-red-600">
                Podaj nazwisko.
              </p>
            )}
          </label>
          <label className="block">
            <span className="text-xl font-bold text-black">
              Telefon kontaktowy <span className="text-emerald-700">*</span>
            </span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={recipient.phone}
              onChange={(e) => onRecipientChange("phone", e.target.value)}
              placeholder="np. 600 700 800"
              className={fieldClass(Boolean(recipientErrors.phone))}
            />
            {recipientErrors.phone && (
              <p className="mt-1 text-lg font-bold text-red-600">
                Podaj poprawny numer (min. 9 cyfr).
              </p>
            )}
          </label>
        </div>
      )}
    </div>
  );
}

function CheckoutScheduleSection({
  schedule,
  errors,
  onScheduleChange,
}: {
  schedule: HelpSchedule;
  errors: ScheduleFieldErrors;
  onScheduleChange: (patch: Partial<HelpSchedule>) => void;
}) {
  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xl font-bold text-black">Kiedy potrzebujesz pomocy?</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            onScheduleChange({ mode: "now", date: "", time: "" })
          }
          className={`rounded-xl px-3 py-4 text-xl font-bold transition ${
            schedule.mode === "now"
              ? "bg-emerald-600 text-white"
              : "bg-neutral-100 text-neutral-700"
          }`}
        >
          Jak najszybciej
        </button>
        <button
          type="button"
          onClick={() => onScheduleChange({ mode: "later" })}
          className={`rounded-xl px-3 py-4 text-xl font-bold transition ${
            schedule.mode === "later"
              ? "bg-emerald-600 text-white"
              : "bg-neutral-100 text-neutral-700"
          }`}
        >
          Zaplanuj termin
        </button>
      </div>

      {schedule.mode === "later" && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xl font-bold text-black">
              Data <span className="text-emerald-700">*</span>
            </span>
            <input
              type="date"
              min={minDate}
              value={schedule.date}
              onChange={(e) => onScheduleChange({ date: e.target.value })}
              className={fieldClass(Boolean(errors.date || errors.past))}
            />
          </label>
          <label className="block">
            <span className="text-xl font-bold text-black">
              Godzina <span className="text-emerald-700">*</span>
            </span>
            <input
              type="time"
              value={schedule.time}
              onChange={(e) => onScheduleChange({ time: e.target.value })}
              className={fieldClass(Boolean(errors.time || errors.past))}
            />
          </label>
          {errors.past && (
            <p className="text-lg font-bold text-red-600 sm:col-span-2">
              Wybierz datę i godzinę w przyszłości.
            </p>
          )}
          {(errors.date || errors.time) && !errors.past && (
            <p className="text-lg font-bold text-red-600 sm:col-span-2">
              Podaj datę i godzinę wizyty.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CheckoutAddressButton({
  addressLabel,
  addressReady,
  onEditAddress,
}: {
  addressLabel: string;
  addressReady: boolean;
  onEditAddress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEditAddress}
      className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100">
        <MapPin className="h-5 w-5 text-emerald-700" strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold uppercase tracking-wide text-neutral-500">
          Adres pomocy
        </span>
        <span
          className={`block truncate text-xl font-bold ${
            addressReady ? "text-black" : "text-neutral-500"
          }`}
        >
          {addressLabel}
        </span>
      </span>
      <ChevronRight className="h-6 w-6 shrink-0 text-neutral-400" />
    </button>
  );
}

function OfferPricePicker({
  range,
  value,
  packageLabel = "Wynagrodzenie pomocnika",
  onChange,
}: {
  range: PriceRange;
  value: number;
  packageLabel?: string;
  onChange: (zl: number) => void;
}) {
  const offer = clampOffer(value, range);
  const serviceFee = getServiceFeeFromOffer(offer);
  const total = offer + serviceFee;

  return (
    <div className="mt-5 space-y-3 border-t border-neutral-100 pt-4">
      <div>
        <p className="text-xl font-bold text-black">Ustal wynagrodzenie</p>
        <p className="mt-1 text-lg font-bold leading-snug text-neutral-500">
          Przesuń suwak w zakresie {range.min}–{range.max} zł.
        </p>
      </div>

      <label className="block">
        <span className="text-lg font-bold text-neutral-600">{packageLabel}</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={range.min}
            max={range.max}
            step={1}
            value={offer}
            onChange={(e) =>
              onChange(clampOffer(Number(e.target.value), range))
            }
            className="w-28 rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-2xl font-bold outline-none ring-emerald-600 focus:ring-2"
          />
          <span className="text-xl font-bold text-neutral-600">zł</span>
        </div>
      </label>

      <input
        type="range"
        min={range.min}
        max={range.max}
        step={1}
        value={offer}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600"
        aria-label="Wynagrodzenie pomocnika"
      />
      <div className="flex justify-between text-base font-bold text-neutral-500">
        <span>{range.min} zł</span>
        <span>{range.max} zł</span>
      </div>

      <div className="space-y-2 border-t border-neutral-100 pt-3">
        <div className="flex justify-between text-xl font-bold">
          <span className="text-neutral-600">{packageLabel}</span>
          <span>{offer} zł</span>
        </div>
        <div className="flex justify-between text-xl font-bold">
          <span className="text-neutral-600">Opłata serwisowa</span>
          <span>{serviceFee} zł</span>
        </div>
        <div className="flex justify-between pt-1 text-xl font-bold text-black">
          <span>Razem</span>
          <span>{total} zł</span>
        </div>
      </div>
    </div>
  );
}

function DogWalkCheckout({
  orderFor,
  recipient,
  recipientErrors,
  dogDetails,
  dogErrors,
  offerPriceZl,
  onOfferPriceChange,
  addressLabel,
  addressReady,
  onOrderForChange,
  onRecipientChange,
  onDogChange,
  schedule,
  scheduleErrors,
  onScheduleChange,
  onEditAddress,
}: {
  orderFor: OrderFor;
  recipient: RecipientDetails;
  recipientErrors: RecipientFieldErrors;
  dogDetails: DogDetails;
  dogErrors: DogFieldErrors;
  offerPriceZl: number;
  onOfferPriceChange: (zl: number) => void;
  addressLabel: string;
  addressReady: boolean;
  onOrderForChange: (value: OrderFor) => void;
  onRecipientChange: (field: keyof RecipientDetails, value: string) => void;
  onDogChange: (
    field: keyof DogDetails,
    value: string,
  ) => void;
  schedule: HelpSchedule;
  scheduleErrors: ScheduleFieldErrors;
  onScheduleChange: (patch: Partial<HelpSchedule>) => void;
  onEditAddress: () => void;
}) {
  const priceRange = getDogWalkPriceRange(dogDetails.duration);
  const durationLabel = dogDetails.duration
    ? DOG_WALK_DURATION_LABELS[dogDetails.duration]
    : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500">
            <Dog className="h-8 w-8 text-white" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-xl font-bold text-black">Spacer z opieką</p>
            <p className="text-xl font-bold text-neutral-500">
              {durationLabel ? `${durationLabel} · ` : ""}pies na smyczy
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-neutral-100 pt-4">
          <p className="text-xl font-bold text-black">
            Czas spaceru <span className="text-emerald-700">*</span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {DOG_WALK_DURATION_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onDogChange("duration", option.id)}
                className={`rounded-xl px-3 py-3 text-left transition ${
                  dogDetails.duration === option.id
                    ? "bg-emerald-600 text-white"
                    : dogErrors.duration
                      ? "bg-red-50 text-neutral-800 ring-1 ring-red-300"
                      : "bg-neutral-100 text-neutral-800"
                }`}
              >
                <span className="block text-xl font-bold">{option.label}</span>
                <span
                  className={`block text-lg font-bold ${
                    dogDetails.duration === option.id
                      ? "text-emerald-100"
                      : "text-neutral-500"
                  }`}
                >
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
          {dogErrors.duration && (
            <p className="mt-2 text-lg font-bold text-red-600">
              Wybierz czas spaceru.
            </p>
          )}
        </div>

        {priceRange ? (
          <OfferPricePicker
            range={priceRange}
            value={offerPriceZl}
            onChange={onOfferPriceChange}
          />
        ) : null}
      </div>

      <CheckoutAddressButton
        addressLabel={addressLabel}
        addressReady={addressReady}
        onEditAddress={onEditAddress}
      />

      <CheckoutRecipientSection
        orderFor={orderFor}
        recipient={recipient}
        recipientErrors={recipientErrors}
        onOrderForChange={onOrderForChange}
        onRecipientChange={onRecipientChange}
      />

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xl font-bold text-black">Informacje o psie</p>
        <label className="mt-4 block">
          <span className="text-xl font-bold text-black">
            Rasa <span className="text-emerald-700">*</span>
          </span>
          <input
            type="text"
            value={dogDetails.breed}
            onChange={(e) => onDogChange("breed", e.target.value)}
            placeholder="np. labrador, golden retriever"
            className={fieldClass(Boolean(dogErrors.breed))}
          />
          {dogErrors.breed && (
            <p className="mt-1 text-lg font-bold text-red-600">Podaj rasę psa.</p>
          )}
        </label>

        <div className="mt-4">
          <p className="text-xl font-bold text-black">
            Gabaryt <span className="text-emerald-700">*</span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {DOG_SIZE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onDogChange("size", option.id)}
                className={`rounded-xl px-3 py-3 text-left transition ${
                  dogDetails.size === option.id
                    ? "bg-emerald-600 text-white"
                    : dogErrors.size
                      ? "bg-red-50 text-neutral-800 ring-1 ring-red-300"
                      : "bg-neutral-100 text-neutral-800"
                }`}
              >
                <span className="block text-xl font-bold">{option.label}</span>
                <span
                  className={`block text-lg font-bold ${
                    dogDetails.size === option.id
                      ? "text-emerald-100"
                      : "text-neutral-500"
                  }`}
                >
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
          {dogErrors.size && (
            <p className="mt-2 text-lg font-bold text-red-600">
              Wybierz gabaryt psa.
            </p>
          )}
        </div>

        <label className="mt-4 block">
          <span className="text-xl font-bold text-black">Dodatkowe uwagi</span>
          <textarea
            value={dogDetails.notes}
            onChange={(e) => onDogChange("notes", e.target.value)}
            rows={3}
            placeholder="Np. reaguje na inne psy, potrzebuje kagańca, lęka się wind…"
            className="mt-2 w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-xl font-bold outline-none ring-emerald-600 focus:ring-2"
          />
        </label>
      </div>

      <CheckoutScheduleSection
        schedule={schedule}
        errors={scheduleErrors}
        onScheduleChange={onScheduleChange}
      />
    </section>
  );
}

function HomeHelpCheckout({
  orderFor,
  recipient,
  recipientErrors,
  homeHelp,
  homeHelpErrors,
  offerPriceZl,
  onOfferPriceChange,
  addressLabel,
  addressReady,
  onOrderForChange,
  onRecipientChange,
  onHomeHelpChange,
  schedule,
  scheduleErrors,
  onScheduleChange,
  onEditAddress,
}: {
  orderFor: OrderFor;
  recipient: RecipientDetails;
  recipientErrors: RecipientFieldErrors;
  homeHelp: HomeHelpDetails;
  homeHelpErrors: HomeHelpFieldErrors;
  offerPriceZl: number;
  onOfferPriceChange: (zl: number) => void;
  addressLabel: string;
  addressReady: boolean;
  onOrderForChange: (value: OrderFor) => void;
  onRecipientChange: (field: keyof RecipientDetails, value: string) => void;
  onHomeHelpChange: (field: keyof HomeHelpDetails, value: string) => void;
  schedule: HelpSchedule;
  scheduleErrors: ScheduleFieldErrors;
  onScheduleChange: (patch: Partial<HelpSchedule>) => void;
  onEditAddress: () => void;
}) {
  const priceRange = getHomePriceRange(homeHelp.duration);
  const extensionHint = priceRange
    ? getHomeExtensionPrice(
        clampOffer(offerPriceZl, priceRange),
        getHomePackageMinutes(homeHelp.duration),
      )
    : HOME_EXTENSION.minutes;

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500">
            <HomeHelpIcon className="h-8 w-8 text-white" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-xl font-bold text-black">Drobna pomoc domowa</p>
          </div>
        </div>

        <div className="mt-5 border-t border-neutral-100 pt-4">
          <p className="text-xl font-bold text-black">
            Czas pomocy <span className="text-emerald-700">*</span>
          </p>
          <p className="mt-1 text-lg font-bold text-neutral-500">
            Wybierz czas na start. Przedłużenie tylko po Twojej akceptacji.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {HOME_DURATION_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onHomeHelpChange("duration", option.id)}
                className={`rounded-xl px-3 py-3 text-left transition ${
                  homeHelp.duration === option.id
                    ? "bg-violet-600 text-white"
                    : homeHelpErrors.duration
                      ? "bg-red-50 text-neutral-800 ring-1 ring-red-300"
                      : "bg-neutral-100 text-neutral-800"
                }`}
              >
                <span className="block text-xl font-bold">{option.label}</span>
                <span
                  className={`block text-lg font-bold ${
                    homeHelp.duration === option.id
                      ? "text-violet-100"
                      : "text-neutral-500"
                  }`}
                >
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
          {homeHelpErrors.duration && (
            <p className="mt-2 text-lg font-bold text-red-600">
              Wybierz czas pomocy.
            </p>
          )}
        </div>

        {priceRange ? (
          <>
            <OfferPricePicker
              range={priceRange}
              value={offerPriceZl}
              packageLabel="Wynagrodzenie za czas"
              onChange={onOfferPriceChange}
            />
            <p className="pt-3 text-lg font-bold leading-snug text-neutral-500">
              To wybrany czas na start. Jeśli go zabraknie, zaproponujemy
              przedłużenie o {HOME_EXTENSION.minutes} min (ok. +{extensionHint}{" "}
              zł) — tylko za Twoją zgodą.
            </p>
          </>
        ) : null}
      </div>

      <CheckoutAddressButton
        addressLabel={addressLabel}
        addressReady={addressReady}
        onEditAddress={onEditAddress}
      />

      <CheckoutRecipientSection
        orderFor={orderFor}
        recipient={recipient}
        recipientErrors={recipientErrors}
        onOrderForChange={onOrderForChange}
        onRecipientChange={onRecipientChange}
      />

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xl font-bold text-black">Szczegóły pomocy</p>

        <div className="mt-4">
          <p className="text-xl font-bold text-black">
            Czego potrzebujesz? <span className="text-emerald-700">*</span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {HOME_TASK_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onHomeHelpChange("taskType", option.id)}
                className={`rounded-xl px-3 py-3 text-left transition ${
                  homeHelp.taskType === option.id
                    ? "bg-violet-600 text-white"
                    : homeHelpErrors.taskType
                      ? "bg-red-50 text-neutral-800 ring-1 ring-red-300"
                      : "bg-neutral-100 text-neutral-800"
                }`}
              >
                <span className="block text-xl font-bold">{option.label}</span>
              </button>
            ))}
          </div>
          {homeHelpErrors.taskType && (
            <p className="mt-2 text-lg font-bold text-red-600">
              Wybierz rodzaj pomocy.
            </p>
          )}
        </div>

        <label className="mt-4 block">
          <span className="text-xl font-bold text-black">
            Opisz zadanie <span className="text-emerald-700">*</span>
          </span>
          <textarea
            value={homeHelp.description}
            onChange={(e) => onHomeHelpChange("description", e.target.value)}
            rows={3}
            placeholder="Np. wynieść śmieci, podlać kwiaty, posprzątać kuchnię…"
            className={`mt-2 w-full resize-none rounded-xl border px-4 py-3 text-xl font-bold outline-none ring-emerald-600 focus:ring-2 ${
              homeHelpErrors.description
                ? "border-red-400 bg-red-50"
                : "border-neutral-300 bg-neutral-50"
            }`}
          />
          {homeHelpErrors.description && (
            <p className="mt-1 text-lg font-bold text-red-600">
              Opisz zadanie (min. kilka słów).
            </p>
          )}
        </label>

        <label className="mt-4 block">
          <span className="text-xl font-bold text-black">Dodatkowe uwagi</span>
          <textarea
            value={homeHelp.notes}
            onChange={(e) => onHomeHelpChange("notes", e.target.value)}
            rows={3}
            placeholder="Np. kod do domofonu, piętro bez windy, proszę zadzwonić przed przyjazdem…"
            className="mt-2 w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-xl font-bold outline-none ring-emerald-600 focus:ring-2"
          />
        </label>
      </div>

      <CheckoutScheduleSection
        schedule={schedule}
        errors={scheduleErrors}
        onScheduleChange={onScheduleChange}
      />
    </section>
  );
}

function ShoppingCheckout({
  orderFor,
  recipient,
  recipientErrors,
  shoppingOrder,
  shoppingErrors,
  offerPriceZl,
  onOfferPriceChange,
  addressLabel,
  addressReady,
  onOrderForChange,
  onRecipientChange,
  onShoppingFieldChange,
  onShoppingItemChange,
  onAddShoppingItem,
  onRemoveShoppingItem,
  schedule,
  scheduleErrors,
  onScheduleChange,
  onEditAddress,
}: {
  orderFor: OrderFor;
  recipient: RecipientDetails;
  recipientErrors: RecipientFieldErrors;
  shoppingOrder: ShoppingOrderDetails;
  shoppingErrors: ShoppingFieldErrors;
  offerPriceZl: number;
  onOfferPriceChange: (zl: number) => void;
  addressLabel: string;
  addressReady: boolean;
  onOrderForChange: (value: OrderFor) => void;
  onRecipientChange: (field: keyof RecipientDetails, value: string) => void;
  onShoppingFieldChange: (
    field: "store" | "duration" | "notes" | "allowSimilarPurchases",
    value: string | boolean,
  ) => void;
  onShoppingItemChange: (
    id: string,
    patch: Partial<Pick<ShoppingListItem, "name" | "quantity" | "allowSimilar">>,
  ) => void;
  onAddShoppingItem: () => void;
  onRemoveShoppingItem: (id: string) => void;
  schedule: HelpSchedule;
  scheduleErrors: ScheduleFieldErrors;
  onScheduleChange: (patch: Partial<HelpSchedule>) => void;
  onEditAddress: () => void;
}) {
  const priceRange = getShoppingPriceRange(shoppingOrder.duration);
  const filledCount = shoppingOrder.items.filter(
    (item) => item.name.trim().length > 0,
  ).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500">
            <ShoppingBag className="h-8 w-8 text-white" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-xl font-bold text-black">Zakupy dla Ciebie</p>
            <p className="text-xl font-bold text-neutral-500">
              Przejrzysta lista · dostawa pod drzwi
            </p>
          </div>
        </div>

        {priceRange ? (
          <OfferPricePicker
            range={priceRange}
            value={offerPriceZl}
            onChange={onOfferPriceChange}
          />
        ) : (
          <p className="mt-5 border-t border-neutral-100 pt-4 text-lg font-bold text-neutral-500">
            Najpierw wybierz czas poniżej — wtedy ustawisz wynagrodzenie w
            sugerowanym zakresie.
          </p>
        )}
      </div>

      <CheckoutAddressButton
        addressLabel={addressLabel}
        addressReady={addressReady}
        onEditAddress={onEditAddress}
      />

      <CheckoutRecipientSection
        orderFor={orderFor}
        recipient={recipient}
        recipientErrors={recipientErrors}
        onOrderForChange={onOrderForChange}
        onRecipientChange={onRecipientChange}
      />

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="text-xl font-bold text-black">
            Sklep <span className="text-emerald-700">*</span>
          </span>
          <input
            type="text"
            value={shoppingOrder.store}
            onChange={(e) => onShoppingFieldChange("store", e.target.value)}
            placeholder="Np. Biedronka, Lidl — ul. Dietla"
            className={fieldClass(Boolean(shoppingErrors.store))}
          />
          {shoppingErrors.store && (
            <p className="mt-1 text-lg font-bold text-red-600">
              Podaj nazwę sklepu lub marketu.
            </p>
          )}
        </label>

        <div className="mt-5">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xl font-bold text-black">
                Lista zakupów <span className="text-emerald-700">*</span>
              </p>
              <p className="mt-0.5 text-lg font-bold text-neutral-500">
                {filledCount > 0
                  ? `${filledCount} ${filledCount === 1 ? "produkt" : "produkty"} na liście`
                  : "Dodaj produkty — pomocnik zobaczy całą listę"}
              </p>
            </div>
          </div>

          <label
            className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3.5"
          >
            <input
              type="checkbox"
              checked={shoppingOrder.allowSimilarPurchases}
              onChange={(e) =>
                onShoppingFieldChange(
                  "allowSimilarPurchases",
                  e.target.checked,
                )
              }
              className="h-5 w-5 shrink-0 rounded border-neutral-300 text-amber-600 focus:ring-amber-600"
            />
            <span className="text-lg font-bold text-neutral-800">
              W razie braku kup podobne
            </span>
          </label>

          <ul
            className={`mt-3 flex flex-col gap-3 ${
              shoppingErrors.items ? "rounded-xl ring-2 ring-red-300 ring-offset-2" : ""
            }`}
          >
            {shoppingOrder.items.map((item, index) => (
              <li
                key={item.id}
                className="rounded-xl border border-amber-100 bg-amber-50/60 p-3"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-lg font-bold text-amber-900"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) =>
                        onShoppingItemChange(item.id, { name: e.target.value })
                      }
                      placeholder="Nazwa produktu"
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xl font-bold outline-none ring-amber-600 focus:ring-2"
                    />
                    <input
                      type="text"
                      value={item.quantity}
                      onChange={(e) =>
                        onShoppingItemChange(item.id, {
                          quantity: e.target.value,
                        })
                      }
                      placeholder="Ilość (np. 2 szt., 1 l)"
                      className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-lg font-bold text-neutral-800 outline-none ring-amber-600 focus:ring-2"
                    />
                    <label
                      className="mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-lg py-1"
                    >
                      <input
                        type="checkbox"
                        checked={item.allowSimilar}
                        onChange={(e) =>
                          onShoppingItemChange(item.id, {
                            allowSimilar: e.target.checked,
                          })
                        }
                        className="h-4 w-4 shrink-0 rounded border-neutral-300 text-amber-600 focus:ring-amber-600"
                        aria-label={`W razie braku kup podobne: ${item.name || `produkt ${index + 1}`}`}
                      />
                      <span className="text-base font-bold text-neutral-600">
                        Kup podobne
                      </span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveShoppingItem(item.id)}
                    className="-mr-1 rounded-xl p-2 text-neutral-500 hover:bg-amber-100 hover:text-red-600"
                    aria-label="Usuń produkt z listy"
                  >
                    <Trash2 className="h-6 w-6" strokeWidth={2.25} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {shoppingErrors.items && (
            <p className="mt-2 text-lg font-bold text-red-600">
              Dodaj co najmniej jeden produkt (min. 2 znaki).
            </p>
          )}

          <button
            type="button"
            onClick={onAddShoppingItem}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 bg-white py-3 text-xl font-bold text-amber-800 active:bg-amber-50"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
            Dodaj produkt
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xl font-bold text-black">
            Szacowany czas w sklepie{" "}
            <span className="text-emerald-700">*</span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SHOPPING_DURATION_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onShoppingFieldChange("duration", option.id)}
                className={`rounded-xl px-3 py-3 text-left transition ${
                  shoppingOrder.duration === option.id
                    ? "bg-amber-600 text-white"
                    : shoppingErrors.duration
                      ? "bg-red-50 text-neutral-800 ring-1 ring-red-300"
                      : "bg-neutral-100 text-neutral-800"
                }`}
              >
                <span className="block text-xl font-bold">{option.label}</span>
                <span
                  className={`block text-lg font-bold ${
                    shoppingOrder.duration === option.id
                      ? "text-amber-100"
                      : "text-neutral-500"
                  }`}
                >
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
          {shoppingErrors.duration && (
            <p className="mt-2 text-lg font-bold text-red-600">
              Wybierz szacowany czas.
            </p>
          )}
        </div>

        <label className="mt-4 block">
          <span className="text-xl font-bold text-black">Dodatkowe uwagi</span>
          <textarea
            value={shoppingOrder.notes}
            onChange={(e) => onShoppingFieldChange("notes", e.target.value)}
            rows={3}
            placeholder="Np. budżet gotówką, bez glutenu, zadzwonić przed płatnością…"
            className="mt-2 w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-xl font-bold outline-none ring-emerald-600 focus:ring-2"
          />
        </label>
      </div>

      <CheckoutScheduleSection
        schedule={schedule}
        errors={scheduleErrors}
        onScheduleChange={onScheduleChange}
      />
    </section>
  );
}

function LocationSearchBar({
  label,
  isGeocoding,
  onOpen,
}: {
  label: string;
  isGeocoding: boolean;
  onOpen: () => void;
}) {
  const isPlaceholder = label === "Wpisz miejsce pomocy";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-4 flex w-full items-center gap-3 rounded-full border border-neutral-200 bg-neutral-100 px-5 py-4 text-left shadow-sm"
    >
      <Search
        className="h-6 w-6 shrink-0 text-neutral-500"
        strokeWidth={2.5}
        aria-hidden
      />
      <span
        className={`truncate text-xl font-bold ${
          isPlaceholder ? "text-neutral-500" : "text-black"
        }`}
      >
        {isGeocoding ? "Aktualizuję adres…" : label}
      </span>
    </button>
  );
}

function generateVisitPin(seedKey: string): string {
  return String(hashSeed(`pin-${seedKey}`) % 10000).padStart(4, "0");
}

function ActivitySection({
  orders,
  showLiveTracking,
  mapCenter,
  hasPin,
  destinationLabel,
  onCall,
  onEndActiveOrder,
  onVisitPhaseChange,
  onHomeExtensionsChange,
  onHomeJobEnded,
}: {
  orders: OrderRecord[];
  showLiveTracking: boolean;
  mapCenter: { lat: number; lng: number };
  hasPin: boolean;
  destinationLabel: string;
  onCall: () => void;
  onEndActiveOrder: (orderId: string, totalZl?: number) => void;
  onVisitPhaseChange: (orderId: string, phase: VisitPhase) => void;
  onHomeExtensionsChange: (orderId: string, extensions: number) => void;
  onHomeJobEnded: (orderId: string) => void;
}) {
  const inProgress = orders.find((o) => o.status === "in_progress");
  const completed = orders.filter((o) => o.status === "completed");
  const helperName = inProgress?.helperName ?? HELPERS[0].name;
  const helperAvatar =
    inProgress?.helperAvatar ?? HELPERS[0].avatar;
  const helperRating =
    inProgress?.helperRating ?? HELPERS[0].rating;
  const helperTransport =
    inProgress?.helperTransport ?? HELPERS[0].transport;
  const helperMotionVerb =
    inProgress?.helperMotionVerb ?? HELPERS[0].motionVerb;
  const helperVerification =
    inProgress?.helperVerification ?? HELPERS[0].verification;
  const isHomeJob = inProgress?.serviceId === "home";
  const isDogWalk = inProgress?.serviceId === "dog";

  const visitPhase: VisitPhase = inProgress?.visitPhase ?? "en_route";
  const orderId = inProgress?.id;
  const phaseStartedAtMs = useMemo(() => {
    if (inProgress?.phaseStartedAtMs != null) return inProgress.phaseStartedAtMs;
    return Date.now();
  }, [inProgress?.id, inProgress?.phaseStartedAtMs, visitPhase]);

  const visitPin = useMemo(
    () => (orderId ? generateVisitPin(orderId) : "0000"),
    [orderId],
  );

  const setPhase = (phase: VisitPhase) => {
    if (!orderId) return;
    onVisitPhaseChange(orderId, phase);
  };

  return (
    <section className="flex flex-1 flex-col gap-5">
      {showLiveTracking && inProgress ? (
        <div
          className={`flex flex-col gap-3 ${
            visitPhase === "en_route" ? "min-h-0 flex-1" : ""
          }`}
        >
          {visitPhase === "en_route" && (
            <>
              <LiveTrackingMap
                destination={mapCenter}
                hasPin={hasPin}
                seedKey={inProgress.id}
                helperName={helperName}
                helperAvatarUrl={helperAvatar}
                helperRating={helperRating}
                transport={helperTransport}
                motionVerb={helperMotionVerb}
                destinationLabel={destinationLabel}
                startedAtMs={phaseStartedAtMs}
                dense
                fill
                onArrived={() => setPhase("awaiting_pin")}
              />
              <EnRouteServicePanel
                helperName={helperName}
                helperRating={helperRating}
                helperVerification={helperVerification}
                motionVerb={helperMotionVerb}
                onCall={onCall}
                onEnd={() => onEndActiveOrder(inProgress.id)}
              />
            </>
          )}

          {visitPhase === "awaiting_pin" && (
            <ArrivalPinConfirm
              helperName={helperName}
              helperAvatar={helperAvatar}
              pin={visitPin}
              onCall={onCall}
              onConfirmed={() => setPhase("in_service")}
              onCancel={() => onEndActiveOrder(inProgress.id)}
            />
          )}

          {visitPhase === "in_service" && isHomeJob && (
            <HomeJobSessionPanel
              orderId={inProgress.id}
              helperName={helperName}
              packageMinutes={inProgress.packageMinutes ?? 30}
              packagePrice={inProgress.packagePrice ?? 45}
              startedAtMs={phaseStartedAtMs}
              extensions={inProgress.homeExtensions ?? 0}
              initiallyEnded={Boolean(inProgress.homeJobEnded)}
              onCall={onCall}
              onExtensionsChange={(n) =>
                onHomeExtensionsChange(inProgress.id, n)
              }
              onMarkEnded={() => onHomeJobEnded(inProgress.id)}
              onComplete={onEndActiveOrder}
            />
          )}

          {visitPhase === "in_service" && isDogWalk && (
            <>
              <DogWalkMap
                home={mapCenter}
                seedKey={inProgress.id}
                helperName={helperName}
                helperAvatarUrl={helperAvatar}
                startedAtMs={phaseStartedAtMs}
                onWalkComplete={() => setPhase("dog_handoff")}
              />
              <OnSiteServicePanel
                helperName={helperName}
                helperRating={helperRating}
                helperVerification={helperVerification}
                statusLine={`${helperName} wyprowadza psa. Śledź spacer na mapie.`}
                onCall={onCall}
                onEnd={() => onEndActiveOrder(inProgress.id)}
              />
            </>
          )}

          {visitPhase === "dog_handoff" && isDogWalk && (
            <DogHandoffConfirm
              helperName={helperName}
              helperAvatar={helperAvatar}
              totalZl={
                (inProgress.packagePrice ?? DEFAULT_DOG_WALK_PRICE_RANGE.suggested) +
                (inProgress.serviceFee ?? getServiceFeeFromOffer(inProgress.packagePrice ?? DEFAULT_DOG_WALK_PRICE_RANGE.suggested))
              }
              onCall={onCall}
              onConfirmOk={() =>
                onEndActiveOrder(
                  inProgress.id,
                  (inProgress.packagePrice ?? DEFAULT_DOG_WALK_PRICE_RANGE.suggested) +
                    (inProgress.serviceFee ?? getServiceFeeFromOffer(inProgress.packagePrice ?? DEFAULT_DOG_WALK_PRICE_RANGE.suggested)),
                )
              }
            />
          )}

          {visitPhase === "in_service" && !isHomeJob && !isDogWalk && (
            <OnSiteServicePanel
              helperName={helperName}
              helperRating={helperRating}
              helperVerification={helperVerification}
              onCall={onCall}
              onEnd={() => onEndActiveOrder(inProgress.id)}
            />
          )}
        </div>
      ) : (
        <p className="text-xl font-bold text-neutral-600">Historia zleceń</p>
      )}

      {!showLiveTracking && inProgress && (
        <OrderHistoryCard order={inProgress} highlight />
      )}

      {completed.length > 0 && !(showLiveTracking && inProgress) && (
        <div className="flex flex-col gap-3">
          <p className="text-lg font-bold text-neutral-500">Wcześniejsze</p>
          {completed.map((order) => (
            <OrderHistoryCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {orders.length === 0 && (
        <p className="text-center text-xl font-bold text-neutral-500">
          Brak zleceń w historii
        </p>
      )}
    </section>
  );
}

function DogHandoffConfirm({
  helperName,
  helperAvatar,
  totalZl,
  onCall,
  onConfirmOk,
}: {
  helperName: string;
  helperAvatar: string;
  totalZl: number;
  onCall: () => void;
  onConfirmOk: () => void;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-emerald-200 bg-white p-5 shadow-md">
      <div className="flex items-center gap-4">
        <img
          src={helperAvatar}
          alt={helperName}
          className="h-16 w-16 rounded-full object-cover ring-2 ring-emerald-500 ring-offset-2"
          width={64}
          height={64}
        />
        <div>
          <p className="text-lg font-bold text-emerald-700">Powrót ze spaceru</p>
          <p className="text-2xl font-bold text-black">{helperName}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-emerald-50 px-4 py-5">
        <p className="text-2xl font-bold text-black">Pies jest z powrotem</p>
        <p className="mt-2 text-xl font-bold leading-snug text-neutral-700">
          {helperName} oddaje psa. Sprawdź, czy wszystko jest w porządku —
          potem potwierdź i zakończ zlecenie.
        </p>
      </div>

      <div className="flex justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-lg font-bold text-neutral-700">
        <span>Do zapłaty</span>
        <span className="text-black">{totalZl} zł</span>
      </div>

      <button
        type="button"
        onClick={onConfirmOk}
        className="flex min-h-[64px] w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-4 text-2xl font-bold text-white"
      >
        Wszystko w porządku — zakończ
      </button>

      <ActiveServiceSafetyActions
        helperName={helperName}
        statusLine="Jeśli coś nie gra, zadzwoń lub wezwij pomoc."
        endLabel="Zgłoś problem i zakończ"
        onCall={onCall}
        onConfirmEnd={onConfirmOk}
        showEnd
      />
    </section>
  );
}

function ArrivalPinConfirm({
  helperName,
  helperAvatar,
  pin,
  onCall,
  onConfirmed,
  onCancel,
}: {
  helperName: string;
  helperAvatar: string;
  pin: string;
  onCall: () => void;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<"show" | "waiting" | "ok">("show");

  useEffect(() => {
    if (phase !== "waiting") return;
    const t = window.setTimeout(() => {
      setPhase("ok");
      window.setTimeout(onConfirmed, 900);
    }, 2800);
    return () => window.clearTimeout(t);
  }, [phase, onConfirmed]);

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-white p-4 shadow-md">
      <div className="flex items-center gap-3">
        <img
          src={helperAvatar}
          alt={helperName}
          className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald-500 ring-offset-2"
          width={48}
          height={48}
        />
        <div>
          <p className="text-base font-bold text-emerald-700">Na miejscu</p>
          <p className="text-xl font-bold text-black">{helperName}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-center">
        <div className="mb-1 flex items-center justify-center gap-2 text-emerald-800">
          <KeyRound className="h-5 w-5" strokeWidth={2.25} />
          <p className="text-base font-bold">Kod przybycia</p>
        </div>
        <p
          className="font-mono text-4xl font-bold tracking-[0.3em] text-black"
          aria-label={`Kod ${pin.split("").join(" ")}`}
        >
          {pin}
        </p>
        <p className="mt-2 text-lg font-bold leading-snug text-neutral-700">
          Podaj ten kod pomocnikowi przy drzwiach.
        </p>
      </div>

      {phase === "show" && (
        <>
          <button
            type="button"
            onClick={() => setPhase("waiting")}
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-xl font-bold text-white"
          >
            Pokazałem kod pomocnikowi
          </button>
          <ActiveServiceSafetyActions
            helperName={helperName}
            statusLine="Nie otwieraj drzwi, dopóki kod nie zostanie potwierdzony."
            endLabel="Anuluj zlecenie"
            onCall={onCall}
            onConfirmEnd={onCancel}
            showEnd
            compact
          />
        </>
      )}

      {phase === "waiting" && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Loader2
            className="h-12 w-12 animate-spin text-emerald-600"
            strokeWidth={2.25}
          />
          <p className="text-2xl font-bold text-black">
            {helperName} wpisuje kod…
          </p>
          <p className="text-xl font-bold text-neutral-500">
            Chwilę poczekaj na potwierdzenie
          </p>
        </div>
      )}

      {phase === "ok" && (
        <div className="rounded-2xl bg-emerald-600 px-4 py-5 text-center text-white">
          <p className="text-2xl font-bold">Kod poprawny</p>
          <p className="mt-1 text-xl font-bold text-emerald-100">
            Zaczynamy usługę
          </p>
        </div>
      )}
    </section>
  );
}

function OnSiteServicePanel({
  helperName,
  helperRating,
  helperVerification,
  statusLine,
  onCall,
  onEnd,
}: {
  helperName: string;
  helperRating: string;
  helperVerification: string;
  statusLine?: string;
  onCall: () => void;
  onEnd: () => void;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 shrink-0 text-emerald-600" />
        <p className="text-lg font-bold text-neutral-700">
          {helperVerification} · {helperRating}★
        </p>
      </div>
      <ActiveServiceSafetyActions
        helperName={helperName}
        statusLine={
          statusLine ?? `${helperName} jest u Ciebie. Usługa w toku.`
        }
        endLabel="Zakończ usługę"
        onCall={onCall}
        onConfirmEnd={onEnd}
      />
    </section>
  );
}

/**
 * Duże akcje dla seniora: telefon do helpera, SOS (112 / bliska osoba), zakończenie.
 */
function ActiveServiceSafetyActions({
  helperName,
  statusLine,
  endLabel,
  onCall,
  onConfirmEnd,
  showEnd = true,
  compact = false,
}: {
  helperName: string;
  statusLine: string;
  endLabel: string;
  onCall: () => void;
  onConfirmEnd: () => void;
  showEnd?: boolean;
  /** Mniejsze przyciski — wszystko widać bez scrolla (np. przy dojeździe). */
  compact?: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTarget, setHelpTarget] = useState<"112" | "trusted">("112");
  const [alsoNotifyTrusted, setAlsoNotifyTrusted] = useState(true);
  const [helpPhase, setHelpPhase] = useState<"form" | "sending" | "done">(
    "form",
  );
  const [endOpen, setEndOpen] = useState(false);
  const [doneTarget, setDoneTarget] = useState<"112" | "trusted">("112");
  const [doneNotifiedTrusted, setDoneNotifiedTrusted] = useState(false);

  const startHelp = () => {
    const target = helpTarget;
    const notify = target === "112" ? alsoNotifyTrusted : true;
    setDoneTarget(target);
    setDoneNotifiedTrusted(notify);
    setHelpPhase("sending");
    window.setTimeout(() => {
      setHelpPhase("done");
      if (target === "112") {
        window.alert(
          notify
            ? `Łączenie z numerem alarmowym 112…\nPowiadamiamy też: ${TRUSTED_CONTACT.name} (${TRUSTED_CONTACT.phoneDisplay}). (demo)`
            : "Łączenie z numerem alarmowym 112… (demo)",
        );
      } else {
        window.alert(
          `Łączenie z ${TRUSTED_CONTACT.name} (${TRUSTED_CONTACT.relation}) · ${TRUSTED_CONTACT.phoneDisplay}… (demo)`,
        );
      }
    }, 900);
  };

  const closeHelp = () => {
    setHelpOpen(false);
    setHelpPhase("form");
    setHelpTarget("112");
    setAlsoNotifyTrusted(true);
  };

  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      {!compact && (
        <p className="text-xl font-bold leading-snug text-black">{statusLine}</p>
      )}

      <button
        type="button"
        onClick={onCall}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-bold text-white shadow-sm active:scale-[0.99] ${
          compact
            ? "min-h-[52px] px-4 py-3 text-xl"
            : "min-h-[64px] gap-3 px-6 py-4 text-2xl"
        }`}
      >
        <Phone className={compact ? "h-6 w-6" : "h-8 w-8"} strokeWidth={2.25} />
        Zadzwoń do {helperName}
      </button>

      <button
        type="button"
        onClick={() => {
          setHelpOpen(true);
          setHelpPhase("form");
        }}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-500 bg-red-50 font-bold text-red-700 active:scale-[0.99] ${
          compact
            ? "min-h-[52px] px-4 py-3 text-xl"
            : "min-h-[64px] gap-3 px-6 py-4 text-2xl"
        }`}
      >
        <AlertCircle
          className={compact ? "h-6 w-6" : "h-8 w-8"}
          strokeWidth={2.25}
        />
        Potrzebuję pomocy
      </button>

      {showEnd && (
        <button
          type="button"
          onClick={() => setEndOpen(true)}
          className={`flex w-full items-center justify-center rounded-2xl bg-neutral-100 font-bold text-neutral-800 ${
            compact
              ? "min-h-[48px] px-4 py-2.5 text-lg"
              : "min-h-[56px] px-6 py-3.5 text-xl"
          }`}
        >
          {endLabel}
        </button>
      )}

      {helpOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-dialog-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            {helpPhase === "form" && (
              <>
                <p
                  id="help-dialog-title"
                  className="text-2xl font-bold text-black"
                >
                  Potrzebujesz pomocy?
                </p>
                <p className="mt-2 text-xl font-bold leading-snug text-neutral-600">
                  Nie łączymy Cię z pomocnikiem na miejscu. Wybierz numer
                  alarmowy 112 albo zaufaną osobę.
                </p>

                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setHelpTarget("112")}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      helpTarget === "112"
                        ? "border-red-600 bg-red-50 ring-2 ring-red-600"
                        : "border-neutral-200 bg-neutral-50"
                    }`}
                  >
                    <span className="block text-xl font-bold text-black">
                      Numer alarmowy 112
                    </span>
                    <span className="mt-1 block text-lg font-bold text-neutral-500">
                      Pogotowie, policja, straż — w nagłym zagrożeniu
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHelpTarget("trusted")}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      helpTarget === "trusted"
                        ? "border-red-600 bg-red-50 ring-2 ring-red-600"
                        : "border-neutral-200 bg-neutral-50"
                    }`}
                  >
                    <span className="block text-xl font-bold text-black">
                      {TRUSTED_CONTACT.name} ({TRUSTED_CONTACT.relation})
                    </span>
                    <span className="mt-1 block text-lg font-bold text-neutral-500">
                      {TRUSTED_CONTACT.phoneDisplay}
                    </span>
                  </button>
                </div>

                {helpTarget === "112" && (
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={alsoNotifyTrusted}
                      onChange={(e) => setAlsoNotifyTrusted(e.target.checked)}
                      className="mt-1 h-6 w-6 shrink-0 rounded border-neutral-300 text-emerald-600"
                    />
                    <span className="text-xl font-bold leading-snug text-black">
                      Powiadom też bliską osobę SMS-em
                      <span className="mt-1 block text-lg font-bold text-neutral-500">
                        {TRUSTED_CONTACT.name} · {TRUSTED_CONTACT.phoneDisplay}
                      </span>
                    </span>
                  </label>
                )}

                <div className="mt-5 grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={startHelp}
                    className="flex min-h-[60px] items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-xl font-bold text-white"
                  >
                    <PhoneCall className="h-7 w-7" strokeWidth={2.25} />
                    {helpTarget === "112"
                      ? "Połącz z 112"
                      : `Zadzwoń do ${TRUSTED_CONTACT.name}`}
                  </button>
                  <button
                    type="button"
                    onClick={closeHelp}
                    className="min-h-[52px] rounded-2xl bg-neutral-100 px-4 py-3 text-xl font-bold text-neutral-800"
                  >
                    Wróć
                  </button>
                </div>
              </>
            )}

            {helpPhase === "sending" && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <Loader2
                  className="h-12 w-12 animate-spin text-red-600"
                  strokeWidth={2.25}
                />
                <p className="text-2xl font-bold text-black">
                  {doneTarget === "112"
                    ? "Łączymy z 112…"
                    : `Łączymy z ${TRUSTED_CONTACT.name}…`}
                </p>
                {doneTarget === "112" && doneNotifiedTrusted && (
                  <p className="text-xl font-bold text-neutral-600">
                    Powiadamiamy też {TRUSTED_CONTACT.name}
                  </p>
                )}
              </div>
            )}

            {helpPhase === "done" && (
              <div className="flex flex-col gap-4 py-2">
                <p className="text-2xl font-bold text-black">Pomoc wezwana</p>
                <p className="text-xl font-bold leading-snug text-neutral-600">
                  {doneTarget === "112"
                    ? "Połączenie z numerem alarmowym 112"
                    : `Połączenie z ${TRUSTED_CONTACT.name} (${TRUSTED_CONTACT.relation})`}
                  {doneTarget === "112" && doneNotifiedTrusted
                    ? ` · SMS do ${TRUSTED_CONTACT.name}`
                    : ""}
                  .
                </p>
                <p className="text-lg font-bold leading-snug text-neutral-500">
                  Pomocnik na zleceniu nie jest informowany o tym wezwaniu.
                </p>
                <button
                  type="button"
                  onClick={closeHelp}
                  className="min-h-[56px] rounded-2xl bg-emerald-600 px-4 py-3 text-xl font-bold text-white"
                >
                  Rozumiem
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {endOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-dialog-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <p id="end-dialog-title" className="text-2xl font-bold text-black">
              Zakończyć usługę?
            </p>
            <p className="mt-2 text-xl font-bold leading-snug text-neutral-600">
              Potwierdź tylko, jeśli pomoc jest już niepotrzebna. Rozliczymy
              zużyty czas.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => {
                  setEndOpen(false);
                  onConfirmEnd();
                }}
                className="min-h-[56px] rounded-2xl bg-neutral-900 px-4 py-3 text-xl font-bold text-white"
              >
                Tak, zakończ
              </button>
              <button
                type="button"
                onClick={() => setEndOpen(false)}
                className="min-h-[52px] rounded-2xl bg-neutral-100 px-4 py-3 text-xl font-bold text-neutral-800"
              >
                Nie, wróć
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeJobSessionPanel({
  orderId,
  helperName,
  packageMinutes,
  packagePrice,
  startedAtMs,
  extensions,
  initiallyEnded,
  onCall,
  onExtensionsChange,
  onMarkEnded,
  onComplete,
}: {
  orderId: string;
  helperName: string;
  packageMinutes: number;
  packagePrice: number;
  startedAtMs: number;
  extensions: number;
  initiallyEnded: boolean;
  onCall: () => void;
  onExtensionsChange: (extensions: number) => void;
  onMarkEnded: () => void;
  onComplete: (orderId: string, totalZl?: number) => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(() =>
    Math.max(0, Date.now() - startedAtMs),
  );
  const [promptOpen, setPromptOpen] = useState(false);
  const [ended, setEnded] = useState(initiallyEnded);
  const promptedForTotalRef = useRef(0);

  const totalMinutes =
    packageMinutes + extensions * HOME_EXTENSION.minutes;
  const extensionUnitPrice = getHomeExtensionPrice(packagePrice, packageMinutes);
  const extensionsCost = extensions * extensionUnitPrice;
  const helperPay = packagePrice + extensionsCost;
  const liveServiceFee = getServiceFeeFromOffer(helperPay);
  const runningTotal = helperPay + liveServiceFee;
  const packageDurationMs = totalMinutes * HOME_DEMO_MS_PER_MINUTE;
  const progress = Math.min(1, elapsedMs / packageDurationMs);

  useEffect(() => {
    if (ended) return;
    let frame = 0;
    const tick = () => {
      setElapsedMs(Math.max(0, Date.now() - startedAtMs));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ended, startedAtMs]);

  useEffect(() => {
    if (ended || promptOpen) return;
    if (progress < 0.82) return;
    if (promptedForTotalRef.current >= totalMinutes) return;
    promptedForTotalRef.current = totalMinutes;
    setPromptOpen(true);
  }, [progress, ended, promptOpen, totalMinutes]);

  const finishJob = () => {
    setPromptOpen(false);
    setEnded(true);
    onMarkEnded();
  };

  const acceptExtension = () => {
    onExtensionsChange(extensions + 1);
    setPromptOpen(false);
  };

  if (ended) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <p className="text-xl font-bold text-emerald-800">Zlecenie zakończone</p>
        <div className="space-y-2 border-t border-neutral-100 pt-3">
          <div className="flex justify-between text-lg font-bold text-neutral-700">
            <span>Czas pomocy ({packageMinutes} min)</span>
            <span>{packagePrice} zł</span>
          </div>
          {extensions > 0 && (
            <div className="flex justify-between text-lg font-bold text-neutral-700">
              <span>
                Przedłużenia ×{extensions} (+
                {extensions * HOME_EXTENSION.minutes} min)
              </span>
              <span>{extensionsCost} zł</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-neutral-700">
            <span>Opłata serwisowa</span>
            <span>{liveServiceFee} zł</span>
          </div>
          <div className="flex justify-between pt-2 text-2xl font-bold text-black">
            <span>Do zapłaty</span>
            <span>{runningTotal} zł</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onComplete(orderId, runningTotal)}
          className="w-full rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white"
        >
          Gotowe
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-violet-700">Pomoc w toku</p>
          <p className="text-xl font-bold text-black">
            {helperName} · {totalMinutes} min
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-black">{runningTotal} zł</p>
          <p className="text-sm font-bold text-neutral-500">na rachunku</p>
        </div>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-violet-600 transition-[width] duration-200 ease-linear"
          style={{ width: `${Math.max(3, progress * 100)}%` }}
        />
      </div>

      {promptOpen && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xl font-bold text-amber-950">
            Czas pomocy się kończy
          </p>
          <p className="mt-2 text-lg font-bold leading-snug text-amber-900">
            Przedłużyć o {HOME_EXTENSION.minutes} min za +{extensionUnitPrice}{" "}
            zł? Bez zgody kończymy zlecenie.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={finishJob}
              className="rounded-xl bg-white px-3 py-3 text-lg font-bold text-neutral-800 ring-1 ring-neutral-200"
            >
              Zakończ teraz
            </button>
            <button
              type="button"
              onClick={acceptExtension}
              className="rounded-xl bg-violet-600 px-3 py-3 text-lg font-bold text-white"
            >
              Przedłuż (+{extensionUnitPrice} zł)
            </button>
          </div>
        </div>
      )}

      <ActiveServiceSafetyActions
        helperName={helperName}
        statusLine={`${helperName} jest u Ciebie. Możesz zadzwonić lub wezwać pomoc.`}
        endLabel="Zakończ usługę"
        onCall={onCall}
        onConfirmEnd={finishJob}
        showEnd={!promptOpen}
      />
    </section>
  );
}

function EnRouteServicePanel({
  helperName,
  helperRating,
  helperVerification,
  motionVerb,
  onCall,
  onEnd,
}: {
  helperName: string;
  helperRating: string;
  helperVerification: string;
  motionVerb: string;
  onCall: () => void;
  onEnd: () => void;
}) {
  return (
    <section
      className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 px-1">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        <p className="truncate text-base font-bold text-neutral-600">
          {helperVerification} · {helperRating}★ · {motionVerb} do Ciebie
        </p>
      </div>

      <ActiveServiceSafetyActions
        helperName={helperName}
        statusLine={`${helperName} ${motionVerb.toLowerCase()} do Ciebie.`}
        endLabel="Anuluj zlecenie"
        onCall={onCall}
        onConfirmEnd={onEnd}
        compact
      />
    </section>
  );
}

function OrderHistoryCard({
  order,
  highlight = false,
}: {
  order: OrderRecord;
  highlight?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        highlight ? "border-emerald-200 bg-emerald-50/40" : "border-neutral-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xl font-bold text-black">{order.serviceTitle}</p>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
            order.status === "in_progress"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {order.status === "in_progress" ? "W trakcie" : "Zakończone"}
        </span>
      </div>
      <p className="mt-2 text-xl font-bold text-neutral-700">{order.address}</p>
      <p className="mt-1 text-lg font-bold text-neutral-500">
        {order.dateLabel}
        {order.helperName ? ` · ${order.helperName}` : ""}
      </p>
    </article>
  );
}

function NavButton({
  label,
  icon: Icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: typeof ClipboardList;
  active: boolean;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-w-[30%] flex-col items-center gap-1 rounded-xl px-3 py-3 text-center transition ${
        active ? "text-emerald-700" : "text-neutral-500"
      }`}
    >
      <Icon
        className={`h-7 w-7 ${active ? "text-emerald-600" : ""}`}
        strokeWidth={active ? 2.5 : 2}
      />
      <span className="text-xl font-bold leading-tight">{label}</span>
      {active && (
        <span className="absolute -bottom-0.5 h-1 w-8 rounded-full bg-emerald-600" />
      )}
      {badge && !active && (
        <span className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
      )}
    </button>
  );
}

function SearchingPanel({
  serviceId,
  schedule,
  onCancel,
}: {
  serviceId: string | null;
  schedule: HelpSchedule;
  onCancel: () => void;
}) {
  const label =
    SERVICES.find((s) => s.id === serviceId)?.title ?? "pomocy";
  const planned = formatScheduleLabel(schedule);

  return (
    <section
      className="flex flex-1 flex-col items-center justify-center gap-8 px-2 pt-2 text-center"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className="h-16 w-16 animate-spin text-emerald-600"
        strokeWidth={2.25}
        aria-hidden
      />
      <div className="space-y-3">
        <p className="text-2xl font-bold leading-snug text-black">
          {planned
            ? "Szukam pomocnika na wybrany termin…"
            : "Szukam zweryfikowanego pomocnika w Twojej okolicy..."}
        </p>
        <p className="text-xl font-bold text-neutral-500">Zlecenie: {label}</p>
        {planned && (
          <p className="text-xl font-bold text-emerald-700">Termin: {planned}</p>
        )}
      </div>
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-500" />
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 min-h-[56px] w-full max-w-xs rounded-2xl bg-neutral-100 px-6 py-3 text-xl font-bold text-neutral-800"
      >
        Anuluj wyszukiwanie
      </button>
    </section>
  );
}
