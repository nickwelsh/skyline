import { createHash } from "node:crypto";

type Rgba = [number, number, number, number];
type Rect = { x: number; y: number; width: number; height: number };
type Runtime = { browserVersion: string; platform: string; deviceScaleFactor: number; locale: string; timezone: string };
type Pixel = { x: number; y: number; trigger: Rgba; skyline: Rgba };

export type BreadcrumbElementEvidence = {
  rect: Rect;
  canonicalDomSha256: string;
  semanticDomSha256: string;
  accessibilitySha256: string;
  computedStyleSha256: string;
  effectiveCssSha256: string;
  quadsSha256: string;
  backdropSha256: string;
  cropSha256: string;
  paint: { currentColor: string; stroke: string; strokeWidth: string; strokeLinecap: string };
  outerHtmlSha256: string;
  matchingRulesSha256: string;
};

export type BreadcrumbSideEvidence = { svg: BreadcrumbElementEvidence; line: BreadcrumbElementEvidence };
export type BreadcrumbRasterizationObservation = {
  runtime: Runtime;
  viewport?: { width: number; height: number };
  trigger: BreadcrumbSideEvidence | null;
  skyline: BreadcrumbSideEvidence | null;
  pixels: Pixel[];
};

export type BreadcrumbRasterizationPolicy = {
  schemaVersion: number;
  evidence: { canonicalCaptures: number; visibleCaptures: number; absentCaptures: number; observations: number; finiteStates: number };
  environment: { chromiumRevision: string; chromiumVersion: string; architecture: string; platform: string; deviceScaleFactor: number; locale: string; timezone: string };
  selectors: { svg: string; line: string };
  source: Record<string, string>;
  states: Array<{ sha256: string; pixels: Pixel[] }>;
  captures: Record<string, { viewport: { width: number; height: number }; candidates: Array<{ sha256: string }> }>;
  absentCaptures: string[];
};

export type BreadcrumbRasterizationRegion = {
  kind: "breadcrumb-rasterization";
  id: "run-breadcrumb-rasterization";
  capture: string;
  rect: Rect;
  pixels: Pixel[];
};

const approvedPolicySha256 = "477b6f07cd22b699988290c021f2d866a44229970364b689d25e94357df48b66";

export function validateBreadcrumbRasterizationPolicy(policy: BreadcrumbRasterizationPolicy) {
  if (digest(policy) !== approvedPolicySha256) throw new Error("Breadcrumb renderer changed approved policy evidence.");
  const visible = Object.keys(policy.captures);
  const canonical = new Set([...visible, ...policy.absentCaptures]);
  const exactCardinality = policy.schemaVersion === 1
    && policy.evidence.canonicalCaptures === 439
    && policy.evidence.visibleCaptures === 196
    && policy.evidence.absentCaptures === 243
    && policy.evidence.observations === 831
    && policy.evidence.finiteStates === 9
    && visible.length === 196
    && policy.absentCaptures.length === 243
    && canonical.size === 439
    && policy.states.length === 9;
  if (!exactCardinality) throw new Error("Breadcrumb renderer changed approved policy cardinality.");
  for (const state of policy.states) if (digest(state.pixels) !== state.sha256) throw new Error("Breadcrumb renderer changed finite state evidence.");
  return policy;
}

export function fingerprintBreadcrumbRasterizationCandidate(stateSha256: string, trigger: BreadcrumbSideEvidence, skyline: BreadcrumbSideEvidence) {
  return digest({ stateSha256, trigger: orderedSide(trigger), skyline: orderedSide(skyline) });
}

function orderedSide(side: BreadcrumbSideEvidence): BreadcrumbSideEvidence {
  requireExactKeys(side, ["svg", "line"], "side");
  return { svg: orderedElement(side.svg), line: orderedElement(side.line) };
}

