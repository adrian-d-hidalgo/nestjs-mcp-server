#!/usr/bin/env python3
"""PreToolUse hook: gate destructive and release-owned shell commands.

Makes the CLAUDE.md non-negotiable mechanical rather than advisory:

    "Never run `git commit`, `git push`, `git reset --hard`, `git rebase`, or
     publish without the user typing the exact command. 'Finish the task' is
     not authorization."

Three decisions:
  DENY   — catastrophic or release-owned. No prompt, no override from the model.
  ASK    — state-changing but legitimate when the user asked for it. The user
           confirms, which IS them authorizing the exact command.
  ALLOW  — everything else (exit 0 silently).

Emits the PreToolUse JSON decision on stdout and always exits 0; blocks are
logged to ~/.claude/hooks-logs/<date>.jsonl.
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

# --- DENY -------------------------------------------------------------------
# Catastrophic, unrecoverable, or owned by the release automation.
DENY = [
    # Filesystem catastrophes
    (r"\brm\s+(-\S+\s+)*['\"]?(~/?|\$HOME)['\"]?(\s|$|[;&|])", "rm-home"),
    (r"\brm\s+(-\S+\s+)*(\./?|\*|\./\*)(\s|$|[;&|])", "rm-cwd-contents"),
    (r"\brm\s+(-\S+\s+)*/(\*|\s|$|[;&|])", "rm-root"),
    (r"\brm\s+(-\S+\s+)*/(etc|usr|var|bin|sbin|lib|boot|dev|proc|sys)(/|\s|$)", "rm-system-dir"),
    (r"\brm\b.+\.ssh/(id_|authorized_keys|known_hosts)", "rm-ssh"),
    (r"\bdd\b.+of=/dev/(sd[a-z]|nvme|hd[a-z]|vd[a-z]|xvd[a-z])", "dd-disk"),
    (r"\bmkfs(\.\w+)?\s+/dev/", "mkfs-disk"),
    (r":\(\)\s*\{.*:\s*\|\s*:.*&", "fork-bomb"),
    (r"\bchmod\b.+\b777\b", "chmod-777"),
    (r"\b(curl|wget)\b.+\|\s*(ba|z|fi)?sh\b", "curl-pipe-sh"),
    # Git history destruction
    (r"\b(rm|mv)\s+(-\S+\s+)*[-~]?(/|~/|\./)?\.git(\s|$|[;&|])", "git-dir-destroy"),
    (r"\bgit\s+reset\s+--hard\b", "git-reset-hard"),
    (r"\bgit\s+clean\s+(-\S*f|-f)", "git-clean-force"),
    (r"\bgit\s+push\b(?!.*--force-with-lease).*(--force\b|-f\b)", "git-force-push"),
    (r"\bgit\s+branch\s+-D\b", "git-branch-force-delete"),
    (r"\bgit\s+stash\s+(clear|drop)\b", "git-stash-destroy"),
    # Any form that overwrites the working tree from a ref or the index.
    # The earlier version only caught `git checkout .` / `git restore .` and let
    # `git checkout HEAD -- <path>` through, which discarded uncommitted work.
    (r"\bgit\s+checkout\b[^|;&]*\s--\s", "git-discard-worktree"),
    (r"\bgit\s+checkout\s+\S+\s+--\s", "git-discard-worktree-ref"),
    (r"\bgit\s+restore\b", "git-restore"),
    (r"\bgit\s+(checkout|restore)\s+(\.|--\s+\.)(\s|$)", "git-discard-worktree-dot"),
    # Publishing — semantic-release owns this, dispatched manually via Actions
    (r"\b(npm|pnpm|yarn)\s+publish\b", "publish"),
    (r"\bnpx\s+semantic-release\b", "semantic-release-local"),
    (r"\bnpm\s+(version|deprecate|unpublish|dist-tag)\b", "npm-registry-mutation"),
    # Secrets
    (r"\b(cat|less|head|tail|more|bat)\s+[^|;&]*\.env(\s|$|[;&|])", "read-dotenv"),
    (r"\b(cat|less|head|tail|more|bat)\b.+(credentials|\.pem|\.key|id_rsa|id_ed25519)", "read-secrets"),
    (r"\becho\b.+\$\w*(SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE)", "echo-secret"),
]

# --- ASK --------------------------------------------------------------------
# Legitimate when the user asked for it; the confirmation prompt IS the
# authorization CLAUDE.md requires.
ASK = [
    (r"\bgit\s+commit\b", "git-commit"),
    (r"\bgit\s+push\b", "git-push"),
    (r"\bgit\s+rebase\b", "git-rebase"),
    (r"\bgit\s+merge\b", "git-merge"),
    (r"\bgit\s+tag\b(?!\s+-l)", "git-tag"),
    (r"\bgit\s+cherry-pick\b", "git-cherry-pick"),
    (r"\bgit\s+revert\b", "git-revert"),
    (r"\bgit\s+checkout\s+-b\b", "git-new-branch"),
    (r"\bgit\s+switch\b", "git-switch"),
    (r"\bgh\s+(pr|release|issue)\s+(create|merge|edit|close|delete)", "gh-mutation"),
    (r"\bsudo\b", "sudo"),
    (r"\bdocker\s+(system|image|volume)\s+prune", "docker-prune"),
    (r"\b(rm|rmdir)\b", "rm"),
]

REASONS = {
    "publish": (
        "Publishing is owned by semantic-release and dispatched manually via "
        "GitHub Actions -> Release -> Run workflow (.handbook/GIT_GUIDELINES.md). "
        "Never publish from a local shell."
    ),
    "semantic-release-local": (
        "semantic-release runs in CI, not locally. Running it here can tag and "
        "publish from an unverified working tree."
    ),
    "npm-registry-mutation": (
        "Version numbers and dist-tags are computed by semantic-release from the "
        "commit history. Editing them by hand desynchronises the registry from the tags."
    ),
    "git-reset-hard": "Discards uncommitted work irrecoverably. Stash or commit first.",
    "git-force-push": "Force-pushing rewrites shared history. Use --force-with-lease, and only when you typed it yourself.",
    "read-dotenv": ".env holds credentials. Read .env.example instead.",
}

LOG_DIR = Path.home() / ".claude" / "hooks-logs"


def log(decision: str, rule_id: str, cmd: str, data: dict) -> None:
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        logfile = LOG_DIR / f"{datetime.now().strftime('%Y-%m-%d')}.jsonl"
        with open(logfile, "a") as fh:
            fh.write(json.dumps({
                "ts": datetime.now().isoformat(),
                "hook": "block-destructive",
                "decision": decision,
                "rule_id": rule_id,
                "command": cmd,
                "session_id": data.get("session_id", ""),
                "cwd": data.get("cwd", ""),
            }) + "\n")
    except Exception:
        pass


def classify(cmd: str):
    for pattern, rule_id in DENY:
        if re.search(pattern, cmd, re.IGNORECASE):
            return "deny", rule_id
    for pattern, rule_id in ASK:
        if re.search(pattern, cmd, re.IGNORECASE):
            return "ask", rule_id
    return None, None


def emit(decision: str, reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
    }))


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    if data.get("tool_name") != "Bash":
        return 0

    cmd = data.get("tool_input", {}).get("command", "")
    if not cmd:
        return 0

    decision, rule_id = classify(cmd)
    if decision is None:
        return 0

    log(decision, rule_id, cmd, data)

    if decision == "deny":
        detail = REASONS.get(rule_id, "This command is destructive or irreversible.")
        emit("deny", f"BLOCKED [{rule_id}] {detail}")
    else:
        detail = REASONS.get(
            rule_id,
            "CLAUDE.md: git and destructive operations require the user to authorize "
            "the exact command. 'Finish the task' is not authorization.",
        )
        emit("ask", f"CONFIRM [{rule_id}] {detail}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
