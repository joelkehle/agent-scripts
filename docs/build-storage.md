---
summary: "Go cache access and disk-space checks on Dev."
read_when:
  - "A Go build needs a writable cache or runs out of disk or RAM."
---

# Build storage on Dev

Trusted coding sessions reuse the normal `~/.cache/go-build` cache. Native
Codex settings grant write access to this directory and the existing
`~/go/pkg/mod` module cache. Claude already has normal user write access.
Both clients set `GOCACHE` to the normal cache and `GOTMPDIR` to `/tmp`.
No launcher, approval mode, memory limit, or service-account permission changes.

On Dev, `agent-check` uses that cache and disk scratch for Go repository gates.
It warns below 12 GiB available and refuses to start below 8 GiB. Running jobs
are not stopped. Other hosts and dry runs keep their existing behavior.
Direct build commands can bypass this check; use `agent-check` for full gates.
These thresholds provide headroom, not a quota against concurrent writers.

Go handles normal scratch cleanup and trims unused entries in its shared cache.
The existing Linux temporary-file cleaner remains in place. No new sweeper,
Trash purge schedule, or custom build lifecycle is installed. Old or uncertain
files still need a separate bounded check before manual cleanup.

New sessions load the native settings. Existing sessions may retain their old
sandbox; use native approved execution for their current build, then reopen
normally when convenient. Do not restart another person's session.

Dev disk alerts use fresh `dev_node` available-byte metrics at 12/8 GiB through
the existing Manager notification route. The older machine-health snapshot
can be stale and should not be used for Dev's disk alert.
