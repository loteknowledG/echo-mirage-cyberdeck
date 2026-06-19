import assert from "node:assert/strict";
import {
  getLatestMuthurObservation,
  recordMuthurObservation,
} from "../src/lib/muthur/observation/observation-store.server";

async function main() {
  recordMuthurObservation({
    route: "/cyberdeck",
    surface: "cyberdeck",
    activeTab: "operator",
    activePane: "editor",
    visibleDocument: "src/lib/muthur-core/loop.ts",
    documentExcerpt: "export function observe() {",
  });

  const observation = getLatestMuthurObservation("cyberdeck");
  assert.equal(observation?.route, "/cyberdeck");
  assert.equal(observation?.surface, "cyberdeck");
  assert.equal(observation?.activePane, "editor");
  assert.equal(observation?.visibleDocument, "src/lib/muthur-core/loop.ts");

  console.log("probe-muthur-observation: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
