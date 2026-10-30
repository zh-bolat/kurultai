# Контракт голоса: робот Курултая ↔ сервер (v1, 2026-10-30)

Сервер — тот же backend, что у Astana Hub (`~/astana-hub-robot/backend`, VPS 89.144.34.185, ветка `feature/voice-latency`).
Протокол целиком — `docs/astana-hub/api-contract.md` (v1.4). Здесь только отличия для Курултая.

## Этап 1 (без изменений на сервере, сборка 5.51)
Робот Курултая пользуется существующими нейтральными эндпоинтами с токеном Astana Hub:
- `POST /v1/tts?stream=true` — голос ElevenLabs (Dmitry, `eleven_v4_turbo`), MP3. Текст ≤ 300 символов, `lang` ru/kk.
- Распознавание и ответы — на роботе через OpenRouter (как в 5.50). `/v1/chat` и `/v1/live` **не** использовать:
  у них агент и персона Astana Hub.

## Этап 2: профиль `kurultai` на сервере (нужен деплой по слову владельца)
**Профиль выбирается токеном.** На сервере второй токен `KURULTAI_ROBOT_TOKEN` (`.env`). Запрос с ним работает в профиле
`kurultai`, с прежним `ROBOT_TOKEN` — в профиле `astana_hub`. Поведение Astana Hub не меняется ни в чём.

В профиле `kurultai`:
- Эндпоинты `/v1/health`, `/v1/tts`, `/v1/stt`, `/v1/stt/stream`, `/v1/chat`, `/v1/live` с тем же протоколом.
- Агент: системный промпт Курултая (персона «ИИ-помощник Курултая Республики Казахстан», характер деловой и немного
  игривый, тематика только Курултай и законодательство РК; текст — из `ASSISTANT_INSTRUCTIONS` в
  `android-app/.../MainActivity.java` этого репозитория). **Без базы знаний Astana Hub**, без тулов `where_is`, `guide_to`,
  `look`, без быстрых ответов про места хаба (fastpath), без событий хаба.
- Данные: сервер сам раз в час загружает публичный снимок quryltai.kz (те же 4 API и формат, что
  `QuryltaiDataSync.promptContext`: все законопроекты с итогами по статусам, планы, комитеты с числом членов, до 120
  депутатских запросов) и кладёт его в системный промпт. Без сети — последний снимок.
- Веб-поиск (плагин `web` OpenRouter, 3 результата) — только на вопросы о новостях, прошедших событиях и расписании
  (логика `needsWebSearch` из `MainActivity.java`).
- Приветствие (`visitor_arrived`): короткое, от лица помощника Курултая, ru/kk.
- Голос, VAD, перебивание «стоп», «не мне», сон — как у Astana Hub (те же настройки `.env`).
- Журнал вопросов и метрики помечаются профилем (`profile=kurultai`), чтобы не смешивать статистику хаба.
- `GET /v1/health` без изменений. Для проверки профиля: `GET /v1/profile` (с токеном) → `{"profile": "kurultai"}`.

## Робот (этап 2)
- `BACKEND_URL` и `KURULTAI_ROBOT_TOKEN` — в `android-app/secrets.properties` (не в git), вшиваются в `BuildConfig`.
- Live-клиент: WebSocket `/v1/live?session_id=…&lang=ru|kk`, `hello` → `visitor_arrived` по лицу или по нажатию круга,
  микрофон PCM 16 кГц непрерывно, звук ответа PCM 24 кГц (`AudioTrack`, `USAGE_VOICE_COMMUNICATION`) — как в
  `~/astana-hub-robot/android-app/.../live/`. Состояния панели mynbayy (`idle/listening/thinking/speaking`) — из кадров
  `listening`, `user_speaking`, `thinking`, `turn_start`, `turn_end`, `interrupted`.
- Запасной режим: если `/v1/live` недоступен — этап 1 (OpenRouter на роботе + `/v1/tts`).
