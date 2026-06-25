import {
  CAPABILITY_REGISTRY,
  getCapability,
  getRiskLevel,
  getApprovalMode,
  getReceiptType,
  getVerificationType,
  getCapabilityOwner,
  getHighRiskActions,
  getActionsByApprovalMode,
  getCapabilityManifest,
  requiresConfirmation,
  getActionScope,
} from "../src/lib/computer-use/capability-registry";
import {
  clearReceipts,
  recordReceipt,
  getReceipts,
  getReceiptById,
  getReceiptCount,
  queryReceipts,
  getReceiptSummary,
  makeToolExecReceipt,
  makeAuthorityReceipt,
  makeVerifyReceipt,
  computeContentHash,
  createReceiptId,
} from "../src/lib/computer-use/receipt-store";
import type { MuthurReceipt, AuthorityReceipt } from "../src/lib/computer-use/receipt-types";

function assert(name: string, condition: boolean | (() => boolean), detail?: unknown) {
  const pass = typeof condition === "function" ? condition() : condition;
  if (!pass) {
    console.error(`FAIL ${name}`, detail ?? "");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

function main() {
  console.log("=== Capability Registry + Receipt System Probe ===\n");

  console.log("--- Capability Registry: Era 2 Metadata ---");

  const manifest = getCapabilityManifest();
  assert("manifest excludes unknown", !manifest.some((m) => m.name === "unknown"));
  assert("manifest has 12 capabilities", manifest.length === 12);

  for (const cap of manifest) {
    assert(`${cap.name} has riskLevel`, cap.riskLevel !== undefined);
    assert(`${cap.name} has receiptType`, cap.receiptType !== undefined);
    assert(`${cap.name} has verificationType`, cap.verificationType !== undefined);
    assert(`${cap.name} has approvalMode`, cap.approvalMode !== undefined);
    assert(`${cap.name} has owner`, cap.owner !== undefined);
  }

  console.log("\n--- Risk Levels ---");
  const highRisk = getHighRiskActions();
  assert("paste_text is high risk", highRisk.includes("paste_text"));
  assert("hotkey is high risk", highRisk.includes("hotkey"));
  assert("get_active_window is low risk", getRiskLevel("get_active_window") === "low");
  assert("capture_screen is medium risk", getRiskLevel("capture_screen") === "medium");
  assert("2 high-risk actions", highRisk.length === 2);

  console.log("\n--- Approval Modes ---");
  const autoActions = getActionsByApprovalMode("auto");
  const userActions = getActionsByApprovalMode("user");
  const operatorActions = getActionsByApprovalMode("operator");
  assert("stop_execution is auto approval", getApprovalMode("stop_execution") === "auto");
  assert("paste_text requires user approval", getApprovalMode("paste_text") === "user");
  assert("focus_window requires operator approval", getApprovalMode("focus_window") === "operator");
  assert("user approval actions include paste_text + hotkey", userActions.length === 2);
  assert("operator approval actions include focus_window + capture_screen", operatorActions.length === 2);

  console.log("\n--- Receipt Types ---");
  assert("all capabilities use tool.exec receipt", manifest.every((m) => m.receiptType === "tool.exec"));
  assert("getReceiptType returns tool.exec", getReceiptType("get_active_window") === "tool.exec");

  console.log("\n--- Verification Types ---");
  assert("indicate_point uses visual verification", getVerificationType("indicate_point") === "visual");
  assert("paste_text uses input_output verification", getVerificationType("paste_text") === "input_output");
  assert("get_active_window uses logical verification", getVerificationType("get_active_window") === "logical");
  assert("stop_execution uses none verification", getVerificationType("stop_execution") === "none");

  console.log("\n--- Ownership ---");
  assert("stop_execution owned by user", getCapabilityOwner("stop_execution") === "user");
  assert("get_active_window owned by muthur", getCapabilityOwner("get_active_window") === "muthur");

  console.log("\n--- Backward Compatibility ---");
  assert("getCapability returns metadata", getCapability("get_active_window") !== undefined);
  assert("requiresConfirmation still works", requiresConfirmation("paste_text") === true);
  assert("requiresConfirmation false for observation", requiresConfirmation("get_active_window") === false);
  assert("getActionScope still works", getActionScope("get_active_window") === "observation");
  assert("CAPABILITY_REGISTRY has all 13 entries", Object.keys(CAPABILITY_REGISTRY).length === 13);

  console.log("\n--- Receipt Store: Basic Operations ---");
  clearReceipts();
  assert("receipts empty after clear", getReceiptCount() === 0);

  const receipt1 = makeToolExecReceipt({
    capabilityId: "get_active_window",
    authority: "muthur",
    status: "success",
    inputs: {},
    outputs: { title: "Test Window" },
    durationMs: 42,
  });
  assert("makeToolExecReceipt returns receipt", receipt1 !== undefined);
  assert("receipt has receiptId", receipt1.receiptId.startsWith("exec-"));
  assert("receipt type is tool.exec", receipt1.type === "tool.exec");
  assert("receipt has contentHash", receipt1.contentHash !== undefined);
  assert("receipt count is 1", getReceiptCount() === 1);

  console.log("\n--- Receipt Store: Query ---");
  const receipt2 = makeToolExecReceipt({
    capabilityId: "paste_text",
    authority: "user",
    status: "failed",
    inputs: { text: "hello" },
    error: "Clipboard unavailable",
    durationMs: 5,
  });

  const allReceipts = getReceipts();
  assert("2 receipts stored", allReceipts.length === 2);

  const found = getReceiptById(receipt1.receiptId);
  assert("getReceiptById finds receipt", found?.receiptId === receipt1.receiptId);

  const successReceipts = queryReceipts({ status: "success" });
  assert("query by status success returns 1", successReceipts.length === 1);
  assert("query success returns correct receipt", successReceipts[0].receiptId === receipt1.receiptId);

  const failedReceipts = queryReceipts({ status: "failed" });
  assert("query by status failed returns 1", failedReceipts.length === 1);

  const muthurReceipts = queryReceipts({ authority: "muthur" });
  assert("query by authority muthur returns 1", muthurReceipts.length === 1);

  const userReceipts = queryReceipts({ authority: "user" });
  assert("query by authority user returns 1", userReceipts.length === 1);

  console.log("\n--- Receipt Store: Summary ---");
  const summary = getReceiptSummary();
  assert("summary total is 2", summary.total === 2);
  assert("summary byType has tool.exec: 2", summary.byType["tool.exec"] === 2);
  assert("summary byStatus has success: 1", summary.byStatus["success"] === 1);
  assert("summary byStatus has failed: 1", summary.byStatus["failed"] === 1);
  assert("summary byAuthority has muthur: 1", summary.byAuthority["muthur"] === 1);
  assert("summary byAuthority has user: 1", summary.byAuthority["user"] === 1);
  assert("summary recentReceiptIds has 2", summary.recentReceiptIds.length === 2);

  console.log("\n--- Authority Receipts ---");
  clearReceipts();
  const authReceipt = makeAuthorityReceipt({
    kind: "authority.delegate",
    authority: "muthur",
    from: "muthur",
    to: "pi",
    reason: "Pi computer use lease granted",
    leaseId: "lease-001",
  });
  assert("authority receipt created", authReceipt.type === "authority.delegate");
  const authR = authReceipt as AuthorityReceipt;
  assert("authority receipt from muthur", authR.from === "muthur");
  assert("authority receipt to pi", authR.to === "pi");
  assert("authority receipt has leaseId", authR.leaseId === "lease-001");

  const returnReceipt = makeAuthorityReceipt({
    kind: "authority.return",
    authority: "pi",
    from: "pi",
    to: "muthur",
    reason: "Pi computer use lease terminated",
    leaseId: "lease-001",
  });
  assert("authority return receipt created", returnReceipt.type === "authority.return");

  console.log("\n--- Verify Receipts ---");
  const execReceipt = makeToolExecReceipt({
    capabilityId: "verify_text_visible",
    authority: "muthur",
    status: "success",
    inputs: { text: "Hello" },
    outputs: { matches: true },
  });

  const verifyPass = makeVerifyReceipt({
    authority: "muthur",
    claimReceiptId: execReceipt.receiptId,
    verificationType: "visual",
    matches: true,
    details: "Text found at (100, 200)",
  });
  assert("verify.pass receipt created", verifyPass.type === "verify.pass");
  assert("verify.pass status is success", verifyPass.status === "success");

  const verifyFail = makeVerifyReceipt({
    authority: "muthur",
    claimReceiptId: execReceipt.receiptId,
    verificationType: "visual",
    matches: false,
    details: "Text not found",
  });
  assert("verify.fail receipt created", verifyFail.type === "verify.fail");
  assert("verify.fail status is failed", verifyFail.status === "failed");

  console.log("\n--- Content Hash ---");
  const hash1 = computeContentHash({ a: 1, b: 2 });
  const hash2 = computeContentHash({ a: 1, b: 2 });
  const hash3 = computeContentHash({ a: 1, b: 3 });
  assert("same content same hash", hash1 === hash2);
  assert("different content different hash", hash1 !== hash3);
  assert("hash starts with h_", hash1.startsWith("h_"));

  console.log("\n--- Receipt ID Generation ---");
  const id1 = createReceiptId("test");
  const id2 = createReceiptId("test");
  assert("receipt IDs are unique", id1 !== id2);
  assert("receipt ID has prefix", id1.startsWith("test-"));

  console.log("\n--- Max Receipts Trimming ---");
  clearReceipts();
  for (let i = 0; i < 100; i++) {
    makeToolExecReceipt({
      capabilityId: "get_active_window",
      authority: "muthur",
      status: "success",
      inputs: { i },
      outputs: {},
    });
  }
  assert("100 receipts stored", getReceiptCount() === 100);
  assert("query with limit returns subset", queryReceipts({ limit: 10 }).length === 10);

  console.log("\n--- Direct recordReceipt ---");
  clearReceipts();
  const manualReceipt: MuthurReceipt = {
    receiptId: createReceiptId("manual"),
    type: "memory.write",
    authority: "muthur",
    timestamp: new Date().toISOString(),
    status: "success",
    namespace: "atlas",
    key: "entity:ship",
    valueHash: computeContentHash("ship"),
    valueSize: 4,
  } as MuthurReceipt;
  recordReceipt(manualReceipt);
  assert("manual receipt stored", getReceiptCount() === 1);
  assert("manual receipt retrievable", getReceiptById(manualReceipt.receiptId)?.type === "memory.write");

  clearReceipts();
  console.log("\n=== Probe Complete ===");
}

main();
