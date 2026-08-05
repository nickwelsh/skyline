import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "dist/licenses");
const packages = [
  "@tabler/icons-react",
  "@tailwindcss/forms",
  "@tailwindcss/typography",
  "@window-splitter/react",
  "@window-splitter/state",
  "framer-motion",
  "non.geist",
  "prism-react-renderer",
  "react",
  "react-dom",
  "tailwind-scrollbar",
  "tailwind-scrollbar-hide",
  "tailwindcss",
  "tw-animate-css",
];

mkdirSync(destination, { recursive: true });
cpSync(join(root, "THIRD_PARTY_NOTICES.md"), join(root, "dist/THIRD_PARTY_NOTICES.md"));
cpSync(join(root, "licenses/trigger.dev-APACHE-2.0.txt"), join(destination, "trigger.dev-APACHE-2.0.txt"));
cpSync(join(root, "licenses/geist-OFL-1.1.txt"), join(destination, "geist-OFL-1.1.txt"));

for (const packageName of packages) {
  const directory = join(root, "node_modules", packageName);
  const license = readdirSync(directory).find((file) => /^licen[cs]e/i.test(file) && statSync(join(directory, file)).isFile());
  const packageLabel = packageName.replaceAll("/", "-");
  if (license && existsSync(join(directory, license))) {
    const contents = readFileSync(join(directory, license), "utf8").replaceAll("\r\n", "\n");
    writeFileSync(join(destination, `${packageLabel}-${basename(license)}`), contents);
    continue;
  }

  cpSync(join(directory, "package.json"), join(destination, `${packageLabel}-package.json`));
}
