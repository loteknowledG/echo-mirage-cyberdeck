import fs from "fs/promises";
import path from "path";
import type {
  AgentRoles,
  ToolRegistryBundle,
  WorkflowPlaybooks,
  ActiveTask,
  HandoffHistory,
  HandoffEntry,
  OrchestrationBundle,
} from "./orchestration-types";

const ORCHESTRATION_DIR = path.join(process.cwd(), ".echo-mirage", "orchestration");

function isValidAgentRoles(obj: unknown): obj is AgentRoles {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return Array.isArray(o.agents) && typeof o.hierarchy === "object";
}

function isValidToolRegistryBundle(obj: unknown): obj is ToolRegistryBundle {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return Array.isArray(o.tools);
}

function isValidWorkflowPlaybooks(obj: unknown): obj is WorkflowPlaybooks {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return Array.isArray(o.playbooks);
}

function isValidActiveTask(obj: unknown): obj is ActiveTask {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.status === "string" &&
    typeof o.owner === "string" &&
    Array.isArray(o.blockers)
  );
}

function isValidHandoffHistory(obj: unknown): obj is HandoffHistory {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return Array.isArray(o.entries);
}

export async function loadOrchestrationBundle(): Promise<OrchestrationBundle> {
  const result: OrchestrationBundle = {
    agentRoles: null,
    toolRegistry: null,
    workflowPlaybooks: null,
    activeTask: null,
    handoffHistory: null,
  };

  try {
    const data = await fs.readFile(path.join(ORCHESTRATION_DIR, "agent-roles.json"), "utf-8");
    const parsed = JSON.parse(data);
    if (isValidAgentRoles(parsed)) {
      result.agentRoles = parsed;
    }
  } catch {
    // fail gracefully
  }

  try {
    const data = await fs.readFile(path.join(ORCHESTRATION_DIR, "tool-registry.json"), "utf-8");
    const parsed = JSON.parse(data);
    if (isValidToolRegistryBundle(parsed)) {
      result.toolRegistry = parsed;
    }
  } catch {
    // fail gracefully
  }

  try {
    const data = await fs.readFile(path.join(ORCHESTRATION_DIR, "workflow-playbooks.json"), "utf-8");
    const parsed = JSON.parse(data);
    if (isValidWorkflowPlaybooks(parsed)) {
      result.workflowPlaybooks = parsed;
    }
  } catch {
    // fail gracefully
  }

  try {
    const data = await fs.readFile(path.join(ORCHESTRATION_DIR, "active-task.json"), "utf-8");
    const parsed = JSON.parse(data);
    if (isValidActiveTask(parsed)) {
      result.activeTask = parsed;
    }
  } catch {
    // fail gracefully
  }

  try {
    const data = await fs.readFile(path.join(ORCHESTRATION_DIR, "handoff-history.jsonl"), "utf-8");
    if (data.trim()) {
      const lines = data.trim().split("\n").filter((l) => l.trim());
      const entries = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((e): e is HandoffEntry => {
          if (!e || typeof e !== "object") return false;
          return (
            typeof e.timestamp === "string" &&
            typeof e.from === "string" &&
            typeof e.to === "string" &&
            typeof e.task === "string"
          );
        });
      result.handoffHistory = { entries };
    } else {
      result.handoffHistory = { entries: [] };
    }
  } catch {
    // fail gracefully
  }

  return result;
}