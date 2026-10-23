export interface ConversationIdentity {
  baseUrl: string;
  deviceId: string;
  mac: string;
}

export interface SendChatInput extends ConversationIdentity {
  sessionId: string;
  requestId?: string;
  text: string;
  language: string;
}

export interface ChatReply {
  sessionId: string;
  requestId: string;
  answer: string;
  language: string;
  isMock: boolean;
  robotDelivery: string;
  generatedAt: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  return trimmed;
}

function endpoint(identity: ConversationIdentity, path: string): string {
  const baseUrl = required(identity.baseUrl, "ACU URL").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("ACU URL must start with http:// or https://.");
  }
  return `${baseUrl}${path}`;
}

async function apiError(response: Response): Promise<Error> {
  const raw = await response.text();
  if (raw) {
    try {
      const payload = JSON.parse(raw) as {
        error?: unknown;
        detail?: unknown;
        errors?: unknown;
      };
      if (payload.detail) return new Error(String(payload.detail));
      if (payload.error) return new Error(String(payload.error));
      if (payload.errors && typeof payload.errors === "object") {
        const messages = Object.values(payload.errors)
          .flatMap((value) => Array.isArray(value) ? value : [value])
          .map(String)
          .filter(Boolean);
        if (messages.length) return new Error(messages.join(" "));
      }
    } catch {
      // Use the HTTP status below when the body is not JSON.
    }
  }
  return new Error(`HTTP ${response.status}`);
}

function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSessionId(): string {
  return `session-${createRequestId()}`;
}

export async function sendChat(
  input: SendChatInput,
  fetchImpl: FetchLike = fetch,
): Promise<ChatReply> {
  const requestId = input.requestId ?? createRequestId();
  const sessionId = required(input.sessionId, "sessionId");
  const text = required(input.text, "Transcript text");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetchImpl(endpoint(input, "/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: required(input.deviceId, "deviceId"),
        mac: required(input.mac, "MAC"),
        sessionId,
        requestId,
        text,
        language: required(input.language, "language"),
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw await apiError(response);
    const payload = await response.json() as Partial<ChatReply>;
    if (
      payload.sessionId !== sessionId ||
      payload.requestId !== requestId ||
      typeof payload.answer !== "string" ||
      !payload.answer.trim() ||
      typeof payload.language !== "string" ||
      typeof payload.isMock !== "boolean" ||
      typeof payload.robotDelivery !== "string" ||
      typeof payload.generatedAt !== "string"
    ) {
      throw new Error("ACU returned an invalid chat response.");
    }
    return payload as ChatReply;
  } finally {
    clearTimeout(timer);
  }
}

export async function synthesizeSpeech(
  identity: ConversationIdentity,
  text: string,
  language: string,
  fetchImpl: FetchLike = fetch,
): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetchImpl(endpoint(identity, "/api/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: required(identity.deviceId, "deviceId"),
        mac: required(identity.mac, "MAC"),
        text: required(text, "Answer text"),
        language: required(language, "language"),
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw await apiError(response);
    if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("audio/wav")) {
      throw new Error("ACU TTS returned an unsupported audio format.");
    }
    const audio = await response.arrayBuffer();
    if (audio.byteLength < 44) throw new Error("ACU TTS returned empty audio.");
    return audio;
  } finally {
    clearTimeout(timer);
  }
}

export async function resetConversation(
  identity: ConversationIdentity,
  sessionId: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(endpoint(identity, "/api/reset"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: required(identity.deviceId, "deviceId"),
        mac: required(identity.mac, "MAC"),
        sessionId: required(sessionId, "sessionId"),
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw await apiError(response);
  } finally {
    clearTimeout(timer);
  }
}
