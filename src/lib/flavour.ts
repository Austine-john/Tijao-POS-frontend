// A colour per drink family, so the right tile can be spotted at a glance.
// Matched on words in the product name; anything unknown gets the brand blue.

const RULES: [RegExp, string][] = [
  [/coke zero|zero/i, "#1f2937"],
  [/coke|coca/i, "#e11d2e"],
  [/fanta.*passion|passion/i, "#a21caf"],
  [/fanta|orange/i, "#f97316"],
  [/sprite/i, "#16a34a"],
  [/krest|bitter lemon|lemon/i, "#ca8a04"],
  [/stoney|tangawizi|ginger/i, "#92400e"],
  [/blackcurr|black curr/i, "#6d28d9"],
  [/minute ?maid|juice|mango|apple|tropical/i, "#f59e0b"],
  [/predator|charge|steam|energy|monster|red bull/i, "#0f766e"],
  [/water|dasani|keringet|ital|oasis|aquamist/i, "#0ea5e9"],
  [/novida/i, "#65a30d"],
];

export function flavourColor(name: string): string {
  for (const [re, color] of RULES) if (re.test(name)) return color;
  return "#1d45b8";
}
