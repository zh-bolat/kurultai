#!/usr/bin/env bash
# Бэкап базы робота Курултая (материалы админки, журнал вопросов, память разговоров) на сервере.
# Только стек kurultai-robot: контейнер БД kurultai-db, база kurultai. Astana Hub не трогает.
#
# Ставится на сервер в ~/kurultai-backup/kurultai-backup.sh, запускается cron пользователя bolat:
#   30 3 * * * $HOME/kurultai-backup/kurultai-backup.sh >> $HOME/kurultai-backup/backup.log 2>&1
# Копии: ~/kurultai-backups/kurultai-<время>.dump (pg_dump -Fc), хранятся KEEP_DAYS дней.
# Копию вне сервера забирает ноутбук: docs/kurultai/backup/pull-backups.sh (systemd user timer).
# Восстановление — docs/kurultai/backup/README.md.
#
# Дамп пишется во временный файл, проверяется `pg_restore --list` и только потом получает имя *.dump —
# битая копия не выдаёт себя за хорошую.
set -euo pipefail
umask 077

COMPOSE_DIR="${COMPOSE_DIR:-$HOME/kurultai-robot/infra}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.kurultai.yml}"
SERVICE="${SERVICE:-kurultai-db}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/kurultai-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
MIN_FREE_MB="${MIN_FREE_MB:-2048}"
ts="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cd "$COMPOSE_DIR"
dc() { docker compose -f "$COMPOSE_FILE" "$@"; }

if [[ -z "$(dc ps -q --status running "$SERVICE" 2>/dev/null)" ]]; then
  echo "$(date -Is) ОШИБКА: $SERVICE не запущен — бэкап невозможен" >&2
  exit 1
fi
free_mb="$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
if (( free_mb < MIN_FREE_MB )); then
  echo "$(date -Is) ОШИБКА: на диске ${free_mb} МБ < ${MIN_FREE_MB} МБ — бэкап не делаю" >&2
  exit 1
fi

final="$BACKUP_DIR/kurultai-$ts.dump"
tmp="$(mktemp "$BACKUP_DIR/.kurultai-$ts.XXXXXX")"
trap 'rm -f "$tmp"' EXIT

dc exec -T "$SERVICE" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' < /dev/null > "$tmp"
# проверка: архив читается и в нём есть таблицы материалов
toc="$(dc exec -T "$SERVICE" pg_restore --list < "$tmp")"
if ! grep -q 'TABLE public kurultai_materials' <<<"$toc"; then
  echo "$(date -Is) ОШИБКА: дамп не читается или без kurultai_materials" >&2
  exit 1
fi
mv "$tmp" "$final"
trap - EXIT

find "$BACKUP_DIR" -maxdepth 1 -name 'kurultai-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) ok $(basename "$final") $(du -h "$final" | cut -f1); копий: $(find "$BACKUP_DIR" -maxdepth 1 -name 'kurultai-*.dump' | wc -l)"
