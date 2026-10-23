import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import {
  AcuHttpError,
  checkAcuHealth,
  getRegistrationStatus,
  reportRobotOnline,
  registerRobot,
  verifyApprovedRobot,
} from "../src/lib/deviceApi.ts";

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const config = {
  baseUrl: "",
  deviceId: "robot-001",
  mac: "AA:BB:CC:DD:EE:FF",
  name: "Alfred",
  ip: "192.168.1.42",
  firmware: "1.0.0",
  language: "en",
};

test("checks health, registers, polls approval, and verifies MAC", async () => {
  let calls = 0;
  await withServer(async (request, response) => {
    calls++;
    if (request.url === "/api/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (request.url === "/api/bot/register") {
      assert.equal(request.method, "POST");
      assert.deepEqual(await readJson(request), {
        deviceId: config.deviceId,
        name: config.name,
        ip: config.ip,
        mac: config.mac,
        firmware: config.firmware,
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ message: "Registration received" }));
      return;
    }
    if (request.url === "/api/bot/registration-status/robot-001") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "approved", deviceId: "robot-001" }));
      return;
    }
    if (request.url === "/api/bot/device-status/robot-001") {
      assert.equal(request.method, "POST");
      assert.deepEqual(await readJson(request), { mac: config.mac });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ message: "Status updated" }));
      return;
    }
    assert.equal(
      request.url,
      "/api/bot/instructions/robot-001?mac=AA%3ABB%3ACC%3ADD%3AEE%3AFF",
    );
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ command: "" }));
  }, async (baseUrl) => {
    const identity = { ...config, baseUrl };
    await checkAcuHealth(baseUrl);
    await registerRobot(identity);
    assert.equal(await getRegistrationStatus(identity), "approved");
    await verifyApprovedRobot(identity);
    await reportRobotOnline(identity);
  });
  assert.equal(calls, 5);
});

test("preserves ACU status and error detail", async () => {
  await assert.rejects(
    registerRobot(
      { ...config, baseUrl: "http://acu.invalid" },
      async () => new Response(JSON.stringify({ error: "Device ID already in use" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    ),
    (error) => error instanceof AcuHttpError &&
      error.status === 409 &&
      /already in use/.test(error.message),
  );
});
