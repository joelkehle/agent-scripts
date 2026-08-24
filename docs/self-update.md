---
summary: "Install and run the hourly fleet checkout self-update timer."
read_when:
  - Installing agent-scripts on a fleet machine.
  - Checking or fixing the agent-scripts self-update timer.
  - A machine has three or more self-update failures.
---

# Agent Scripts Self-Update

This timer keeps one `agent-scripts` checkout current. It runs once each hour.
It only fast-forwards the local `main` branch from `origin/main`. It never
resets files, rebases commits, switches branches, or fixes local work.

The updater accepts only this remote URL:

```text
https://github.com/joelkehle/agent-scripts.git
```

## Install It On Each Machine

Start in that machine's `agent-scripts` checkout. Run:

```bash
scripts/install-self-update
```

On Linux, the installer copies two user units into
`~/.config/systemd/user/`. It reloads the user service manager and enables the
timer now.

On macOS, it copies the plist into `~/Library/LaunchAgents/`. It uses
`launchctl bootstrap`. It falls back to the older `launchctl load` command when
needed. The macOS job passes `--jitter`, so each run waits a random 0 to 120
seconds before it checks Git.

The installer is safe to run again. It prints each file and service action.

## Check It On Linux

```bash
systemctl --user status agent-scripts-self-update.timer
systemctl --user list-timers agent-scripts-self-update.timer
journalctl --user -u agent-scripts-self-update.service
```

## Check It On macOS

```bash
launchctl print "gui/$(id -u)/com.joelkehle.agent-scripts-self-update"
tail ~/Library/Logs/agent-scripts-self-update.log
```

The `last exit code` in that output shows whether the last run worked. The
log file holds each run's messages. You can
also run the updater by hand from the checkout:

```bash
bin/agent-scripts-self-update
```

## Local State

The updater writes small local records under:

```text
${XDG_STATE_HOME:-~/.local/state}/agent-scripts-self-update/
```

`last-update` holds the installed commit SHA and a UTC timestamp. The
`consecutive-failures` file holds the failure count. A good run resets the
count to zero. A failed run adds one. At three failures and above, the updater
prints a loud `WARNING` line. These files are local working state. Git remains
the source of truth.

## When It Refuses Or Fails

The updater exits with an error and counts a failure when:

- the script is not inside a Git checkout;
- the `origin` remote is missing, has extra fetch URLs, or is not the exact URL
  shown above;
- the checkout has a detached `HEAD` or is not on `main`;
- tracked or untracked files make the checkout dirty;
- `origin/main` is missing;
- local `main` is ahead of, or has split from, `origin/main`;
- Git cannot read the checkout status, commit SHAs, or remote branch;
- `git pull --ff-only origin main` fails, including a network, access, disk, or
  Git error;
- the pulled SHA does not match `origin/main`;
- it cannot read the time or write its state files; or
- an unknown command-line flag is used. This error happens before the state
  folder is opened, so it is not added to the failure count.

The updater also refuses to start when it cannot create its state folder. That
error cannot be counted because the count lives in that folder.

Only one run may work at a time. Linux uses `flock`. macOS uses a folder lock.
A second run prints a skip line and exits without changing the failure count.
If a macOS process is killed so hard that cleanup cannot run, its empty
`run.lock.d` folder may remain. The next run removes that folder by itself
once it is more than six hours old, and says so with a `WARNING` line. To
clear it sooner, check that no updater is running, then remove only that
folder.

The installer refuses an unsupported system. It also refuses when the updater,
unit files, plist, `systemctl`, or `launchctl` is missing. On Linux, a user
systemd session must be ready. A checkout path with a line break is refused.
File-copy errors and service-manager errors also stop the install with a
non-zero exit.
