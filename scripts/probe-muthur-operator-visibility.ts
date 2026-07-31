import assert from "node:assert/strict";
import { buildMuthurSystemContent } from "../src/lib/muthur/chat/muthur-chat-posture";
import {
  buildClientOperatorObservation,
  formatClientDeckContextForMuthur,
} from "../src/lib/muthur/observation/client-operator-snapshot";
import {
  getLatestMuthurObservation,
  recordMuthurObservation,
} from "../src/lib/muthur/observation/observation-store.server";
import type { MuthurScreenSnapshot } from "../src/lib/muthur-screen-context";

const sampleSnapshot: MuthurScreenSnapshot = {
  capturedAt: new Date().toISOString(),
  activeServer: "mirage",
  activeCustomTab: null,
  chat: [],
  streamingMuthur: null,
  operator: {
    surfaceMode: "workspace",
    fileName: "muthur-manifesto.md",
    filePath: "docs/muthur-manifesto.md",
    previewSurface: "markdown",
    docMode: "view",
    documentText: "# The MUTHUR Manifesto\n\nKnowledge is relationships.",
  },
  browserUrl: null,
};

function run() {
  const deckPrompt = formatClientDeckContextForMuthur(sampleSnapshot);
  assert.match(deckPrompt, /muthur-manifesto\.md/);
  assert.match(deckPrompt, /docs\/muthur-manifesto\.md/);
  assert.match(deckPrompt, /do not claim the pane is empty/i);

  const clientObs = buildClientOperatorObservation(sampleSnapshot);
  assert.equal(clientObs?.visibleDocument, "muthur-manifesto.md");
  assert.equal(clientObs?.editor?.readOnly, true);
  assert.match(clientObs?.editor?.content ?? "", /Knowledge is relationships/);

  recordMuthurObservation({
    route: "/cyberdeck",
    surface: "cyberdeck",
    activeTab: "mirage",
    activePane: "operator",
    visibleDocument: "muthur-manifesto.md",
    documentExcerpt: "Knowledge is relationships.",
    editor: {
      active: false,
      filePath: "docs/muthur-manifesto.md",
      fileName: "muthur-manifesto.md",
      fileExtension: "md",
      language: "markdown",
      content: "# The MUTHUR Manifesto",
      contentExcerpt: "# The MUTHUR Manifesto",
      selectionText: null,
      cursorLine: null,
      cursorColumn: null,
      dirty: false,
      readOnly: true,
    },
  });

  recordMuthurObservation({
    route: "/cyberdeck",
    surface: "cyberdeck",
    activeTab: "mirage",
    activePane: "glyph-channel",
    visibleDocument: null,
    documentExcerpt: null,
  });

  const merged = getLatestMuthurObservation("cyberdeck");
  assert.equal(merged?.editor?.fileName, "muthur-manifesto.md");
  assert.match(merged?.editor?.content ?? "", /MUTHUR Manifesto/);

  const { systemContent } = buildMuthurSystemContent({
    message: "what do you think of this manifesto?",
    operatorContext: {
      fileName: "muthur-manifesto.md",
      localFilePath: "docs/muthur-manifesto.md",
      previewSurface: "markdown",
      docMode: "view",
    },
    posture: "agent",
    memoryPrompt: "",
    browserPrompt: "",
    glyphPrompt: "",
    glyphDoctrine: "",
    deckScreenPrompt: deckPrompt,
  });
  assert.match(systemContent, /Operator pane context \(from client\)/);
  assert.match(systemContent, /Live operator pane \(client snapshot/);
  assert.match(systemContent, /muthur-manifesto\.md/);

  console.log("probe-muthur-operator-visibility: PASS");
}

run();
