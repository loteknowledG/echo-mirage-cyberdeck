export interface AgentRole {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  primary_use: string;
  handoff_to: string[];
}

export interface AgentHierarchy {
  top: string;
  builders: string[];
  verifier: string;
  final: string;
}

export interface AgentRoles {
  agents: AgentRole[];
  hierarchy: AgentHierarchy;
}

export interface ToolRegistry {
  id: string;
  agent: string;
  role: string;
  use_when: string[];
  do_not_use_when: string[];
  handoff_format: Record<string, string>;
}

export interface ToolRegistryBundle {
  tools: ToolRegistry[];
}

export interface PlaybookStep {
  step: number;
  owner: string;
  action: string;
  output: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  steps: PlaybookStep[];
  success_criteria: string;
}

export interface WorkflowPlaybooks {
  playbooks: Playbook[];
}

export interface ActiveTask {
  title: string;
  status: string;
  owner: string;
  current_step: string;
  next_step: string;
  blockers: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface HandoffEntry {
  timestamp: string;
  from: string;
  to: string;
  task: string;
  result: string;
  next_action: string;
}

export interface HandoffHistory {
  entries: HandoffEntry[];
}

export interface OrchestrationBundle {
  agentRoles: AgentRoles | null;
  toolRegistry: ToolRegistryBundle | null;
  workflowPlaybooks: WorkflowPlaybooks | null;
  activeTask: ActiveTask | null;
  handoffHistory: HandoffHistory | null;
}