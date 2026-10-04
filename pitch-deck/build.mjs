/**
 * Buduje dwa decki Kompano jako PDF: pełny (10 slajdów) i pitch na 3 minuty (6 slajdów).
 *
 *   node pitch-deck/build.mjs              — zrzuty z aplikacji (localhost:3000) + PDF
 *   node pitch-deck/build.mjs --no-shots   — tylko PDF z zapisanych zrzutów
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as Lucide from "lucide-react";
import puppeteer from "puppeteer";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(ROOT, "assets");
const OUT = path.join(ROOT, "out");
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SKIP_SHOTS = process.argv.includes("--no-shots");
const BRAND = "Kompano";

const SHOTS = ["home", "checkout", "tracking", "pin", "helper"];

/* ------------------------------------------------------------------ */
/* helpery HTML                                                        */
/* ------------------------------------------------------------------ */

function icon(name, size = 32, strokeWidth = 2.25) {
  const Cmp = Lucide[name];
  if (!Cmp) throw new Error(`Brak ikony lucide: ${name}`);
  return renderToStaticMarkup(createElement(Cmp, { size, strokeWidth }));
}

function brandMark(size) {
  return `<span class="brand-mark" style="width:${size}px;height:${size}px">${icon(
    "HeartHandshake",
    Math.round(size * 0.58),
    2.2,
  )}</span>`;
}

function phone(shot, variant = "") {
  return `<div class="phone ${variant}"><img src="../assets/${shot}.png" alt="" /></div>`;
}

function foot(index, total) {
  return `<div class="foot"><span class="foot-brand">${brandMark(36)} ${BRAND}</span><span>${index} / ${total}</span></div>`;
}

function iconRow(iconName, title, tone = "") {
  return `<div class="icon-row"><span class="icon-badge ${tone}">${icon(iconName, 38)}</span><span class="icon-row-text">${title}</span></div>`;
}

function step(n, title) {
  return `<div class="step"><span class="step-num">${n}</span><span class="step-text">${title}</span></div>`;
}

function stat(value, label) {
  return `<div class="card"><div class="stat-value">${value}</div><p class="stat-label">${label}</p></div>`;
}

const SERVICES = [
  { tone: "tone-dog", icon: "Dog", title: "Spacer z psem", price: "od 20 zł" },
  { tone: "tone-home", icon: "House", title: "Pomoc w domu", price: "od 35 zł" },
  { tone: "tone-shop", icon: "ShoppingBag", title: "Zakupy", price: "od 40 zł" },
];

function serviceList() {
  return `<div class="icon-list icon-list--lg">${SERVICES.map((s) =>
    iconRow(s.icon, `${s.title} <span class="price">${s.price}</span>`, s.tone),
  ).join("")}</div>`;
}

const MARKS = {
  yes: () => `<span class="mark mark--yes">${icon("Check", 28, 3)}</span>`,
  no: () => `<span class="mark mark--no">${icon("X", 28, 3)}</span>`,
  partial: () => `<span class="mark mark--partial">${icon("Minus", 28, 3)}</span>`,
};

function compareTable() {
  const cols = ["Od ręki", "Sprawdzone", "Jasna cena"];
  const rows = [
    { label: "Rodzina", values: ["partial", "yes", "yes"] },
    { label: "Ogłoszenie", values: ["partial", "no", "no"] },
    { label: "Instytucje", values: ["no", "yes", "partial"] },
    { label: BRAND, values: ["yes", "yes", "yes"], hl: true },
  ];
  const head = `<div class="head"></div>${cols.map((c) => `<div class="head">${c}</div>`).join("")}`;
  const body = rows
    .map((r) => {
      const hl = r.hl ? " hl" : "";
      const label = r.hl
        ? `<span style="display:flex;align-items:center;gap:16px">${brandMark(48)} ${BRAND}</span>`
        : r.label;
      return `<div class="row-label${hl}">${label}</div>${r.values
        .map((v) => `<div class="cell${hl}">${MARKS[v]()}</div>`)
        .join("")}`;
    })
    .join("");
  return `<div class="compare center-block">${head}${body}</div>`;
}

function roadmap() {
  const steps = [
    { tag: "Teraz", title: "Pilotaż", now: true },
    { tag: "Następnie", title: "Kolejne miasta" },
    { tag: "Potem", title: "Rodziny i gminy" },
  ];
  return `<div class="road">${steps
    .map(
      (s) =>
        `<div class="road-step${s.now ? " road-step--now" : ""}"><p class="road-tag">${s.tag}</p><p class="road-title">${s.title}</p></div>`,
    )
    .join("")}</div>`;
}

