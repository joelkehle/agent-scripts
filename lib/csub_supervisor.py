#!/usr/bin/env python3
"""csub process supervisor: phased kill, watchdog, and forced-reap tree kill.

Ported from bin/csub's Bash implementation (kill_tree / kill_phased / the
watchdog and escalator helpers), which went through PR #20 review rounds
3-9 — several real supervision defects were found and fixed there (identity
gating on the phase-2 KILL, walking setsid-detached descendants, etc.). This
module preserves that logic; see GitHub issue #25 for the port rationale.
csub itself stays a Bash CLI (arg parsing, isolation pins, Elephant guard,
receipts) and delegates only process supervision to this module.

Invoked as: python3 lib/csub_supervisor.py SUBCOMMAND ...

Subcommands:
  selftest
      Deterministic identity-gating self-check — no real processes are
      touched. Prints PHASED-SELFTEST-OK and exits 0 on success; raises
      (nonzero exit) on a bad decision. Wired to bin/csub's
      CSUB_PHASED_SELFTEST=1 test hook.

  descendants SIG ROOT
      Immediate, non-identity-gated signal to ROOT's *descendants* only:
      snapshot the process tree once (pid/ppid only), then signal every
      live descendant found in that snapshot (ROOT itself excluded). Used
      where the caller already knows termination of the whole tree is
      unconditional — bin/csub's reap_with_deadline and cleanup (forced
      reap of a helper or the child after its grace window, or on csub's
      own exit) — but ROOT is always a background job bin/csub's own shell
      spawned, so bin/csub signals ROOT itself via its own `kill` builtin
      (see reap_root() there): a shell-tracked job signaled by any other
      process, including this module, makes bash print a spurious
      "Killed ..." notice at the next `wait` on it, regardless of stream
      redirection on that wait. Descendants are never shell-tracked jobs,
      so that concern does not apply to them.

  phased ROOT GRACE [TAG]
      Two-phase TERM -> KILL. TERMs ROOT's process group and every live
      descendant now (snapshotting pid+start-time for each), waits GRACE
      seconds, then re-snapshots and KILLs only survivors whose (pid, start
      time) still match what was TERMed — a recycled PID is never signaled,
      and the group-wide KILL fires only if ROOT itself kept its identity.
      Calls os.setsid() first, so bin/csub can background this and let it
      outlive the very group it is about to signal. This is the escalator:
      bin/csub's TERM/INT/HUP traps invoke it directly on the child pid.

  watchdog TIMEOUT GRACE ROOT FLAG [TAG]
      os.setsid(), sleep TIMEOUT seconds, touch FLAG, then run the same
      TERM -> KILL sequence as `phased` against ROOT/GRACE. FLAG is the
      receipt hook: bin/csub checks for its existence right after the child
      is reaped, and its presence (only possible if the wall-clock bound
      fired) is what makes the run account outcome=timeout, exit 124 rather
      than outcome=signaled or outcome=failed.

  TAG, where accepted, is inert: it exists only so the process's command
  line carries a recognizable string for `pgrep -f` (bin/csub's own
  leaked-helper check greps for "csub-wd:" / "csub-esc:").

Exit codes: 0 on success, 2 on a malformed invocation (bad subcommand or
argument count), nonzero (an uncaught exception) if `selftest`'s assertions
fail.
"""
import os
import signal
import subprocess
import sys
import time


def _snapshot(with_lstart):
    """One `ps` pass -> ({pid: identity}, {ppid: [child pid, ...]}).

    identity is the process's `lstart` string when with_lstart, else None.
    Best-effort: a `ps` failure yields empty maps rather than raising, so a
    momentarily-unavailable `ps` degrades to "no known descendants" instead
    of crashing the supervisor.
    """
    fields = "pid=,ppid=,lstart=" if with_lstart else "pid=,ppid="
    try:
        out = subprocess.run(
            ["ps", "-Ao", fields], capture_output=True, text=True
        ).stdout
    except Exception:
        return {}, {}
    ids, kids = {}, {}
    for line in out.splitlines():
        if with_lstart:
            parts = line.split(None, 2)
            if len(parts) < 3:
                continue
            pid_s, ppid_s, ident = parts[0], parts[1], parts[2]
        else:
            parts = line.split(None, 1)
            if len(parts) < 2:
                continue
            pid_s, ppid_s, ident = parts[0], parts[1], None
        try:
            pid, ppid = int(pid_s), int(ppid_s)
        except ValueError:
            continue
        ids[pid] = ident
        kids.setdefault(ppid, []).append(pid)
    return ids, kids


