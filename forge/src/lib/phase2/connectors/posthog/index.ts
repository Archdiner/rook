export { mapPostHogEvent, mapPostHogEvents } from "./mapping";
export type { MapOptions, MapResult } from "./mapping";

export { runPostHogSync, validatePostHogConnection } from "./sync";
export type { RunSyncResult } from "./sync";

export { resolvePostHogSecret } from "./secrets";

export { PostHogConnectorError } from "./errors";
export type { PostHogErrorCode } from "./errors";