/* ------------------------------------------------------------------ */
/* pełna prezentacja — 10 slajdów                                       */
/* ------------------------------------------------------------------ */

const FULL = [
  () => `<section class="slide bg-emerald">
    <div class="split">
      <div class="split-copy">
        <span class="eyebrow">${brandMark(56)} ${BRAND}</span>
        <h1>Pomoc na wyciągnięcie ręki</h1>
        <p class="lead">Pomocnicy z sąsiedztwa, zweryfikowani w mObywatelu.</p>
      </div>
      ${phone("home")}
    </div>
  </section>`,

  () => `<section class="slide bg-cream">
    <span class="eyebrow">Problem</span>
    <h2>Polska się starzeje</h2>
    <div class="grid-3 center-block">
      ${stat("10 mln", "osób po sześćdziesiątce")}
      ${stat("1,5 mln", "seniorów mieszka samotnie")}
      ${stat("180 tys.", "seniorów w Krakowie")}
    </div>
  </section>`,

  () => `<section class="slide bg-white">
    <span class="eyebrow">Dla kogo</span>
    <h2>Poznaj panią Helenę</h2>
    <div class="split" style="grid-template-columns:auto 1fr;gap:88px">
      <div class="persona-card">
        <div class="persona-avatar">H</div>
        <p class="persona-name">Helena, 78 lat</p>
      </div>
      <div>
        <div class="icon-list icon-list--lg" style="margin-top:0">
          ${iconRow("Dog", "Mieszka sama z psem")}
          ${iconRow("ShoppingBag", "Zakupy na trzecie piętro")}
          ${iconRow("ShieldAlert", "Boi się obcych w domu")}
        </div>
        <p class="quote">Bez zaufania nie ma zamówienia.</p>
      </div>
    </div>
  </section>`,

  () => `<section class="slide bg-cream">
    <span class="eyebrow">Alternatywy</span>
    <h2>Dziś nie ma dobrego wyboru</h2>
    ${compareTable()}
  </section>`,

  () => `<section class="slide bg-cream">
    <div class="split">
      <div class="split-copy">
        <span class="eyebrow">Rozwiązanie</span>
        <h2>Trzy sprawy. Jeden ekran.</h2>
        ${serviceList()}
      </div>
      ${phone("home")}
    </div>
  </section>`,

  () => `<section class="slide bg-white">
    <div class="split">
      <div class="split-copy">
        <span class="eyebrow">Zamówienie</span>
        <h2>Gotowe w minutę</h2>
        <div class="steps">
          ${step(1, "Wybierz usługę i czas")}
          ${step(2, "Ustal cenę")}
          ${step(3, "Pomocnik jest w drodze")}
        </div>
      </div>
      ${phone("checkout")}
    </div>
  </section>`,

  () => `<section class="slide bg-cream">
    <div class="split">
      <div class="split-copy">
        <span class="eyebrow">Bezpieczeństwo</span>
        <h2>Każdy pomocnik sprawdzony w&nbsp;mObywatelu</h2>
        <p class="lead">Senior wie, kto stoi za drzwiami.</p>
        <div class="icon-list icon-list--lg">
          ${iconRow("MapPin", "Podgląd na mapie")}
          ${iconRow("KeyRound", "Kod przy drzwiach")}
          ${iconRow("Siren", "Przycisk pomocy")}
        </div>
      </div>
      <div class="phones">${phone("tracking", "phone--md")}${phone("pin", "phone--md")}</div>
    </div>
  </section>`,

  () => `<section class="slide bg-white">
    <div class="split">
      <div class="split-copy">
        <span class="eyebrow">Dwie strony rynku</span>
        <h2>Zyskują obie strony</h2>
        <div class="grid-2 mt-48">
          <div class="card">
            <p class="card-title">Senior</p>
            <div class="icon-list" style="margin-top:32px">
              ${iconRow("Type", "Prosta obsługa")}
              ${iconRow("HeartHandshake", "Spokój rodziny")}
            </div>
          </div>
          <div class="card">
            <p class="card-title">Pomocnik</p>
            <div class="icon-list" style="margin-top:32px">
              ${iconRow("Bike", "Praca blisko domu")}
              ${iconRow("HandCoins", "100% stawki")}
            </div>
          </div>
        </div>
      </div>
      ${phone("helper")}
    </div>
  </section>`,

  () => `<section class="slide bg-cream">
    <span class="eyebrow">Model biznesowy</span>
    <h2>Jak zarabiamy</h2>
    <div class="grid-2 center-block">
      <div class="card">
        <div class="big-number">10%</div>
        <p class="card-text">od każdego zlecenia</p>
      </div>
      <div class="card card--emerald">
        <div class="big-number big-number--money">~75 tys. zł</div>
        <p class="card-text">przychodu miesięcznie przy 500&nbsp;zleceniach dziennie po&nbsp;ok.&nbsp;50&nbsp;zł</p>
      </div>
    </div>
  </section>`,

  () => `<section class="slide bg-emerald">
    <span class="eyebrow">Plan</span>
    <h2>Start w Krakowie</h2>
    ${roadmap()}
  </section>`,
];

