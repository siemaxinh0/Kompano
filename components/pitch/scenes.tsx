"use client";

import type { ComponentType, ReactNode } from "react";
import {
  BadgeCheck,
  Bike,
  Contrast,
  Dog,
  HandCoins,
  House,
  ShoppingBasket,
  Type,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { DemoPreset } from "@/lib/demoDirector";
import type { A11yPrefs } from "@/lib/a11y";
import {
  AlternativesSlide,
  BusinessSlide,
  CalculatorSlide,
  CtaSlide,
  FaqSlide,
  MarketSlide,
  PersonaSlide,
  PillarsSlide,
  ScamSlide,
  StatsSlide,
} from "@/components/pitch/slides";

export type ChapterId =
  | "problem"
  | "solution"
  | "safety"
  | "access"
  | "helpers"
  | "business";

export const CHAPTERS: { id: ChapterId; label: string }[] = [
  { id: "problem", label: "Problem" },
  { id: "solution", label: "Rozwiązanie" },
  { id: "safety", label: "Bezpieczeństwo" },
  { id: "access", label: "Dostępność" },
  { id: "helpers", label: "Pomocnicy" },
  { id: "business", label: "Model biznesowy" },
];

export type SceneAction =
  | { kind: "wait"; ms: number }
  | { kind: "tap"; target: string; after?: number }
  | { kind: "point"; target: string; ms?: number }
  | { kind: "type"; text: string };

export type SceneStep = { label: string; actions: SceneAction[] };

export type SlideProps = {
  playing: boolean;
  onTry: () => void;
  onRestart: () => void;
};

export type SceneContext = {
  setPrefs: (patch: Partial<A11yPrefs>) => void;
  resetHelper: () => void;
};

export type Scene = {
  id: string;
  chapter: ChapterId;
  layout: "phone" | "full";
  title: string;
  lead?: string;
  voice: string;
  role?: "client" | "helper";
  preset?: DemoPreset;
  steps?: SceneStep[];
  /** Czas po wykonaniu kroków (dla slajdów pełnych — cały czas trwania). */
  hold: number;
  extra?: ReactNode;
  Slide?: ComponentType<SlideProps>;
  onEnter?: (ctx: SceneContext) => void;
};

function FeatureChips({
  items,
}: {
  items: { icon: LucideIcon; label: string }[];
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item.label}
          className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[15px] font-semibold text-ink shadow-card"
        >
          <item.icon className="h-4 w-4 text-emerald-700" strokeWidth={2.5} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export const SCENES: Scene[] = [
  {
    id: "intro",
    chapter: "problem",
    layout: "phone",
    preset: "home",
    title: "Pomoc na wyciągnięcie ręki.",
    lead: "Helpovski łączy seniorów ze sprawdzonymi pomocnikami z okolicy. Spacer z psem, drobna pomoc w domu i zakupy — zamówione w kilku dotknięciach.",
    voice:
      "Helpovski. Pomoc na wyciągnięcie ręki. Łączymy seniorów ze sprawdzonymi pomocnikami z okolicy.",
    hold: 6500,
    extra: (
      <FeatureChips
        items={[
          { icon: Dog, label: "Spacer z psem" },
          { icon: House, label: "Drobna pomoc domowa" },
          { icon: ShoppingBasket, label: "Zakupy" },
        ]}
      />
    ),
  },
  {
    id: "stats",
    chapter: "problem",
    layout: "full",
    title: "Polska się starzeje",
    voice:
      "Polska się starzeje. W kraju mieszka już prawie dziesięć milionów osób po sześćdziesiątce, a półtora miliona seniorów prowadzi gospodarstwo domowe w pojedynkę. W samym Krakowie to ponad sto osiemdziesiąt tysięcy osób.",
    hold: 10000,
    Slide: StatsSlide,
  },
  {
    id: "persona",
    chapter: "problem",
    layout: "full",
    title: "Poznaj panią Helenę",
    voice:
      "Poznaj panią Helenę. Ma siedemdziesiąt osiem lat, mieszka sama z psem. Kolano nie pozwala na długie spacery, zakupy trzeba wnieść na trzecie piętro, a córka mieszka daleko. Najbardziej boi się wpuszczać obcych do domu.",
    hold: 11000,
    Slide: PersonaSlide,
  },
  {
    id: "scams",
    chapter: "problem",
    layout: "full",
    title: "Największa bariera to zaufanie",
    voice:
      "Największą barierą jest zaufanie. W dwa tysiące dwudziestym piątym roku policja odnotowała ponad pięć tysięcy oszustw na wnuczka i na policjanta. Straty przekroczyły sto pięćdziesiąt milionów złotych. Senior, który boi się otworzyć drzwi, nie zamówi pomocy.",
    hold: 11000,
    Slide: ScamSlide,
  },
  {
    id: "alternatives",
    chapter: "problem",
    layout: "full",
    title: "Dziś nie ma dobrego wyboru",
    voice:
      "Dziś senior ma do wyboru rodzinę, której nie chce obciążać, ogłoszenie od nieznajomego albo procedurę w ośrodku pomocy społecznej. Żadna z opcji nie daje pomocy od ręki, od sprawdzonej osoby, w jasnej cenie.",
    hold: 10000,
    Slide: AlternativesSlide,
  },
  {
    id: "solution",
    chapter: "solution",
    layout: "phone",
    preset: "home",
    title: "Trzy codzienne sprawy. Jeden ekran.",
    lead: "Bez rejestracji w okienku i bez szukania numeru telefonu. Senior wybiera, czego potrzebuje — resztą zajmuje się Helpovski.",
    voice:
      "Rozwiązanie jest proste. Trzy codzienne sprawy na jednym ekranie. Senior wybiera, czego potrzebuje, a resztą zajmuje się Helpovski.",
    steps: [
      { label: "Spacer z psem", actions: [{ kind: "point", target: "service-dog", ms: 1100 }] },
      { label: "Drobna pomoc domowa", actions: [{ kind: "point", target: "service-home", ms: 1100 }] },
      { label: "Zakupy", actions: [{ kind: "point", target: "service-shopping", ms: 1100 }] },
    ],
    hold: 1500,
  },
  {
    id: "order",
    chapter: "solution",
    layout: "phone",
    preset: "home",
    title: "Zamówienie w mniej niż minutę",
    lead: "Jedna decyzja na raz, duże kafle i podpowiedzi cen. Nie ma pól, które trzeba zgadywać.",
    voice:
      "Zamówienie zajmuje mniej niż minutę. Pani Helena wybiera spacer z psem, czas, wielkość psa i wpisuje rasę. Jedna decyzja na raz.",
    steps: [
      { label: "Wybiera spacer z psem", actions: [{ kind: "tap", target: "service-dog", after: 900 }] },
      { label: "Czas spaceru: 30 minut", actions: [{ kind: "tap", target: "dog-duration-30min" }] },
      { label: "Wielkość psa", actions: [{ kind: "tap", target: "dog-size-medium" }] },
      {
        label: "Rasa — wpisana w sekundę",
        actions: [{ kind: "tap", target: "dog-breed", after: 200 }, { kind: "type", text: "Labrador" }],
      },
    ],
    hold: 1500,
  },
  {
    id: "pricing",
    chapter: "solution",
    layout: "phone",
    preset: "checkout-dog-filled",
    title: "Uczciwa cena, znana z góry",
    lead: "Widełki zależą od usługi i czasu. Senior sam ustala stawkę — pomocnik dostaje całość, a Helpovski dolicza 10% opłaty serwisowej.",
    voice:
      "Cena jest znana z góry. Senior widzi widełki i sam ustala stawkę. Pomocnik dostaje sto procent, a Helpovski dolicza dziesięć procent opłaty serwisowej.",
    steps: [
      { label: "Widełki ceny dla tej usługi", actions: [{ kind: "point", target: "offer-picker", ms: 1600 }] },
      {
        label: "Można dodać coś od siebie",
        actions: [
          { kind: "tap", target: "offer-plus", after: 300 },
          { kind: "tap", target: "offer-plus", after: 900 },
        ],
      },
      { label: "Pomocnik dostaje 100% stawki", actions: [{ kind: "wait", ms: 2400 }] },
    ],
    hold: 1000,
  },
  {
    id: "match",
    chapter: "solution",
    layout: "phone",
    preset: "checkout-dog-filled",
    title: "Pomocnik w kilka sekund",
    lead: "Szukamy zweryfikowanych osób w najbliższej okolicy. Senior od razu widzi, kto przyjdzie: imię, zdjęcie i ocenę.",
    voice:
      "Jedno dotknięcie i szukamy sprawdzonego pomocnika w okolicy. Po kilku sekundach senior widzi, kto przyjdzie: imię, zdjęcie, ocenę i weryfikację.",
    steps: [
      { label: "„Szukaj pomocnika”", actions: [{ kind: "tap", target: "cta-search", after: 300 }] },
      { label: "Szukamy w okolicy", actions: [{ kind: "wait", ms: 3800 }] },
      { label: "Mamy pomocnika — z oceną i weryfikacją", actions: [{ kind: "wait", ms: 3300 }] },
    ],
    hold: 600,
  },
  {
    id: "tracking",
    chapter: "safety",
    layout: "phone",
    preset: "en_route",
    title: "Wiesz, kto i kiedy przyjdzie",
    lead: "Pomocnik widoczny na mapie na żywo, z czasem dojazdu. Żadnych anonimowych telefonów ani niezapowiedzianych wizyt.",
    voice:
      "Od tej chwili senior widzi pomocnika na mapie na żywo, razem z czasem dojazdu. Żadnych anonimowych telefonów ani niezapowiedzianych wizyt.",
    steps: [
      { label: "Pomocnik w drodze — na żywo", actions: [{ kind: "wait", ms: 3200 }] },
      { label: "Czas dojazdu i środek transportu", actions: [{ kind: "wait", ms: 1800 }] },
      { label: "Dociera pod drzwi", actions: [{ kind: "tap", target: "map-arrived", after: 1200 }] },
    ],
    hold: 600,
  },
  {
    id: "pin",
    chapter: "safety",
    layout: "phone",
    preset: "awaiting_pin",
    title: "Drzwi otwiera tylko kod",
    lead: "Senior otwiera tylko osobie, która zna jednorazowy kod z jego aplikacji. Oszust podający się za pomocnika go nie zna.",
    voice:
      "Pod drzwiami działa jednorazowy kod. Senior otwiera tylko osobie, która go zna. Oszust podający się za pomocnika nie ma do niego dostępu.",
    steps: [
      { label: "Aplikacja pokazuje jednorazowy kod", actions: [{ kind: "wait", ms: 2600 }] },
      { label: "Senior pokazuje kod pomocnikowi", actions: [{ kind: "tap", target: "pin-shown", after: 400 }] },
      { label: "Pomocnik wpisuje kod — wizyta potwierdzona", actions: [{ kind: "wait", ms: 3700 }] },
    ],
    hold: 800,
  },
  {
    id: "sos",
    chapter: "safety",
    layout: "phone",
    preset: "in_service",
    title: "Pomoc jednym dotknięciem",
    lead: "Przez całą wizytę na ekranie jest przycisk pomocy. Łączy z numerem 112 albo z bliską osobą, która dostaje SMS z adresem.",
    voice:
      "Przez całą wizytę senior ma pod ręką przycisk pomocy. Jedno dotknięcie łączy z numerem alarmowym albo z bliską osobą, która dostaje SMS z adresem.",
    steps: [
      { label: "Przycisk pomocy zawsze widoczny", actions: [{ kind: "point", target: "sos-open", ms: 1300 }] },
      { label: "112 albo bliska osoba", actions: [{ kind: "tap", target: "sos-open", after: 3400 }] },
      { label: "Powrót do wizyty", actions: [{ kind: "tap", target: "sos-back", after: 600 }] },
    ],
    hold: 800,
  },
  {
    id: "handoff",
    chapter: "safety",
    layout: "phone",
    preset: "dog_handoff",
    title: "Płatność dopiero po potwierdzeniu",
    lead: "Senior płaci, gdy potwierdzi, że usługa została wykonana. Potem ocenia pomocnika — oceny widzą kolejni klienci.",
    voice:
      "Płatność następuje dopiero wtedy, gdy senior potwierdzi wykonanie usługi. Potem ocenia pomocnika, a oceny widzą kolejni klienci.",
    steps: [
      { label: "Pies wraca do domu", actions: [{ kind: "wait", ms: 2400 }] },
      { label: "Senior potwierdza i dopiero płaci", actions: [{ kind: "tap", target: "handoff-confirm", after: 2600 }] },
    ],
    hold: 800,
  },
  {
    id: "pillars",
    chapter: "safety",
    layout: "full",
    title: "Osiem warstw bezpieczeństwa",
    voice:
      "Bezpieczeństwo to osiem warstw: weryfikacja tożsamości, zaświadczenie o niekaralności, jednorazowy kod, śledzenie na żywo, przycisk pomocy, płatność po potwierdzeniu, oceny i ubezpieczenie.",
    hold: 11000,
    Slide: PillarsSlide,
  },
  {
    id: "faq",
    chapter: "safety",
    layout: "full",
    title: "Najczęstsze wątpliwości",
    voice:
      "Odpowiadamy na najczęstsze wątpliwości seniorów i ich rodzin.",
    hold: 19000,
    Slide: FaqSlide,
  },
  {
    id: "a11y",
    chapter: "access",
    layout: "phone",
    preset: "home",
    title: "Zaprojektowane dla seniorów",
    lead: "Duże przyciski, jedna decyzja na ekranie i ustawienia, które działają od razu.",
    voice:
      "Aplikację projektujemy dla seniorów. Tekst powiększa się jednym przyciskiem, jest tryb wysokiego kontrastu, a komunikaty mogą być czytane na głos.",
    onEnter: ({ setPrefs }) => setPrefs({ textSize: "normal", highContrast: false }),
    steps: [
      {
        label: "Większy tekst — jednym przyciskiem",
        actions: [
          { kind: "tap", target: "text-size", after: 1300 },
          { kind: "tap", target: "text-size", after: 1600 },
          { kind: "tap", target: "text-size", after: 700 },
        ],
      },
      {
        label: "Wysoki kontrast",
        actions: [
          { kind: "tap", target: "nav-profil", after: 900 },
          { kind: "tap", target: "switch-contrast", after: 2200 },
          { kind: "tap", target: "switch-contrast", after: 600 },
        ],
      },
    ],
    hold: 1200,
    extra: (
      <FeatureChips
        items={[
          { icon: Type, label: "Trzy rozmiary tekstu" },
          { icon: Contrast, label: "Wysoki kontrast" },
          { icon: Volume2, label: "Czytanie na głos" },
        ]}
      />
    ),
  },
  {
    id: "helpers",
    chapter: "helpers",
    layout: "phone",
    role: "helper",
    title: "Pomocnicy z sąsiedztwa",
    lead: "Studenci, aktywni emeryci i sąsiedzi dorabiają elastycznie, blisko domu. Każdy przechodzi weryfikację, zanim przyjmie pierwsze zlecenie.",
    voice:
      "Po drugiej stronie są pomocnicy z sąsiedztwa: studenci, aktywni emeryci, sąsiedzi. Włączają aktywność, wybierają środek transportu i dostają zlecenia z najbliższej okolicy.",
    onEnter: ({ resetHelper }) => resetHelper(),
    steps: [
      { label: "Włącza aktywność", actions: [{ kind: "tap", target: "helper-start", after: 700 }] },
      {
        label: "Wybiera, jak się porusza",
        actions: [
          { kind: "tap", target: "helper-transport-bike", after: 500 },
          { kind: "tap", target: "helper-confirm", after: 500 },
        ],
      },
      { label: "Czeka na zlecenia w okolicy", actions: [{ kind: "wait", ms: 2800 }] },
    ],
    hold: 800,
    extra: (
      <FeatureChips
        items={[
          { icon: HandCoins, label: "100% stawki dla pomocnika" },
          { icon: Bike, label: "Zlecenia blisko domu" },
          { icon: BadgeCheck, label: "Weryfikacja przed startem" },
        ]}
      />
    ),
  },
  {
    id: "business",
    chapter: "business",
    layout: "full",
    title: "Jak zarabiamy",
    voice:
      "Model jest prosty. Zamawiający płaci stawkę pomocnika i dziesięć procent opłaty serwisowej. Pomocnik dostaje sto procent stawki. W kolejnym kroku dochodzi abonament dla rodzin i partnerstwa z gminami.",
    hold: 12000,
    Slide: BusinessSlide,
  },
  {
    id: "calculator",
    chapter: "business",
    layout: "full",
    title: "Policz sam",
    voice:
      "Jeśli zaledwie jeden procent krakowskich seniorów zamówi pomoc raz w tygodniu, to ponad dwieście sześćdziesiąt zleceń dziennie.",
    hold: 12000,
    Slide: CalculatorSlide,
  },
  {
    id: "market",
    chapter: "business",
    layout: "full",
    title: "Rynek i plan",
    voice:
      "Startujemy w Krakowie, potem kolejne duże miasta. Rynek to prawie dziesięć milionów seniorów w Polsce i ich rodziny.",
    hold: 10000,
    Slide: MarketSlide,
  },
  {
    id: "cta",
    chapter: "business",
    layout: "full",
    title: "Wypróbuj Helpovski",
    voice:
      "Helpovski. Spokój seniora i jego bliskich. Teraz Twoja kolej — wypróbuj aplikację.",
    hold: 6000,
    Slide: CtaSlide,
  },
];

export function estimateSceneMs(scene: Scene): number {
  let ms = 900;
  for (const step of scene.steps ?? []) {
    for (const action of step.actions) {
      if (action.kind === "wait") ms += action.ms;
      else if (action.kind === "tap") ms += 1450 + (action.after ?? 500);
      else if (action.kind === "point") ms += 1300 + (action.ms ?? 900);
      else ms += action.text.length * 85 + 400;
    }
  }
  return ms + scene.hold;
}
