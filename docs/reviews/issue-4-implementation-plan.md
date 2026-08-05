# Issue #4: no-push isolation — implementation plan

This page is a plan for running mission children under an OS user that cannot push, no matter what command they type. It answers manager issue #4 ("Enforce no-push execution for non-Joel dispatched coding agents"). It is paper only. Joel ratifies it before any contract starts. Source of truth: `~/Projects/tmp/issue-4-implementation-plan.md` (laptop, not a repo).

**Summary.** Today every mission child runs as `joelkehle`, the same OS user that holds push credentials. The git wrapper that blocks `git push` is a PATH shim, and its own header says "Guardrail only." The fix is a second OS user, `mission-worker`, with no credentials in its home or environment. The conductor hands work to it through two small sudo helpers. Every code change lands behind a config flag that defaults to off, and every step has a named canary check, because an unexercised spawn-path change crash-looped managerd on 2026-08-04 (179 restarts). This plan is written so that cannot happen again.

---

## 1. What the issue requires

Issue #4 (read 2026-08-04 via `gh issue view 4 --repo joelkehle/manager`) states the problem plainly: "`allow_push:false` is a guardrail rather than a security boundary. A dispatched process can bypass command wrappers and may inherit credentials capable of pushing." It requires five things:

1. a separate unprivileged OS user;
2. no push credentials in its home or environment;
3. bounded project-directory permissions;
4. tests proving absolute-path, `git -C`, and configured-command push attempts fail;
5. a documented launch, review, and recovery path.

## 2. How children spawn today (the real code path)

All file references are in `manager/internal/projectsmcp/` on beelink.

- **The conductor lives in managerd**, a systemd *user* service for `joelkehle`: `~/.config/systemd/user/claude-projects-mcp.service` (`ExecStart=/home/joelkehle/Projects/shared/manager/claude-projects-mcp`, `EnvironmentFile=.../manager/.env`). No root, no privilege separation.
- **The single spawn point** is `startManaged` (`agent_runs.go:351`). It does `exec.Command(options.spec.name, options.spec.args...)` with `cmd.Dir = project.Path`, `cmd.Env = options.spec.env`, stdout/stderr to a log file the conductor opens, and `SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGKILL}` (`agent_runs.go:374-382`). Every run — contributor, reviewer, validation — goes through here.
- **Commands are built** in `buildAgentCommand` (`agent_run_profiles.go:12`): `claude -p --permission-mode bypassPermissions` or `codex exec`. A comment at `agent_runs.go:31-35` admits why: acceptEdits would prompt on Bash calls, so policy rests on `--disallowedTools` plus the git wrapper.
- **The git wrapper** (`gitWrapperScript`, `agent_run_profiles.go:159`) is a PATH-prefix shim. Its first line of output is the confession: `# Guardrail only: absolute-path calls such as /usr/bin/git push are NOT covered by this PATH shim.` (`agent_run_profiles.go:185`).
- **Termination** is `terminateProcessGroup` (`agent_runs.go:962`): `syscall.Kill(-pid, SIGTERM)` then SIGKILL, and `processGroupExists` (`agent_runs.go:997`) treats `EPERM` as "still alive." Remember that detail — it is the number-one way a user split can break this code.
- **Mission-confined codex runs** get more: a scratch HOME in `/tmp` (`prepareAgentMissionScratch`, `agent_run_mission_confinement.go:71`), a codex permission profile that limits filesystem access to the workspace plus verified runtime read roots (`missionPermissionProfileConfigWithLoopback`, `:144`), `shell_environment_policy inherit="none"` (`:221`), and validation commands wrapped in `unshare --user --net` (`missionValidationNamespaceArgs`, `agent_runs.go:334`). This is good confinement — but it is codex's own sandbox, running as `joelkehle`. It is policy, not an OS boundary.

## 3. Where credentials live today (what a child can reach)

Checked on beelink 2026-08-04. The user `joelkehle` is uid 1000 and is in **sudo** and **docker** groups. Push-capable material reachable by any process running as that user:

