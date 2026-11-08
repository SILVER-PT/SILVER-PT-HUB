// Unit check of parseItem regexes extracted verbatim from src/nutrition.tsx
const fs = require("fs");
const src = fs.readFileSync("/app/frontend/src/nutrition.tsx", "utf8");
const start = src.indexOf("const parseItem = (s: string) => {");
const end = src.indexOf("\n  };", start) + 5;
const body = src.slice(start, end).replace("(s: string)", "(s)");
const num = (x) => parseFloat(x) || 0;
const parseItem = eval("(() => { " + body + " return parseItem; })()");
const cases = [
  ["dischi di riso 30g", "dischi di riso", 30],
  ["Diet coke 330ml", "Diet coke", 330],
  ["100g d’orzo", "orzo", 100],
  ["100g d'orzo", "orzo", 100],
  ["80g di avena", "avena", 80],
  ["avena 80 g", "avena", 80],
  ["Di pollo 150 gr", "pollo", 150],
  ["dolci 20g", "dolci", 20],
];
let fail = 0;
for (const [inp, n, g] of cases) {
  const r = parseItem(inp);
  const ok = r.name === n && r.grams === g;
  if (!ok) fail++;
  console.log(ok ? "PASS" : "FAIL", JSON.stringify(inp), "->", JSON.stringify(r));
}
process.exit(fail ? 1 : 0);
