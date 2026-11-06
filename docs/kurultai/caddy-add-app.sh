#!/usr/bin/env bash
# Добавить маршрут /app (скачивание APK) в блок Курултая общего Caddyfile и мягко перезагрузить Caddy.
# Запускать на сервере: bash ~/kurultai-robot/infra/caddy-add-app.sh
# Меняет только сайт kurultai.89-144-34-185.sslip.io; копия до правки — рядом, *.bak-<время>.
# Файл правится на месте (тот же inode — его видит контейнер), при ошибке проверки — откат.
set -euo pipefail

FILE=/opt/astana-hub-robot/infra/caddy/Caddyfile
SITE="kurultai.89-144-34-185.sslip.io {"
CADDY="$(docker ps --format '{{.Names}}' | grep -E 'caddy' | head -1)"
[[ -n "$CADDY" ]] || { echo "контейнер caddy не найден" >&2; exit 1; }

# root-файл правим через одноразовый контейнер с тем же каталогом
run() { docker run --rm -i -v /opt/astana-hub-robot/infra/caddy:/c alpine:3.20 sh -c "$1"; }

if run "awk '/^kurultai\\.89-144-34-185\\.sslip\\.io \\{/{k=1} k&&/handle \\/app\\*/{f=1} k&&/^}/{k=0} END{exit !f}' /c/Caddyfile"; then
  echo "маршрут /app уже есть — ничего не меняю"; exit 0
fi
grep -qF "$SITE" "$FILE" 2>/dev/null || run "grep -qF '$SITE' /c/Caddyfile" || { echo "нет блока Курултая" >&2; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
run "cp -p /c/Caddyfile /c/Caddyfile.bak-$STAMP"
# Вставка перед последним «handle {» (error 404) внутри блока Курултая
run "awk '
  /^kurultai\\.89-144-34-185\\.sslip\\.io \\{/ {k=1}
  k && /^\\thandle \\{\$/ && !done {
    print \"\\t# Скачивание APK из браузера робота (страница с паролем, app/kurultai/download.py)\"
    print \"\\thandle /app* {\"
    print \"\\t\\treverse_proxy kurultai-api:8000 {\"
    print \"\\t\\t\\theader_down -Server\"
    print \"\\t\\t}\"
    print \"\\t}\"
    done=1
  }
  k && /^}/ {k=0}
  {print}
  END {exit !done}
' /c/Caddyfile > /tmp/new && cat /tmp/new > /c/Caddyfile"

if docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  echo "готово: /app добавлен, Caddy перезагружен (копия: Caddyfile.bak-$STAMP)"
else
  run "cat /c/Caddyfile.bak-$STAMP > /c/Caddyfile"
  echo "проверка конфигурации не прошла — вернул как было" >&2
  exit 1
fi
