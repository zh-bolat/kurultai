#!/bin/zsh
set -eu

if command -v adb >/dev/null 2>&1; then
  ADB_BIN=$(command -v adb)
elif [[ -x /tmp/kurultai-android-build/sdk/platform-tools/adb ]]; then
  ADB_BIN=/tmp/kurultai-android-build/sdk/platform-tools/adb
else
  print "ADB не найден. Установите Android Platform Tools."
  exit 1
fi

if [[ "$("$ADB_BIN" get-state 2>/dev/null || true)" != "device" ]]; then
  print "Робот не подключён или не подтвердил USB-отладку."
  "$ADB_BIN" devices -l
  exit 2
fi

print "Создайте НОВЫЙ ключ OpenAI. Опубликованный ранее ключ использовать нельзя."
read -rs "OPENAI_ROBOT_KEY?Вставьте новый API-ключ (ввод скрыт): "
print

if [[ "$OPENAI_ROBOT_KEY" != sk-* || ${#OPENAI_ROBOT_KEY} -lt 20 ]]; then
  unset OPENAI_ROBOT_KEY
  print "Формат ключа неверный."
  exit 3
fi

"$ADB_BIN" shell am start -n kz.ustem.kurultai/kz.kurultai.assistant.MainActivity --es openai_api_key "$OPENAI_ROBOT_KEY" >/dev/null
unset OPENAI_ROBOT_KEY
print "На экране робота нажмите «Сохранить». После этого ключ будет зашифрован Android Keystore."
