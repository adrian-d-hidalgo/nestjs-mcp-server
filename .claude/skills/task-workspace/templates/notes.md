<!--
## Findings log — .project/tasks/issue-<N>/notes.md

APPEND-ONLY. Newest entry last, each one dated. Any stage may append; no stage rewrites it.

Its whole value is the dead ends: the approach that looked right and wasn't, the API that doesn't
behave as documented, the thing found while looking for something else. Rewriting or "cleaning" the
file destroys exactly what it exists to preserve — the next session then re-investigates what was
already ruled out.

This file is gitignored and local. Anything a consumer or contributor must eventually know does NOT
belong here alone — it belongs in the issue.

Delete this comment block when writing the real file.
-->

# Notes — #<N> <issue title>

## <YYYY-MM-DD> · <stage: /specification | /develop | /debug>

**<short title of the finding>**

What was tried or found, and the conclusion. Cite `file:line` from calls actually run, and tag
confidence inline: `[Verified]` / `[Inference]` / `[Unverified]`.

If this rules something out, say so explicitly — "the cause is **not** X, because Y" is the most
useful sentence this file can contain.

---

<!--
Entry shapes worth using:

### Dead end
What was tried, why it looked right, what actually happened, and what that rules out.

### Ruled out
An approach considered and rejected before it was tried, with the reason. Stops it being
re-proposed in three weeks.

### Out of scope
Something broken or missing that was found while doing this work and deliberately NOT built.
Record what was proposed for it (a Mode B / Mode X issue) — if nothing was, say that, because an
unrecorded finding is a lost one.

### Upstream
Behaviour of @modelcontextprotocol/sdk (or another dependency) that is surprising, undocumented,
or contradicts its docs. The single highest-value entry type here: it is the knowledge that is
most expensive to rediscover and least likely to be written down anywhere else.

### Environment
A local-only factor that affected a result — a Node version, a stale dist/, a cached lockfile.
Prevents a future session drawing the wrong conclusion from the same symptom.
-->
