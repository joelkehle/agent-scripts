# Human-AI Product Review System

This is the complete map for reviewing a user-visible product with Joel. The
three internal review layers strengthen the existing Clean Canvas walkthrough;
they do not replace it.

## Two operating speeds

Use **Studio** while Joel and Codex are still shaping the experience. Studio
returns a clean preview after targeted deterministic checks and at most one
fast cold review. It does not claim preflight green or acceptance.

Use **Acceptance** only when the direction is ready for formal observation,
preservation, or production consideration. Acceptance runs all three internal
layers, independent regression, full gates, proof, and traceability.

This distinction protects both speed and evidence quality. A Studio preview is
for collaborative design judgment; a formal first-use observation is usability
evidence and still requires full preflight. See
[model-routing.md](model-routing.md) for model choices, escalation, and the
5-15 minute Studio target.

## Whole system

```text
Frame the user outcome and neutral task
                    |
Build the clean product canvas and separate review surface
                    |
             Choose operating lane
              /               \
 Studio collaboration       Acceptance checkpoint
 targeted checks            1. Structural review
 optional fast review        2. Cold-reader review
       |                     3. Joel-twin review
 fresh preview URL                    |
       |                         all three pass
 Joel decides -> repair               |
       |                     Joel's first-use observation
       +-----------> preserve direction / formal review
                                      |
                           Clarify -> reveal -> critique
                                      |
                           Joel decides -> repair -> replay
                                      |
                           Regression -> proof -> gates
                                      |
                           Learn at the correct scope
```

The three full layers live entirely inside the **Acceptance checkpoint**. Joel
remains the authority for lived experience, taste, and acceptance. Passing
preflight means the design is ready to spend Joel's attention on; it does not
mean Joel will understand or accept it.

## Phase 1: Frame

Define before designing:

- intended user;
- real outcome, not a feature tour;
- believable starting situation;
- one neutral task;
- research questions;
- product maturity and truth boundary;
- whether the participant is the intended user or an owner proxy;
- evidence handling, recording consent, retention, redaction, and withdrawal;
- in-scope and out-of-scope decisions;
- human decision authority.

The task drives the product content and the review. Do not build a screen and
invent a task afterward.

## Phase 2: Build two surfaces

Create:

- **Product canvas:** only proposed product experience.
- **Review surface:** task, rationale, fixtures, alternatives, annotations,
  findings, and decisions.

Do not expose the review surface during first-use observation. A clean canvas
prevents explanation from contaminating what the user can actually understand.
It does not prove that the content is comprehensible.

## Phase 3: Internal preflight

At an Acceptance checkpoint, run three reviews in order. During Studio, run
the affected structural checks and at most one fast comprehension review; do
not call that preflight green. Use fresh context for Acceptance layers 2 and 3.
Give those reviewers raw product artifacts and the neutral task, never the
intended route, desired verdict, generator conversation, or design rationale.

### Layer 1: Structural review

Purpose: prove that the artifact works as an interface.

Full implementation context is allowed. Check:

- required surfaces and states exist;
- interactions map to the correct objects;
- repeated objects use one declared field schema;
- labels, verbs, metadata, dates, and sources are consistent and nonredundant;
- responsive composition and reading order;
- keyboard, focus, accessible names, contrast, and target size;
- empty, loading, error, stale, success, and irreversible states;
- product and review artifacts remain separate;
- no broken paths, accidental writes, private fixtures, or false live claims.

Automation belongs here. A green DOM or screenshot check proves only this
layer.

### Layer 2: Cold-reader comprehension review

Purpose: detect meaning that exists only in the generator's head.

The reviewer receives only:

- the clean interactive product artifact, or screenshots when interaction is
  unavailable;
- the intended user identity at the minimum useful resolution;
- the neutral task.

The reviewer must:

1. Explain the page and each visible object in ordinary language.
2. Perform the neutral task without help when the artifact is interactive.
3. Predict what each action will do.
4. Identify the subject of every claim and every change.
5. Identify the source, new evidence, prior state, current state, and user
   consequence whenever the UI claims that knowledge changed.
6. Flag every unnamed referent, mixed schema, unexplained abstraction,
   duplicated field, or sentence that requires hidden context.

With screenshots only, report explanation and action-prediction evidence; never
claim task completion. Record the review modality. Block human review when the
reviewer must guess. Professional-sounding prose is not a pass. Terms such as
"assessment," "replication evidence," "method," or "revised upward" require a
concrete referent and plain-language meaning.

### Layer 3: Joel-twin taste review

Purpose: apply Joel's confirmed standards without asking Joel to rediscover
predictable defects.

The reviewer receives the same cold artifacts as layer 2 plus a versioned set
of explicitly confirmed Joel design principles. It still receives no design
rationale or intended answer.

Current seed principles (Joel design profile version 1, 2026-07-16):

- Use plain English rather than analyst or agent jargon.
- Name the concrete subject, source, change, and consequence.
- Make every field earn its place; do not repeat dates or facts.
- Use one coherent schema for repeated objects and source information.
- Use the same action label for the same action; differences must be visible.
- Give one crystal-clear instruction at a time.
- Spend Joel's attention on decisions and lived experience, not defects an AI
  reviewer can find first.
- Possibility is not attention. A promoted attention item must carry a verified
  consequence or a rare concrete human-authority request; “this might matter”
  stays below the waterline for more investigation.
- An attention surface spends awareness; it does not create or own Joel's task
  state. A rare authority request names the decision only Joel can make, while
  any resulting commitment stays with its owning work system.
