/**
 * Public surface for the headless capture pipeline.
 *
 * Consumers should import from this module. The internal modules
 * (browser, dom, styles, etc.) are implementation details.
 */

export { capturePageAllBreakpoints } from './record';
export { checkBudget, recordCaptureSpend } from './budget';
export { isCaptureV2Enabled } from './flags';

export type {
  BBox,
  CaptureBreakpoint,
  CaptureCohort,
  CaptureOptions,
  CaptureRunSummary,
  ConsoleMessage,
  CtaCandidateMeasured,
  FormCandidateMeasured,
  FormInputItemMeasured,
  HeadingItemMeasured,
  JsError,
  PageCapture,
  PageCaptureMeta,
} from './types';

export {
  BREAKPOINT_VIEWPORTS,
  CAPTURE_USER_AGENTS,
  CaptureError,
  estimateCostUsd,
} from './types';

/** Build a pathRef → PageCapture[] index keyed by most-recent captures. */
export function buildCaptureIndex(captures: import('./types').PageCapture[]): Map<string, import('./types').PageCapture[]> {
  const map = new Map<string, import('./types').PageCapture[]>();
  for (const capture of captures) {
    let list = map.get(capture.pathRef);
    if (!list) {
      list = [];
      map.set(capture.pathRef, list);
    }
    list.push(capture);
  }
  return map;
}
