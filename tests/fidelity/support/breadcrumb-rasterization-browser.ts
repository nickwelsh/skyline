import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import { PNG } from "pngjs";
import policyJson from "../breadcrumb-rasterization-policy.json" with { type: "json" };
import {
  breadcrumbRasterizationRegion,
  validateBreadcrumbRasterizationObservation,
  validateBreadcrumbRasterizationPolicy,
  type BreadcrumbElementEvidence,
  type BreadcrumbRasterizationObservation,
  type BreadcrumbRasterizationPolicy,
  type BreadcrumbSideEvidence,
} from "./breadcrumb-rasterization";
import { captureProtectedElementCrop, fingerprintCapabilityAccessibility, observeElementDom, observeRendererDetailsInPage, requireSingleMatch } from "./difference-regions";
import { captureExactStableObservation } from "./exact-observation";

export const breadcrumbRasterizationPolicy = validateBreadcrumbRasterizationPolicy(policyJson as unknown as BreadcrumbRasterizationPolicy);

export function isBreadcrumbRasterizationCapture(capture: string) {
  return capture in breadcrumbRasterizationPolicy.captures || breadcrumbRasterizationPolicy.absentCaptures.includes(capture);
}

export async function observeBreadcrumbRasterization(
  trigger: Page,
  skyline: Page,
  capture: string,
  triggerScreenshot: Buffer,
  skylineScreenshot: Buffer,
) {
  if (!isBreadcrumbRasterizationCapture(capture)) throw new Error(`Breadcrumb renderer does not permit unknown capture ${capture}.`);
  const snapshot = await observeSnapshot(trigger, skyline);
  return resolveObservation(capture, snapshot, triggerScreenshot, skylineScreenshot);
}

type ScreenshotPair = { triggerScreenshot: Buffer; skylineScreenshot: Buffer };

export async function captureStableBreadcrumbRasterization(
  trigger: Page,
  skyline: Page,
  capture: string,
  captureScreenshots: () => Promise<ScreenshotPair> = () => capturePairScreenshots(trigger, skyline),
) {
  if (!isBreadcrumbRasterizationCapture(capture)) throw new Error(`Breadcrumb renderer does not permit unknown capture ${capture}.`);
  let accepted = false;
  let acceptedRegion: ReturnType<typeof resolveObservation>;
  const { observation, artifact } = await captureExactStableObservation({
    label: `Breadcrumb renderer ${capture}`,
    read: () => observeSnapshot(trigger, skyline),
    capture: captureScreenshots,
    accept: (snapshot, screenshots) => {
      try {
        acceptedRegion = resolveObservation(capture, snapshot, screenshots.triggerScreenshot, screenshots.skylineScreenshot);
        accepted = true;
        return true;
      } catch (error) {
        if (error instanceof Error && /changed (finite state|exact capture) evidence/.test(error.message)) return false;
        throw error;
      }
    },
    advance: () => advanceFrame(trigger, skyline),
  });
  if (!accepted) throw new Error(`Breadcrumb renderer ${capture} did not capture approved exact evidence.`);
  return {
    region: acceptedRegion,
    ...artifact,
  };
}

async function capturePairScreenshots(trigger: Page, skyline: Page): Promise<ScreenshotPair> {
  const [triggerScreenshot, skylineScreenshot] = await Promise.all([
    trigger.screenshot({ animations: "disabled", caret: "hide" }),
    skyline.screenshot({ animations: "disabled", caret: "hide" }),
  ]);
  return { triggerScreenshot, skylineScreenshot };
}

async function observeSnapshot(trigger: Page, skyline: Page) {
  const [triggerSide, skylineSide, triggerRuntime, skylineRuntime, triggerViewport, skylineViewport] = await Promise.all([
    observeSide(trigger, "trigger"),
    observeSide(skyline, "skyline"),
    runtimeFor(trigger),
    runtimeFor(skyline),
    viewportFor(trigger),
    viewportFor(skyline),
  ]);
  if (JSON.stringify(triggerRuntime) !== JSON.stringify(skylineRuntime)) throw new Error("Breadcrumb renderer changed cross-side runtime evidence.");
  if (JSON.stringify(triggerViewport) !== JSON.stringify(skylineViewport)) throw new Error("Breadcrumb renderer changed cross-side viewport evidence.");
  return { trigger: triggerSide, skyline: skylineSide, runtime: triggerRuntime, viewport: triggerViewport };
}

function resolveObservation(capture: string, snapshot: Awaited<ReturnType<typeof observeSnapshot>>, triggerScreenshot: Buffer, skylineScreenshot: Buffer) {
  const triggerSide = addCrops(snapshot.trigger, triggerScreenshot, snapshot.viewport, "trigger");
  const skylineSide = addCrops(snapshot.skyline, skylineScreenshot, snapshot.viewport, "skyline");
  const observation: BreadcrumbRasterizationObservation = {
    runtime: snapshot.runtime,
    viewport: snapshot.viewport,
    trigger: triggerSide,
    skyline: skylineSide,
    pixels: triggerSide && skylineSide ? exactDeltas(triggerScreenshot, skylineScreenshot, triggerSide.svg.rect) : [],
  };
  validateBreadcrumbRasterizationObservation(breadcrumbRasterizationPolicy, capture, observation);
  return breadcrumbRasterizationRegion(breadcrumbRasterizationPolicy, capture, observation);
}

