# Echo Mirage

Echo Mirage is a copy-first, proposal-driven workflow for AI and human editing.

- `Echo` = copies
- `Mirage` = proposals
- original stays safe
- proposal can be reviewed, accepted, or rejected

```text
                           E C H O   M I R A G E
                     copy-first • proposal-driven • safe

┌──────────────────────────────────────────────────────────────────────┐
│                         ORIGINAL / MASTER                            │
│                      (the thing you do not lose)                     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                │  ECHO = make a copy
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           WORKING COPY                               │
│                     (draft / branch / proposal seed)                  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                │  MIRAGE = AI proposes change
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          PROPOSAL / MIRAGE                            │
│        view: compare • edit: diff • comment: ask AI to revise         │
└───────────────────────┬───────────────────────────────┬──────────────┘
                        │                               │
                     ACCEPT                         REJECT
                        │                               │
                        ▼                               ▼
┌───────────────────────────────┐          ┌────────────────────────────┐
│         ACTIVE COPY            │          │       DISCARD PROPOSAL     │
│   becomes the new live doc     │          │    original still safe     │
└───────────────────────────────┘          └────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                         TAB WORKFLOW                                 │
├───────────────────────────┬──────────────────────────────────────────┤
│         OPERATOR          │             WORKSHOP                     │
│   direct user edits       │      AI-made proposal copies             │
│   normal document mode    │      review / comment / revise           │
└───────────────────────────┴──────────────────────────────────────────┘
```

The main idea is simple:

1. make a copy
2. let AI propose a change
3. review the proposal
4. accept or reject it

That keeps the original safe and makes the workflow feel like a friendly, AI-native document system.
