# Docs corpus review: editorial violations, architecture leaks, and fix missions

This page is a full review of the docs in three repos: `manager/docs`, `agent-scripts/docs`, and `ucla-tdg-ip-agents/docs` (all read from beelink on 2026-08-04). It judges every page against the two law files: `manager/docs/editorial-guidelines.md` and `manager/docs/glossary.md`. It has three parts. Part 1 ranks the worst pages and shows how to fix their prose. Part 2 lists places where the docs expose real design problems, not just writing problems. Part 3 is a ranked list of bounded doc missions Joel can turn into contracts. Source of truth: `~/Projects/tmp/docs-corpus-review-2026-08-04.md` (local laptop file; not part of any repo).

How the review was done: every markdown file in the three trees was read (168 files). A script measured sentence length and reading grade for each page. Three parallel readers covered the three repos. Every finding quoted below was verified against the source file by hand. Line numbers refer to the files on beelink.

---

## Part 1: The worst pages, ranked

The earlier reviewer flagged five pages. All five are confirmed as offenders. But two of them are not the worst. The re-ranked list below adds five pages that are worse or equally bad. Reading-grade scores come from a Flesch-Kincaid pass over prose only (code blocks and tables stripped). The target is grade 6. The corpus median is about grade 13.

### 1. `~/Projects/shared/agent-scripts/docs/github-native-lifecycle-read-propose-packet.md`

The biggest page in the corpus: 1,991 lines, ~356 sentences, 23 of them over 25 words. It is a spec, an evidence ledger, and a roadmap fused into one file. That triple purpose breaks the "one fact lives in one place" rule by design.

- Violations: no plain-language opening, jargon without definition ("idempotency key", "reducer", "disposable projection", "conflict-safe"), long passive walls, and raw command dumps mixed into prose.
- The fix is structural, not sentence-level: split it into a short spec page, a ledger page, and a roadmap page.

### 2. `~/Projects/ucla-tdg/ucla-tdg-ip-agents/docs/JK-SPEC-INTERNPM-001-CONFORMANCE.md` (flagged — confirmed)

Grade 16.6, 14 sentences over 25 words. No summary paragraph — the page opens with nine metadata lines and a wall of requirement codes (PM-WKR, PM-QTX, NFR, EI) that are never introduced. A reader who has not memorized the spec cannot start here.

- Verbatim (line 143): "The nudge recommendation surface regenerates on every snapshot with no durable record and no cooldown — the suppression MUST is violated by the present surface."
- Rewrite: "The code makes the same nudge again on every pass. It saves nothing and waits for nothing. The spec says it must wait. It does not."
- Verbatim (lines 17-20): "That package was renamed to `internal/contributioncoordinator` upstream while Wave 1 sat unlanded, so Wave 1 is being ported in stages and the paths above have been rewritten to the new package."
- Rewrite: "The package got a new name before Wave 1 landed. We are moving Wave 1 over piece by piece. The file paths in this table already use the new name."

### 3. `~/Projects/shared/manager/docs/services/claude-mcp-connectors.md` (flagged — confirmed)

No summary paragraph; the body starts at "Connector Entries" (line 11). It mixes four documents: a config reference, an auth design note, a token-minting runbook, and a troubleshooting guide. Acronyms PKCE, DCR, HMAC, and header names appear with no definition.

- Verbatim (line 53): "Canonical public resource and authorization-server URLs come from the configured route, never from forwarded request scheme/host values. `X-Forwarded-*` and unsigned Cloudflare identity headers remain ignored unless the request carries the optional `X-MCP-OAuth-Proxy-Token` break-glass marker matching `CLAUDE_MCP_OAUTH_PROXY_TRUSTED_PROXY_TOKEN`."
- Rewrite: "The proxy builds its public URLs from its own config. It never trusts URL hints from the caller. One exception exists: an emergency header that carries the exact secret token."