| Credential | Location | How it pushes |
|---|---|---|
| GitHub OAuth token | `~/.config/gh/hosts.yml` | `~/.gitconfig` sets `credential.helper = !gh auth git-credential`, so plain `git push` over https just works |
| SSH key | `~/.ssh/id_ed25519` | any ssh remote |
| SSH agent | `SSH_AUTH_SOCK` — explicitly allowlisted into non-mission child env (`buildAgentEnv`, `agent_run_profiles.go:240`) | agent-signed push |
| Model/API keys | `ANTHROPIC_*`, `OPENAI_*`, `CLAUDE_CODE_OAUTH_TOKEN` allowlisted (`agent_run_profiles.go:241-251`) | not git, but spend |

Mission-confined runs strip `SSH_AUTH_SOCK`, `ANTHROPIC_*`, `CLAUDE_*`, `AWS_*`, `GOOGLE_*`, `VERTEX_*` (`agent_run_profiles.go:266-274`) and the codex sandbox hides `~/.config`. Non-mission runs (profile `workspace-write`, and every `claude_code` run) keep real `HOME` and the ssh agent. Either way, one sandbox escape lands in a shell that owns push credentials and sudo. That is what issue #4 closes.

## 4. Proposed user layout on beelink

- **User:** `mission-worker`. System account, locked password, shell `/bin/bash` (children need a shell), never in `sudo`, `docker`, or `joelkehle` groups.
- **Home:** `/home/mission-worker`. Contents: nothing but runtime caches. No `.gitconfig` credential helper, no `.config/gh`, no `.ssh`, no agent socket.
- **Shared group:** `mission-work`, members `joelkehle` + `mission-worker`, used only for handoff directories.
- **Runtime:** `/opt/mission-runtime/` (root-owned, world-readable): node, the npm codex package, and the Go toolchain plus a shared `gomodcache`. This is required because today's codex resolves inside `/home/joelkehle/.nvm/...` and Go's module cache is `~/go/pkg/mod` (`resolveAgentMissionRuntimeBoundary`, `agent_run_mission_confinement.go:391`) — both unreadable to `mission-worker` once Joel's home is `750`.
- **Project-directory access (bounded):** the conductor already reserves a project per mission (`reserveProject`, `agent_runs.go:479`). At mission start it grants `setfacl -R -m u:mission-worker:rwX` plus a matching default ACL on the one reserved project directory, and removes the ACL at mission end. The worker can write that tree and nothing else of Joel's. Phase 2 (later, optional): move mission workspaces to local clones under `/srv/missions/<run-id>` owned by `mission-worker`, with the conductor fetching the branch back by path — a stronger box, but a bigger conductor change, so it is not phase 1.
- **Scratch:** `prepareAgentMissionScratch` makes `0700` dirs owned by managerd's user (`agent_run_mission_confinement.go:80`). Under the flag, scratch creation moves into the spawn helper so the worker owns its scratch.

Even if the worker reads the project's `.git`, pushing fails: the https helper is absent, the ssh key is unreadable, and there is no agent socket. Residual risk, stated honestly: a worker could still `git remote add` an attacker URL that embeds *the attacker's* credentials and push code out. Credential removal cannot stop that; network egress policy (the codex sandbox network rules, and later host firewalling) is the control, and it stays out of scope for #4 exactly as the issue's Boundary section says.

## 5. Handing work to the unprivileged user: sudo helpers (recommended)

Three options were weighed:

1. **sudoers rule + two fixed helpers — recommended.**
2. **Custom setuid binary — rejected.** Writing our own setuid root program is strictly more dangerous than sudo, and loses sudo's logging.
3. **systemd (`systemd-run --uid` or a template unit) — rejected for phase 1.** managerd is a *user* service; setting `--uid` needs the system manager, which means root or polkit policy. It would also replace the process-group lifecycle (`Setpgid`, `Pdeathsig`, `terminateProcessGroup`) wholesale — the largest possible spawn-path rewrite, which is exactly what the crash-loop mandate forbids. Worth revisiting after phase 1 is boring.

The sudo design, concretely:

- `/etc/sudoers.d/mission-worker`:
  - `joelkehle ALL=(mission-worker) NOPASSWD: /usr/local/bin/mission-spawn`
  - `joelkehle ALL=(mission-worker) NOPASSWD: /usr/local/bin/mission-reap`
