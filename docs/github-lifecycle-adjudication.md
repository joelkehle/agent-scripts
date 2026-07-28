---
summary: "Offline adjudication observer: recorded-evidence schema, decision correlation, stated owner-attention resolution, deterministic ruling IDs, and rendered doctrine-graduation proposals."
read_when:
  - Recording or reading a github-lifecycle-adjudication-evidence.v1 bundle.
  - Correlating one of Joel's GitHub decisions with its packet, attention item, and issue lineage.
  - Proposing that a decision graduate into canonical doctrine.
  - Changing ruling IDs, graduation proposals, or the observer's write boundary.
---

# GitHub lifecycle adjudication observer

Implements `GHL-REQ-08` (Joel-only adjudication) and `GHL-REQ-09` (durable
graduation) from
[`JK-SPEC-GHLIFE-001`](github-native-lifecycle-read-propose-packet.md), under
the identity, guarded-write, and separation obligations of `GHL-NFR-01`
through `GHL-NFR-03`.

The observer reads what Joel already decided and says what that decision
implies. It has no GitHub write path at all: no `APPROVE`, no merge, no
request-changes, no attention close, and no doctrine edit. Live collection of
the evidence belongs to the deployed contribution coordinator (`GHL-008`);
this tool reads a recorded bundle offline.

## Artifacts

| Artifact | Path |
|---|---|
| Library | `lib/github-lifecycle/adjudication-*.js`, `lib/github-lifecycle/comment-markers.js` |
| CLI | `bin/ghl-adjudication` |
| Fixtures | `tests/github-lifecycle/fixtures/adjudication/` |
| Tests | `tests/github-lifecycle/adjudication-observer.test.js` |

## Commands

```bash
ghl-adjudication observe evidence.json
ghl-adjudication observe evidence.json --format json --pull 44
ghl-adjudication render evidence.json --ruling JK-RULING-20260727-44
ghl-adjudication receipt evidence.json --actor codex-contributor --at 2026-07-27T00:00:00.000Z
```

Exit codes are `0` for a clean run, `1` for evidence defects, and `2` for a
usage or input error. `render` refuses defective evidence.

## Evidence bundle `github-lifecycle-adjudication-evidence.v1`

A bundle is what an authorized collector already read from GitHub, written
down. Unknown fields are rejected so a drifted collector fails closed.

Top level: `schema`, `bundle_version`, `collection`, `pull_requests`, and
optional `owner_login` (default `joelkehle`) and `notes`.

`collection` carries `collected_at`, `collected_by`, and `source`
(`recorded` for a real capture, `fixture` for test evidence), plus optional
`note`.

Each `pull_requests[]` entry carries:

| Field | Meaning |
|---|---|
| `repository` | `owner/repo` |
| `pull_number` | Positive integer |
| `current_head_sha` | The head the pull request has now |
| `state` | `open`, `closed`, or `merged` |
| `business_scope` | `personal`, `shared`, or `ucla` |
| `lineage` | Issue number, issue ID, and optional spec ID, revision, and requirement IDs |
| `decisions` | Joel's recorded GitHub acts; absent means none |
| `comments` | Recorded PR comments, marker-parsed here |
| `issue_comments` | Recorded lifecycle issue comments, for claim lineage |

Each `decisions[]` entry carries `github_disposition` (`merged`, `closed`, or
`changes_requested`), `decided_by`, `decided_at`, and the exact `head_sha` the
act applied to, plus optional `url`, `reason`, and `observed_from`. A decision
is a GitHub act, not a comment; prose is never a decision.

Each comment carries `comment_id`, `author`, `created_at`, and `body`. The body
is read with the same framing the rest of the lifecycle uses — an HTML marker
naming the schema, then the canonical payload in a `json` fence:

```text
<!-- owner-attention.v1 item_key=<key> idempotency_key=<key> head_sha=<sha> state=open -->
```

Marker attributes that disagree with the payload are a parse failure, so a
hand-edited comment cannot impersonate an event. Comments with no marker are
prose. The observer reads four foreign schemas and emits none of them:
`ready-for-joel.v1`, `owner-attention.v1`, `adjudication-observation.v1`, and
`github-lifecycle-claim.v1`. Their contracts live with the coordinator.

Heads are compared as exact lowercase strings; a bundle that abbreviates one
head and spells out another is a collection defect, not a near match.

## Correlation

One `github-lifecycle-adjudication-record.v1` per recorded decision, carrying
the packet, owner-attention item, issue lineage, and claim count for the same
`(repository, pull_request, head_sha)`. Record status:

| Status | Meaning |
|---|---|
| `adjudicated` | The owner decided the pull request's current head |
| `superseded_by_head` | The owner decided a head the pull request has moved past |
| `not_adjudication` | Somebody other than the owner acted; a policy guardrail is not Joel's ruling |

A pull request with no `adjudicated` record appears under
`awaiting_adjudication` with the reason: no decision at all, only a stale
decision, or only non-owner actions. Silence is never a decision.