### 4. `~/Projects/shared/manager/docs/work-orders/supervised-coding-missions-status.md` (new)

A 1,209-line ledger with no summary paragraph and no reading path. It uses "Elephant" from line 36 onward without ever saying what an Elephant check is (the definition lives in `agent-scripts/docs/elephant/README.md`, unlinked).

- Verbatim (line 354): "initiative Elephant semantic extension preserving WWI, loop, skill, repository-instruction, and mission-layer ownership"
- Rewrite: "We extended the Elephant check for initiatives. It still respects who owns what: WWI, loops, skills, repo instructions, and the mission layer." (And define or link WWI and Elephant first.)

### 5. `~/Projects/shared/manager/docs/work-orders/supervised-coding-missions-live-trial.md` (new)

The evidence is excellent; the prose is not for humans. Nearly every "sentence" is a comma-chained bullet fragment (my parser measured an average of 135 words per sentence-unit — the page has almost no full sentences). It also invents words and mixes trial vocabulary (see Part 2, finding A5).

- Verbatim (frontmatter line 2 vs title line 9): summary says "Live ten-mission **canary** plan" while the title says "**Live Trial**" — the same page calls the same event two names.
- Verbatim (line 97): "live service health and repository cleanliness after terminalization"
- Rewrite: "whether the service was healthy and the repo clean after the mission ended." ("Terminalization" is an invented word; the glossary has "terminal" already.)

### 6. `~/Projects/shared/agent-scripts/docs/STATE_ARCHITECTURE.md` (new)

Grade 16.3, 24 sentences over 25 words across 185 sentences. Normative doctrine written as unbroken prose.

- Verbatim (~line 100 region): "The payload allowlist is limited to opaque synchronization lineage IDs; committed IMAP and Gmail History boundaries; unresolved and resolved gap types and status; machine-only capture, reconciliation, metadata-refresh, and gap-resolution obligations; canonical opaque provider message and thread locator IDs required to execute those obligations; capture intent, attempt, and outcome classification..." (66 words, one sentence)
- Rewrite: turn the list into bullets. "The payload may hold only these things:" followed by one item per line.

### 7. `~/Projects/shared/manager/docs/decisions/JK-SPEC-FAULTTOL-001.md` (flagged — confirmed)

No summary paragraph; opens with an ID block. Undefined acronyms: OOM, c-state, wal-g, GHCR, anycast. Long compound sentences throughout.

- Verbatim (line 15): "The outage took down every dependent layer simultaneously — public MCP endpoints (`kehle.nexus`, `techtransfer.agency` connectors), the personal and TDG wikis, the Pinakes bus, the Joel Projects connector, and the working copy of active development (x-bookmarks / llm-wiki)."
- Rewrite: "When the Beelink died, everything on it died too. That included the public connectors, both wikis, the bus, and the active dev work."

### 8. `~/Projects/shared/manager/docs/work-orders/supervised-coding-initiatives.md` (flagged — confirmed)

Has a good structure but grade-15 prose and undefined mid-document terms ("dispatch intent", "assurance mission" before its definition).

- Verbatim (lines 26-30): "It is a durable deterministic parent that owns an ordered outcome plan, holds the repository reservation across child boundaries, chains exact-SHA mission evidence, enforces aggregate budgets, and requires a final review of the whole initiative." (37 words)
- Rewrite: "An initiative is a parent record that survives restarts. It holds a step-by-step plan. It keeps the repo reserved the whole time. It links each mission's proof to the next. It enforces one total budget. At the end, one review judges the whole thing."

### 9. `~/Projects/shared/agent-scripts/docs/agent-start.md` (Joel-flagged entry point — confirmed)

