# Design Walkthrough Speed and Model Routing

Use two lanes. Do not turn every design correction into an acceptance run.

The durable rule is role-based: use the fastest model that can reliably perform
the role, and reserve the strongest model for product judgment. The portable
defaults below follow current Codex documentation. Joel's local catalog may
offer additional aliases; those are an optimization, not part of the contract.
If a model is unavailable, choose the newest available model in the same role
tier and record the fallback.

## Current model map

| Role | Default model | Reasoning | Use for |
| --- | --- | --- | --- |
| Product lead | `gpt-5.6` | `high` | Interpret Joel's feedback, extract product principles, resolve mental-model or ownership conflicts, decide whether scope changed |
| Studio implementer | `gpt-5.6-terra` | `low` or `medium` | Bounded HTML/CSS/JS changes, copy cleanup, proof/docs updates, focused test repair |
| Fast reviewer | `gpt-5.6-terra` | `medium` | Cold-reader comprehension, screenshot/interaction review, consistency and plain-language critique |
| Acceptance Joel twin | `gpt-5.6` | `high` | Apply the confirmed Joel design profile and adjudicate remaining semantic or taste conflicts |
| Optional text sprint | `gpt-5.3-codex-spark` | lowest supported | Near-instant text-only microcopy alternatives when available; never visual review or product-boundary judgment |

As of 2026-07-16, Joel's local model catalog also exposes `gpt-5.6-sol` as the
strong product-judgment alias and `gpt-5.6-luna` as the fast implementation
alias. Use them when the active client accepts those IDs; otherwise use the
portable defaults above. Do not copy local aliases into a project contract or
claim they were selected merely because they appear in this guide.

Deterministic code, not a model, owns DOM assertions, click paths, Back/Undo/
reload state, overflow, focus, accessible names, source-link existence, clean-
canvas separation, screenshot capture, and proof packaging.

Do not use several strong reviewers to rediscover the same mechanical defect.
Do not use Spark for screenshot judgment: it is a text-only iteration model.
Current Codex guidance recommends a demanding model for ambiguous multi-step
work and a faster model for read-heavy scans and supporting work; custom agents
can pin `model` and `model_reasoning_effort` when the client exposes them.
When the orchestration surface cannot select a subagent model, say so in the
receipt and still enforce the lane, reviewer count, and escalation policy. Do
not pretend model routing was enforced.

Official references:

- [Codex subagents and model choice](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Codex speed options](https://learn.chatgpt.com/docs/agent-configuration/speed)

## Lane A: Studio iteration

Use while Joel and Codex are discovering the design together. This is a
collaborative preview, not formal usability evidence or acceptance.

1. Capture Joel's observation and the design decision it implies.
2. Use the Product lead only when the feedback changes meaning, hierarchy,
   object model, ownership, or a shared principle. Skip it for literal copy,
   spacing, metadata, or broken-control corrections.
3. Let the Studio implementer make one bounded repair.
4. Run only the affected deterministic checks and open the changed view in a
   browser.
5. Use one Fast reviewer when visible meaning or interaction changed. Skip
   model review for a purely mechanical repair already covered by automation.
6. Return a fresh product URL to Joel. Record open hypotheses; do not claim
   preflight green or acceptance.

Target: return the next reviewable turn in 5-15 minutes. If the lane exceeds 15
minutes, report the specific cause before starting another review round.

Studio does **not** require a three-layer preflight, full repository gate, full
screenshot suite, Elephant traceability rewrite, proof-pack rebuild, loop
receipt, commit, or push after each correction. Run those only when separately
required for safety or explicitly requested.

The minimal Studio record is the observation or accepted correction, the files
or surface changed, the focused checks run, and the fresh preview URL. It may
live in the active loop breadcrumb or product decision log.

## Lane B: Acceptance and ship

Enter when Joel says the direction is good, asks for formal walkthrough
acceptance, or asks to preserve/ship the scene. Also enter before making a
user-visible production change.

1. Freeze the candidate and neutral task.
2. Run structural automation.
3. Run one fresh Fast reviewer as the cold reader.
4. Run one fresh Acceptance Joel twin.
5. Repair high/medium findings with the cheapest capable model and rerun only
   the affected layer. Do not restart every layer after each microfix.
6. When affected layers pass, run one independent regression review, full
   desktop/mobile checks, repository gate, traceability, screenshots, and proof.
7. Present the accepted-review candidate to Joel. Only explicit Joel acceptance
   closes the walkthrough gate.

"Preserve this candidate" enters this lane and produces a versioned candidate
plus proof. Whether that preservation also means commit and push is controlled
by the repository's write policy and active coordination boundaries; it never
silently overrides a stop.

One strong synthesis plus one strong final judgment is the normal ceiling. Add
another strong-model pass only for a real semantic contradiction, safety issue,
or unresolved high-severity finding.

## Escalation

Escalate from the fast model to the strongest model when:

- two focused repair attempts fail for the same semantic reason;
- a reviewer cannot distinguish a copy defect from a product-boundary defect;
- the change affects the information architecture, user agency, ownership, or
  the definition of attention/knowledge;
- the proposed fix would add a product mode, store, agent, authority, or live
  behavior.

Do not escalate because a deterministic test failed with a concrete error.
Repair that failure directly first.
