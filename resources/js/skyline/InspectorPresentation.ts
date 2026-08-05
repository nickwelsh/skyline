import type { InspectorDto, InspectorPresentation } from "./dto";

export type ExternalInspector = InspectorDto & {
  presentation?: InspectorPresentation;
  detailSections: Array<{ label: string; value: unknown }>;
};

export type { CapturedValue, HttpMessageCapture, InspectorFailure, InspectorTiming, TextCapture } from "./dto";
