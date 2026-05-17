# Echo Mirage Fusion Memory Workflow

This document explains how memory, orchestration, and runtime cognition interact inside the Echo Mirage Cyberdeck architecture.

```text
 USER ACTION / EVENT
          |
          v
+---------------------------+
|     Echo Mirage UX        |
| (chat / rail / commands)  |
+-------------+-------------+
              |
              v
+---------------------------+
|          Fusion           |
|  Workflow / Task Runtime  |
+-------------+-------------+
              |
              | 1. Determine intent
              | 2. Determine active scope
              | 3. Resolve worktree/project
              v
+---------------------------+
|          MUTHUR           |
| Continuity + Memory Layer |
+-------------+-------------+
              |
              | Retrieve:
              | - canonical docs
              | - related memories
              | - recent receipts
              | - operational context
              | - prior workflows
              v
+---------------------------+
|   Context Assembly Layer  |
|  ("runtime cognition")    |
+-------------+-------------+
              |
              | Inject grounded context
              v
+---------------------------+
|  Active Agents / Models   |
| Cursor / Codex / GPT etc  |
+-------------+-------------+
              |
              | Actions / outputs / changes
              v
+---------------------------+
| Receipts + Reinforcement  |
|  logs / summaries / refs  |
+-------------+-------------+
              |
              | Store:
              | - outcomes
              | - workflow traces
              | - reinforced memory
              | - task linkage
              v
+---------------------------+
|          MUTHUR           |
| updated continuity state  |
+---------------------------+
```

---

## Core Concept

Memory is not treated as simple chat history.

Memory represents:

- operational continuity
- contextual grounding
- workflow recall
- doctrine retrieval
- task reinforcement
- runtime state restoration

Fusion acts as the orchestration layer that determines:

> "What memory is relevant right now?"

MUTHUR acts as the continuity authority that answers:

> "What continuity exists?"

Agents operate inside assembled runtime context rather than isolated prompts.

---

## Runtime Flow

1. User performs an action or issues a command.
2. Echo Mirage UX forwards the event into Fusion.
3. Fusion determines:
   - user intent
   - active project scope
   - worktree/runtime context
4. Fusion queries MUTHUR for relevant continuity data.
5. MUTHUR retrieves:
   - canonical documents
   - related memories
   - operational receipts
   - prior workflow references
6. Context Assembly Layer builds grounded runtime cognition.
7. Active agents receive contextualized operational state.
8. Agents perform actions and generate outputs.
9. Receipts/logs are generated and reinforced.
10. Updated continuity state is stored back into MUTHUR.

---

## Architectural Roles

### Echo Mirage UX
User-facing operational surface:
- panels
- rails
- chat
- workflow interaction

### Fusion
Operational nervous system:
- workflow orchestration
- task runtime
- multi-agent coordination
- memory routing
- worktree awareness

### MUTHUR
Continuity and cognition layer:
- memory authority
- canonical document grounding
- persistence
- continuity restoration
- future Semantic Atlas integration

### Context Assembly Layer
Responsible for constructing:
- runtime cognition
- grounded operational context
- memory-informed prompts
- task-aware agent state

---

## Doctrine

Documents decide.  
Memory recalls.  
Fusion orchestrates.  
MUTHUR restores continuity.
