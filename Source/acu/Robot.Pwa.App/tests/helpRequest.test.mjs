import assert from "node:assert/strict";
import test from "node:test";

import { requestStaffHelp } from "../src/lib/helpRequest.ts";

const config = {
  baseUrl: "http://acu.local:3000/",
  deviceId: "robot / 001",
  mac: "AA:BB:CC:DD:EE:FF",
};

test("sends the patient help event to the existing ACU device-status endpoint", async () => {
  let request;
  await requestStaffHelp(config, async (url, init) => {
    request = { url, init };
    return new Response(null, { status: 200 });
  });

  assert.equal(
    request.url,
    "http://acu.local:3000/api/bot/device-status/robot%20%2F%20001",
  );
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.init.body), {
    mac: config.mac,
    event: "patient_help_requested",
  });
  assert.ok(request.init.signal instanceof AbortSignal);
});

test("reports ACU help-request failures in English", async () => {
  await assert.rejects(
    requestStaffHelp(config, async () => new Response(null, { status: 503 })),
    /Help request failed \(HTTP 503\)/,
  );
});
