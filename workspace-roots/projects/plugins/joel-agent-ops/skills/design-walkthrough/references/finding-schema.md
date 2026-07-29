# Walkthrough Finding Schema

Record the observation before interpretation. Preserve exact user words only
when the session's evidence consent permits it; otherwise label a paraphrase.

```yaml
id: DW-001
screen: Home
task: Understand whether a saved signal matters
moment: Before any facilitator explanation
observation: Joel compared two sections and could not state their difference.
quote: "Worth my attention and what changed seem a little similar to me."
quote_consent: current_product_review
expected_by_user: A visible difference in purpose and information.
intended_by_design: Attention candidates versus durable knowledge deltas.
classification:
  - observation
  - information_architecture
  - mental_model
impact: medium
confidence: high
inference: The sections overlap in examples and lack a legible semantic boundary.
recommendation: Make the object and consequence differences visible or combine them.
ai_recommendation:
  disposition: explore
  rationale: The distinction is not legible without facilitator context.
decision:
  disposition: pending
  learning_scope: pending
  decided_by: pending
  decided_at: pending
  evidence: pending
owner: product
evidence:
  before: proof URL or screenshot
  after: pending
regression_check: A new user can explain the difference without help.
evidence_policy: Link to the session contract governing quotes and artifacts.
```

## Classification rules

- `observation`: directly seen action, hesitation, statement, or failure.
- `quote`: exact human words; never paraphrase as a quote.
- `inference`: AI explanation of why the observation occurred.
- `preference`: taste or desired style, not a universal usability fact.
- `requirement`: accepted behavior or constraint.
- `idea`: possible response that has not been selected.
- `ai_recommendation`: nonauthoritative AI advice; never evidence of acceptance.
- `decision.disposition`: human-authorized change, keep, explore, or defer.
- `decision.learning_scope`: exactly `session_only`, `product_preference`, or
  `shared_principle`; never infer it from emotional intensity.
- `decision.decided_by`, `decided_at`, and `evidence`: required before replacing
  `pending`; preserve the human authorization boundary.

## Impact

- `high`: blocks the task, creates dangerous misunderstanding, or breaks the
  product's primary mental model.
- `medium`: causes hesitation, wrong prediction, rework, or material distrust.
- `low`: local friction or visual inconsistency with a recoverable outcome.

Do not assign statistical weight to a single-user observation. When the product
is explicitly for Joel, his preference and comprehension are still product
authority; label them accurately rather than pretending they generalize.
