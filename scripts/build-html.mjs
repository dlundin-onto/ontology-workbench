import { copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const src = join(distDir, "index.html");
const dest = join(distDir, "ontology-workbench.html");

copyFileSync(src, dest);
console.log(`Built single-file HTML: dist/ontology-workbench.html`);
