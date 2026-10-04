# Kompano

Aplikacja łącząca seniorów ze sprawdzonymi pomocnikami z okolicy (spacer z psem, pomoc w domu, zakupy). Next.js 16, React 19, Tailwind 4, Leaflet.

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja działa pod [http://localhost:3000](http://localhost:3000). `Ctrl+Alt+H` przełącza widok klienta i pomocnika.

## Deploy na Vercel

Projekt importuje się jako zwykły projekt Next.js — bez dodatkowych ustawień. Plik `.vercelignore` wyklucza z deployu prezentacje (`pitch-deck/`, `components/pitch/`), materiały marki (`brand/`) i skrypty (`scripts/`).

## Prezentacje

Prezentacje PDF generuje `pitch-deck/build.mjs` (zrzuty z działającej aplikacji + Puppeteer). Puppeteer jest instalowany osobno, żeby nie trafiał do aplikacji:

```bash
npm install --prefix pitch-deck
npm run dev            # w osobnym terminalu
npm run deck           # zrzuty + PDF do pitch-deck/out/
```