`calibration` scores the packet's recommended disposition and any
`decision-analysis.v1` confidence against what Joel actually did. It is
calibration input for the reviewer identity and creates no authority; decision
quality and outcome quality stay separate facts.

## Stated attention resolution

For an `adjudicated` record with a matching owner-attention item, the record
states the resolution the decision implies:

| Observed act | `observed_action` | `decision` | Proposed state |
|---|---|---|---|
| `merged` | `approve` | `acknowledged` | `disposed` |
| `closed` | `dismiss` | `dismissed` | `disposed` |
| `changes_requested` | `dismiss` | `dismissed` | `disposed` |

The Project Manager vocabulary has no separate request-changes value, so
`github_disposition` preserves the precise act. `performed` is always `false`
and `performed_by` is always `null`: closing or superseding an attention item
is the coordinator's separately authorized guarded adapter's write.
`write_needed` is `false` when an `adjudication-observation.v1` for the same
decision is already recorded, or the item already carries a disposition.

A `superseded_by_head` or `not_adjudication` record resolves nothing and says
why in `attention_resolution_blocked`.

## Durable rulings

A decision graduates doctrine only through an explicit marker, never through
inference. Two sources count, and only on an `adjudicated` record:

1. an owner-authored PR comment carrying a `github-lifecycle-ruling.v1` marker
   with `owning_document`, `ruling_slug`, and `statement`, optionally
   `head_sha`, `reason`, `ruling_refs`, `requirement_ids`, and `supersedes`;
2. a `ready-for-joel.v1` packet entry in `unresolved_judgment[]` flagged
   `graduates_to_doctrine: true` with an `owning_document`.

The owning document must be one of the four canonical homes; anything else is
the `unknown_owning_document` defect rather than an invented home:

- `docs/contribution-review-architecture.md`
- `docs/maintainer-charter.md`
- `docs/contributor-operating-protocol.md`
- `docs/STATE_ARCHITECTURE.md`

### Ruling IDs

`JK-RULING-YYYYMMDD-NN`:

- `YYYYMMDD` is the UTC date of the **decision**, read from `decided_at` in the
  evidence. The library never reads the wall clock.
- `NN` is `sha256(identity)` truncated to its first two bytes, modulo 100,
  where identity is `github-lifecycle-ruling.v1`, repository, pull number,
  decided head, owning document, and ruling slug joined with NUL.

Deriving `NN` from identity rather than from position means adding another pull
request to a bundle cannot renumber an existing ruling. The full
`ruling_key` sha256 accompanies every ruling, and two different rulings that
derive the same `ruling_id` are the `ruling_id_collision` defect rather than a
silent merge. A ruling slug taken from a packet judgment call is lowercased and
hyphenated (`UJ-02` becomes `uj-02`).

## Graduation proposals

`render` emits one proposed issue per ruling, marked with the same
`github-lifecycle-issue-proposal.v1` convention the manifest renderer uses so a
downstream adapter can upsert without duplicating:

```text
<!-- github-lifecycle-issue-proposal.v1 source=github-lifecycle-adjudication-evidence.v1 ruling=JK-RULING-YYYYMMDD-NN repository=<owner/repo> pull_request=<n> head_sha=<sha> payload_sha256=<hex> -->
```

Each body names the owning document, the adjudication it came from, the ruling
statement, related standing-ruling and requirement IDs, the lifecycle issue,
and the change control that document imposes. The proposal is the request for
the doctrine edit; the edit itself travels the ordinary issue, mission, PR,
review, and adjudication path.

`tests/github-lifecycle/fixtures/adjudication/jk-ruling-20260727-44.expected.md`
is the byte-stability anchor. An intended renderer change regenerates it with:

```bash
ghl-adjudication render tests/github-lifecycle/fixtures/adjudication/doctrine-graduation.evidence.json \
  --ruling JK-RULING-20260727-44 --format json |
  node -e 'const d=JSON.parse(require("node:fs").readFileSync(0,"utf8")).proposals[0];
process.stdout.write(`${d.title}\n\n${d.body}`)' \
  > tests/github-lifecycle/fixtures/adjudication/jk-ruling-20260727-44.expected.md
```

## Replay and receipts

Record IDs, idempotency keys, ruling IDs, and proposal IDs are sha256 over
canonical identity, so re-running over the same evidence yields byte-identical
output and creates no duplicate decision or graduation proposal. The same
decision recorded twice in one bundle is the `duplicate_decision` defect.

`buildAdjudicationReceipt` emits
`github-lifecycle-adjudication-receipt.v1` with the observing actor and tool,
the subject bundle and collector, the sha256 of the canonicalized bundle, the
outcome with its defect and warning codes and derived IDs, and an explicit
boundary block. The caller injects `actor` and `timestamp`, and `receipt_id` is
derived from the receipt body, so `verifyReceipt` detects tampering.

## Boundaries

- No GitHub reads or writes, no network access, and no credentials.
- No adjudication: this tool records Joel's decision and never makes one.
- No attention write: it states the resolution the coordinator's guarded
  adapter performs.
- No doctrine edit: it renders the issue that asks for one.
- No inference that silence, prose, or a non-owner action is a decision.
