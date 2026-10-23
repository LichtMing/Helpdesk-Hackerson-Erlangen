import type { RobotConfig } from "./robotConfig";

export interface AssignedRobotWorkflow {
  workflowId: string;
  speechText: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function endpoint(config: Pick<RobotConfig, "baseUrl">, path: string): string {
  return `${config.baseUrl.replace(/\/+$/, "")}${path}`;
}

async function errorFrom(response: Response): Promise<Error> {
  const raw = await response.text();
  try {
    const body = JSON.parse(raw) as { error?: unknown; detail?: unknown };
    if (body.detail) return new Error(String(body.detail));
    if (body.error) return new Error(String(body.error));
  } catch {
    // Fall back to the status below.
  }
  return new Error(`HTTP ${response.status}`);
}

export async function startAssignedAnswerWorkflow(
  config: Pick<RobotConfig, "baseUrl" | "deviceId">,
  fetchImpl: FetchLike = fetch,
): Promise<AssignedRobotWorkflow> {
  const deviceId = encodeURIComponent(config.deviceId);
  const response = await fetchImpl(
    endpoint(config, `/api/bot/robot-workflows/${deviceId}/workflow/start`),
    { method: "POST" },
  );
  if (!response.ok) throw await errorFrom(response);

  const body = await response.json() as {
    Workflows?: Array<{
      WorkflowID?: unknown;
      RobotId?: unknown;
      Steps?: Array<{ TTS?: unknown; Title?: unknown }>;
    }>;
  };
  const workflow = body.Workflows?.[0];
  const step = workflow?.Steps?.[0];
  const speechText = typeof step?.TTS === "string" && step.TTS.trim()
    ? step.TTS.trim()
    : typeof step?.Title === "string" ? step.Title.trim() : "";
  if (
    !workflow ||
    typeof workflow.WorkflowID !== "string" ||
    workflow.RobotId !== config.deviceId ||
    !speechText
  ) {
    throw new Error("ACU returned an invalid robot answer workflow.");
  }
  return { workflowId: workflow.WorkflowID, speechText };
}

export async function completeAnswerWorkflow(
  config: Pick<RobotConfig, "baseUrl" | "deviceId">,
  workflowId: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const response = await fetchImpl(
    endpoint(
      config,
      `/api/bot/robot-workflows/${encodeURIComponent(config.deviceId)}` +
        `/workflows/${encodeURIComponent(workflowId)}/complete`,
    ),
    { method: "POST" },
  );
  if (!response.ok) throw await errorFrom(response);
}