def _walk(start, ids, kids):
    """BFS the process tree rooted at `start` (inclusive) -> {pid: identity}."""
    seen = {}
    queue = [start]
    while queue:
        p = queue.pop()
        if p in seen:
            continue
        seen[p] = ids.get(p)
        queue.extend(kids.get(p, []))
    return seen


def _phase2_targets(root, victims, ids2, kids2):
    """Identity-gated phase-2 plan: (allow_group_kill, {pid: start})."""
    root_same = (
        root in ids2
        and victims.get(root) is not None
        and ids2.get(root) == victims.get(root)
    )
    targets = {}
    if root_same:
        targets.update(_walk(root, ids2, kids2))
    for p, start in victims.items():
        if p not in targets and start is not None and ids2.get(p) == start:
            targets[p] = start
    return root_same, targets


def _sig(pid, s):
    try:
        os.kill(pid, s)
    except Exception:
        pass


def _sig_number(name):
    name = name.upper()
    if not name.startswith("SIG"):
        name = "SIG" + name
    return getattr(signal, name)


def cmd_selftest():
    # Recycled root (saved start A, now B) with a fresh child: neither may
    # be signaled; the identity-preserved orphan still must be.
    victims = {100: "A", 150: "A2"}
    ids2 = {100: "B", 200: "B2", 150: "A2"}
    kids2 = {100: [200]}
    do_group, targets = _phase2_targets(100, victims, ids2, kids2)
    assert not do_group, "group kill allowed on recycled root"
    assert 100 not in targets and 200 not in targets, "recycled root or its child targeted"
    assert 150 in targets, "identity-preserved orphan missed"
    # Healthy root: same identity — group kill allowed; fresh descendant and
    # preserved orphan all targeted.
    victims = {100: "A", 150: "A2"}
    ids2 = {100: "A", 300: "C", 150: "A2"}
    kids2 = {100: [300]}
    do_group, targets = _phase2_targets(100, victims, ids2, kids2)
    assert do_group and 100 in targets and 300 in targets and 150 in targets
    # Vanished (not recycled) root: no group kill; orphans still targeted.
    do_group, targets = _phase2_targets(100, {100: "A", 150: "A2"}, {150: "A2"}, {})
    assert not do_group and 150 in targets and 100 not in targets
    print("PHASED-SELFTEST-OK")


def cmd_descendants(sig_name, root):
    sig_num = _sig_number(sig_name)
    ids, kids = _snapshot(with_lstart=False)
    victims = _walk(root, ids, kids)  # includes root; root is skipped below
    for p in victims:
        if p != root:
            _sig(p, sig_num)


def _run_phased(root, grace):
    ids, kids = _snapshot(with_lstart=True)
    victims = _walk(root, ids, kids)
    try:
        os.killpg(root, signal.SIGTERM)
    except Exception:
        pass
    for p in victims:
        _sig(p, signal.SIGTERM)

    time.sleep(grace)

    ids2, kids2 = _snapshot(with_lstart=True)
    do_group, targets = _phase2_targets(root, victims, ids2, kids2)
    if do_group:
        try:
            os.killpg(root, signal.SIGKILL)
        except Exception:
            pass
    for p in targets:
        _sig(p, signal.SIGKILL)


def cmd_phased(root, grace):
    os.setsid()
    _run_phased(root, grace)


def cmd_watchdog(timeout, grace, root, flag_path):
    os.setsid()
    time.sleep(timeout)
    try:
        open(flag_path, "a").close()
    except OSError:
        pass
    _run_phased(root, grace)


def main(argv):
    if len(argv) < 2:
        print("usage: csub_supervisor.py {selftest|descendants|phased|watchdog} ...", file=sys.stderr)
        return 2
    cmd, rest = argv[1], argv[2:]
    try:
        if cmd == "selftest":
            cmd_selftest()
            return 0
        if cmd == "descendants":
            if len(rest) < 2:
                raise ValueError("descendants requires SIG ROOT")
            cmd_descendants(rest[0], int(rest[1]))
            return 0
        if cmd == "phased":
            if len(rest) < 2:
                raise ValueError("phased requires ROOT GRACE")
            cmd_phased(int(rest[0]), int(rest[1]))
            return 0
        if cmd == "watchdog":
            if len(rest) < 4:
                raise ValueError("watchdog requires TIMEOUT GRACE ROOT FLAG")
            cmd_watchdog(int(rest[0]), int(rest[1]), int(rest[2]), rest[3])
            return 0
    except ValueError as exc:
        print(f"csub_supervisor.py: {exc}", file=sys.stderr)
        return 2
    print(f"csub_supervisor.py: unknown subcommand {cmd!r}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