/* ------------------------------------------------------------------ */
/* pitch na 3 minuty — 6 slajdów                                        */
/* ------------------------------------------------------------------ */

const PITCH = [
  () => `<section class="slide bg-emerald">
    <div class="split">
      <div class="split-copy">
        <span class="eyebrow">${brandMark(56)} ${BRAND}</span>
        <h1>Pomoc dla seniora w&nbsp;minutę</h1>
        <p class="lead">Sąsiedzi zweryfikowani w mObywatelu.</p>
      </div>
      ${phone("home")}
    </div>
  </section>`,

  () => `<section class="slide bg-cream">
    <span class="eyebrow">Problem</span>
    <h2>Bez zaufania nie ma pomocy</h2>
    <div class="grid-2 center-block" style="align-items:stretch">
      ${stat("1,5 mln", "seniorów mieszka samotnie")}
      <div class="card card--emerald" style="display:flex;align-items:center">
        <p class="big-quote">Nieznajomemu nikt nie otworzy drzwi.</p>
      </div>
    </div>
  </section>`,

  () => `<section class="slide bg-white">
    <span class="eyebrow">Produkt</span>
    <h2>Minuta do pomocnika</h2>
    <div class="phones center-block" style="justify-content:space-between">
      <div class="phone-col">${phone("home", "phone--sm")}<p class="phone-caption"><span class="step-num">1</span>Wybierz</p></div>
      <div class="phone-col">${phone("checkout", "phone--sm")}<p class="phone-caption"><span class="step-num">2</span>Ustal cenę</p></div>
      <div class="phone-col">${phone("tracking", "phone--sm")}<p class="phone-caption"><span class="step-num">3</span>Śledź dojazd</p></div>
      <div class="phone-col">${phone("pin", "phone--sm")}<p class="phone-caption"><span class="step-num">4</span>Otwórz z kodem</p></div>
    </div>
  </section>`,

  () => `<section class="slide bg-cream">
    <div class="split">
      <div class="split-copy">
        <span class="eyebrow">Przewaga</span>
        <h2>Każdy pomocnik sprawdzony w&nbsp;mObywatelu</h2>
        <p class="lead">Dlatego senior bezpiecznie otwiera drzwi.</p>
        <div class="icon-list icon-list--lg">
          ${iconRow("KeyRound", "Kod przy drzwiach")}
          ${iconRow("Siren", "Przycisk pomocy")}
        </div>
      </div>
      ${phone("pin")}
    </div>
  </section>`,

  () => `<section class="slide bg-white">
    <span class="eyebrow">Biznes</span>
    <h2>Jak zarabiamy</h2>
    <div class="grid-2 center-block">
      <div class="card">
        <div class="big-number">10%</div>
        <p class="card-text">od każdego zlecenia</p>
      </div>
      <div class="card card--emerald">
        <div class="big-number big-number--money">~75 tys. zł</div>
        <p class="card-text">przychodu miesięcznie przy 500&nbsp;zleceniach dziennie po&nbsp;ok.&nbsp;50&nbsp;zł</p>
      </div>
    </div>
  </section>`,

  () => `<section class="slide bg-emerald">
    <span class="eyebrow">${brandMark(56)} ${BRAND}</span>
    <h1 class="center-block" style="font-size:150px">Zacznijmy<br />w Krakowie</h1>
  </section>`,
];

/* ------------------------------------------------------------------ */
/* zrzuty ekranu z aplikacji                                           */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, text, selector = "button") {
  await page.waitForFunction(
    (sel, t) => [...document.querySelectorAll(sel)].some((el) => el.innerText.includes(t)),
    { timeout: 20_000 },
    selector,
    text,
  );
  await page.evaluate(
    (sel, t) => [...document.querySelectorAll(sel)].find((el) => el.innerText.includes(t)).click(),
    selector,
    text,
  );
}

