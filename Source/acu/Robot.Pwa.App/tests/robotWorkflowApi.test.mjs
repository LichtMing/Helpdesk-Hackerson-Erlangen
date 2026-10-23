import assert from "node:assert/strict";
import test from "node:test";

import {
  completeAnswerWorkflow,
  startAssignedAnswerWorkflow,
} from "../src/lib/robotWorkflowApi.ts";

const config = {
  baseUrl: "http://acu.test:3000",
  deviceId: "robot/001",
};

test("starts an assigned answer workflow and reads its TTS", async () => {
  const workflow = await startAssignedAnswerWorkflow(config, async (url, init) => {
    assert.equal(
      url,
      "http://acu.test:3000/api/bot/robot-workflows/robot%2F001/workflow/start",
    );
    assert.equal(init.method, "POST");
    return new Response(JSON.stringify({
      Workflows: [{
        WorkflowID: "erlangen-helpdesk-answer",
        RobotId: "robot/001",
        Steps: [{ TTS: "Please stay still." }],
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  assert.deepEqual(workflow, {
    workflowId: "erlangen-helpdesk-answer",
    speechText: "Please stay still.",
  });
});

test("completes the workflow after playback", async () => {
  let called = false;
  await completeAnswerWorkflow(config, "answer/1", async (url, init) => {
    called = true;
    assert.equal(
      url,
      "http://acu.test:3000/api/bot/robot-workflows/robot%2F001/workflows/answer%2F1/complete",
    );
    assert.equal(init.method, "POST");
    return new Response(null, { status: 204 });
  });
  assert.equal(called, true);
});

test("rejects a workflow assigned to another robot", async () => {
  await assert.rejects(
    startAssignedAnswerWorkflow(config, async () => new Response(JSON.stringify({
      Workflows: [{
        WorkflowID: "answer",
        RobotId: "another-robot",
        Steps: [{ Title: "Wrong target" }],
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })),
    /invalid robot answer workflow/,
  );
});
