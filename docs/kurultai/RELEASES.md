# Сборки робота Курултая

APK в git не хранятся (`*.apk` в `.gitignore`): в них вшит ключ OpenRouter, а репозиторий публичный.
Не выкладывать APK в GitHub Releases, чаты и облака без лимита на ключе.

## Стабильная: 5.50-a0427c6-20261030 (2026-10-30)

| | |
|---|---|
| Пакет | `kz.ustem.kurultai`, «AI-помощник Курултая» |
| versionCode | 133 |
| Коммит / тег | `a0427c6` / `stable-2026-10-30` |
| Подпись | `android-app/release.keystore` (CN=Kurultai Robot, O=Ustem Foundation) |
| sha256 | `b24213399c251dba6e5d97266ec95b5c1197c7499c653feb80bd383e55d03760` |
| Где лежит | `~/kurultai-releases/Kurultai-Ustem-v5.50-a0427c6-20261030-STABLE.apk`, `apk-archive/Kurultai-Ustem-STABLE.apk` |

Что внутри: дизайн mynbayy (prod-5.50-ui), только OpenRouter (ответы `openai/gpt-6-luna`, распознавание
`google/gemini-3.1-flash-lite`, озвучка `openai/gpt-audio-mini` голосом cedar), без «null» в ответах, все законопроекты
и итоги в снимке quryltai.kz, обновление раз в час, веб-поиск только для новостей. Подробности — `CHANGELOG.md`.

Откат на эту сборку: раздать папку `python3 -m http.server 8090` и открыть файл в браузере робота.
Если на роботе стоит версия с большим versionCode, Android не даст поставить старую поверх: сначала удалить приложение
(ключ вшит, вводить заново не нужно).

Пересобрать то же самое: `git checkout stable-2026-10-30`, в `android-app/` должны быть `release.keystore` и
`secrets.properties`, затем `./gradlew assembleRelease`.
