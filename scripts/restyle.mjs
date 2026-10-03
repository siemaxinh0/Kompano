import { readFileSync, writeFileSync } from "node:fs";

const files = process.argv.slice(2);

for (const file of files) {
  let src = readFileSync(file, "utf8");
  const before = src;

  src = src.replace(
    /rounded-2xl border border-neutral-200 bg-white (p-\d) shadow-sm/g,
    "card $1",
  );
  src = src.replace(
    /rounded-2xl border border-neutral-200 bg-white (p-\d) text-left shadow-sm/g,
    "card $1 text-left",
  );

  src = src.replace(
    /mt-2 w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-xl font-bold outline-none ring-emerald-600 focus:ring-2/g,
    "field resize-none",
  );

  src = src.replace(/bg-emerald-600(?![\d/])/g, "bg-emerald-700");

  src = src.replace(/(["`])([^"`\n]*)\1/g, (match, quote, body) => {
    if (!/\bfont-bold\b/.test(body)) return match;
    if (!/\btext-neutral-(400|500|600)\b/.test(body)) return match;
    return quote + body.replace(/\bfont-bold\b/g, "font-semibold") + quote;
  });

  if (src !== before) {
    writeFileSync(file, src);
    console.log(`updated ${file}`);
  }
}
