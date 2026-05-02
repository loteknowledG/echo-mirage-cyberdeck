# Echo Mirage Project Group Init

Echo Mirage needs a small project root marker before version control behavior turns on.
This is the equivalent of `git init`, but for a local-first copy/restore workflow.

## Goal

- Give a project a real root folder and identity.
- Keep version control scoped to that project only.
- Turn on archive-before-write behavior only after the project is initialized.
- Keep live files in normal locations so tools and compilers keep working.

## Init Action

The app should expose a button like:

- `NEW PROJECT GROUP`
- `START PROJECT`
- `INIT PROJECT`

That button should:

1. Ask for a project name.
2. Ask for a root folder or create one.
3. Create a hidden project marker folder.
4. Write a manifest file.
5. Create an archive folder.
6. Enable project-scoped version control.

## Recommended Project Marker

Use a hidden folder at the project root:

```txt
MyProject/
  .echo-mirage/
    project.json
    archive/
```

That folder is the project root marker, just like `.git/` in Git.

## Project Manifest

The manifest should stay small and human-readable.

```json
{
  "schemaVersion": 1,
  "kind": "echo-mirage-project",
  "id": "proj_01",
  "name": "My Project",
  "createdAt": "2026-05-01T23:20:24.261Z",
  "updatedAt": "2026-05-01T23:20:24.261Z",
  "versioningEnabled": true,
  "saveStrategy": "copy-first",
  "archiveDir": ".echo-mirage/archive",
  "restorePolicy": "manual",
  "activeFile": null,
  "lastOpenedFile": null
}
```

## Core Rules

1. The live project keeps the real files in their normal paths.
2. Before a save writes to a live file, the old version is copied into `.echo-mirage/archive/`.
3. The archive stays out of the compiler's way.
4. Restore means copy the archived file back to the live path.
5. The manifest only turns versioning on for the initialized project.

## Folder Shapes

### Code Project

```txt
MyApp/
  .echo-mirage/
    project.json
    archive/
      2026-05-01T23-20-24Z/
        src/
        docs/
  src/
  public/
  package.json
  tsconfig.json
```

### Docs Project

```txt
MyDocs/
  .echo-mirage/
    project.json
    archive/
      2026-05-01T23-20-24Z/
        docs/
  docs/
    intro.md
    design.md
    notes.md
```

### Voice Project

```txt
VoicePack/
  .echo-mirage/
    project.json
    archive/
      2026-05-01T23-20-24Z/
        muthur.json
  muthur.json
```

## Why This Helps

- The user gets a clear "start project" moment.
- The app knows when a workspace is being versioned.
- Old versions stay easy to restore.
- Live files stay normal and compiler-friendly.
- The archive model remains simple and local-first.

## Relationship To Archive Design

This project init layer sits above the archive folder design.

- `project.json` says a workspace is versioned.
- `.echo-mirage/archive/` stores old copies.
- live files remain the source of truth the user edits.

