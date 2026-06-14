# ADR-FS-001 — Workspace Mutation Doctrine

**Status:** Accepted  
**Date:** 2026-06-07  
**Work order:** L-FS-001  
**Verification:** JP-L-FS-001

## Decision

Workspace folder creation is performed only through validated server endpoints (`POST /api/workspace/create-folder`) with workspace-boundary checks. Operators create structure from the picker UI; no direct client filesystem access.

## Context

Workspace navigation supported read-only browsing. Architecture workflows (work orders, verifications, ADRs, memory archives) require in-app folder organization.

## Consequences

- Parent paths must be workspace-relative; path traversal blocked
- Folder names validated (reserved names, invalid characters)
- Tree refreshes immediately after create and after document save
- Future MUTHUR commands can invoke the same controlled endpoint

## Keywords

folder creation, workspace mutation, create-folder, filesystem, operator picker
