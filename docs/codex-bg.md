---
summary: Durable background runner for long Codex-adjacent jobs with logs, resume metadata, and optional Gmail completion email.
read_when:
  - Running a long local job that should survive a Codex session ending.
  - Sending completion email for a background job through the JK Gmail bus agent.
  - Adding or troubleshooting Codex session resume metadata in job reports.
---

# Codex Background Runner

`codex-bg` starts a local command, captures logs, writes a durable summary, and can send a completion email through the existing JK Gmail ingest agent.

Use it when a bakeoff, audit, crawl, or validation run might outlive the current Codex session.

## Basic Use

```bash
codex-bg start --name glm-bakeoff --timeout 2h --cwd ~/Projects/shared/manager -- \
  bash -lc 'go run ./cmd/local-intake-brief-exam --help > "$CODEX_BG_SUMMARY_FILE"'
```

The runner prints a run id and status command:

```bash
codex-bg status <run-id>
codex-bg tail <run-id>
codex-bg tail <run-id> --stderr
```

State lives in `~/.local/share/codex-bg/runs/` by default. Override with `CODEX_BG_STATE_DIR`. This is local agent working state, not a source of truth; it is safe to prune old runs after any needed proof is saved.

## Resume Metadata

`codex-bg` detects the newest Codex session id from `~/.codex/sessions/` when possible. Pass `--session-id` when the job is launched from a wrapper or another terminal:

```bash
codex-bg start --session-id "$(codex-bg current-session-id)" --name long-check -- ./scripts/check
```

Reports include:

```bash
codex resume <session-id>
```

If no session id is available, reports fall back to:

```bash
codex resume --last --all
```

## Email Notification

Email is a bus-backed write action. The sender agent is `codex-bg-notifier`; it sends a request to the write-capable `jk-gmail-ingest` agent using the `email-send` path.

```bash
codex-bg start \
  --name glm-bakeoff \
  --timeout 2h \
  --email joel@kehle.com \
  --cwd ~/Projects/shared/manager \
  -- bash -lc './scripts/run-long-check > "$CODEX_BG_SUMMARY_FILE"'
```

Requirements:

- `codex-bg-notifier` is present in `~/Projects/shared/manager/ops/config/allowlist.txt`.
- JK bus is reachable at `http://localhost:8081` or set `CODEX_BG_BUS_URL`.
- HMAC secret lives at `~/.config/codex-bg/secret`; the runner creates it with `0600` permissions when missing.

The email body starts with a plain-English section, then status, run id, duration, local summary path, optional proof URL, log directory, and the Codex resume command.

For useful completion emails, have the job write a short human result to `CODEX_BG_EMAIL_FILE`. Keep it to complete sentences: what ran, whether it passed, the important comparison numbers, what changed, and what Joel should do next.

```bash
codex-bg start --name model-bakeoff --email joel@kehle.com -- \
  bash -lc 'printf "Both models passed. GLM was faster on this exam; see artifacts for details.\n" > "$CODEX_BG_EMAIL_FILE"'
```

## Launcher Choice

Default launcher is `auto`: use `systemd-run --user` when available, otherwise a detached Node supervisor. Force a mode when needed:

```bash
codex-bg start --launcher systemd --name job -- ./script
codex-bg start --launcher nohup --name job -- ./script
codex-bg start --launcher foreground --name job -- ./script
```

When using `systemd`, load secrets inside the command or from files. Do not rely on interactive shell exports being present in the user service environment.

## Secret Hygiene

Command lines and summaries redact common Hugging Face and OpenAI token patterns plus bearer headers. Prefer reading tokens from files inside the launched command:

```bash
codex-bg start --name hf-check -- \
  bash -lc 'HF_TOKEN="$(tr -d "\r\n" < ~/.codex/hf_token)" ./scripts/check'
```
