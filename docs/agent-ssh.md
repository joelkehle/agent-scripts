---
summary: The approved machine-to-machine SSH grid and the agent-ssh helper that enforces it.
read_when:
  - An agent session needs to reach another machine (dev, beelink, lab, macmini).
  - Changing lib/ssh-grid.json, bin/agent-ssh, or the SSH Grid section of agent-start.
  - Debugging a "blocked by the SSH grid" error.
---

# Agent SSH

Machines may only talk to each other along the approved grid in `lib/ssh-grid.json`.
From the laptop, use the `agent-*` shell aliases (for example `agent-dev`).
From dev, run `agent-ssh <target>` — it hops through the shared `agent` account, never Joel's.
Beelink reaches keystone through a tunnel only; there is no shell. Every other direction is blocked.
`agent-start` prints your machine's row, so every session starts knowing its allowed hops.
The rule under it all: never use joelkehle keys or accounts for automation.
