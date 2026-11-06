#!/usr/bin/env bash
# Разрешить загрузку файлов в админку материалов Курултая (/app/admin/api/materials) — до 25 МБ.
# Без этого Caddy режет тело запроса до 32 КБ (правило @k_small блока Курултая) и PDF не загрузить.
# Запускать на сервере: bash ~/kurultai-robot/infra/caddy-admin-upload.sh
# Меняет только сайт kurultai.89-144-34-185.sslip.io; копия до правки — рядом, *.bak-<время>; ошибка проверки — откат.
set -euo pipefail

CADDY="$(docker ps --format '{{.Names}}' | grep -E 'caddy' | head -1)"
[[ -n "$CADDY" ]] || { echo "контейнер caddy не найден" >&2; exit 1; }
run() { docker run --rm -i -v /opt/astana-hub-robot/infra/caddy:/c alpine:3.20 sh -c "$1"; }

if run "grep -q '@k_upload path /app/admin/api/materials' /c/Caddyfile"; then
  echo "лимит загрузки уже настроен — ничего не меняю"; exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
run "cp -p /c/Caddyfile /c/Caddyfile.bak-$STAMP"
# В блоке Курултая: исключить загрузку из @k_small и дать ей свой лимит 25 МБ
run "awk '
  /^kurultai\\.89-144-34-185\\.sslip\\.io \\{/ {k=1}
  k && /^\\t@k_small not path / && !done {
    sub(/\$/, \" /app/admin/api/materials\")
    print
    print \"\\t# Загрузка материалов в админку (PDF, DOCX…): до 25 МБ\"
    print \"\\t@k_upload path /app/admin/api/materials\"
    print \"\\trequest_body @k_upload {\"
    print \"\\t\\tmax_size 25MB\"
    print \"\\t}\"
    done=1
    next
  }
  k && /^}/ {k=0}
  {print}
  END {exit !done}
' /c/Caddyfile > /tmp/new && cat /tmp/new > /c/Caddyfile"

if docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  echo "готово: загрузка до 25 МБ, Caddy перезагружен (копия: Caddyfile.bak-$STAMP)"
else
  run "cat /c/Caddyfile.bak-$STAMP > /c/Caddyfile"
  echo "проверка конфигурации не прошла — вернул как было" >&2
  exit 1
fi
