import AsyncStorage from "@react-native-async-storage/async-storage";

import { parseRobotConfig, type RobotConfig } from "./robotConfig";

const CONFIG_KEY = "acu.robot.config.v1";

export async function loadRobotConfig(): Promise<RobotConfig | null> {
  const stored = await AsyncStorage.getItem(CONFIG_KEY);
  if (!stored) return null;

  try {
    return parseRobotConfig(JSON.parse(stored));
  } catch {
    return null;
  }
}

export async function saveRobotConfig(config: RobotConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export async function clearRobotConfig(): Promise<void> {
  await AsyncStorage.removeItem(CONFIG_KEY);
}
