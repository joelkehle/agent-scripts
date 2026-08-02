---
summary: "GHL-010 pilot: the scenario ledger that runs checked-in acceptance evidence, the offline live-mode refusal preflight, and the ordered live-canary runbook with its rollback and abort points."
read_when:
  - Checking which parts of the weekly-goal-to-GitHub lifecycle are built, partial, or still unproven.
  - Running or changing `ghl-pilot` or the GHL-E2E scenario map.
  - Deciding whether the GitHub-native lifecycle pilot may run against live GitHub.
  - Preparing, executing, or aborting the supervised live canary.
  - Recording an ACT-REV activation checkpoint or its build identity.
---

# GitHub lifecycle pilot

Implements `GHL-010` from
[`JK-SPEC-GHLIFE-001`](github-native-lifecycle-read-propose-packet.md). Two
things live here: an offline harness that runs the checked-in evidence for the
twelve `GHL-E2E` acceptance scenarios and records an attributable ledger, and
the ordered procedure for the one supervised live canary.

Phase one is offline only. Nothing in `ghl-pilot` reaches the network, writes
to GitHub, activates a build, or authorizes a canary.

## Scenario ledger

`docs/github-lifecycle/ghl-e2e-scenarios.v1.json` binds each of
`GHL-E2E-01` through `GHL-E2E-12` to the tests that actually assert its
clauses: the worktree, its repository, the exact expected HEAD, the commands to
run, and the clauses each command proves.

```bash
ghl-pilot plan                 # what each scenario binds to, including its gaps
ghl-pilot run                  # execute everything and print the ledger summary
ghl-pilot run --scenario GHL-E2E-02
ghl-pilot ledger --at 2026-07-27T00:00:00Z   # sealed, attributable receipt
```

Three properties make the ledger worth trusting:

- **Revision first.** Every worktree's `git rev-parse HEAD` is checked before
  anything executes. A pinned worktree whose HEAD moved marks its scenarios
  `stale_revision` and fails the run. `--allow-drift` runs anyway and records
  the drift in the ledger and its receipt. The `agent-scripts` worktree holds
  this tool and is `revision_policy: self`: its revision is recorded, never
  enforced, because it advances as the pilot itself is committed.
- **No silent passes.** `go test -run` exits 0 when its regex matches nothing,
  so every command declares `expects_tests` and the runner fails a command that
  matched no test or ran a different number than declared. A renamed or deleted
  test breaks the run instead of quietly shrinking coverage.
- **Honest coverage.** A scenario is `executable` only when every clause it
  lists is asserted by a command. Otherwise it is `partial` or `missing` and
  must name each unproven clause, why it is unproven, and what would prove it.
  The runner reports those gaps on every run; a passing run proves the listed
  clauses and nothing more.

The ledger receipt seals the map hash, the observed revisions, and each
command's exit code, test counts, and output hash. Wall-clock durations stay in
the ledger and out of the receipt, so two runs that observed the same output
seal identically.

### Current coverage

`ghl-pilot plan` currently reports five `executable` scenarios and seven
`partial` scenarios. The gaps are recorded in the map
itself and printed by `ghl-pilot plan`; the largest are the packet's spec
revision and requirement citations (`GHL-E2E-04`), a simulated GitHub-post and
packet-post failure that preserves earlier stages (`GHL-E2E-07`), a shared-scope
pull request recording `owner-attention.v1` (`GHL-E2E-08`), and a composed
all-adapter replay plus Project Manager reconstruction (`GHL-E2E-12`).

The Manager worktree carries a known host issue: 21 mission-conductor tests in
`./internal/projectsmcp` fail on this host because the deterministic fake
mission's validation step reports `test -f result/change.txt` as failed, ending
the mission `budget_exhausted` instead of `ready_for_joel`. The map selects the
Manager tests that genuinely pass at the pinned HEAD and records the blocked
clauses as gaps rather than running the whole package. That failure is not
root-caused; treat any claim resting on those tests as unproven until it is.

### What exists and what is still missing

The pieces are farther along than the live canary.