- **`mission-spawn`** (root-installed, mode 755, argument-validating): makes the worker-owned scratch, `setsid`s the payload into its own process group, writes the payload pgid to a conductor-readable file, then waits. It holds the stdin pipe from managerd open; on stdin EOF (managerd died) it kills its payload group. This replaces `Pdeathsig`, which stops working across a uid boundary.
- **`mission-reap <pgid> <TERM|KILL>`**: signals the recorded payload group. Needed because `terminateProcessGroup` runs as `joelkehle` and `kill(-pid)` on `mission-worker` processes returns `EPERM` — and `processGroupExists` reads `EPERM` as "alive" (`agent_runs.go:1002`), so without this helper every cancel would hang forever.
- In `buildAgentCommand`, when the flag is on, `spec.name` becomes `sudo` and the args get the prefix `-u mission-worker -- /usr/local/bin/mission-spawn ...`. Stdout/stderr file descriptors (1 and 2) pass through sudo untouched, so run logs keep working.
- Child env is built exactly as today, then the flag additionally strips `SSH_AUTH_SOCK` for *all* profiles and sets `HOME=/home/mission-worker` for non-mission runs.

## 6. Test matrix (all must fail, each captured as a receipt)

Run inside a spawned child, as `mission-worker`, in a reserved project:

| # | Attempt | Expected failure |
|---|---|---|
| 1 | `git push origin HEAD` | no credential helper output, non-interactive auth fails, exit != 0 |
| 2 | `/usr/bin/git push origin HEAD` (absolute path — the shim bypass) | same |
| 3 | `git -C /full/path push origin HEAD` | same |
| 4 | configured command: `git config alias.p push && git p`; also `git -c credential.helper=...` pointing at Joel's helper | helper unreachable / token unreadable, exit != 0 |
| 5 | `GIT_SSH_COMMAND='ssh -i /home/joelkehle/.ssh/id_ed25519' git push ssh-remote` | key unreadable (EACCES) |
| 6 | `gh auth status`; `gh api user` | no token found |
| 7 | `cat /home/joelkehle/.config/gh/hosts.yml` | EACCES |
| 8 | `printenv SSH_AUTH_SOCK` | empty; and Joel's agent socket is 0600 `joelkehle` anyway |

Plus two *positive* controls, so the box is proven open where it should be: the worker **can** commit in the reserved project, and the conductor **can** still push the branch afterward as itself. The matrix becomes a permanent mission validation script so it re-runs on every future spawn-path change.

## 7. Host provisioning commands (staged; a human runs these, in order)

```bash
# Step P1 — user and groups (inert until the flag flips)
sudo adduser --disabled-password --gecos "supervised mission worker" mission-worker
sudo usermod -L mission-worker
sudo groupadd mission-work
sudo usermod -aG mission-work joelkehle
id mission-worker   # verify: NOT in sudo, docker, or joelkehle groups

# Step P2 — close Joel's home to the worker
chmod 750 /home/joelkehle
stat -c '%a %U:%G' /home/joelkehle   # expect 750 joelkehle:joelkehle

# Step P3 — shared runtime (node + codex + go + module cache)
sudo mkdir -p /opt/mission-runtime
# install node + @openai/codex + go under /opt/mission-runtime (root-owned, a+rX)
# seed gomodcache: sudo -u mission-worker GOMODCACHE=/opt/mission-runtime/gomodcache go mod download (per repo)

# Step P4 — helpers and sudoers
sudo install -m 755 mission-spawn mission-reap /usr/local/bin/
sudo visudo -f /etc/sudoers.d/mission-worker   # the two NOPASSWD lines from section 5
sudo -u mission-worker -n /usr/local/bin/mission-spawn --self-test   # proves the rule

# Step P5 — git identity for the worker (safe.directory so git accepts Joel-owned repos)
sudo -u mission-worker git config --global user.name  "mission-worker"
sudo -u mission-worker git config --global user.email "mission-worker@beelink.invalid"
# safe.directory entries are injected per-run via GIT_CONFIG_* env by the conductor, not stored

# Step P6 — flag flip, ONLY after all code missions below are merged, deployed, and canaried with the flag off
# add CLAUDE_PROJECTS_MCP_MISSION_USER=mission-worker to manager/.env, restart managerd, run the canary ladder (section 9)
```

Steps P1–P5 are inert: nothing consults the new user until P6. Rollback at any point = remove the `.env` line and restart. No binary rollback is ever needed.

## 8. Mission contract splits (code vs. ops-by-hand)

**Code missions (manager repo, each behind `CLAUDE_PROJECTS_MCP_MISSION_USER`, default off):**

