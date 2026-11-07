#!/usr/bin/env bash
# Копия бэкапов базы Курултая вне сервера: забирает ~/kurultai-backups/*.dump с сервера на этот компьютер.
# Запускается systemd user timer (kurultai-pull-backups.timer) раз в день; Persistent=true — если ноутбук был
# выключен, догонит при включении. Ручной запуск: docs/kurultai/backup/pull-backups.sh
#
# Сюда: ~/kurultai-backups (или DEST), хранится KEEP_DAYS дней. Сервер хранит свои 14 дней отдельно.
set -euo pipefail
umask 077

SERVER="${SERVER:-bolat@89.144.34.185}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/lab_key}"
DEST="${DEST:-$HOME/kurultai-backups}"
KEEP_DAYS="${KEEP_DAYS:-60}"

mkdir -p "$DEST"
chmod 700 "$DEST"
rsync -a --ignore-existing --include='kurultai-*.dump' --exclude='*' \
  -e "ssh -i $SSH_KEY -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20" \
  "$SERVER:kurultai-backups/" "$DEST/"
find "$DEST" -maxdepth 1 -name 'kurultai-*.dump' -mtime +"$KEEP_DAYS" -delete
latest="$(ls -1t "$DEST"/kurultai-*.dump 2>/dev/null | head -n 1 || true)"
if [[ -z "$latest" ]]; then
  echo "$(date -Is) ОШИБКА: копий нет" >&2
  exit 1
fi
age_h=$(( ( $(date +%s) - $(stat -c %Y "$latest") ) / 3600 ))
echo "$(date -Is) ok: копий $(ls -1 "$DEST"/kurultai-*.dump | wc -l), свежая $(basename "$latest") (${age_h} ч назад)"
if (( age_h > 48 )); then
  echo "$(date -Is) ВНИМАНИЕ: свежей копии больше 48 ч — проверьте cron бэкапа на сервере" >&2
  exit 1
fi