| Part | State | What that means |
|---|---|---|
| Manifest schema, coverage check, stable renderer | Implemented and locally tested | A design can become a checked issue proposal. |
| Exact batch approval | Designed target only | Version 2 still needs one matching Joel comment per issue. |
| GitHub issue create, claim, lease, and recovery adapters | Implemented with focused tests | The adapters exist; the full live chain is not yet proven. |
| Manager mission, initiative, and campaign conductors | Implemented | They own coding proof, not GitHub state. |
| Weekly goal to issue link | Not implemented | Current manifest schemas do not carry a weekly-goal field. |
| Issue-to-Manager provenance | Partial | Claim data exists, but Manager does not yet carry every issue, spec revision, and requirement field. |
| Legacy lifecycle tool wording | Partial | The canonical docs use `request_agent_mission`; the ratified v1 issue text still names the operator tool and needs a new approved revision. |
| Guarded branch and PR publication | Implemented with focused tests | Only a successful exact mission packet may publish. |
| Independent review, exact-head packet, new-head invalidation | Implemented with focused tests | A changed head must be reviewed again. |
| Owner-attention and Joel decision record | Partial | Core paths exist; shared-scope and full replay still have stated gaps. |
| One real start-to-finish canary | Not run | The whole system is not yet proven live. |
| Plain terminal launch with automatic issue binding | Not proven | A normal session can still begin without a GitHub work link. |

Do not add another workflow engine before this chain passes once. Fix the
missing links in the existing owners first.

## Live-mode refusal preflight

`docs/github-lifecycle/ghl-activation-spec.v1.json` states the build identity
the canary requires: `ACT-REV-05`, the Manager build containing `GHL-001`,
`GHL-005`, `GHL-013`, and `manager#8`, and `ACT-REV-06`, the coordinator and
review build containing `GHL-002`, `GHL-004`, `GHL-006`, `GHL-008`, and
`GHL-013`. Each checkpoint names the historical receipt it supersedes, its
smoke checks, and its rollback. `ACT-REV-05` and `ACT-REV-06` were ratified
2026-07-30 and superseded `ACT-REV-03` and `ACT-REV-04`; since `manager#8`,
the Manager checkpoint is satisfiable from the running process's own `/health`
build block rather than from a written activation receipt.

```bash
ghl-pilot preflight observed.json            # exit 1 refuses, exit 0 permits
ghl-pilot preflight observed.json --receipt  # sealed evaluation receipt
```

`observed.json` is `github-lifecycle-build-identity.v1`: what the health
endpoints actually report, one `{service, commit, dirty, activated_at}` entry
per service, plus the receipts named by the current activation spec. Version
1.1.0 requires `ACT-REV-03` for Manager and `ACT-REV-04` for the coordinator.

Live mode is refused unless every checkpoint matches exactly. A service that is
absent, reported twice, reporting no commit, reporting a commit that is not the
required one, reporting `dirty`, or reporting no activation time is a refusal
with a structured reason. A merged and reviewed revision is not an activated
one; only a health endpoint reporting that commit satisfies a checkpoint.

**A passing preflight is a precondition, never an authorization.** It says the
required builds are running. It does not say the canary may proceed; that is
Joel's separate decision.

The last recorded live check was 2026-07-30. It passed after Joel ratified
`ACT-REV-05` and `ACT-REV-06`, and the two health endpoints reported the exact
required builds. That pass proved build identity only. It did not authorize or
run the canary.

This is a dated fact. Before a canary, rebuild `observed.json` from the real
health endpoints and run `ghl-pilot preflight` again. Do not reuse the old pass
as current proof.

## Live canary runbook

Do not begin until all four hold:

1. `ghl-pilot run` passes on the pinned revisions, and its ledger receipt is
   recorded.
2. `ghl-pilot preflight` exits 0 against **real** health-endpoint output, not a
   fixture.
3. `ACT-REV-05` and `ACT-REV-06` are activated, with their smoke checks run and
   their receipts recorded.
4. Joel has given canary authorization **for this specific issue**, separately
   from approving activation.

The canary is one bounded real issue, start to finish, once. Every step below
names its tool, its actor, and the receipt it must leave. Stop at the first
step that does not produce its receipt.

