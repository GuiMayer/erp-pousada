#!/bin/bash
set -euo pipefail
# A NUL-delimited payload preserves spaces, quotes and Unicode through WSL's
# Windows command-line parser. No eval, shell expansion or credential files.
mapfile -d '' -t args < <(printf '%s' "${1:?Missing payload}" | base64 --decode)
root="${args[0]:?Missing repository root}"
cd "$root"
exec /bin/bash "$root/scripts/docker-wsl.sh" "${args[@]:1}"
