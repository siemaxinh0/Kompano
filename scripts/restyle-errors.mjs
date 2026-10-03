import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
let src = readFileSync(file, "utf8");
let count = 0;
src = src.replace(
  /<p className="mt-[12] text-lg font-bold text-red-600">\s*([^<{]+?)\s*<\/p>/g,
  (_m, text) => {
    count++;
    return `<FieldError>${text}</FieldError>`;
  },
);
writeFileSync(file, src);
console.log(`replaced ${count}`);