- **M1 — spawn prefix + helpers' Go side.** `buildAgentCommand` sudo prefix; pgid-file plumbing; `terminateProcessGroup` branch that calls `mission-reap`; unit tests with a fake helper. No behavior change with the flag empty — proven by the existing test suite passing untouched.
- **M2 — env and scratch.** Strip `SSH_AUTH_SOCK` everywhere under the flag; worker HOME; scratch creation via helper; per-run `GIT_CONFIG_*` safe.directory injection.
- **M3 — ACL grant/revoke** around project reservation, with revoke guaranteed in `wait()` cleanup.
- **M4 — the test matrix** as a validation script plus a `mission_validation` receipt wiring, run in CI against a fixture user where possible and on beelink as the acceptance mission.

The two helper scripts (`mission-spawn`, `mission-reap`) are small enough to be one code mission with independent review, but they are *installed* by hand (P4) — install is an ops act.

**Ops-by-hand (Joel, staged):** P1–P6 above, plus the final acceptance run. Nothing in P1–P5 requires touching a running mission.

## 9. Spawn-breaking risks and the canary for each

Standing rules already in force (learned 2026-08-04): deploy = build + restart + canary spawn; sustained canary; legacy-state fixtures; never restart managerd mid-mission. This plan adds a flag so the new path cannot activate by deploy accident — the 2026-08-04 crash loop happened because a restart silently activated an unexercised confinement rewrite. A flag that defaults to current behavior makes that class of failure structurally impossible.

| # | Step that could break spawning | Failure it would cause | Canary check (run before real missions) |
|---|---|---|---|
| R1 | sudo prefix (M1) | child never starts; or cancel hangs forever on EPERM (`agent_runs.go:1002`) | start a trivial echo mission, then **cancel** one: assert status `killed` and `ProcessDeathConfirmed=true` |
| R2 | codex runtime moved to /opt (P3) | `verifyAgentMissionCodexBoundary` preflight fails, every mission dies at start | with flag on: `codex features list` preflight as worker succeeds; then one full canary mission end-to-end |
| R3 | `chmod 750` Joel home (P2) | *current* (flag-off) missions lose a read root they silently relied on | immediately after P2, with flag still off: run one canary mission on the old path |
| R4 | git "dubious ownership" (M2/M3) | contributor cannot commit; every mission exhausts budget | canary mission whose contract is exactly "make one commit in a scratch repo"; assert candidate SHA exists |
| R5 | scratch ownership (M2) | codex cannot write HOME/TMPDIR, instant failure | canary asserts a file written to scratch by the child |
| R6 | gomodcache move (P3) | validation commands fail or take 10x time | run the repo's full validation command as worker once, by hand, before flag flip |
| R7 | log fd passing through sudo (M1) | silent runs, empty receipts | canary asserts non-empty run log and session id extraction |
| R8 | flag flip itself (P6) | anything above, in production | the full ladder: flag on → echo canary → cancel canary → commit canary → matrix mission → 30-minute sustained canary; any failure → remove flag line, restart, file findings |

## 10. Launch, review, and recovery path (issue requirement 5)

- **Launch:** unchanged for Joel — `manager-mission start --contract ...`. The conductor decides the OS user from the flag; contracts do not change shape.
- **Review:** unchanged — contributor and reviewer receipts, packet, Joel merges. The packet's authority section already records `push_performed: false` (`agent_mission_ready.go:353-357`); after this work that claim is enforced by the OS, not asserted.
- **Recovery:** if the worker path misbehaves, remove `CLAUDE_PROJECTS_MCP_MISSION_USER` from `.env` and restart managerd between missions — the old path is untouched code. Orphaned worker processes: `sudo -u mission-worker /usr/local/bin/mission-reap <pgid> KILL`, or worst case `sudo pkill -u mission-worker`. Leftover ACL cleanup: `setfacl -R -x u:mission-worker <project>` is idempotent and safe while missions are stopped.

## 11. Relation to the rest of the remediation

Issue #25's delegated-authority grants assume the worker cannot push outside the grant *even if it ignores instructions* — this plan is what makes that true, which is why #4 is sequenced before WO-2b (live publisher). The keep-blocking list in `hitl-audit-2026-08.md` (merge to main, deploy, money, external publication) is unaffected: this plan removes capability from workers; it does not move any decision away from Joel.
