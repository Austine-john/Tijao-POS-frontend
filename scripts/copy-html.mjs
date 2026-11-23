// After `vite build`: Frappe serves /pos from www/pos.html, so copy the built index.html there.
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, "../../backend/frappe-bench/apps/tijao_pos/tijao_pos");
const from = path.join(app, "public/frontend/index.html");
const to = path.join(app, "www/pos.html");
mkdirSync(path.dirname(to), { recursive: true });
copyFileSync(from, to);
console.log(`copied ${path.relative(process.cwd(), from)} -> ${path.relative(process.cwd(), to)}`);