This is the front door for every coding session, and it assumes you already live here. The startup-packet list (lines 25-41) names several tools with zero definitions, including AgentCoord, docs-list, bus-discover, and agent-check. Line 63 tells the reader to run `yolo resume` — `yolo` is defined nowhere in the corpus (it appears again in `manager/docs/decisions/fleet-version-rollout-plan.md:91` as "the current `yolo` alias runs Codex..."). The page also mixes three concerns: the launch ritual, Codex thread-naming etiquette, and installer internals (symlink vs hard link vs copy).

- Verbatim (lines 42): "The normal startup path should keep bus visibility because many Joel workflows should reuse existing Pinakes agents before new local code."
- Rewrite: "Keep the bus check on. Many jobs should reuse a live bus agent instead of new code."

### 10. `~/Projects/shared/manager/docs/decisions/endpoint-auth-policy-2026-06.md` (flagged — confirmed, but least bad of the five)

Short and decision-shaped, so it ranks last among the flagged pages. Still: telegraph fragments, an invented adverb, and pre-glossary vocabulary ("per-repo accidents", "Backlog says").

- Verbatim (lines 20-22): "agents with broad shell access can accidentally or prompt-injectedly hit write endpoints they were never meant to touch"
- Rewrite: "an agent with shell access can hit a write endpoint by mistake, or because a prompt injection tricked it."

Honorable mentions (bad, just below the cut): `manager/docs/work-orders/supervised-coding-campaigns.md` (grade 17.4, the highest true score in the corpus), `agent-scripts/docs/contribution-review-architecture.md` (905 lines; one 350-word paragraph on scope authority), `agent-scripts/docs/ops-log-2026-08-04-buses-and-badges.md` (opens with "Written by Claude..." instead of a summary — ironic, since it is the newest page), and `ucla-tdg-ip-agents/docs/ARCHITECTURE.md` (68 lines, still manages to skip the summary and lead with "The bus is not implemented or operated here").

---

## Part 2: What the docs reveal about the architecture

These are cases where honest documentation exposes a design problem. Each item has evidence, a reason it is a design issue rather than a writing issue, and a candidate fix.

### A. One concept, many names

**A1. The engine has three names, and the glossary's pick is the rarest one.**
The glossary rules the service is `managerd` (`manager/docs/glossary.md:33-35`). In the corpus, `managerd` appears in 3 files, `claude-projects-mcp` in 19, and a capitalized bare "**Manager**" in 72. "Manager" is the name most docs actually use (e.g., `agent-scripts/docs/contribution-review-architecture.md:75`: "**Manager** owns supervised execution proof"), and it is not a governed noun at all. Why it is a design problem: the rename (WO-8) was ruled but not resourced, so three names now share one referent, and a fourth informal one ("Projects MCP") floats beside them. Recommendation: either execute WO-8 (code + env vars + paths), or add "Manager" to the glossary as the short form of managerd and forbid the rest. Do not leave the glossary teaching a name that exists nowhere on disk.

**A2. "Conductor" names two different machines.**
The glossary defines conductor as the mission engine (`glossary.md:13-15`). But `agent-scripts/docs/contribution-review-architecture.md:82-95` declares "One system, two conductors" — a "coding conductor" and a "lifecycle conductor" — and the ip-agents repo uses bare "conductor" for the lifecycle one throughout (`ucla-tdg-ip-agents/docs/GITHUB_AGENT_IDENTITY.md:121-215`, `lifecycle_conductor.go`). Even the manager repo does it: `manager/docs/services/claude-mcp-connectors.md:60` calls the contribution coordinator the "`ucla-tdg-ip-agents` lifecycle conductor". Why it is a design problem: a governed noun was overloaded to describe a second state machine in a different repo, which means the second machine never got its own name — a sign its identity is unsettled. Recommendation: give the lifecycle machine a governed name of its own (candidate: **publisher**, since its unique authority is branch/PR publication) and reserve conductor for the mission engine only.

