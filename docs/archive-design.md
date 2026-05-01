# Echo Mirage Archive Folder Design

Echo Mirage uses an archive folder to keep old versions of files out of the live project while still making them easy to restore later.

## Goal

- Keep the live file name unchanged so compilers and tools keep working.
- Save the old version before writing a new one.
- Keep archived copies outside the active source tree.
- Make restore simple and predictable.

## Core Rules

1. The live file stays in its normal location.
2. Before an edit is committed, the old file is copied into the archive.
3. The archive copy keeps the original filename.
4. The archive lives in a separate folder that the compiler does not scan.
5. Restoring a file means copying the archived version back into the live path.

## Recommended Folder Shape

Use a stable archive root, then mirror the project path inside it.

```txt
src/components/button.tsx
.echo-mirage/archive/project-name/src/components/button.tsx/2026-05-01T11-09-29Z/button.tsx
```

That keeps:

- the original filename intact
- the project path readable
- the backup version separated by time

## Save Flow

1. Open the live file.
2. Edit the working copy.
3. Before writing the change, copy the current live file into the archive folder.
4. Write the new content back to the original path.
5. The compiler sees the same filename, so the project keeps building normally.

## Restore Flow

1. Find the archived copy you want.
2. Copy it back to the original live path.
3. Reopen or rebuild the project.

## Why Put Time In The Folder

Putting the timestamp in the folder name instead of the filename keeps the file itself clean.

Good:

```txt
archive/project/foo/2026-05-01T11-09-29Z/foo.ts
```

Less ideal:

```txt
archive/project/foo.unixtime.ts
```

The folder-based approach is easier to restore, easier to scan, and keeps the real file name boring.

## Why This Works Well For Echo Mirage

- It is copy-first.
- It protects against AI slop.
- It keeps the compiler happy.
- It gives users a clear rollback path.
- It stays simple enough to understand quickly.

## Short Version

Live file first.
Archive old copy first.
Write new content to the same path.
Restore by copying the archived version back.