- State the absence of an obligation in contextual prose when that distinction
  is useful. Do not make action/no-action a mandatory label, status, field, or
  classification, and do not require “Joel's part” on routine objects.
- Aim for usefulness, trust, and joy—not merely administrative correctness.

The Joel twin is a preflight critic, not Joel's replacement. It may block an
obvious mismatch, but it cannot accept a design or manufacture Joel's opinion.

### Taste-learning contract

Promote a preference only when Joel explicitly makes it general or repeatedly
confirms it across contexts. Record the principle, scope, supporting examples,
counterexamples, and confirmation date. Keep product-specific choices in the
product contract.

Never treat grief, stress, anger, urgency, verbosity, or emotional intensity as
a preference signal or weighting mechanism. Preserve exact observations, but
learn taste only from deliberate decisions.

### Preflight integration

The root reviewer reads all three reports and the raw artifact. It repairs every
high or medium finding or records why the product decision remains open. It
then reruns the affected layer with a fresh reviewer.

Ready for Joel means:

- all three layers pass;
- no unresolved high or medium preflight findings;
- the product and review surfaces remain separate;
- the neutral task is singular and nonleading;
- the root reviewer can complete the task without supplying hidden context.

This readiness label applies to formal first-use observation. A Studio preview
may return to Joel sooner when it is clearly labeled collaborative and carries
its open hypotheses.

## Phase 4: Joel's first-use observation

If someone could reasonably mistake the prototype for a live system, state one
brief truth-boundary fact first. It is disclosure, not a task. Ask for recording
consent before audio, video, screen recording, or reuse outside the current
product review. The session contract must name captured evidence, destination,
access, retention, redaction, and withdrawal. Without consent to preserve exact
words outside the working conversation, record a paraphrased observation rather
than a quote.

Then give one instruction, not a preamble plus a second task:

> Show me, while thinking aloud, how you would [real outcome].

Stay quiet. Record first fixation, vocabulary, actions, hesitation,
backtracking, surprise, recovery, questions, and any facilitator help. Do not
teach, praise, defend, or name the intended route. Silence never blocks an
accessibility accommodation, consent question, or safety intervention. Treat
think-aloud behavior as comprehension evidence, not naturalistic timing or
statistical usability evidence.

Offer reasonable accommodations before the attempt. Structural accessibility
checks must name the keyboard, focus, accessible-name, contrast, target-size,
zoom, and responsive evidence actually exercised. If assistive technology or a
person using an accommodation was not included, report heuristic accessibility
coverage—not lived accessibility validation.

Internal preflight reduces avoidable waste. It cannot predict Joel's lived
experience, so this phase remains essential.

## Phase 5: Clarify without teaching

Ask one neutral question at a time only when needed to understand an
observation. Preserve Joel's exact words before adding inference. Do not start
repair or explain intent yet.

## Phase 6: Reveal and critique

Announce the role change. Open the separate review surface. Distinguish proposed
product UI, fixtures, rationale, alternatives, and anything not implemented or
live. Compare Joel's observed mental model with the intended one using
`design-language.md` and record findings using `finding-schema.md`.

## Phase 7: Human decision

Joel assigns each finding a disposition such as change, keep, explore, or
defer, and separately chooses `session_only`, `product_preference`, or
`shared_principle`. AI recommendations do not create acceptance. Record who
decided, when, and the evidence pointer.

## Phase 8: Repair and replay

Implement accepted decisions only. During Studio, run targeted checks and the
one affected fast-review layer, then return the next preview. At Acceptance,
run the affected preflight layers again, then repository gates and before/after
proof. Do not rerun unaffected strong-model layers after each microfix. Replay
the same neutral task without announcing the fix. Restart from the first task
when the information architecture or mental model changed. Give one
independent regression reviewer the repaired artifact without the desired
verdict and keep its report with the proof.

## Phase 9: Learn at the correct scope

- Session observations stay in the proof pack or receipt.
- Product decisions stay in the product experience contract.
- Confirmed Joel design principles update the Joel-twin criteria.
- General recurring process failures update this shared skill.
- One person's preferences do not become universal usability claims.

## Acceptance required artifacts

These artifacts are required for the Acceptance lane, not after each Studio
correction:

- session contract and neutral task;
- known starting state and reset instructions;
- clean product URL and separate review URL;
- structural report;
- cold-reader report;
- Joel-twin report and taste-profile version;
- observation log with exact quotes when consent permits, otherwise clearly
  labeled paraphrases;
- finding register and human decisions;
- before/after proof and replay result;
- independent regression-review result without the desired verdict;
- validation evidence and loop receipt.

The Studio lane keeps only a minimal iteration record: the observation or
accepted correction, changed surface, focused checks, and fresh preview URL.
That record may live in the active loop breadcrumb or product decision log.

## Status vocabulary

- **Structural green:** layer 1 passed only; accessibility claims are limited
  to the evidence actually exercised.
- **Preflight green:** all three internal layers passed.
- **Observed attempt:** Joel attempted the neutral task; success, abandonment,
  and facilitator help are recorded separately.
- **Decisions recorded:** Joel assigned dispositions and learning scope; this
  does not by itself mean the product or walkthrough was accepted.
- **Walkthrough accepted:** Joel explicitly accepted the reviewed experience.
- **Repair validated:** accepted repairs passed preflight, repository gates,
  independent regression review, and replay where applicable.

Never call structural green "UX-ready." Never call preflight green "accepted."
Product release readiness remains a separate product-specific gate.
