import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'lib/gmail-boundary.py'
spec = importlib.util.spec_from_file_location('boundary', SCRIPT)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


class BoundaryTests(unittest.TestCase):
    def test_preserves_other_settings_and_is_idempotent(self):
        ct = '[apps.drive]\nenabled = true\n[features]\napps = true\n'
        original = {'permissions': {'allow': ['Read'], 'deny': ['Bash(rm *)']},
                    'hooks': {'PreToolUse': [{'matcher': 'Write', 'hooks': []}]}, 'model': 'fable'}
        before = copy.deepcopy(original)
        c, j = b.proposed(ct, original)
        self.assertEqual(original, before)
        self.assertTrue(c.startswith(ct))
        self.assertEqual(j['model'], 'fable')
        self.assertEqual(j['permissions']['allow'], ['Read'])
        self.assertIn('Bash(rm *)', j['permissions']['deny'])
        self.assertEqual(j['hooks']['PreToolUse'][0], original['hooks']['PreToolUse'][0])
        self.assertEqual(b.proposed(c, j), (c, j))
        self.assertEqual(b.check(c, j), [])

    def test_conflicting_app_is_not_overwritten(self):
        with self.assertRaises(ValueError):
            b.proposed('[apps.' + b.GMAIL_ID + ']\nenabled=true\n', {})

    def test_missing_or_disabled_hook_fails_check(self):
        self.assertEqual(len(b.check('', {})), 3)
        c,j = b.proposed('', {})
        j['disableAllHooks'] = True
        self.assertTrue(b.check(c,j))

    def run_hook(self, payload, state):
        return subprocess.run(['python3',str(SCRIPT),'hook'], input=payload, text=True,
                              capture_output=True, env={**os.environ, 'XDG_STATE_HOME': str(state)})

    def test_hook_blocks_gmail_without_logging_content(self):
        with tempfile.TemporaryDirectory() as d:
            for tool in ['gmail_search_messages','gmail_send_message','future_tool']:
                result = self.run_hook(json.dumps({'tool_name': 'mcp__claude_ai_Gmail__'+tool,
                                                   'tool_input': {'body': 'PRIVATE SENTINEL'}}), d)
                self.assertEqual(result.returncode, 2)
            audit = (Path(d)/'joel-agent/gmail-boundary.log').read_text()
            self.assertEqual(len(audit.splitlines()), 3)
            self.assertNotIn('PRIVATE', audit)
            for tool in ['mcp__claude_ai_Google_Drive__read_file','mcp__airtable__list_bases','Bash']:
                self.assertEqual(self.run_hook(json.dumps({'tool_name':tool}), d).returncode,0)
            self.assertEqual(self.run_hook('not json',d).returncode,2)

    def test_audit_failure_still_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'file';path.write_text('not a directory')
            result=self.run_hook(json.dumps({'tool_name':'mcp__claude_ai_Gmail__read'}),path)
            self.assertEqual(result.returncode,2)

    def test_install_backup_and_repeat(self):
        with tempfile.TemporaryDirectory() as d:
            c=Path(d)/'codex';c.mkdir();j=Path(d)/'claude';j.mkdir()
            (c/'config.toml').write_text('model="example"\n')
            (j/'settings.json').write_text('{"model":"fable"}\n')
            env={**os.environ,'CODEX_HOME':str(c),'CLAUDE_CONFIG_DIR':str(j)}
            for _ in range(2):
                result=subprocess.run(['python3',str(SCRIPT),'install'],env=env,capture_output=True,text=True)
                self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual((c/'config.toml.before-gmail-boundary').read_text(),'model="example"\n')
            self.assertEqual((j/'settings.json.before-gmail-boundary').read_text(),'{"model":"fable"}\n')


if __name__ == '__main__': unittest.main()