**A3. The glossary says "bus", singular. There are two buses, plus relays.**
`glossary.md:37-39` defines the bus as "the Pinakes message system". `agent-scripts/docs/ops-log-2026-08-04-buses-and-badges.md:7-19` documents the truth: Pinakes is software; there are two buses (JK bus, UCLA bus), primaries on keystone, reached through relay containers on beelink. `bus-discovery.md` uses lowercase ids `jk` / `ucla-tdg`. Why it is a design problem: the ops log itself says it — "merging and environment separation are the same design decision and should be decided together" (line 19). The glossary's singular noun quietly pre-decides a merge that was never made. Recommendation: update the glossary to "Pinakes (the software), JK bus, UCLA bus" now, and note the merge decision as open. Also name the relay pattern — it is live infrastructure with no doc.

**A4. The UCLA coordinator carries five names across three eras.**
The same component (or its close neighbors) appears as: "intern-manager" / `internal/internmanager` (old), "contribution-coordinator" / `internal/contributioncoordinator` (new; `CONTRIBUTION_COORDINATOR.md:10`), "the PM" / "Agentic Project Manager" (`JK-SPEC-INTERNPM-001.md:14`), and it still stores data under `/app/data/intern-manager` with `INTERN_MANAGER_*` env vars (`JK-SPEC-INTERNPM-001-CONFORMANCE.md:61,174`). Meanwhile a separate bus agent, `ucla-tdg-project-manager` ("the tracker", `ops-log-2026-08-04:14,29`), also does PM-shaped work (deadline alerts). Why it is a design problem: the rename left a three-layer fossil record (package, env prefix, data dir), and two PM-named things now share the UCLA bus with no boundary doc saying which owns what. Recommendation: one mission to finish the rename fossils; one design note stating the coordinator/tracker boundary or a consolidation decision.

**A5. Trial vocabulary is unruled: canary, live trial, pilot.**
Same page, both names: `manager/docs/work-orders/supervised-coding-missions-live-trial.md` (title "Live Trial", frontmatter "canary plan", section "Controlled canary"). `agent-scripts/docs/github-lifecycle-pilot.md` uses "pilot" plus "supervised live canary" (frontmatter lines 2-7). `manager/docs/services/local-intake-clerk.md:6` uses "scheduled canary" for a recurring smoke check — a third meaning. Why it is a design problem: these words encode real, different risk stages (proof on fixtures, first live run, recurring live check), and the system keeps needing all three; without governed names, every subsystem invents its own ladder. Recommendation: rule three nouns in the glossary (suggestion: **rehearsal** = offline proof, **canary** = first bounded live run, **smoke** = recurring live check) and retire "live trial" and "pilot".

**A6. A second, ungoverned naming system: office titles.**
"Joel Notifier" (`notify-joel.md:14` — "Office title: **Joel Notifier**"), "Hall Monitor", "Local Intake Clerk", "Tailscale Keymaster", "Chief of Staff", and the collective "Joel Inc agent swarm" (`notify-joel.md:2`). None are in the glossary. Why it is a design problem: the office-title register is doing real work — it encodes role, trust level, and charter (`supervised-coding-design.md:319-322` even distinguishes "standing roles, not layers") — but it lives entirely outside the name law. Recommendation: either admit the office-title system into the glossary as the registry for standing roles, or drop it. Right now every service has a service name, an agent id, a capability name, and an office title (notify-joel alone has four: `notify-joel`, `macmini-notify-joel`, `notify-joel-agent`, "Joel Notifier").

**A7. The launch layer is a pile of words with no named component.**
agent-start is a "launch ritual" (`agent-start.md:11`), invoked by "launch wrappers" (line 68), installed as "shims" (line 110), wired by the manager installer (line 140), skipped via `CODEX_SKIP_AGENT_START` or `AGENT_LAUNCH_PREFLIGHT`, near a `codex-bg` "detached Node supervisor" (`codex-bg.md:82`) and an "agent-invoker" (three manager work orders). Why it is a design problem: five words (ritual, wrapper, shim, launcher, invoker) for one pipeline means the pipeline was never designed as one thing. Recommendation: name the launch pipeline once, then describe wrapper/shim as its parts.

