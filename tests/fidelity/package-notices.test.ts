import { execFileSync } from "node:child_process";
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

function expectedNotice(packageName: string): { contents: string; filename: string } {
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
