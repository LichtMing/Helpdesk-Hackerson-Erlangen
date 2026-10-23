import type { RobotConfig } from "./robotConfig";

export type RegistrationStatus = "pending" | "approved" | "rejected" | "unregistered";

export class AcuHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AcuHttpError";
    this.status = status;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function readError(response: Response): Promise<AcuHttpError> {
  const raw = await response.text();
  if (raw) {
    try {
      const body = JSON.parse(raw) as { error?: unknown; detail?: unknown };
      if (body.detail) return new AcuHttpError(String(body.detail), response.status);
      if (body.error) return new AcuHttpError(String(body.error), response.status);
    } catch {
      // Fall through to the HTTP status when the response is not JSON.
    }
  }
  return new AcuHttpError(`HTTP ${response.status}`, response.status);
}

async function request(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: FetchLike,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("连接 ACU 超时，请检查地址和网络。");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkAcuHealth(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const response = await request(
    endpoint(baseUrl, "/api/health"),
    { method: "GET" },
    5_000,
    fetchImpl,
  );
  if (!response.ok) throw await readError(response);
  const body = await response.json() as { status?: unknown };
  if (body.status !== "ok") throw new Error("ACU 健康检查返回了无效结果。");
}

export async function registerRobot(
  config: RobotConfig,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const response = await request(
    endpoint(config.baseUrl, "/api/bot/register"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: config.deviceId,
        name: config.name,
        ip: config.ip,
        mac: config.mac,
        firmware: config.firmware,
      }),
    },
    10_000,
    fetchImpl,
  );
  if (!response.ok) throw await readError(response);
}

export async function getRegistrationStatus(
  config: Pick<RobotConfig, "baseUrl" | "deviceId">,
  fetchImpl: FetchLike = fetch,
): Promise<RegistrationStatus> {
  const response = await request(
    endpoint(config.baseUrl, `/api/bot/registration-status/${encodeURIComponent(config.deviceId)}`),
    { method: "GET" },
    5_000,
    fetchImpl,
  );
  if (!response.ok) throw await readError(response);
  const body = await response.json() as { status?: unknown };
  if (!["pending", "approved", "rejected", "unregistered"].includes(String(body.status))) {
    throw new Error("ACU 返回了未知的设备状态。");
  }
  return body.status as RegistrationStatus;
}

export async function verifyApprovedRobot(
  config: Pick<RobotConfig, "baseUrl" | "deviceId" | "mac">,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const query = encodeURIComponent(config.mac);
  const response = await request(
    endpoint(
      config.baseUrl,
      `/api/bot/instructions/${encodeURIComponent(config.deviceId)}?mac=${query}`,
    ),
    { method: "GET" },
    5_000,
    fetchImpl,
  );
  if (!response.ok) throw await readError(response);
}
