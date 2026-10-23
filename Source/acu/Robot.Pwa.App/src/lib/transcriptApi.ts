export interface SendTranscriptInput {
  baseUrl: string;
  deviceId: string;
  mac: string;
  text: string;
  language: string;
  requestId?: string;
}

export interface TranscriptReceipt {
  message: string;
  requestId: string;
  deviceId: string;
  text: string;
  language: string;
  receivedAt: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  return trimmed;
}

function asReceipt(value: unknown): TranscriptReceipt {
  if (!value || typeof value !== "object") {
    throw new Error("ACU returned invalid JSON data.");
  }

  const receipt = value as Partial<TranscriptReceipt>;
  const fields: Array<keyof TranscriptReceipt> = [
    "message",
    "requestId",
    "deviceId",
    "text",
    "language",
    "receivedAt",
  ];
  if (fields.some((field) => typeof receipt[field] !== "string")) {
    throw new Error("The ACU receipt is missing required fields.");
  }
  return receipt as TranscriptReceipt;
}

export async function sendTranscript(
  input: SendTranscriptInput,
  fetchImpl: FetchLike = fetch,
): Promise<TranscriptReceipt> {
  const baseUrl = required(input.baseUrl, "ACU URL").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("ACU URL must start with http:// or https://.");
  }

  const deviceId = required(input.deviceId, "deviceId");
  const mac = required(input.mac, "MAC");
  const text = required(input.text, "Transcript text");
  const requestId = input.requestId ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetchImpl(
      `${baseUrl}/api/bot/transcripts/${encodeURIComponent(deviceId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac, text, language: input.language, requestId }),
        signal: controller.signal,
      },
    );

    const raw = await response.text();
    let payload: unknown = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new Error(`ACU returned a non-JSON response (HTTP ${response.status}).`);
      }
    }

    if (!response.ok) {
      const apiError = payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${response.status}`;
      throw new Error(`Failed to send transcript text: ${apiError}`);
    }

    const receipt = asReceipt(payload);
    if (receipt.requestId !== requestId || receipt.text !== text) {
      throw new Error("The ACU receipt does not match the submitted transcript.");
    }
    return receipt;
  } finally {
    clearTimeout(timer);
  }
}