### B. Contradictory descriptions of the same flow

**B1. The coordinator doc contradicts itself — and the spec — on "blocked". (Verified by hand.)**
`ucla-tdg-ip-agents/docs/CONTRIBUTION_COORDINATOR.md:45-47`: "`blocked` is derived only from an exact `blocked` label or the `Blocker:` field... Free-text keyword inference was removed." Same file, lines 311-313: "An issue is blocked when it has a `blocked` label or an assignee-authored comment mentions `blocked`, `blocker`, `stuck`, `waiting on`, `gated on`, `depends on`, or `dependency`." The spec forbids the second rule (PM-CHK-3, `JK-SPEC-INTERNPM-001.md:158`) and the conformance matrix says Mission A4 implemented the first. Why it matters: a stale "Snapshot Policy" section survived the A4 change; anyone implementing from the bottom of the doc will re-add a spec violation. This is the single most dangerous doc bug found.

**B2. Stage list drift between the story and the contract.**
`how-a-mission-works.md` step 2 lists seven stages; `work-orders/supervised-coding-missions.md:322-331` lists eight (adds `terminal`). Small, but these are the two pages a newcomer reads first, and the guidelines say the story page should link, not restate.

**B3. Mission roles: neutral in the story, Codex-only in the contract.**
`how-a-mission-works.md` says the contributor is "an AI worker" (neutral). `services/claude-projects-mcp.md:378` says "Supervised mission model roles are Codex-only in v1." Both are true at different layers, but no page says which layer owns the restriction. See also D2.

**B4. Activation state disagrees across pages.**
`manager/docs/elephant-checks/supervised-coding-missions.md` status line says "INITIATIVE IMPLEMENTED, NOT ACTIVATED" while `supervised-coding-missions-status.md:374+` records live initiative proof with durable packets. One of the two is stale; a reader cannot tell which layer is actually released today.

### C. Overlapping components / consolidation targets

**C1. Three docs describe the same NAS coordination layer.** (Verified: near-identical "Control Plane Model" sections.)
`agent-scripts/docs/agentcoord.md` (the CLI), `agent-scripts/docs/shared-agent-coordination.md` (the contract), `manager/docs/services/agent-coordination-share.md` (the service). The second and third restate each other almost line for line. One canonical page plus two stubs would satisfy the "one fact, one place" rule.

**C2. Two glossaries.**
`manager/docs/supervised-coding-design.md` is subtitled "Design Overview and Glossary" and contains its own naming-rationale section (lines 282-299) defining mission/initiative/campaign — two of which (initiative, campaign) are missing from the root glossary that claims to be "the canonical name registry". Why it is a design problem: term rulings are being made in a satellite doc; the root registry is falling behind its own law. (Same pattern in ip-agents: nudge, check-in, roster, sweep, "PM proposal", and "envelope" — all load-bearing nouns, none governed; "envelope" is a live synonym for packet, `capabilities/disclosure-processor.md` "uid-envelope.v1".)

**C3. Eight documents own one subsystem.**
Supervised coding has: design, operator charter, runbook, work-order contract, initiatives contract, campaigns contract, status ledger, live-trial ledger, plus an elephant check — across `manager/docs/` root, `runbooks/`, `work-orders/`, and `elephant-checks/`. Conductor, receipt, and packet get re-explained in at least four of them (per-file verification in this review). The content is good; the duplication is the problem the guidelines name explicitly.

**C4. Coordinator vs tracker (see A4).** Two PM-shaped agents on one bus with no boundary doc.

### D. Channel and vendor names baked into core concepts (violates the channel-vs-core ruling)

