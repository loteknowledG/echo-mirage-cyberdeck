import type {
  AgentRoles,
  ToolRegistryBundle,
  WorkflowPlaybooks,
  ActiveTask,
  HandoffHistory,
  OrchestrationBundle,
} from "./orchestration-types";

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
    const res = await fetch("/api/orchestration", { cache: "no-store" });
    if (res.ok) {
      const bundle = await res.json();
      if (isValidAgentRoles(bundle.agentRoles)) {
        result.agentRoles = bundle.agentRoles;
      }
      if (isValidToolRegistryBundle(bundle.toolRegistry)) {
        result.toolRegistry = bundle.toolRegistry;
      }
      if (isValidWorkflowPlaybooks(bundle.workflowPlaybooks)) {
        result.workflowPlaybooks = bundle.workflowPlaybooks;
      }
      if (isValidActiveTask(bundle.activeTask)) {
        result.activeTask = bundle.activeTask;
      }
      if (isValidHandoffHistory(bundle.handoffHistory)) {
        result.handoffHistory = bundle.handoffHistory;
      }
    }
  } catch {
    // fail gracefully
  }

  return result;
}