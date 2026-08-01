#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/agent-env-install-test.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
source_fixture="$tmp/source"
install_root="$tmp/install"

mkdir -p "$source_fixture/bin" "$source_fixture/lib" "$source_fixture/workspace-roots/projects/.agents"
cp -R "$repo/bin/." "$source_fixture/bin/"
cp -R "$repo/lib/." "$source_fixture/lib/"
cp -R "$repo/workspace-roots/projects/.agents/." "$source_fixture/workspace-roots/projects/.agents/"
git -C "$source_fixture" init -q
git -C "$source_fixture" config user.email test@example.invalid
git -C "$source_fixture" config user.name Test
git -C "$source_fixture" add bin lib workspace-roots/projects/.agents
git -C "$source_fixture" commit -qm fixture
revision="$(git -C "$source_fixture" rev-parse HEAD)"

"$source_fixture/bin/agent-env-install" --prefix "$install_root" >/dev/null
first_manifest="$(sha256sum "$install_root/.agent-env-manifest.tsv")"
"$source_fixture/bin/agent-env-install" --prefix "$install_root" >/dev/null
[ "$(sha256sum "$install_root/.agent-env-manifest.tsv")" = "$first_manifest" ]
grep -q "^source_revision$(printf '\t')$revision$" "$install_root/.agent-env-manifest.tsv"
[ "$(grep -c '^file'$(printf '\t') "$install_root/.agent-env-manifest.tsv")" -eq "$(find "$install_root" -type f ! -name .agent-env-manifest.tsv | wc -l)" ]
[ -z "$(find "$install_root" -type l -print -quit)" ] || { echo "symlink found in payload" >&2; exit 1; }

while IFS= read -r installed; do
  [ -f "$installed" ] && [ ! -L "$installed" ] || { echo "not a regular file: $installed" >&2; exit 1; }
  [ "$(stat -c '%h' "$installed")" -eq 1 ] || { echo "hard link found: $installed" >&2; exit 1; }
done < <(find "$install_root" -type f -print)
while IFS=$'\t' read -r kind _ relative; do
  [ "$kind" = file ] || continue
  if [ -f "$source_fixture/$relative" ]; then
    [ "$(stat -c '%i' "$source_fixture/$relative")" != "$(stat -c '%i' "$install_root/$relative")" ] || {
      echo "source inode reused: $relative" >&2
      exit 1
    }
  fi
done < "$install_root/.agent-env-manifest.tsv"
! grep -R -F "$source_fixture" "$install_root" --exclude=.agent-env-manifest.tsv

mv "$source_fixture" "$tmp/source-hidden"
mkdir -p "$tmp/doc-check/docs"
printf '%s\n' '# Test' > "$tmp/doc-check/docs/README.md"
(cd "$tmp/doc-check" && "$install_root/docs-list" >/dev/null)
"$install_root/machine-compliance" --help >"$tmp/machine.out" 2>&1 && machine_status=0 || machine_status=$?
[ "$machine_status" -eq 1 ]
grep -q 'machine-compliance: missing' "$tmp/machine.out"
test -r "$install_root/workspace-roots/projects/.agents/skills/ship-loop/SKILL.md"

printf '\nchanged\n' >> "$install_root/bin/docs-list"
set +e
changed_output="$("$install_root/agent-env-install" --verify --prefix "$install_root" 2>&1)"
changed_status=$?
set -e
[ "$changed_status" -ne 0 ] && grep -q 'CHANGED bin/docs-list' <<<"$changed_output"
mv "$tmp/source-hidden" "$source_fixture"
"$source_fixture/bin/agent-env-install" --prefix "$install_root" >/dev/null
rm "$install_root/bin/docs-list"
set +e
missing_output="$("$install_root/agent-env-install" --verify --prefix "$install_root" 2>&1)"
missing_status=$?
set -e
[ "$missing_status" -ne 0 ] && grep -q 'MISSING bin/docs-list' <<<"$missing_output"

migrate_root="$tmp/migrate"
mkdir -p "$migrate_root"
ln -s "$source_fixture/bin/docs-list" "$migrate_root/docs-list"
"$source_fixture/bin/agent-env-install" --prefix "$migrate_root" >/dev/null
[ -f "$migrate_root/docs-list" ] && [ ! -L "$migrate_root/docs-list" ]

refuse_root="$tmp/refuse"
mkdir -p "$refuse_root" "$tmp/outside-bin"
ln -s "$tmp/outside-bin" "$refuse_root/bin"
set +e
refuse_output="$("$source_fixture/bin/agent-env-install" --prefix "$refuse_root" 2>&1)"
refuse_status=$?
set -e
[ "$refuse_status" -ne 0 ] && grep -q 'REFUSING directory symlink' <<<"$refuse_output"

printf 'agent-env-install tests OK\n'
