import { getSynapseMcpClient } from "./synapse-mcp-client.server";

type ControlLeaseAcquireResult = {
  held?: boolean;
  is_owner?: boolean;
  outcome?: string;
};

type ControlLeaseReleaseResult = {
  released?: boolean;
  outcome?: string;
};

export async function acquireSynapseOperatorLease(ttlMs: number): Promise<void> {
  const client = getSynapseMcpClient();
  const clampedTtl = Math.max(100, Math.min(ttlMs, 30_000));
  const result = await client.callTool<ControlLeaseAcquireResult>(
    "control_lease_acquire",
    { ttl_ms: clampedTtl },
  );
  if (result.is_owner !== true && result.held === true) {
    throw new Error("Synapse input lease held by another MCP session");
  }

  await client.callTool("tool_profile_set", {
    profile: "break_glass",
    confirm_break_glass: true,
    reason: "Echo Mirage Pi operator control grant",
  });
}

export async function renewSynapseOperatorLease(ttlMs = 15_000): Promise<void> {
  const client = getSynapseMcpClient();
  await client.callTool<ControlLeaseAcquireResult>("control_lease_acquire", {
    ttl_ms: Math.max(100, Math.min(ttlMs, 30_000)),
  });
}

export async function releaseSynapseOperatorLease(): Promise<void> {
  const client = getSynapseMcpClient();
  try {
    await client.callTool<ControlLeaseReleaseResult>("control_lease_release", {});
  } catch {
    // Best-effort release when daemon is down.
  }
  try {
    await client.callTool("tool_profile_set", {
      profile: "normal_agent",
      confirm_break_glass: false,
      reason: null,
    });
  } catch {
    // Profile reset is best-effort.
  }
}

export async function syncSynapseLeaseWithPiGrant(durationMs: number): Promise<void> {
  await acquireSynapseOperatorLease(durationMs);
}