function orderedElement(element: BreadcrumbElementEvidence): BreadcrumbElementEvidence {
  requireExactKeys(element, [
    "rect",
    "canonicalDomSha256",
    "semanticDomSha256",
    "accessibilitySha256",
    "computedStyleSha256",
    "effectiveCssSha256",
    "quadsSha256",
    "backdropSha256",
    "cropSha256",
    "paint",
    "outerHtmlSha256",
    "matchingRulesSha256",
  ], "element");
  requireExactKeys(element.rect, ["x", "y", "width", "height"], "rect");
  requireExactKeys(element.paint, ["currentColor", "stroke", "strokeWidth", "strokeLinecap"], "paint");
  return {
    rect: element.rect,
    canonicalDomSha256: element.canonicalDomSha256,
    semanticDomSha256: element.semanticDomSha256,
    accessibilitySha256: element.accessibilitySha256,
    computedStyleSha256: element.computedStyleSha256,
    effectiveCssSha256: element.effectiveCssSha256,
    quadsSha256: element.quadsSha256,
    backdropSha256: element.backdropSha256,
    cropSha256: element.cropSha256,
    paint: element.paint,
    outerHtmlSha256: element.outerHtmlSha256,
    matchingRulesSha256: element.matchingRulesSha256,
  };
}

function requireExactKeys(value: object, expected: string[], label: string) {
  const actual = Object.keys(value).sort();
  const approved = [...expected].sort();
  if (!same(actual, approved)) throw new Error(`Breadcrumb renderer changed candidate ${label} evidence keys.`);
}

export function validateBreadcrumbRasterizationObservation(policy: BreadcrumbRasterizationPolicy, capture: string, observation: BreadcrumbRasterizationObservation) {
  validateBreadcrumbRasterizationPolicy(policy);
  validateRuntime(policy, observation.runtime);
  const visible = policy.captures[capture];
  const absent = policy.absentCaptures.includes(capture);
  if (!visible && !absent) throw new Error(`Breadcrumb renderer does not permit unknown capture ${capture}.`);
  if ((observation.trigger === null) !== (observation.skyline === null)) throw new Error(`Breadcrumb renderer ${capture} has one-sided presence.`);

  if (absent) {
    if (observation.trigger || observation.skyline || observation.pixels.length) throw new Error(`Breadcrumb renderer ${capture} must remain absent.`);
    return { status: "absent" as const };
  }
  if (!observation.trigger || !observation.skyline) throw new Error(`Breadcrumb renderer ${capture} must remain visible on both sides.`);
  if (observation.viewport && !same(observation.viewport, visible.viewport)) throw new Error(`Breadcrumb renderer ${capture} changed viewport geometry.`);
  const stateSha256 = digest(observation.pixels);
  if (!policy.states.some((state) => state.sha256 === stateSha256 && same(state.pixels, observation.pixels))) throw new Error(`Breadcrumb renderer ${capture} changed finite state evidence.`);
  const candidateSha256 = fingerprintBreadcrumbRasterizationCandidate(stateSha256, observation.trigger, observation.skyline);
  if (!visible.candidates.some(({ sha256 }) => sha256 === candidateSha256)) throw new Error(`Breadcrumb renderer ${capture} changed exact capture evidence.`);
  return { status: "visible" as const, stateSha256, candidateSha256 };
}

export function breadcrumbRasterizationRegion(policy: BreadcrumbRasterizationPolicy, capture: string, observation: BreadcrumbRasterizationObservation): BreadcrumbRasterizationRegion | undefined {
  const resolved = validateBreadcrumbRasterizationObservation(policy, capture, observation);
  if (resolved.status === "absent" || observation.pixels.length === 0) return undefined;
  return {
    kind: "breadcrumb-rasterization",
    id: "run-breadcrumb-rasterization",
    capture,
    rect: observation.trigger!.svg.rect,
    pixels: observation.pixels,
  };
}

function validateRuntime(policy: BreadcrumbRasterizationPolicy, runtime: Runtime) {
  const expected = {
    browserVersion: policy.environment.chromiumVersion,
    platform: policy.environment.platform,
    deviceScaleFactor: policy.environment.deviceScaleFactor,
    locale: policy.environment.locale,
    timezone: policy.environment.timezone,
  };
  if (!same(runtime, expected)) throw new Error("Breadcrumb renderer changed runtime evidence.");
}

function same(left: unknown, right: unknown) { return JSON.stringify(left) === JSON.stringify(right); }
function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
