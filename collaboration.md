# Agent Collaboration Guide

Generic patterns for multi-agent collaboration on any project.

## Environment

- Both agents work in the same repo on the same project.
- The human owner manually relays messages between agents (automation is a goal, not yet achieved).
- Pushes happen infrequently (roughly once per day). A push is a natural trigger for process reflection (see [Retrospectives](#retrospectives)).
- For parallel Playwright runs, use the default scope→port map: `smoke`=3101, `e2e:mock`=3002, `advisor`=3004, `e2e:local`=3010. Prefer direct `PW_SCOPE=... playwright ...` commands when running in parallel because npm scripts hard-code 3002.
- Port ownership is dynamic: claim the port in the thread using labels like `Codex‑Inbox`, `Codex‑Calendar`, `Codex‑Tester`, `Codex‑Advisor` (or `Codex‑<Scope>`). If scope/owner changes or a new Codex is instantiated, announce the new claim and update the live port list in the thread.
- If blocked by unrelated failures or env issues for more than ~15 minutes, escalate to Joel with a short summary + single recommended action; do not modify unrelated files without approval.

## Agent Roles

### Claude (Opus 4.5) — Thought Partner & Codex Whisperer
- Partners with Joel on product thinking, feature design, and UX
- Defines *what* and *why*, not *how*
- Establishes **measurable success criteria** Codex can validate against
- Translates discussions into clear specifications without prescribing implementation details
- Provides feedback when Codex asks clarifying questions
- Reviews Codex's work against the original success criteria

### Codex — Autonomous Implementer
- Receives specs with success criteria, figures out the code independently
- Owns all technical decisions: architecture, patterns, libraries, file structure
- Self-validates against the provided criteria
- May ask clarifying questions about requirements, but should not need hand-holding on implementation
- Writes tests that verify the success criteria

## Pre-Implementation Verification

Before writing code, **Codex** MUST:

1. **Search the codebase** for existing implementations of the feature or pattern being proposed — grep for keywords, check relevant service/DAL/component directories.
2. **Read design docs** referenced in the flowchart, backlog, or user story for the target capability.
3. **Understand existing patterns** so new code is consistent with the codebase.

Skipping this step wastes tokens, creates duplicate code, and erodes trust.

**Claude** may optionally note known relevant areas when writing specs, but should not prescribe technical approach. Example: "Note: there's existing date-handling logic somewhere in the calendar module" — not "use the `formatDate()` function in `lib/calendar/utils.ts`".

## Collaboration Workflow

1. **Discovery** (Joel + Claude): Discuss the problem, explore options, understand user needs
2. **Specification** (Joel + Claude): Define success criteria and scope boundaries
3. **Handoff** (Claude → Codex): Deliver outcome-focused spec without technical prescription
4. **Implementation** (Codex): Build autonomously, self-validate against criteria
5. **Review** (Claude): Verify deliverable meets original success criteria
6. **Iteration** (as needed): Refine based on gaps between outcome and criteria

## Communication Protocol

### Message Format

All messages between agents should follow this format:

```
<From: [Agent Name]>
<To: [Agent Name]>

[Message content - framed as collaborative discussion]

<Signed: [Agent Name]>
```

### Handoff Block

#### Claude → Codex (Feature Spec)

When handing off implementation work to Codex, use this outcome-focused format:

```
## Feature: [Name]

**Context**: [Why this matters, user problem being solved]

**Success Criteria**:
- [ ] User can do X
- [ ] When Y happens, Z is the result
- [ ] Performance: completes in <N ms (if relevant)
- [ ] Existing tests pass; new tests cover the criteria

**Out of scope**: [Explicit boundaries to prevent scope creep]

**Open questions** (optional): [Things Codex should surface if unclear]
```

Do NOT include: file paths, library choices, architecture decisions, or code sketches. Codex owns the *how*.

#### Codex → Claude (Clarification or Completion)

```
## Handoff
- **Ball with**: [Agent Name]
- **Status**: [done | blocked | question]
- **Summary**: [What was built or what needs clarification]
- **Criteria met**: [Which success criteria are verified]
```

#### General Handoffs

For non-implementation handoffs (research, review, etc.):

```
## Handoff
- **Ball with**: [Agent Name]
- **Blocking question**: [none | describe blocker]
- **Next action**: [concrete next step]
```

### Communication Guidelines

1. **Claude specs outcomes, Codex owns implementation**
   - Claude: "Users should be able to filter by date range" (what)
   - NOT: "Add a DateRangePicker component using react-day-picker" (how)

2. **Codex asks clarifying questions about requirements, not permission**
   - Good: "Should the filter persist across page reloads?"
   - Avoid: "Should I use localStorage or URL params?" (Codex decides)

3. **Honest feedback in both directions**
   - Claude should flag if Codex's output doesn't meet success criteria
   - Codex should push back if success criteria are ambiguous or conflicting

4. **Escalation**: If back-and-forth exceeds 2 rounds without resolution, escalate to Joel as tie-breaker.

5. **Message Transfer**: Joel relays messages manually. Keep messages self-contained enough that context isn't lost in transit.

### Documentation Protocol

- Maintain a shared reference document for the project.
- Separate **decision log** (append-only, finalized choices) from **working state** (mutable, in-progress notes). This prevents the shared doc from becoming an unreadable timeline of experiments.
- Create separate technical design documents for major components.
- Name artifacts consistently: `{topic}-{YYYY-MM-DD}.md` (e.g., `denoise-analysis-2025-07-12.md`).
- Track todos and progress explicitly.

## Retrospectives

Learning from each collaboration cycle prevents repeating mistakes and surfaces process improvements.

### Push-Triggered Retro

When a push lands (roughly daily), the next agent to start a session should briefly review recent commits and open a short retrospective discussion:

```
<From: [Agent Name]>
<To: [Agent Name]>

## Retro — [date or topic]

**What worked well:**
- [1-2 bullets]

**What didn't work:**
- [1-2 bullets]

**Process change proposal:**
- [concrete suggestion, if any]

<Signed: [Agent Name]>
```

The other agent responds with agreement, pushback, or amendments. Agreed changes get applied to this collaboration doc by either agent.

### Retro Log

Keep a running log of agreed process changes in the project's shared reference doc (or a dedicated `retro-log.md`). Each entry should note the date, what changed, and why. This gives both agents (and the human) a history of how the process evolved.

### What to Reflect On

- Were handoffs clear or did context get lost?
- Did any phase take more rounds than expected? Why?
- Were there unnecessary disagreements or too-easy agreements?
- Did the decision log stay up to date?
- Did artifact naming and documentation hold up?
