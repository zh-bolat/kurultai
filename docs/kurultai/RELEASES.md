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

## Резервная точка перед OpenAI Realtime: 2026-11-09
Рабочая схема до перехода на «голос в голос»: распознавание Gemini Flash Lite → ответ `openai/gpt-6-luna`
(OpenRouter) → голос ElevenLabs Dmitry. Робот отвечает на «Ақылтай / робот / бот», язык с экрана, голова работает.

| что | где |
|---|---|
| сервер, код | тег `kurultai-pipeline-2026-11-09` = `5e7f8ad` в `zh-bolat/astana-hub-robot` (ветка `feature/kurultai-profile`) |
| сервер, образ | `kurultai-robot-api:pipeline-5e7f8ad` на VPS (тот же образ, что работал 7–9.11) |
| сервер, настройки | `~/kurultai-robot/infra/.env.backup-pipeline-2026-11-09` (права 600) |
| приложение | тег `app-2026-11-09` = `52280ee`, APK `5.50-52280ee-20261107` на `/app` и в `apk-archive/`; с Realtime приложение не меняется |

**Откат, если Realtime не подошёл** (по порядку, от быстрого к полному):
1. Переключатель (после выкатки Realtime): в `.env` `KURULTAI_LIVE_ENGINE=pipeline`, затем
   `cd ~/kurultai-robot/infra && docker compose -f docker-compose.kurultai.yml up -d kurultai-api` — 1 минута.
2. Старый образ без пересборки: `docker tag kurultai-robot-api:pipeline-5e7f8ad kurultai-robot-api:local`,
   `cp .env.backup-pipeline-2026-11-09 .env`, затем тот же `up -d kurultai-api` (без `--build`).
3. Код: `git push ssh://bolat@89.144.34.185/home/bolat/kurultai-robot kurultai-pipeline-2026-11-09:main` (с ноутбука,
   `GIT_SSH_COMMAND` как в README) и `up -d --build kurultai-api`.

**После выкатки поиска (2026-11-10, миграция `0006_kurultai_chunks`)** для шагов 2 и 3 нужна ещё одна строка:
старый образ не знает ревизию 0006 и упадёт на `alembic upgrade head`. Поэтому перед `up -d` допишите в `.env`
`DB_AUTO_MIGRATE=false` (старому коду новая таблица `kurultai_chunks` не мешает) — либо, если хотите вернуть схему,
из нового образа выполните `docker compose -f docker-compose.kurultai.yml exec kurultai-api alembic downgrade
0005_kurultai_materials` (удаляет только `kurultai_chunks`, материалы и журнал не трогает).
Шаг 1 (переключатель `KURULTAI_LIVE_ENGINE=pipeline`) по-прежнему без оговорок: старая цепочка живёт в том же образе
и покрыта теми же тестами; поиск и Realtime при этом просто не используются.
Промежуточная точка: образ `kurultai-robot-api:realtime-eff4c03` на VPS — Realtime-гибрид без поиска (работал
9.11, миграций после 0005 не знает → тоже с `DB_AUTO_MIGRATE=false`).
Перед любым откатом — свежая копия базы: `~/kurultai-backup/kurultai-backup.sh` (см. `backup/README.md`).

## Навигация: 2026-11-10 11:41
Сервер `4df2ef9` (поиск `5a26831` + навигация по `navigation.md`), приложение `5.50-e79feb4-20261110` на `/app`.
Образ до навигации сохранён как `kurultai-robot-api:rag-5a26831` (откат: `docker tag … kurultai-robot-api:local` + `up -d`
без `--build`; миграций после 0006 нет, `.env` менять не нужно). Предыдущий APK `5.50-52280ee-20261107` остаётся на `/app`.

## Предохранитель + переключатели: 2026-11-10 15:57
Сервер `30f1e36` (предохранитель Realtime `7da171b`, настройки вкладки робота и «шумный день» `30f1e36`, миграция 0007),
приложение `5.50-6878b68-20261110` на `/app`. Образ до этого сохранён как `kurultai-robot-api:nav-4df2ef9`
(откат: `docker tag … kurultai-robot-api:local` + `up -d` + `DB_AUTO_MIGRATE=false`, таблица `kurultai_runtime_settings`
старому коду не мешает). Переключатели движка/режима — во вкладке «Робот и настройки» под PIN; значения хранятся на
сервере (`kurultai_runtime_settings`), `.env` — только умолчания.

## Сводка заседания в промпте, без прерываний: 2026-11-11 07:57
Сервер `5f620a0` (сводка ближайших событий раньше заголовков, `stop_only` по умолчанию, фильтр «чужого языка», эмоции
по смыслу, бюджет запасной цепочки 60 тыс.). Образ до этого — `kurultai-robot-api:short-c27f200`. Логи прежнего
контейнера сохранены в `~/kurultai-logs/` на сервере (перед каждой выкаткой: `docker logs … | gzip`). Приложение на
`/app` — `5.50-1209d60-20261110` (без изменений). Голосовой прогон после выкатки: 15 из 15 — `audit-2026-11-11.md`.

## «Стоп» сразу и плавно: 2026-11-11
Сервер `7876045` (остановка по слову «стоп» в первых словах расшифровки, «Стоп, а где туалет?» — замолкает и отвечает
на вопрос; `app/live/stop.py::stop_request`). Образ до этого — `kurultai-robot-api:digest-5f620a0`. Приложение
`5.50-58afce9-20261111` на `/app`: на «стоп» и касание круга голос затухает за 260 мс. На роботе не проверено.

## Запасная цепочка без «нет связи», материалы без файлов: 2026-11-12 15:38
Сервер `ff66604`. Причина выкатки — простой 12.11 с 14:57 до 15:16: на OpenAI кончился баланс, робот перешёл на
OpenRouter, но две зависшие сессии запасной цепочки заняли лимит подключений, и сервер отклонял робота.
- Новое подключение робота Курултая вытесняет прежние сессии; «ожил ли OpenAI» проверяется фоном (паузы 1→2→4→5 мин).
- Чтение материалов без `file_bytes` (36 МБ): 70 мс вместо 0,4–1,7 с, после холодного старта не упирается в таймаут.
Образ до этого — `kurultai-robot-api:stop-7876045`. Astana Hub остановлен с 11.11 по решению владельца.
