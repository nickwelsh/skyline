import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "dist/licenses");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const packages = Object.keys(packageJson.dependencies).sort();
const vendoredLicenses = {
  "@heroicons/react": "licenses/npm/heroicons-MIT.txt",
  "@radix-ui/react-dialog": "licenses/npm/radix-ui-MIT.txt",
  "@radix-ui/react-popover": "licenses/npm/radix-ui-MIT.txt",
  "@radix-ui/react-slider": "licenses/npm/radix-ui-MIT.txt",
  "@radix-ui/react-switch": "licenses/npm/radix-ui-MIT.txt",
  "@radix-ui/react-tooltip": "licenses/npm/radix-ui-MIT.txt",
  "assert-never": "licenses/npm/assert-never-MIT.txt",
  "non.geist": "licenses/npm/non.geist-MIT.txt",
};

rmSync(destination, { force: true, recursive: true });
mkdirSync(destination, { recursive: true });
cpSync(join(root, "THIRD_PARTY_NOTICES.md"), join(root, "dist/THIRD_PARTY_NOTICES.md"));
cpSync(join(root, "licenses/trigger.dev-APACHE-2.0.txt"), join(destination, "trigger.dev-APACHE-2.0.txt"));
cpSync(join(root, "licenses/geist-OFL-1.1.txt"), join(destination, "geist-OFL-1.1.txt"));

for (const packageName of packages) {
  const directory = join(root, "node_modules", packageName);
  const packageLabel = packageName.replaceAll("/", "-");
  const vendoredLicense = vendoredLicenses[packageName];

  if (vendoredLicense) {
    cpSync(join(root, vendoredLicense), join(destination, `${packageLabel}-LICENSE.txt`));
    continue;
  }

  const license = readdirSync(directory)
    .sort()
    .find((file) => /^licen[cs]e/i.test(file) && statSync(join(directory, file)).isFile());
  if (license && existsSync(join(directory, license))) {
    const contents = readFileSync(join(directory, license), "utf8").replaceAll("\r\n", "\n");
    writeFileSync(join(destination, `${packageLabel}-${basename(license)}`), contents);
    continue;
  }

  cpSync(join(directory, "package.json"), join(destination, `${packageLabel}-package.json`));
}
