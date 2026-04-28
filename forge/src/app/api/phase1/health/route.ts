import type { HealthResponse } from "@/lib/phase1";
import { mapRouteError, success } from "../_shared";

export async function GET() {
  try {
    const payload: HealthResponse = {
      module: "phase1",
      status: "ok",
      version: "v1",
      capabilities: {
        sufficiency: true,
        insights: true,
      },
    };
    return success(payload);
  } catch (error) {
    return mapRouteError(error);
  }
}