**D1. The core service's whole namespace is channel+vendor.**
`claude-projects-mcp` = a vendor (Claude) plus a channel (MCP) naming the channel-neutral core. It spreads: `CLAUDE_PROJECTS_MCP_*` env vars, `~/.cache/claude-projects-mcp/`, `~/.local/state/claude-projects-mcp/agent-missions/`, `claude-mcp-oauth-proxy`, `CLAUDE_MCP_OAUTH_PROXY_COORDINATOR_TOKEN_SHA256`, and the sibling `chatgpt-projects-mcp-app`. Even the coordinator's credential is named for the channel: `CONTRIBUTION_COORDINATOR_MANAGER_MCP_TOKEN` (`claude-mcp-connectors.md:80`). WO-8 fixes the service name; the env/state/path namespace should be in its scope or it will fossilize (exactly as `INTERN_MANAGER_*` did, A4).

**D2. Worker identities are LLM-branded in the core contract.**
`work-orders/supervised-coding-initiatives.md:96-103`: `"contributor_identity": "codex-contributor"`, `"reviewer_identity": "codex-independent-reviewer"`, `"agents": ["codex"]`; and line 60: "A calling Codex translates that outcome into one `start_agent_initiative` request." The glossary defines contributor and reviewer as roles with identities — the ruling says roles must not be LLM-specific. The policy layer is the right place to bind a role to a model; the identity names themselves should be role-named (e.g., `contributor-1`), with the model an attribute.

**D3. Launch shims are vendor-keyed.**
`agent-start.md:140-142`: the installer wires `codex` and `claude` shims; the escape hatches are `CODEX_SKIP_AGENT_START` and `AGENT_LAUNCH_PREFLIGHT` — one vendor-named, one neutral, for the same mechanism.

### E. Documented-but-nonexistent, existent-but-undocumented

- **managerd** (documented, does not exist on disk): the glossary's preferred name is a plan, not a fact — see A1.
- **`yolo`** (exists, undocumented): used as the operator's normal launch path (`agent-start.md:63`, `fleet-version-rollout-plan.md:85-91,179` — "Joel's normal `yolo` launch") yet no page defines it. For an entry-point tool this is the corpus's clearest existent-but-undocumented gap.
- **Relay containers** (exist, undocumented): the socat/relay pattern carrying both buses on beelink appears only in the ops log (`ops-log-2026-08-04:9-13`); no service page, no port doc entry naming them as relays.
- **`reregister-managerd` cron** (exists, temporary, documented only in the ops log): a live production workaround with no runbook home.
- **Chief of Staff** (planned, but wired): `notify-joel.md:50-51` allowlists `chief-of-staff-agent` as a caller by default; `supervised-coding-design.md:321` says it is "(planned)". A default allowlist entry for a nonexistent agent is a small standing lie in config.
- **Work-order numbering** (referenced, no registry): the glossary cites WO-8; the ops log cites WO-1b/WO-1e; the `work-orders/` directory itself has no numbers and no index. "Work order" is not a governed noun either, even though the glossary's own managerd entry uses it.

---

## Part 3: Recommended editorial missions (ranked)

Each item is one bounded change, sized for one mission contract. Goals are written to paste.

