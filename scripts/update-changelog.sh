#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CHANGELOG="$ROOT_DIR/CHANGELOG.md"
APP_CHANGELOG="$ROOT_DIR/apps/desktop/src/ui/CHANGELOG.md"

if [[ ! -f "$CHANGELOG" ]]; then
  cat > "$CHANGELOG" <<'EOF'
# Changelog

<!-- last: -->

## Unreleased

- Initial development.
EOF
fi

LAST_SHA="$(python3 - <<'PY'
import re
p='CHANGELOG.md'
try:
  s=open(p,'r',encoding='utf-8').read()
except FileNotFoundError:
  print('')
  raise SystemExit
m=re.search(r'<!--\s*last:\s*([0-9a-f]{7,40})\s*-->', s)
print(m.group(1) if m else '')
PY
)"

HEAD_SHA="$(git rev-parse HEAD)"

if [[ -n "$LAST_SHA" ]]; then
  COMMITS="$(git log "$LAST_SHA..$HEAD_SHA" --pretty=format:'- %s (%h)' --reverse || true)"
else
  COMMITS="$(git log -n 50 --pretty=format:'- %s (%h)' --reverse || true)"
fi

# If nothing new, exit cleanly.
if [[ -z "${COMMITS//[[:space:]]/}" ]]; then
  echo "No new commits for changelog."
  exit 0
fi

TODAY="$(date -u +%Y-%m-%d)"

python3 - <<PY
from pathlib import Path
import re

head = "${HEAD_SHA}"
today = "${TODAY}"
commits = """${COMMITS}""".strip()

p = Path("CHANGELOG.md")
s = p.read_text(encoding='utf-8')

section = f"## {today}\n\n{commits}\n\n"

if re.search(r'<!--\s*last:', s):
  # replace marker line and insert section right after it
  s = re.sub(r'<!--\s*last:.*?-->', f'<!-- last: {head} -->', s, count=1)
  parts = s.split(f'<!-- last: {head} -->', 1)
  s = parts[0] + f'<!-- last: {head} -->\n\n' + section + parts[1].lstrip('\n')
else:
  s = f"# Changelog\n\n<!-- last: {head} -->\n\n" + section + s

p.write_text(s, encoding='utf-8')

# Keep app-bundled copy in sync
app_p = Path("apps/desktop/src/ui/CHANGELOG.md")
app_p.write_text(s, encoding='utf-8')
print(f"Updated changelog to {head}")
PY
