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

# Git records this as executable, but the local source is owner-only. The
# installer must use the Git executable bit, not these local permission bits.
chmod 700 "$source_fixture/bin/agent-env-install"
fake_bin="$tmp/fake-bin"
mkdir -p "$fake_bin"
cat > "$fake_bin/sudo" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ "$1" = -n ] && shift
if [ "$1" = install ] && [[ "${*: -2:1}" == */payload/bin/agent-env-install ]]; then
  staged_mode="$(stat -c '%a' "${*: -2:1}")"
  [ "$staged_mode" = 755 ]
  (( (0$staged_mode & 0055) == 0055 ))
  : > "$STAGED_MODE_MARKER"
fi
exec "$@"
EOF
chmod 755 "$fake_bin/sudo"

printf '\nchanged tracked source\n' >> "$source_fixture/bin/docs-list"
set +e
source_changed_output="$("$source_fixture/bin/agent-env-install" --prefix "$install_root" 2>&1)"
source_changed_status=$?
set -e
[ "$source_changed_status" -ne 0 ]
grep -q 'REFUSING tracked or staged payload changes' <<<"$source_changed_output"
[ ! -e "$install_root" ] || { echo "install began before source refusal" >&2; exit 1; }
git -C "$source_fixture" checkout -q -- bin/docs-list

STAGED_MODE_MARKER="$tmp/staged-mode-ok" PATH="$fake_bin:$PATH" \
  "$source_fixture/bin/agent-env-install" --sudo --prefix "$install_root" >/dev/null
[ -f "$tmp/staged-mode-ok" ] || { echo "staged executable mode was not checked" >&2; exit 1; }
installed_mode="$(stat -c '%a' "$install_root/bin/agent-env-install")"
[ "$installed_mode" = 755 ]
(( (0$installed_mode & 0055) == 0055 ))
"$install_root/agent-env-install" --verify --prefix "$install_root" >/dev/null
first_manifest="$(sha256sum "$install_root/.agent-env-manifest.tsv")"
"$source_fixture/bin/agent-env-install" --prefix "$install_root" >/dev/null
[ "$(sha256sum "$install_root/.agent-env-manifest.tsv")" = "$first_manifest" ]
[ "$(stat -c '%a' "$install_root/.agent-env-manifest.tsv")" = 644 ]
while IFS= read -r directory; do
  [ "$(stat -c '%a' "$directory")" = 755 ] || { echo "directory mode is not 0755: $directory" >&2; exit 1; }
done < <(find "$install_root" -type d -print)
while IFS= read -r installed; do
  relative="${installed#"$install_root/"}"
  case "$relative" in
    .agent-env-manifest.tsv) expected_mode=644 ;;
    bin/*) expected_mode=755 ;;
    */*)
      git_mode="$(git -C "$source_fixture" ls-files -s -- "$relative" | awk 'NR == 1 { print $1 }')"
      if [ "$git_mode" = 100755 ]; then expected_mode=755; else expected_mode=644; fi
      ;;
    *) expected_mode=755 ;;
  esac
  [ "$(stat -c '%a' "$installed")" = "$expected_mode" ] || {
    echo "file mode is not 0$expected_mode: $relative" >&2
    exit 1
  }
done < <(find "$install_root" -type f -print)
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
[ ! -e "$install_root/machine-compliance" ]
[ ! -e "$install_root/bin/machine-compliance" ]
test -r "$install_root/workspace-roots/projects/.agents/skills/ship-loop/SKILL.md"

# agent-ssh must ship as an installed entry point next to its grid file, and
# the installed copy must consult the grid (source hidden, so this is payload-only).
[ -x "$install_root/agent-ssh" ] || { echo "installed agent-ssh launcher missing" >&2; exit 1; }
[ -x "$install_root/bin/agent-ssh" ] || { echo "installed bin/agent-ssh missing" >&2; exit 1; }
[ -r "$install_root/lib/ssh-grid.json" ] || { echo "installed lib/ssh-grid.json missing" >&2; exit 1; }
hostname_shim="$tmp/hostname-shim"
mkdir -p "$hostname_shim"
printf '#!/usr/bin/env bash\necho lab\n' > "$hostname_shim/hostname"
chmod 755 "$hostname_shim/hostname"
set +e
ssh_output="$(PATH="$hostname_shim:$PATH" "$install_root/agent-ssh" dev 2>&1)"
ssh_status=$?
set -e
[ "$ssh_status" -ne 0 ] || { echo "installed agent-ssh did not enforce the grid" >&2; exit 1; }
grep -q 'blocked by the SSH grid: lab -> dev' <<<"$ssh_output"

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
