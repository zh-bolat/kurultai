#!/bin/zsh
set -eu

SCRIPT_DIR=${0:A:h}
APK_PATH="$SCRIPT_DIR/app/build/outputs/apk/release/app-release.apk"

if command -v adb >/dev/null 2>&1; then
  ADB_BIN=$(command -v adb)
elif [[ -x /tmp/kurultai-android-build/sdk/platform-tools/adb ]]; then
  ADB_BIN=/tmp/kurultai-android-build/sdk/platform-tools/adb
else
  print "ADB не найден. Установите Android Platform Tools и повторите запуск."
  exit 1
fi

if [[ ! -f "$APK_PATH" ]]; then
  print "APK не найден: $APK_PATH"
  exit 1
fi

"$ADB_BIN" start-server >/dev/null
DEVICE_STATE=$("$ADB_BIN" get-state 2>/dev/null || true)
if [[ "$DEVICE_STATE" != "device" ]]; then
  print "Робот не подключён или не авторизован."
  print "Включите отладку на OrionStar, подключите USB и подтвердите «Разрешить USB-отладку» на экране."
  "$ADB_BIN" devices -l
  exit 2
fi

print "Устанавливаю AI-помощник Комитета…"
"$ADB_BIN" install -r "$APK_PATH"
print "Готово. На роботе: три пальца вниз → Все приложения → AI-помощник Комитета."
