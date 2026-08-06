import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const licensesDirectory = join(root, "dist/licenses");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};
const vendoredNotices: Record<string, { filename: string; sha256: string; source: string }> = {
  "@heroicons/react": {
    filename: "@heroicons-react-LICENSE.txt",
    sha256: "75523ddd65d9620bea09f84e89d0c373b4205a3708b8a1e9f9598a5438a3e641",
    source: "licenses/npm/heroicons-MIT.txt",
  },
  "@radix-ui/react-dialog": {
    filename: "@radix-ui-react-dialog-LICENSE.txt",
    sha256: "0e80a2d229d2fd4fc7e8636142ec5d0ff0bc031f14c15b682e2ac01dfd5b5138",
    source: "licenses/npm/radix-ui-MIT.txt",
  },
  "@radix-ui/react-popover": {
    filename: "@radix-ui-react-popover-LICENSE.txt",
    sha256: "0e80a2d229d2fd4fc7e8636142ec5d0ff0bc031f14c15b682e2ac01dfd5b5138",
    source: "licenses/npm/radix-ui-MIT.txt",
  },
  "@radix-ui/react-slider": {
    filename: "@radix-ui-react-slider-LICENSE.txt",
    sha256: "0e80a2d229d2fd4fc7e8636142ec5d0ff0bc031f14c15b682e2ac01dfd5b5138",
    source: "licenses/npm/radix-ui-MIT.txt",
  },
  "@radix-ui/react-switch": {
    filename: "@radix-ui-react-switch-LICENSE.txt",
    sha256: "0e80a2d229d2fd4fc7e8636142ec5d0ff0bc031f14c15b682e2ac01dfd5b5138",
    source: "licenses/npm/radix-ui-MIT.txt",
  },
  "@radix-ui/react-tooltip": {
    filename: "@radix-ui-react-tooltip-LICENSE.txt",
    sha256: "0e80a2d229d2fd4fc7e8636142ec5d0ff0bc031f14c15b682e2ac01dfd5b5138",
    source: "licenses/npm/radix-ui-MIT.txt",
  },
  "assert-never": {
    filename: "assert-never-LICENSE.txt",
    sha256: "8ab0faa64c7fd3fbd09fa303eccfa727e1d9343ca923737cc187c64ab5c95d4f",
    source: "licenses/npm/assert-never-MIT.txt",
  },
  "non.geist": {
    filename: "non.geist-LICENSE.txt",
    sha256: "841b43f4fd312e0dbe6ccc4573948abf5a02d5db388b15aac0cdee317f18ffde",
    source: "licenses/npm/non.geist-MIT.txt",
  },
};

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function expectedNotice(packageName: string): { contents: string; filename: string } {
  const vendored = vendoredNotices[packageName];

  if (vendored) {
    const contents = readFileSync(join(root, vendored.source), "utf8");

    expect(sha256(contents), packageName).toBe(vendored.sha256);

    return { contents, filename: vendored.filename };
  }

  const directory = join(root, "node_modules", packageName);
  const license = readdirSync(directory)
    .sort()
    .find((file) => /^licen[cs]e/i.test(file) && statSync(join(directory, file)).isFile());
  const packageLabel = packageName.replaceAll("/", "-");

  if (license) {
    return {
      contents: readFileSync(join(directory, license), "utf8").replaceAll("\r\n", "\n"),
      filename: `${packageLabel}-${basename(license)}`,
    };
  }

  return {
    contents: readFileSync(join(directory, "package.json"), "utf8"),
    filename: `${packageLabel}-package.json`,
  };
}

function generateNotices(): void {
  execFileSync(process.execPath, [join(root, "scripts/package-notices.mjs")], { cwd: root });
}

describe("package notices", () => {
  test("copies exact notices for every direct runtime dependency", () => {
    generateNotices();

    for (const packageName of Object.keys(packageJson.dependencies)) {
      const expected = expectedNotice(packageName);
      const destination = join(licensesDirectory, expected.filename);

      expect(existsSync(destination), packageName).toBe(true);
      expect(readFileSync(destination, "utf8"), packageName).toBe(expected.contents);
    }
  });

  test("ships license text instead of package metadata", () => {
    generateNotices();

    expect(readdirSync(licensesDirectory).filter((file) => file.endsWith("package.json"))).toEqual([]);
  });

  test("generates byte-identical notices repeatedly", () => {
    generateNotices();
    const first = Object.fromEntries(
      readdirSync(licensesDirectory)
        .sort()
        .map((file) => [file, readFileSync(join(licensesDirectory, file), "utf8")]),
    );

    generateNotices();
    const second = Object.fromEntries(
      readdirSync(licensesDirectory)
        .sort()
        .map((file) => [file, readFileSync(join(licensesDirectory, file), "utf8")]),
    );

    expect(second).toEqual(first);
  });

  test("documents every direct runtime dependency", () => {
    const notices = readFileSync(join(root, "THIRD_PARTY_NOTICES.md"), "utf8");

    for (const packageName of Object.keys(packageJson.dependencies)) {
      expect(notices, packageName).toContain(`\`${packageName}\``);
    }
  });

  test("removes stale generated license files", () => {
    const staleLicense = join(licensesDirectory, "stale-license.txt");

    try {
      writeFileSync(staleLicense, "stale\n");
      generateNotices();

      expect(existsSync(staleLicense)).toBe(false);
    } finally {
      rmSync(staleLicense, { force: true });
    }
  });
});