type BreadcrumbElementSnapshot = Omit<BreadcrumbElementEvidence, "cropSha256">;
type BreadcrumbSideSnapshot = { svg: BreadcrumbElementSnapshot; line: BreadcrumbElementSnapshot };

async function observeSide(page: Page, application: "trigger" | "skyline"): Promise<BreadcrumbSideSnapshot | null> {
  const { svg, line } = breadcrumbRasterizationPolicy.selectors;
  const [svgCount, lineCount] = await Promise.all([page.locator(svg).count(), page.locator(line).count()]);
  if (svgCount === 0 && lineCount === 0) return null;
  requireSingleMatch(svgCount, "run-breadcrumb-rasterization", `${application} breadcrumb SVG`);
  requireSingleMatch(lineCount, "run-breadcrumb-rasterization", `${application} breadcrumb line`);
  const [svgEvidence, lineEvidence] = await Promise.all([
    observeElement(page, application, "svg", svg),
    observeElement(page, application, "line", line),
  ]);
  return { svg: svgEvidence, line: lineEvidence };
}

async function observeElement(page: Page, application: "trigger" | "skyline", elementType: "svg" | "line", selector: string): Promise<BreadcrumbElementSnapshot> {
  const label = `${application} breadcrumb ${elementType}`;
  const dom = await observeElementDom(page, "run-breadcrumb-rasterization", selector, label);
  const [accessibilitySha256, details, outerHtml, paint, quads] = await Promise.all([
    fingerprintCapabilityAccessibility(page.locator(selector)),
    page.evaluate(observeRendererDetailsInPage, { target: selector }),
    page.locator(selector).evaluate((element) => element.outerHTML),
    page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element);
      return { currentColor: style.color, stroke: style.stroke, strokeWidth: style.strokeWidth, strokeLinecap: style.strokeLinecap };
    }),
    contentQuads(page, selector),
  ]);
  requireSingleMatch(details.count, "run-breadcrumb-rasterization", `${label} renderer details`);
  if (!details.observation) throw new Error(`Breadcrumb renderer lacks ${label} details.`);
  return {
    rect: dom.rect,
    canonicalDomSha256: digest(details.observation.canonicalDom),
    semanticDomSha256: digest(details.observation.semanticDom),
    accessibilitySha256,
    computedStyleSha256: dom.computedStyleSha256,
    effectiveCssSha256: digest(details.observation.effectiveMatchingRules),
    quadsSha256: digest(quads),
    backdropSha256: digest(details.observation.backdrop),
    paint,
    outerHtmlSha256: digest(outerHtml),
    matchingRulesSha256: digest(details.observation.matchingRules),
  };
}

function addCrops(side: BreadcrumbSideSnapshot | null, screenshot: Buffer, viewport: { width: number; height: number }, application: "trigger" | "skyline"): BreadcrumbSideEvidence | null {
  if (!side) return null;
  const addCrop = (element: BreadcrumbElementSnapshot, elementType: "svg" | "line"): BreadcrumbElementEvidence => {
    const crop = captureProtectedElementCrop(screenshot, viewport, element.rect);
    if (crop.status !== "visible") throw new Error(`Breadcrumb renderer ${application} breadcrumb ${elementType} is outside the viewport.`);
    return { ...element, cropSha256: crop.screenshotSha256 };
  };
  return { svg: addCrop(side.svg, "svg"), line: addCrop(side.line, "line") };
}

async function advanceFrame(trigger: Page, skyline: Page) {
  await Promise.all([
    trigger.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))),
    skyline.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))),
  ]);
}

async function contentQuads(page: Page, selector: string) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    const document = await session.send("DOM.getDocument") as { root: { nodeId: number } };
    const match = await session.send("DOM.querySelector", { nodeId: document.root.nodeId, selector }) as { nodeId: number };
    if (!match.nodeId) throw new Error(`Breadcrumb renderer lost selector ${selector}.`);
    return await session.send("DOM.getContentQuads", { nodeId: match.nodeId });
  } finally {
    await session.detach();
  }
}

async function runtimeFor(page: Page) {
  return {
    browserVersion: page.context().browser()?.version() ?? "",
    ...await page.evaluate(() => ({
      platform: navigator.platform,
      deviceScaleFactor: devicePixelRatio,
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })),
  };
}

async function viewportFor(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Breadcrumb renderer requires a fixed viewport.");
  return viewport;
}

function exactDeltas(triggerBuffer: Buffer, skylineBuffer: Buffer, rect: { x: number; y: number; width: number; height: number }) {
  const trigger = PNG.sync.read(triggerBuffer);
  const skyline = PNG.sync.read(skylineBuffer);
  if (trigger.width !== skyline.width || trigger.height !== skyline.height) throw new Error("Breadcrumb renderer screenshot dimensions differ.");
  const pixels = [] as BreadcrumbRasterizationObservation["pixels"];
  const left = Math.floor(rect.x);
  const top = Math.floor(rect.y);
  for (let y = top; y < Math.ceil(rect.y + rect.height); y += 1) for (let x = left; x < Math.ceil(rect.x + rect.width); x += 1) {
    const offset = (y * trigger.width + x) * 4;
    const triggerPixel = Array.from(trigger.data.subarray(offset, offset + 4)) as [number, number, number, number];
    const skylinePixel = Array.from(skyline.data.subarray(offset, offset + 4)) as [number, number, number, number];
    if (triggerPixel.some((value, index) => value !== skylinePixel[index])) pixels.push({ x: x - left, y: y - top, trigger: triggerPixel, skyline: skylinePixel });
  }
  return pixels;
}

function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
