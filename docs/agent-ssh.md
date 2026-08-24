---
summary: The approved machine-to-machine SSH grid and the agent-ssh helper that enforces it.
read_when:
  - An agent session needs to reach another machine (dev, beelink, macmini).
  - Changing lib/ssh-grid.json, bin/agent-ssh, or the SSH Grid section of agent-start.
  - Debugging a "blocked by the SSH grid" error.
---

# Agent SSH

Machines may only talk to each other along the approved grid in `lib/ssh-grid.json`.
Run `agent-ssh <target>`. For an allowed hop, it calls normal SSH as the current
user. It does not switch to a separate Unix account or select a separate key.
This matches the delegated-helper rule: interactive Codex and Claude sessions
run as Joel and may use Joel's normal host access.

Beelink reaches keystone through a tunnel only; there is no shell. Every other direction is blocked.
`agent-start` prints your machine's row, so every session starts knowing its allowed hops.
`agent-ssh` is a convenience router, not a security boundary — real enforcement
comes from SSH keys, `from=` pins in authorized_keys, and Tailscale policy.

The old `agent-*` aliases and the `sudo-agent` hop are not the interactive
path. A persistent service or an untrusted workload may still have its own Unix
account, but its service runbook must name that identity and its allowed hop.
