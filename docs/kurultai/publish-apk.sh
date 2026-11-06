#!/usr/bin/env bash
# Выложить APK робота Курултая на сервер: робот скачает его из браузера по адресу
#   https://kurultai.89-144-34-185.sslip.io/app   (пароль — KURULTAI_APP_PASSWORD в ~/kurultai-robot/infra/.env)
# Нужно в парламенте, куда не пускают с ноутбуками. Страница и ссылки — app/kurultai/download.py (сервер).
#
#   docs/kurultai/publish-apk.sh [путь к APK]        по умолчанию — свежая release-сборка
#   docs/kurultai/publish-apk.sh --stable <APK>      пометить как стабильную (откат), имя с -STABLE
#
# Выкладывать — только по слову владельца (это выкладка на прод-сервер).
# Проверяет: пакет kz.ustem.kurultai, подпись нашим release.keystore, versionName с git sha.
# Имя на сервере: Kurultai-Ustem-v<versionName>[-STABLE].apk. Хранит KEEP последних обычных сборок + все STABLE.
set -euo pipefail

SERVER="bolat@89.144.34.185"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/lab_key}"
REMOTE_DIR="kurultai-apk"   # ~/kurultai-apk на сервере, смонтирован в kurultai-api как /apk (только чтение)
URL="https://kurultai.89-144-34-185.sslip.io/app"
KEEP=4
PACKAGE="kz.ustem.kurultai"
CERT_SHA256="4c8f8577ee50a3a2314cc3941badb86f47008c7173d3ead25a113786309ea542"  # CN=Kurultai Robot, O=Ustem Foundation

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STABLE=""
if [[ "${1:-}" == "--stable" ]]; then STABLE="-STABLE"; shift; fi
APK="${1:-$ROOT/android-app/app/build/outputs/apk/release/app-release.apk}"
[[ -f "$APK" ]] || { echo "Нет файла: $APK" >&2; exit 1; }

SDK="$(sed -n 's/^sdk.dir=//p' "$ROOT/android-app/local.properties" 2>/dev/null || true)"
SDK="${SDK:-${ANDROID_HOME:-$HOME/Android/Sdk}}"
BT="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"

badging="$("$BT/aapt2" dump badging "$APK" | head -1)"
pkg="$(sed -n "s/.*package: name='\([^']*\)'.*/\1/p" <<<"$badging")"
ver="$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<<"$badging")"
cert="$("$BT/apksigner" verify --print-certs "$APK" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')"

[[ "$pkg" == "$PACKAGE" ]] || { echo "Чужой пакет: $pkg (нужен $PACKAGE)" >&2; exit 1; }
[[ "$cert" == "$CERT_SHA256" ]] || { echo "Подпись не нашим release.keystore: $cert" >&2; exit 1; }
[[ "$ver" =~ ^[0-9]+\.[0-9]+-[0-9a-f]{7,}-[0-9]{8}$ ]] || { echo "versionName без git sha и даты: $ver" >&2; exit 1; }

NAME="Kurultai-Ustem-v${ver}${STABLE}.apk"
SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes "$SERVER")
echo "Выкладываю $NAME ($(du -h "$APK" | cut -f1), sha256 $(sha256sum "$APK" | cut -c1-16)…)"
"${SSH[@]}" "mkdir -p ~/$REMOTE_DIR && chmod 755 ~/$REMOTE_DIR"
scp -q -i "$SSH_KEY" -o IdentitiesOnly=yes "$APK" "$SERVER:$REMOTE_DIR/.$NAME.part"
# атомарно: страница не увидит недокачанный файл; старые обычные сборки — сверх KEEP — удалить
"${SSH[@]}" "cd ~/$REMOTE_DIR && chmod 644 .$NAME.part && mv -f .$NAME.part $NAME && \
  ls -1t Kurultai-Ustem-v*.apk | grep -v -- '-STABLE\.apk\$' | tail -n +$((KEEP + 1)) | xargs -r rm -f -- && ls -lt"
echo "Готово: $URL"
