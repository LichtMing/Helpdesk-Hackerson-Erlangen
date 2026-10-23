import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import {
  resetConversation,
  sendChat,
  synthesizeSpeech,
} from "../src/lib/conversationApi.ts";

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

const identity = {
  deviceId: "robot-001",
  mac: "AA:BB:CC:DD:EE:FF",
};

test("sends a Unicode chat turn and correlates the ACU answer", async () => {
  const text = "Wie lange dauert die MRT-Untersuchung? 大概需要多久？";
  await withServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/chat");
    const body = await readJson(request);
    assert.deepEqual(body, {
      ...identity,
      sessionId: "session-1",
      requestId: "request-1",
      text,
      language: "auto",
    });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      sessionId: body.sessionId,
      requestId: body.requestId,
      answer: "Development response",
      language: "en",
      isMock: true,
      robotDelivery: "not_configured",
      generatedAt: "2026-10-22T12:00:00.000Z",
    }));
  }, async (baseUrl) => {
    const reply = await sendChat({
      baseUrl,
      ...identity,
      sessionId: "session-1",
      requestId: "request-1",
      text,
      language: "auto",
    });
    assert.equal(reply.answer, "Development response");
    assert.equal(reply.isMock, true);
    assert.equal(reply.robotDelivery, "not_configured");
  });
});

test("accepts WAV audio and sends an idempotent reset", async () => {
  let requestCount = 0;
  await withServer(async (request, response) => {
    requestCount++;
    const body = await readJson(request);
    if (request.url === "/api/tts") {
      assert.deepEqual(body, {
        ...identity,
        text: "Test answer",
        language: "en",
      });
      const wave = Buffer.alloc(44);
      wave.write("RIFF", 0, "ascii");
      wave.write("WAVE", 8, "ascii");
      response.writeHead(200, { "Content-Type": "audio/wav" });
      response.end(wave);
      return;
    }

    assert.equal(request.url, "/api/reset");
    assert.deepEqual(body, { ...identity, sessionId: "session-1" });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ sessionId: "session-1", cleared: true }));
  }, async (baseUrl) => {
    const fullIdentity = { baseUrl, ...identity };
    const audio = await synthesizeSpeech(fullIdentity, "Test answer", "en");
    assert.equal(audio.byteLength, 44);
    await resetConversation(fullIdentity, "session-1");
  });
  assert.equal(requestCount, 2);
});

test("surfaces a disabled model without attempting TTS", async () => {
  await withServer((_request, response) => {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "The local language model is not connected." }));
  }, async (baseUrl) => {
    await assert.rejects(
      sendChat({
        baseUrl,
        ...identity,
        sessionId: "session-1",
        text: "test",
        language: "en",
      }),
      /not connected/,
    );
  });
});

test("surfaces API-guide Problem Details and validation errors", async () => {
  const input = {
    baseUrl: "http://acu.test",
    ...identity,
    sessionId: "session-problem",
    requestId: "request-problem",
    text: "Hello",
    language: "en-US",
  };

  await assert.rejects(
    sendChat(input, async () => new Response(JSON.stringify({
      title: "Robot workflow operation failed",
      status: 403,
      detail: "Robot must be approved.",
    }), { status: 403, headers: { "Content-Type": "application/problem+json" } })),
    /Robot must be approved/,
  );

  await assert.rejects(
    sendChat(input, async () => new Response(JSON.stringify({
      title: "One or more validation errors occurred.",
      status: 400,
      errors: { text: ["The text field is required."] },
    }), { status: 400, headers: { "Content-Type": "application/problem+json" } })),
    /The text field is required/,
  );
});