1. **Fix the blocked-rule contradiction.** Goal: "In `ucla-tdg-ip-agents/docs/CONTRIBUTION_COORDINATOR.md`, delete or rewrite the stale Snapshot Policy blocked-keyword rule (lines ~311-313) so the whole page states the single PM-CHK-3 rule already given at lines 45-47."
2. **Bring the glossary up to the system it governs.** Goal: "Add to `manager/docs/glossary.md`: initiative, campaign, work order, Elephant check, evidence generation, and the standing-role register (operator, Hall Monitor, Chief of Staff), each in two sentences, linking to the owning page."
3. **Re-rule the bus entry.** Goal: "Rewrite the `bus` entry in `manager/docs/glossary.md` to name Pinakes as the software and the JK bus and UCLA bus as the two instances, note the relay pattern, and mark the merge/environment-separation question as an open decision."
4. **Un-overload conductor.** Goal: "Choose and rule a governed name for the lifecycle conductor (candidate: publisher), then update `agent-scripts/docs/contribution-review-architecture.md`, `ucla-tdg-ip-agents/docs/GITHUB_AGENT_IDENTITY.md`, and `manager/docs/services/claude-mcp-connectors.md:60` to use it."
5. **Settle the engine's name in docs.** Goal: "Decide WO-8's doc-side behavior: either sweep the 19 files using `claude-projects-mcp` and the 72 using bare `Manager` to `managerd`, or amend the glossary to bless `Manager` as the short form until the code rename lands."
6. **Rewrite `agent-start.md` as a real front door.** Goal: "Give `agent-scripts/docs/agent-start.md` a summary paragraph, a one-line definition (or link) for every item in the startup packet (AgentCoord, bus-discover, docs-list, agent-check, yolo), and move Codex thread-naming and installer internals to their own pages."
7. **Rewrite the connectors page.** Goal: "Split `manager/docs/services/claude-mcp-connectors.md` into a reference (URLs, auth model, defined acronyms) and a runbook (token minting, cutover, troubleshooting), each with a summary paragraph at grade-6 register."
8. **Rule the trial ladder.** Goal: "Add rehearsal/canary/smoke (or Joel's chosen trio) to the glossary and retitle `supervised-coding-missions-live-trial.md` and `github-lifecycle-pilot.md` to match."
9. **Merge the three AgentCoord pages.** Goal: "Make `agent-scripts/docs/shared-agent-coordination.md` the one canonical AgentCoord page and reduce `agentcoord.md` (CLI) and `manager/docs/services/agent-coordination-share.md` to linked stubs with only their unique facts."
10. **Give the two big ledgers a front page.** Goal: "Add a ten-line plain-language summary and index to the top of `supervised-coding-missions-status.md` and `supervised-coding-missions-live-trial.md`, define Elephant and WWI by link on first use, and reconcile the 'implemented, not activated' status line in the elephant check with the ledger."
11. **Split the github-native lifecycle mega-doc.** Goal: "Split `agent-scripts/docs/github-native-lifecycle-read-propose-packet.md` into spec, evidence ledger, and roadmap pages, each with a grade-6 summary; change no normative content."
12. **Fold the satellite glossary into the root.** Goal: "Move the naming-rationale rulings in `manager/docs/supervised-coding-design.md:282-299` into `glossary.md` entries and replace them with links, so the root registry is the only place terms are ruled."
13. **De-brand worker identities in the contracts.** Goal: "Document (in `supervised-coding-missions.md` policy section) that contributor/reviewer identity names are role-based with the model as a policy attribute, and rename the documented examples from `codex-contributor` style to role-named identities."
14. **Document `yolo` or retire it from docs.** Goal: "Write a ten-line page (or AGENTS.MD section) defining the `yolo` launch alias, or remove its mentions from `agent-start.md` and the fleet-version docs."
15. **FAULTTOL readability pass.** Goal: "Add a summary paragraph to `manager/docs/decisions/JK-SPEC-FAULTTOL-001.md`, define OOM/wal-g/GHCR/c-state on first use, and split sentences over 25 words, changing no decisions."

---

## Closing note

The corpus's core narrative pages (`editorial-guidelines.md`, `glossary.md`, `how-a-mission-works.md`, `supervised-coding-design.md`) are genuinely good — they meet their own law. The debt is concentrated in three belts: evidence ledgers that were never given a human front page, infrastructure references that fused with runbooks, and specs written before the glossary existed. The architecture findings mostly trace to three unfinished renames (managerd, contribution-coordinator, the bus merge) — the docs are honest, so every unfinished rename is visible as a synonym. Finishing renames, not policing prose, would eliminate the biggest class of violations at the root.
