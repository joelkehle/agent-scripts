---
name: design-walkthrough
description: Prepare, facilitate, record, and improve clean human-AI design walkthroughs for user-visible products, prototypes, dashboards, websites, and application flows. Use when Codex builds or reviews UI, presents a prototype to Joel, conducts a usability or visual-design conversation, separates product UI from reviewer annotations, converts feedback into design decisions, or validates a revised experience.
---

# Design Walkthrough

Treat a walkthrough as four different activities: experience, observation,
critique, and decision. Never collapse them into one annotated product screen.

Read [review-system.md](references/review-system.md) first for the complete
end-to-end system and review gates. Read [protocol.md](references/protocol.md)
before preparing or facilitating a walkthrough. Read
[design-language.md](references/design-language.md) when critiquing visual or
interaction design. Use [finding-schema.md](references/finding-schema.md) to
record the session. Read [model-routing.md](references/model-routing.md) before
choosing models, delegating review, or deciding whether a correction needs the
Studio lane or the Acceptance lane.

## Required separation

Produce two distinct surfaces:

- **Product canvas:** only what the user would experience in the proposed
  product. No design rationale, client notes, acceptance checklist, fixture
  disclosures, guided-review controls, or implementation commentary.
- **Review surface:** research question, neutral tasks, prototype truth
  boundary, rationale, alternatives, annotations, findings, and decisions.

Do not show the review surface before the user's first-use observation pass.
Put synthetic-data and not-live disclosures in the proof/review surface unless
the product itself requires that disclosure for honest use.

## Workflow

1. **Frame:** name the user, outcome, scenario, product maturity, research
   questions, and what is out of scope.
2. **Choose the lane:** use fast Studio iteration while Joel and Codex are
   discovering the design; use full Acceptance preflight only when Joel says
   the direction is ready for formal review/preservation or before production.
   Never turn every copy or interaction correction into a ship ceremony.
3. **Preflight proportionally:** Studio runs affected structural checks and at
   most one fast review before returning the next preview. Acceptance passes
   structural, fresh cold-reader, and fresh Joel-twin review. Run
   `scripts/clean_canvas_check.py <manifest.json>` when a web prototype has
   separable files.
4. **Observe:** present the clean product canvas and one neutral, believable
   task. Ask the user to think aloud. Stay quiet. Do not name intended sections,
   explain the design, teach navigation, defend decisions, or ask leading
   questions.
5. **Clarify:** after the attempt, ask neutral questions such as "What did you
   expect?" and "What made you think that?" Do not solve yet.
6. **Reveal:** open the separate review surface. Explain intent and compare the
   intended mental model with the observed one.
7. **Critique:** apply the shared design language. Tie findings to a user,
   scenario, goal, or principle. Separate observation, quote, inference,
   preference, requirement, and idea.
8. **Decide:** ask the human authority to assign a disposition—change, keep,
   explore, or defer—and separately choose whether any learning is session,
   product, or shared scope. Do not silently turn every comment into a feature.
9. **Apply the semantic stop:** before a meaning-changing repair, compare it
   with the product contract and any active Elephant conditions. Changes to
   meaning, object model, agency, ownership, or the action/attention/task
   boundary stop for reconciliation. Implement one representative instance and
   replay it before propagating the pattern across repeated objects or screens.
10. **Repair and replay:** in Studio, implement one accepted repair, run targeted
   checks, and return the preview. At Acceptance, run affected review layers,
   full gates, and before/after proof before replaying the neutral task.
11. **Learn:** keep session evidence in the proof/receipt; record product rules
   in the product's experience contract; promote a lesson into this shared
   skill only when it recurs or Joel explicitly makes it general.

## Role discipline

- Joel or another actual user owns lived experience, taste, values, and product
  decisions.
- The facilitator gives neutral tasks and protects the observation from
  explanation bias.
- The recorder preserves exact words and actions before adding inference.
- Internal preflight reviewers find avoidable defects before observation. The
  post-observation design critic compares observed and intended mental models
  only after observation.
- The implementer changes only accepted findings.
- An independent reviewer checks regressions without receiving the desired
  verdict.

If one agent performs several roles, announce each role transition. Prefer a
fresh subagent or context for independent critique when available.

## Stop rules

Stop before implementation when product intent is unclear, the user has not
made the required decision, the clean canvas cannot be separated from review
material, or the proposed repair changes product scope. A polished prototype
and green DOM checks are not evidence that a user understood the experience.

When the participant says they are out of steam or otherwise signals fatigue,
record the evidence and stop meaning-changing repair until a fresh checkpoint.
Mechanical preservation may finish; fatigue, silence, or departure does not
authorize interpretation, propagation, or a product decision.

## Handoff

Report:

- clean product URL first;
- neutral task, without revealing the intended answer;
- review URL separately;
- observed findings and human decisions;
- checks and before/after evidence;
- remaining hypotheses and the next task to replay.
