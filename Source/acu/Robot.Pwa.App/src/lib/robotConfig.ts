import type { SpeechLanguage } from "./speechTypes";

export interface RobotConfig {
  baseUrl: string;
  deviceId: string;
  mac: string;
  name: string;
  ip: string;
  firmware: string;
  language: SpeechLanguage;
}

export const DEFAULT_ROBOT_CONFIG: RobotConfig = {
  baseUrl: "http://10.0.2.2:3000",
  deviceId: "",
  mac: "",
  name: "ACU Patient Robot",
  ip: "",
  firmware: "development",
  language: "auto",
};

const LANGUAGES: ReadonlySet<string> = new Set(["auto", "en", "de", "zh"]);

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  return trimmed;
}

export function normalizeRobotConfig(value: RobotConfig): RobotConfig {
  const baseUrl = required(value.baseUrl, "ACU URL").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("ACU URL must start with http:// or https://.");
  }
  if (!LANGUAGES.has(value.language)) {
    throw new Error("The selected speech language is not supported.");
  }

  return {
    baseUrl,
    deviceId: required(value.deviceId, "Device ID"),
    mac: required(value.mac, "MAC"),
    name: required(value.name, "Robot name"),
    ip: value.ip.trim(),
    firmware: value.firmware.trim() || "unknown",
    language: value.language,
  };
}

export function parseRobotConfig(value: unknown): RobotConfig | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<RobotConfig>;
  if (
    typeof candidate.baseUrl !== "string" ||
    typeof candidate.deviceId !== "string" ||
    typeof candidate.mac !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.ip !== "string" ||
    typeof candidate.firmware !== "string" ||
    typeof candidate.language !== "string"
  ) {
    return null;
  }

  try {
    return normalizeRobotConfig(candidate as RobotConfig);
  } catch {
    return null;
  }
}