async function waitForText(page, text, timeout = 20_000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

async function runFlow(page, shot) {
  await page.goto(APP_URL, { waitUntil: "networkidle2", timeout: 60_000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await waitForText(page, "Jak możemy Ci pomóc?");

  // adres pomocy: pin na mapie + nr mieszkania
  await clickByText(page, "Wpisz miejsce pomocy");
  await clickByText(page, "Zaznacz na mapie");
  await page.waitForSelector('footer input[type="text"]');
  await page
    .waitForFunction(() => !document.querySelector("footer p")?.innerText.includes("Odczytuję"), { timeout: 10_000 })
    .catch(() => {});
  await page.type('footer input[type="text"]', "12");
  await clickByText(page, "Potwierdź lokalizację");
  await waitForText(page, "Wybierz rodzaj pomocy");
  await shot("home");

  // zamówienie spaceru
  await clickByText(page, "Wyprowadzenie psa");
  await clickByText(page, "30 min");
  await page.type('input[placeholder^="np. labrador"]', "Labrador");
  await clickByText(page, "Średni");
  await page.evaluate(() => document.querySelector("main")?.scrollTo(0, 0));
  await shot("checkout");

  // wyszukiwanie → dojazd pomocnika
  await clickByText(page, "Szukaj pomocnika");
  await waitForText(page, "Pomocnik już na miejscu", 30_000);
  await page
    .waitForFunction(() => !document.body.innerText.includes("Łączę z lokalizacją"), { timeout: 20_000 })
    .catch(() => {});
  await sleep(4000);
  await shot("tracking");

  // kod przy drzwiach
  await clickByText(page, "Pomocnik już na miejscu");
  await sleep(1200);
  await shot("pin");

  // aplikacja pomocnika
  await page.keyboard.down("Control");
  await page.keyboard.down("Alt");
  await page.keyboard.press("h");
  await page.keyboard.up("Alt");
  await page.keyboard.up("Control");
  await clickByText(page, "Rozpocznij aktywność");
  await clickByText(page, "Rower");
  await shot("helper");
}

async function captureShots(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const shot = async (name) => {
    await sleep(600);
    await page.screenshot({ path: path.join(ASSETS, `${name}.png`) });
    console.log(`  ✓ ${name}.png`);
  };
  try {
    await runFlow(page, shot);
  } catch (err) {
    await page.screenshot({ path: path.join(ASSETS, "_debug.png") });
    throw err;
  } finally {
    await page.close();
  }
}

/* ------------------------------------------------------------------ */
/* budowanie PDF                                                       */
/* ------------------------------------------------------------------ */

async function renderDeck(browser, { slides, title, file }) {
  const css = await fs.readFile(path.join(ROOT, "styles.css"), "utf8");
  const total = slides.length;
  const body = slides
    .map((slide, i) => slide().replace(/<\/section>\s*$/, `${foot(i + 1, total)}</section>`))
    .join("\n");
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;

  const htmlPath = path.join(OUT, `${file}.html`);
  await fs.writeFile(htmlPath, html, "utf8");

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  const pdfPath = path.join(OUT, `${file}.pdf`);
  await page.pdf({ path: pdfPath, width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true });
  await page.close();
  console.log(`  ✓ ${path.relative(process.cwd(), pdfPath)} (${total} slajdów)`);
}

await fs.mkdir(ASSETS, { recursive: true });
await fs.mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: true });
try {
  if (SKIP_SHOTS) {
    console.log("Pomijam zrzuty — używam zapisanych w pitch-deck/assets.");
  } else {
    console.log(`Zrzuty ekranu z ${APP_URL}…`);
    await captureShots(browser);
  }

  for (const name of SHOTS) {
    await fs.access(path.join(ASSETS, `${name}.png`)).catch(() => {
      throw new Error(`Brak zrzutu assets/${name}.png — uruchom aplikację (npm run dev) i zbuduj bez --no-shots.`);
    });
  }

  console.log("PDF…");
  await renderDeck(browser, { slides: FULL, title: `${BRAND} — prezentacja`, file: `${BRAND}-prezentacja` });
  await renderDeck(browser, { slides: PITCH, title: `${BRAND} — pitch 3 min`, file: `${BRAND}-pitch-3min` });
} finally {
  await browser.close();
}
