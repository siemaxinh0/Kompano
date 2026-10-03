import { readFileSync, writeFileSync } from "node:fs";

for (const file of process.argv.slice(2)) {
  let src = readFileSync(file, "utf8");
  const before = src;
  src = src.replace(
    /attribution=(?:'[^']*'|"[^"]*")(\s*)url="https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png"/g,
    "attribution={MAP_ATTRIBUTION}$1url={MAP_TILE_URL}",
  );
  src = src.replace(
    /import \{([^}]*)\} from "@\/components\/mapIcons";/,
    (_m, names) => {
      const list = names
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      for (const extra of ["MAP_ATTRIBUTION", "MAP_TILE_URL"]) {
        if (!list.includes(extra)) list.push(extra);
      }
      return `import {\n  ${list.join(",\n  ")},\n} from "@/components/mapIcons";`;
    },
  );
  if (src !== before) {
    writeFileSync(file, src);
    console.log(`updated ${file}`);
  }
}
