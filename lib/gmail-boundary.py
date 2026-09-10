#!/usr/bin/env python3
"""Local coding-assistant Gmail controls. Never calls a mail service."""
import argparse
import copy
import datetime
import json
import os
from pathlib import Path
import re
import shlex
import sys
import tempfile
import tomllib

GMAIL_ID = 'connector_2128aebfecb84f64a069897515042a44'
DENY = 'mcp__claude_ai_Gmail__*'
MATCHER = '^mcp__claude_ai_Gmail__.*$'
REASON = 'Direct Gmail is blocked in coding assistants. Use the approved mail app or mirror; report gaps without a Gmail fallback.'


def hook_entry():
    return {'matcher': MATCHER, 'hooks': [{'type': 'command', 'command':
        'python3 ' + shlex.quote(str(Path(__file__).resolve())) + ' hook', 'timeout': 5}]}


def proposed(codex_text, claude):
    config = tomllib.loads(codex_text)
    gmail = config.get('apps', {}).get(GMAIL_ID)
    if gmail is None:
        codex_text += '\n# Coding assistants only; keep ChatGPT web connected.\n[apps.' + GMAIL_ID + ']\nenabled = false\n'
    elif gmail.get('enabled') is not False:
        raise ValueError('Existing Gmail app settings need a focused edit; refusing to overwrite them')
    result = copy.deepcopy(claude)
    rules = result.setdefault('permissions', {}).setdefault('deny', [])
    if DENY not in rules:
        rules.append(DENY)
    hooks = result.setdefault('hooks', {}).setdefault('PreToolUse', [])
    if hook_entry() not in hooks:
        hooks.append(hook_entry())
    return codex_text, result


def write_if_changed(path, original, content):
    if content == original:
        return
    if path.is_symlink():
        raise ValueError('Refusing to replace a symlink: ' + str(path))
    path.parent.mkdir(parents=True, exist_ok=True)
    current = path.read_text() if path.exists() else ''
    if current != original:
        raise ValueError('Settings changed during install; retry after review')
    if path.exists():
        backup = path.with_name(path.name + '.before-gmail-boundary')
        if not backup.exists():
            fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w') as f:
                f.write(original)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.gmail-boundary-')
    with os.fdopen(fd, 'w') as f:
        f.write(content)
    os.replace(name, path)


def paths():
    return (Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'config.toml',
            Path(os.environ.get('CLAUDE_CONFIG_DIR', str(Path.home() / '.claude'))) / 'settings.json')


def check(codex_text, claude):
    gmail = tomllib.loads(codex_text).get('apps', {}).get(GMAIL_ID, {})
    failures = []
    if gmail.get('enabled') is not False:
        failures.append('Codex Gmail app is not disabled')
    if DENY not in claude.get('permissions', {}).get('deny', []):
        failures.append('Claude Code Gmail deny rule is missing')
    if hook_entry() not in claude.get('hooks', {}).get('PreToolUse', []):
        failures.append('Claude Code Gmail hook is missing or has a different path')
    if claude.get('disableAllHooks') is True:
        failures.append('Claude Code hooks are disabled')
    return failures


def hook():
    # This hook is selected only for the Gmail namespace. Bad input must block too.
    try:
        event = json.load(sys.stdin)
        name = event['tool_name']
        if not isinstance(name, str):
            raise ValueError('invalid tool name')
        if not re.fullmatch(MATCHER, name):
            return 0
    except (ValueError, KeyError, TypeError):
        print('Gmail guard received invalid input; refusing this call.', file=sys.stderr)
        return 2
    # Log no arguments, message data, addresses or session IDs.
    try:
        root = Path(os.environ.get('XDG_STATE_HOME', str(Path.home() / '.local/state')))
        folder = root / 'joel-agent'
        folder.mkdir(parents=True, exist_ok=True)
        fd = os.open(folder / 'gmail-boundary.log', os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(fd, 'w') as f:
            f.write(datetime.datetime.now(datetime.timezone.utc).isoformat() + ' direct_gmail_blocked\n')
    except OSError:
        print('Gmail guard audit unavailable; call remains blocked.', file=sys.stderr)
    print(REASON, file=sys.stderr)
    return 2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['check', 'install', 'hook'])
    args = parser.parse_args()
    if args.action == 'hook':
        return hook()
    codex, claude = paths()
    ct = codex.read_text() if codex.exists() else ''
    jt = claude.read_text() if claude.exists() else ''
    data = json.loads(jt or '{}')
    if args.action == 'install':
        new_ct, new_data = proposed(ct, data)
        if check(new_ct, new_data):
            raise ValueError('Conflicting settings; no files written')
        write_if_changed(codex, ct, new_ct)
        write_if_changed(claude, jt, json.dumps(new_data, indent=2) + '\n')
    failures = check(codex.read_text() if codex.exists() else '',
                     json.loads(claude.read_text()) if claude.exists() else {})
    for failure in failures:
        print('FAIL: ' + failure)
    if not failures:
        print('PASS: local Gmail blocks configured; web connectors untouched. Fresh runtime inventory still required.')
    return bool(failures)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, TypeError) as exc:
        print('FAIL: Gmail boundary settings could not be checked (' + type(exc).__name__ + ')', file=sys.stderr)
        sys.exit(1)
