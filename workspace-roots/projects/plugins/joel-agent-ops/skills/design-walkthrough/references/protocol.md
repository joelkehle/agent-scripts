# Clean Canvas Walkthrough Protocol

Use this protocol for a human-AI review of a user-visible product. It combines
moderated think-aloud testing, cognitive walkthrough, design critique,
heuristic review, accessibility evaluation, and AI mental-model testing.

## 1. Prepare

Write the session contract before building the proof:

- primary user and relevant experience level;
- outcome the user is trying to achieve;
- believable starting situation;
- one neutral task at a time;
- research questions that the interface must answer;
- prototype truth boundary and known fictions;
- evidence handling, recording consent, retention, and redaction when relevant;
- in-scope and out-of-scope decisions;
- decision authority;
- separate product and review URLs.

Do not put the expected answer into the task. Do not tell the participant which
component, label, route, or mental model is being tested.

## 2. Preflight before human attention

First choose the operating lane:

- **Studio:** collaborative owner preview; run affected deterministic checks
  and at most one fast cold review. Do not claim usability evidence or
  acceptance. Record only the correction, changed surface, focused checks, and
  fresh preview URL.
- **Acceptance:** formal first-use observation or preservation/ship checkpoint;
  run structural, cold-reader, and Joel-twin layers.

See [model-routing.md](model-routing.md). Do not run full Acceptance ceremony
after every Studio correction.

"Preserve this candidate" starts Acceptance packaging. Repository policy and
active coordination boundaries determine whether preservation also includes a
commit and push.

Inspect the product with these lenses:

1. Each repeated object has a declared information schema.
2. The same action label means the same thing everywhere.
3. Different action labels communicate a real, visible difference.
4. Product language describes user value or action, not design intent.
5. Primary action, hierarchy, grouping, and reading order are legible.
6. Empty, loading, error, success, stale, and irreversible states are handled.
7. Keyboard, focus, accessible names, contrast, target size, and responsive
   composition receive automated and manual checks.
8. Product and review files are disjoint; the clean canvas contains no review
   notes or prototype-performance claims.

The preflight prevents avoidable defects. It does not predict whether the user
will understand the experience.

## 3. First-use observation

Facilitator script:

> We are testing the product, not you. Please say what you notice, what you
> think things mean, and what you expect to happen. I will mostly stay quiet.

Then give one neutral task. Record:

- first fixation or first element mentioned;
- words the user uses for the product and its objects;
- attempted actions and sequence;
- hesitation, backtracking, surprise, and recovery;
- questions asked of the interface;
- points where the facilitator had to help.

Do not praise, correct, explain, or reveal the intended route. Use only a short
"Please keep talking" prompt when narration stops.

## 4. Clarify without teaching

After the attempt, ask only what is needed to understand the observation:

- What did you expect to happen?
- What made you choose that?
- What do you think this label means?
- What information feels missing or unnecessary?
- Did these two things seem different? Why?
- If you returned tomorrow, where would you look first?

Capture the answer before offering an interpretation.

## 5. Reveal intent and critique

Open the review surface. State which material is:

- proposed production UI;
- prototype fixture;
- reviewer guidance;
- rationale;
- not implemented or not live.

Compare observed and intended mental models. Use
[design-language.md](design-language.md), then record findings with
[finding-schema.md](finding-schema.md).

## 6. Decide

The human authority assigns one disposition:

- `change`
- `keep`
- `explore`
- `defer`

Record learning scope separately:

- `session_only`
- `product_preference`
- `shared_principle`

The AI may recommend a disposition but must not manufacture acceptance. Record
alternatives when the decision is provisional.

## 7. Repair, verify, replay

Implement only accepted scope. In Studio, rerun affected semantic,
interaction, accessibility, and responsive checks and return the preview. At
Acceptance, rerun affected review layers, full repository gates, and
before/after evidence. Do not restart unaffected strong-model reviews after a
microfix. Replay the same neutral task without describing the fix. If the
change affects the overall information architecture or mental model, restart
from the first task instead of testing only the edited component.

## 8. Learn without overfitting

- Session-specific evidence stays with the proof pack or loop receipt.
- Product-specific rules stay in the product experience contract.
- Joel-specific preferences become shared only after recurrence or explicit
  instruction.
- General process failures update this skill or its deterministic checks.
- Findings from one user do not automatically generalize to other users. For a
  multi-user product, test representative users and include accessibility users
  throughout development.

## Foundations

- [GOV.UK moderated usability testing](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing)
- [Nielsen Norman Group critique guide](https://media.nngroup.com/media/articles/attachments/NNg_UXCritiqueCheatsheet.pdf)
- [Nielsen Norman Group usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [IBM Enterprise Design Thinking playbacks](https://www.ibm.com/training/enterprise-design-thinking/framework)
- [Google People + AI mental models](https://pair.withgoogle.com/guidebook-v2/chapter/mental-models/)
- [W3C involving users in accessibility evaluation](https://www.w3.org/WAI/test-evaluate/involving-users/)
