import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRobotConfig,
  parseRobotConfig,
} from "../src/lib/robotConfig.ts";

const valid = {
  baseUrl: " http://192.168.1.20:3000/ ",
  deviceId: " robot-001 ",
  mac: " AA:BB:CC:DD:EE:FF ",
  name: " Alfred ",
  ip: " 192.168.1.42 ",
  firmware: " ",
  language: "de",
};

test("normalizes a complete robot configuration", () => {
  assert.deepEqual(normalizeRobotConfig(valid), {
    baseUrl: "http://192.168.1.20:3000",
    deviceId: "robot-001",
    mac: "AA:BB:CC:DD:EE:FF",
    name: "Alfred",
    ip: "192.168.1.42",
    firmware: "unknown",
    language: "de",
  });
});

test("rejects missing identity and invalid URLs", () => {
  assert.throws(
    () => normalizeRobotConfig({ ...valid, deviceId: "" }),
    /Device ID/,
  );
  assert.throws(
    () => normalizeRobotConfig({ ...valid, baseUrl: "192.168.1.20:3000" }),
    /http:\/\//,
  );
});

test("rejects corrupt persisted configuration", () => {
  assert.equal(parseRobotConfig(null), null);
  assert.equal(parseRobotConfig({ ...valid, language: "fr" }), null);
  assert.equal(parseRobotConfig({ baseUrl: "http://acu" }), null);
});
