# Переключатели во вкладке «Робот и настройки» (контракт v1, 2026-11-10)

Решения владельца 10.11: во вкладке робота — два переключателя под PIN (тот же, что на выход ×): **движок**
(OpenAI / OpenRouter) и **режим** (обычный / шумный день). Шумный день = перебить можно только словом «стоп» +
менее чувствительный детектор речи + отвечать, только когда человек стоит перед роботом. Принудительного конца фразы
и обращения «Ақылтай» — нет. В веб-админке `/app/admin` переключателей не показывать. Поле «собственный шлюз» из
вкладки убрать. Настройки хранятся **на сервере** (переживают переустановку APK, видны в логах и диагностике).

## Сервер
### Хранение
Таблица `kurultai_runtime_settings` (миграция 0007): `key text primary key`, `value jsonb`, `updated_at`, `updated_by`
(IP). Ключи: `live_engine` ∈ {`realtime`, `pipeline`}, `noise_mode` ∈ {`normal`, `noisy`}. Нет строки — значение по
умолчанию из `.env` (`KURULTAI_LIVE_ENGINE`, новый `KURULTAI_NOISE_MODE=normal`). Объект `RuntimeSettings` в
`app.state.kurultai_runtime` с кэшем в памяти (перечитывать из БД при изменении; один процесс — достаточно).

### API (токен робота, как `/v1/robot/diag`)
`GET /v1/robot/settings` →
```json
{"engine": {"selected": "realtime", "effective": "realtime",
            "breaker": {"down": false, "reason": "", "retry_in_s": 0}},
 "noise_mode": "normal",
 "voice": {"provider": "elevenlabs", "credits": 14400, "checked_at": "2026-11-10T09:00:00+00:00"},
 "server": {"version": "0.1.0", "git": "7da171b", "time": "…"},
 "quryltai_updated_at": "…"}
```
- `effective` = `pipeline`, если выбран `realtime`, но сработал предохранитель (`RealtimeHealth.is_down()`), нет
  ключа OpenAI или нет голоса; `breaker.reason` — код (`credit_balance_exhausted`, …).
- `voice.credits` — ElevenLabs `GET /v1/user/subscription` (`character_limit − character_count`), кэш 5 минут;
  ошибка → `credits: null`.

`POST /v1/robot/settings` тело `{"live_engine": "pipeline"}` и/или `{"noise_mode": "noisy"}` (неизвестные значения →
400). Действия: записать, лог `robot_settings_changed` (key, old, new, client_ip), **закрыть все открытые live-сессии
профиля kurultai** кодом 1012 `settings_changed` (приложение переподключится через 2–10 с и получит новые настройки),
вернуть тот же JSON, что GET. PIN проверяет приложение (сервер его не знает); токен робота — достаточная защита API.

### Применение
- `app/live/session.py`: выбор движка — `runtime.live_engine` вместо `settings.kurultai_live_engine` (env остаётся
  значением по умолчанию). Предохранитель работает в любом положении.
- Режим `noisy` в Realtime-мосту (`_session_config`, решения):
  - перебивание только стоп-командой (`kurultai_realtime_barge_in = stop_only` для сессии);
  - детектор речи: `server_vad` с `threshold 0.7`, `prefix_padding_ms 300`, `silence_duration_ms 600` вместо
    `semantic_vad` (как и раньше `create_response: false`, `interrupt_response: false`); шумоподавление `far_field`;
  - **человек перед роботом**: приложение шлёт `{"type":"state","person_present":true|false}` (в `hello` тоже поле
    `person_present`). В режиме `noisy` фраза, закончившаяся при `person_present=false`, не отвечается: элемент
    удаляется, роботу `{"type":"ignored","reason":"no_person"}`; «ставка» (ответ до расшифровки) не начинается;
    стоп-команды работают всегда. Нет сведений о человеке (старое приложение) — считать, что человек есть.
  - предложение проводить и навигация — без изменений.
- Режим `noisy` в пайплайне (OpenRouter): `live_barge_in` и так `stop_only`; фильтр «человек перед роботом» — тоже
  применить на уровне `LiveSession`, если это не больше 20 строк; иначе задокументировать, что в пайплайне только
  стоп-перебивание.
- Логи: `live_ignored_no_person`, `robot_settings_changed`; в `live_session_opened` добавить `noise_mode`.

## Приложение («Робот и настройки»)
### Убрать
«Ключ OpenRouter», «Модель ответа», «Распознавание речи», «Озвучивание» (статусы старой схемы), блок «Настройки
помощника» целиком (модель, «Дополнительно: собственный шлюз», «Проверить», «Сохранить шлюз»), мёртвые обработчики
(`voiceMode`, `answerLanguage`, `loadSettingsPanel`, `testSettings`, `saveSettings`, `onAiStatus`→модель). Адрес
сервера — только из сборки (`BACKEND_URL`).

### Состояние (сверху)
Сервер: онлайн/офлайн · движок «OpenAI» / «OpenRouter» (если `effective ≠ selected` — «OpenAI недоступен: <причина>,
работает OpenRouter, повтор через N мин») · режим «Обычный» / «Шумный день» · голос: «ElevenLabs: 14 400 кредитов»
(красным, если < 20 000) · данные quryltai.kz (время) · версия приложения · экран (WebView) · RobotAPI (готов/нет) ·
Wi‑Fi. Источник — `GET /v1/robot/settings` раз в 60 с и при открытии вкладки (через Java: `Robot.refreshSettings()` →
`window.onRobotSettings(json)`).

### Переключатели (под PIN)
Две группы кнопок-сегментов: «Движок: OpenAI | OpenRouter», «Режим: Обычный | Шумный день». Нажатие → окно PIN
(`pin.js`, как на выход) → `Robot.setRobotSetting(key, value)` → Java `POST /v1/robot/settings` → `onRobotSettings`.
Пока запрос идёт — кнопки заблокированы; ошибка → тост с текстом сервера. Подпись под движком: «OpenAI — быстрее,
с навигацией и поиском; OpenRouter — запасной, без навигации». Под режимом: «Шумный день: перебить можно только словом
„стоп“, робот отвечает лишь тому, кто стоит перед ним».

### Робот (ниже)
Батарея · зарядка · карта · точки (список имён) · «Обновить» · «На зарядку» · **«На пост»** (поездка на `home`,
`Пункт приема`, через тот же `startGuidedNavigation`, state без `auto`) · «Поехать к точке» — выпадающий список точек
карты вместо текстового поля (служебные зарядные точки не показывать) · разблокировка движения, стрелки, голова ·
строка «Последняя поездка: музей — приехал, 42 с» (из `last_trip`). Движение/поездки — по-прежнему только при
разблокировке.

### Присутствие человека
Приложение уже знает `person_present` (слежение за лицом). Слать `state person_present` в live при каждом изменении
(не чаще раза в 1 с) и в `hello`. В диагностику `/v1/robot/diag` — `settings_seen` (что показывает вкладка).

## Открытые моменты
- ElevenLabs остаток — общий ключ с Astana Hub, цифра общая на аккаунт.
- Пороги `server_vad` (0.7 / 600 мс) — стартовые, подбирать по логам шумного дня.
