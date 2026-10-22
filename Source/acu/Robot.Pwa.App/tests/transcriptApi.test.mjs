import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { sendTranscript } from "../src/lib/transcriptApi.ts";

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

test("sends Unicode transcript as JSON and validates the ACU echo", async () => {
  const text = "我需要为核磁共振摘掉眼镜吗？ Äußere Metallteile?";

  await withServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/bot/transcripts/robot-001");
    assert.match(request.headers["content-type"], /^application\/json/);

    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.deepEqual(body, {
      mac: "AA:BB:CC:DD:EE:FF",
      text,
      language: "auto",
      requestId: "transport-check-1",
    });

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      message: "Transcript received",
      requestId: body.requestId,
      deviceId: "robot-001",
      text: body.text,
      language: body.language,
      receivedAt: "2026-10-22T12:00:00.000Z",
    }));
  }, async (baseUrl) => {
    const receipt = await sendTranscript({
      baseUrl,
      deviceId: "robot-001",
      mac: "AA:BB:CC:DD:EE:FF",
      text,
      language: "auto",
      requestId: "transport-check-1",
    });
    assert.equal(receipt.text, text);
  });
});

test("surfaces an ACU rejection", async () => {
  await withServer((_request, response) => {
    response.writeHead(403, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Device not approved" }));
  }, async (baseUrl) => {
    await assert.rejects(
      sendTranscript({
        baseUrl,
        deviceId: "robot-001",
        mac: "AA:BB:CC:DD:EE:FF",
        text: "test",
        language: "en",
      }),
      /Device not approved/,
    );
  });
});

