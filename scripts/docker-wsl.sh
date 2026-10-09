#!/bin/bash
set -euo pipefail
# Arguments stay separate; do not evaluate command text or source secret files.
args=()
previous=''
for arg in "$@"; do
  if [[ "$arg" =~ ^[A-Za-z]:[\\/] ]]; then
    case "$previous" in
      -f|--file|--env-file|--project-directory|-i|--input|-o|--output) arg=$(wslpath -u "$arg");;
      -v|--volume)
        source=${arg%%:*}; rest=${arg#*:}
        source="$source:${rest%%:*}"; suffix=${rest#*:}
        arg="$(wslpath -u "$source"):$suffix";;
      *) if [[ "${args[0]:-}" == 'cp' ]]; then arg=$(wslpath -u "$arg"); fi;;
    esac
  fi
  args+=("$arg")
  previous=$arg
done
# Translate only mount paths in this process; never copy credentials.
for ((i=0; i<${#args[@]}; i++)); do
  if [[ "${args[i]}" == '--env-file' ]]; then
    file="${args[i+1]:?Missing environment file}"
    while IFS= read -r line || [[ -n "$line" ]]; do
      line=${line%$'\r'}
      key=${line%%=*}
      case "$key" in
        BACKUP_HOST_DIR|BACKUP_CONFIG_DIR|BACKUP_SECONDARY_HOST_DIR)
          value=${line#*=}; value=${value#\"}; value=${value%\"}; value=${value#\'}; value=${value%\'}
          if [[ "$value" =~ ^[A-Za-z]:[\\/] ]]; then export "$key=$(wslpath -u "$value")"; fi
          ;;
      esac
    done < "$file"
  fi
done
exec /usr/bin/docker "${args[@]}"