| # | Step | Tool | Actor | Receipt |
|---|---|---|---|---|
| 1 | Create one bounded documentation or validator issue from the approved manifest | `ghl-manifest render` then the issue adapter | `kehle-contributor-agent` | Issue number carrying the manifest marker; `ghl-manifest receipt` |
| 2 | Claim the issue, serialized through the reducer | Claim adapter | `kehle-contributor-agent` | `github-lifecycle-claim.v1` comment; reducer confirms sole ownership and assignment |
| 3 | Start one supervised mission from the confirmed claim | `request_agent_mission` | `kehle-contributor-agent` via Manager | Mission id bound to the claim generation and lease; provenance recorded verbatim |
| 4 | Prove restart recovery: stop the conductor mid-mission, let the replacement reduce GitHub and Manager state | Lifecycle conductor | `kehle-contributor-agent` | Renewal at the same generation, or a recorded block; never a takeover on ambiguity |
| 5 | Publish the exact successful packet SHA to the contributor fork and open one PR | Publication adapter | `kehle-contributor-agent` | One fork branch at the candidate SHA, one PR citing issue, claim, requirements, validation, mission, candidate SHA |
| 6 | Run the independent review and post the ready packet | Review runner | `kehle-reviewer-agent` | One `COMMENT` review and one `ready-for-joel.v1` packet bound to the exact head |
| 7 | Record the owner-attention event on the PR | Attention router | `kehle-reviewer-agent` | `owner-attention.v1` on the GitHub PR. **Nothing enters UCLA Project Manager**; this is personal/shared scope |
| 8 | **Stop for Joel** | — | Joel | No automation step follows until Joel decides |
| 9 | Correlate Joel's decision to the packet, attention item, and issue lineage | `ghl-adjudication observe` | read-only observer | `github-lifecycle-adjudication-receipt.v1`; a stale-head decision is rejected |
| 10 | Record the artifact and write receipts in the ledger | `ghl-pilot ledger`, `loop-receipt` | Joel's session | Sealed ledger receipt plus the loop receipt |

Step 8 is the hard gate. Automation posts no `APPROVE`, performs no merge, and
posts no final `REQUEST_CHANGES`. If a step wants a decision, it stops and
waits.

### Rollback and abort points

- **Before step 1** — abort costs nothing. Deactivate by rolling back
  `ACT-REV-05` and `ACT-REV-06` per the rollback each names in the activation
  spec.
- **After step 2, before step 3** — release the claim so no lease is held.
  Claim state is reconstructed from GitHub events, so nothing local is lost.
  Close the issue if it should not exist.
- **During steps 3 and 4** — cancel the mission through Manager. A cancelled or
  otherwise non-success terminal mission blocks publication by contract; do not
  hand-publish a candidate.
- **After step 5** — close the PR and delete the fork branch. The branch is on
  the contributor fork, never the base repository, so the base repository is
  unchanged. Roll the claim to `released` so a later generation may start.
- **After step 7, before step 8** — the attention item may be superseded but
  not silently deleted; record the supersession so the ledger stays truthful.
- **At any point** — rolling back the coordinator requires releasing any open
  claim first, so no lease is held by a build that is no longer running.

Abort if any of these appear: the preflight begins refusing mid-canary, a
second claim wins the same generation, Manager becomes unavailable during
recovery, an actor other than the configured machine identity performs a write,
or a UCLA Project Manager item appears for this personal-scope pull request.
Each is a contract violation, not a transient failure.

### After the canary

Record what the canary proved, and which `GHL-E2E` clauses it moved from
`partial` to `executable`. A live canary is evidence about the deployed system;
it does not close the map's gaps, which are about the checked-in suites. Update
the map only when a test asserts the clause.

## Recommended completion order

Use this order so each step removes a real block:

1. Re-ratify the old issue text so it names `request_agent_mission` for the
   external lifecycle path.
2. Add a versioned weekly-goal link to the manifest, renderer, and issue.
3. Add the missing issue, spec revision, requirement, weekly-goal, and claim
   links to Manager request and packet proof.
4. Add one exact batch-ratification receipt. Keep the current per-issue gate
   until the new receipt has code and tests.
5. Make plain `codex` and `claude` sessions bind claimed issue work before they
   may write.
6. Close the seven stated scenario gaps, starting with full provenance and
   partial-write recovery.
7. Refresh the live build preflight.
8. Ask Joel for one canary approval.
9. Run the one bounded canary and stop at Joel's decision gate.
10. Record what failed, fix the owning rule or test, and repeat only with a new
   approval if the first canary did not finish.

The first canary should use one small documentation or validator issue in one
repo. It should not also test a new campaign policy. Cross-repo campaign proof
comes after the one-repo path works from issue to decision.
