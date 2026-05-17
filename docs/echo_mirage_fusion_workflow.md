# Echo Mirage Fusion Workflow

This document shows the layered architecture of the Echo Mirage Cyberdeck, including MUTHUR, Fusion, UX, and agent interactions.

```text
                  +---------------------------+
                  |  Echo Mirage UX          |
                  |  (Panels / Rails / Chat) |
                  +-----------+---------------+
                              |
                              v
                  +---------------------------+
                  |          Fusion           |
                  |  (Operational Nervous)   |
                  | - Task Coordination       |
                  | - Workflow Orchestration  |
                  | - Worktree Awareness      |
                  | - Memory Integration      |
                  | - Receipts & Logs         |
                  | - Multi-Agent Supervision |
                  +-----------+---------------+
                              |
                              v
                  +---------------------------+
                  |          MUTHUR           |
                  | (Continuity + Cognition) |
                  | - Memory Authority        |
                  | - Operational Cognition   |
                  | - Persistence Layer       |
                  | - Dream Mode / Atlas      |
                  +---------------------------+
                              ^
                              |
                              +-----------------------------+
                              | Agents (Cursor / Codex / GPT)|
                              +-----------------------------+

Flow Key:
User Action → Fusion → MUTHUR → Fusion → Agents → UX
```

---

## Notes

- **UX Layer:** Panels, rails, chat windows — user-facing interface.
- **Fusion Layer:** Operational nervous system; manages tasks, workflows, worktrees, memory integration, receipts/logs, and agent supervision.
- **MUTHUR Layer:** Continuity and cognition; authority over memory, operational cognition, persistence, and future consolidation (dream mode / Semantic Atlas).
- **Agents:** Cursor, Codex, GPT — act under Fusion supervision, feeding results back into MUTHUR.
