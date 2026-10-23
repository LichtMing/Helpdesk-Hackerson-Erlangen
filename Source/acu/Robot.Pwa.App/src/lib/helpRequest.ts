import type { RobotConfig } from "./robotConfig";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Tells staff that the patient pressed "I need help" (event: patient_help_requested). */
export async function requestStaffHelp(
  config: Pick<RobotConfig, "baseUrl" | "deviceId" | "mac">,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const url =
      `${config.baseUrl.replace(/\/+$/, "")}` +
      `/api/bot/device-status/${encodeURIComponent(config.deviceId)}`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mac: config.mac, event: "patient_help_requested" }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Help request failed (HTTP ${response.status})`);
  } finally {
    clearTimeout(timer);
  }
}
