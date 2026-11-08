# Ақылтай действует: Telegram, почта, Google Calendar — контракт (этап 0)

Статус: **черновик на утверждение** (2026-11-08). Код не пишется, пока документ не утверждён.
Сервер — профиль `kurultai` в `~/astana-hub-robot`, ветка `feature/kurultai-assistant` (worktree
`~/astana-hub-robot-wt/kurultai-assistant`, от `feature/kurultai-profile` = `5e7f8ad`). Робот — `android-app/` этого репо.
Astana Hub не меняется: всё новое включается только токеном профиля kurultai и лежит в `backend/app/kurultai/`.

## 1. Коротко
Робот умеет не только отвечать, но и **предлагать действие**: отправить запрос аппарату, написать контакту депутата,
создать событие в календаре. Модель лишь готовит черновик. Черновик показывается на экране, человек нажимает
кнопку, и только после этого **сервер** выполняет действие из очереди, с повторами и журналом.

Почему так. Модель может ошибиться или её можно «уговорить» (prompt injection через вопрос, материалы, веб-поиск).
Поэтому у модели нет ни адресов, ни секретов, ни права «отправить». Она может только выбрать **id** получателя
из списка, который задал человек в админке, и предложить текст. Решает человек кнопкой, исполняет сервер.

## 2. Режимы и права

| | **Холл** (по умолчанию) | **Ассистент депутата** |
|---|---|---|
| Где | зал, любой посетитель | кабинет депутата |
| Как включить | всегда | PIN депутата на экране робота, проверка на сервере |
| Что может | оставить запрос аппарату | читать свой Google-календарь, создавать события, писать в Telegram и на почту своим контактам |
| Получатели | только «получатели холла» из админки (группа аппарата и/или ящик аппарата), модель их не выбирает | только контакты этого депутата из админки, модель выбирает `contact_id` |
| Календарь | нет | да, личный календарь депутата (OAuth) |
| Подпись | «Запрос посетителя через Ақылтай (робот Курултая)» | «От депутата N через помощника Ақылтай» |
| Выход | — | кнопка «Выйти», бездействие 10 мин, 2 ч максимум, сон робота |

Подтверждение — **только кнопкой на экране**, голосом никогда. Робот отвечает на обращение, а «да» из зала легко
поймать по ошибке (журнал 07.11: робот отвечал на чужие фразы внутри окна разговора).

## 3. Как проходит действие

```
посетитель/депутат ──голос/текст──▶ агент (модель) ──инструмент propose_*──▶ сервер: action = proposed
                                                                              │ кадр action_proposal
робот: карточка «Проверьте и отправьте» [Отправить] [Отмена] ◀────────────────┘
        │ нажали «Отправить» (action_confirm, id)
        ▼
сервер: confirmed → queued ──исполнитель (фон)──▶ канал (Telegram / SMTP / Google) ──▶ sent
                                     │ временная ошибка → повтор (до 5 раз, пауза растёт)
                                     └ постоянная ошибка → failed
робот ◀── кадр action_status (sent / failed) ── сервер; робот говорит «Отправил» / «Не получилось»
```

### Состояния действия
`proposed` → `confirmed` → `queued` → `sending` → `sent`
- `proposed` → `cancelled` (кнопка «Отмена», сон робота, выход из ассистента) или `expired` (не подтвердили за 3 мин).
- `sending` → `retry` (временная ошибка: нет сети, таймаут до отправки, HTTP 429/5xx) → снова `queued` по `next_attempt_at`.
- `sending` → `failed` (постоянная ошибка: 400/401/403, адрес отклонён, исчерпаны попытки).
- `sending` → `uncertain` — запрос ушёл, но ответа нет (таймаут после отправки): **не повторяем сами**, чтобы не
  было дубля; в журнале админки помечено «проверьте вручную».

Переход только «вперёд» одним `UPDATE … WHERE status = <ожидаемое>` — двойное нажатие или два исполнителя не
отправят дважды.

## 4. Таблицы (миграция `0006_kurultai_assistant`)
Модели — рядом с `KurultaiMaterialRow` (`backend/app/db/models.py:362`), стиль тот же.

**`kurultai_integrations`** — настройки интеграций (одна строка на вид)
| поле | тип | что |
|---|---|---|
| `kind` | text PK | `telegram` / `smtp` / `google` |
| `enabled` | bool | выключатель в админке |
| `config` | jsonb | несекретное: SMTP host/port/starttls/login/from, Google client_id, имя бота |
| `secret_enc` | bytea | секрет, зашифрованный (токен бота / SMTP-пароль / Google client_secret) |
| `checked_at`, `check_ok`, `check_error` | | итог кнопки «Проверить» |
| `updated_at` | timestamptz | |

**`kurultai_recipients`** — получатели (кому вообще можно писать)
| поле | тип | что |
|---|---|---|
| `id` | bigint PK | модель выбирает **его** |
| `scope` | text | `hall` (получатель запросов холла) / `deputy` (контакт депутата) |
| `deputy_id` | bigint FK null | для `deputy` |
| `label` | text | «Пресс-служба», «Помощник Айгерим» — это видит модель |
| `channel` | text | `telegram` / `email` (позже `whatsapp`) |
| `address` | text | chat_id или e-mail — модель **не видит** |
| `enabled` | bool | |

**`kurultai_telegram_chats`** — чаты, которые бот «видел» (подсказка для админки, откуда взять chat_id):
`chat_id` PK, `type` (private/group/supergroup), `title`, `username`, `last_seen_at`.

**`kurultai_deputies`** — депутаты для режима ассистента
| поле | тип | что |
|---|---|---|
| `id` | bigint PK | |
| `name_ru`, `name_kk`, `position` | text | показ на экране и в подписи |
| `pin_hash` | text | `scrypt$n$r$p$salt$hash` (stdlib `hashlib.scrypt`, новых библиотек не нужно) |
| `pin_failures`, `locked_until` | int, timestamptz | лимит попыток |
| `enabled` | bool | |
| `google_email` | text null | какой аккаунт подключён |
| `google_refresh_enc` | bytea null | refresh token, зашифрован |
| `google_connected_at`, `google_expires_at` | timestamptz | в режиме Testing токен живёт 7 дней — админка предупреждает |
| `calendar_id` | text | по умолчанию `primary` |

**`kurultai_assistant_sessions`** — вход депутата на роботе
`id` (uuid), `token_hash` (sha256 токена сессии, сам токен в БД не хранится), `deputy_id`, `robot_session_id`
(session_id live/чата), `created_at`, `last_activity_at`, `expires_at`, `ended_at`, `ended_by`
(`logout`/`idle`/`max`/`sleep`/`admin`).

**`kurultai_actions`** — очередь и журнал действий
| поле | тип | что |
|---|---|---|
| `id` | uuid PK | он же ключ идемпотентности; робот подтверждает по нему |
| `kind` | text | `hall_request` / `message` / `email` / `calendar_create` |
| `mode` | text | `hall` / `assistant` |
| `deputy_id`, `assistant_session_id` | null | для ассистента |
| `robot_session_id` | text | действие подтверждается только из этой же сессии робота |
| `channel` | text | `telegram` / `email` / `google` |
| `recipient_ids` | jsonb | id из `kurultai_recipients` (для `calendar_create` пусто) |
| `payload` | jsonb | текст / тема / поля события (без адресов) |
| `preview` | text | то, что показали на экране и что подтвердил человек — отправляется **ровно оно** |
| `status`, `attempts`, `next_attempt_at` | | очередь |
| `created_at`, `expires_at`, `confirmed_at`, `sent_at` | timestamptz | |
| `result` | jsonb | message_id Telegram / Message-ID письма / id события Google |
| `error` | text | последняя ошибка (без секретов) |

**`kurultai_action_log`** — журнал «кто, когда, что, кому, результат»: `ts`, `action_id`, `event`
(`proposed/confirmed/cancelled/expired/sent/retry/failed/uncertain`, а также `pin_ok/pin_fail/assistant_logout`,
`integration_saved/checked`), `actor` (`robot`/`admin`/`system`), `detail` jsonb (без секретов и без адресов —
только id и label). Хранить 180 дней (как журнал вопросов — открытый вопрос 7).

## 5. Секреты и шифрование
- Ключ — новая переменная `KURULTAI_SECRETS_KEY` в `.env` сервера (ключ Fernet, 32 байта base64). Fernet = AES +
  HMAC из библиотеки `cryptography` (она уже стоит транзитивно, `backend/uv.lock:600`; сделаем явной зависимостью).
- Ротация: `KURULTAI_SECRETS_KEY_PREVIOUS` — старый ключ читается, новые записи — новым (MultiFernet).
- Без ключа интеграции выключены (админка пишет «нет ключа шифрования»), остальное работает.
- Секреты никогда не возвращаются из API админки: поле показывает «задан ••••», можно только заменить.
- В логи и в журнал действий секреты и адреса не пишутся; модель и робот секретов не получают.
- Потеря ключа = все секреты интеграций надо ввести заново (бэкап базы без ключа их не раскроет — это и плюс).

## 6. PIN и сессия ассистента
- PIN 4–8 цифр задаёт сотрудник в админке у депутата, хранится `scrypt`-хеш. `ADMIN_PIN` из APK не участвует.
- Вход на роботе: робот шлёт `{deputy_id, pin}` по уже открытому WS (TLS). Сервер сверяет хеш за постоянное время.
- Лимиты: 5 неверных PIN подряд у депутата → блок 15 мин; с одного робота 10 неверных за 15 мин → пауза.
- Успех → сессия ассистента: токен (32 байта) только в памяти робота, в БД — его sha256. Привязана к `robot_session_id`.
- Конец сессии: «Выйти», 10 мин без реплик депутата, 2 ч максимум, робот уснул (двойной тап / 5 мин), закрыто
  приложение, админ отключил депутата. Сервер шлёт `assistant_mode {active:false, reason}`; незавершённые
  `proposed` этого депутата → `cancelled`.
- В режиме ассистента правило «отвечает только на обращение» остаётся (`app/kurultai/wake.py`).

## 7. Инструменты агента (`backend/app/kurultai/actions/tools.py`)
По образцу `where_is`/`no_answer` (`backend/app/agent/tools.py:108–143`): инструмент кладёт действие в `ctx.actions`,
сервис отдаёт событие `action` (`backend/app/agent/service.py:956`) → live шлёт кадр (`backend/app/live/conversation.py:1051`).

| инструмент | режим | что делает | подтверждение |
|---|---|---|---|
| `propose_hall_request(topic, text, visitor_name?, contact?)` | холл | черновик запроса аппарату | кнопка |
| `list_contacts()` | ассистент | id + label контактов депутата (без адресов) | — |
| `propose_message(contact_ids[], text)` | ассистент | Telegram контактам | кнопка |
| `propose_email(contact_ids[], subject, text)` | ассистент | письмо контактам | кнопка |
| `calendar_list(from, to)` | ассистент | события депутата за период (≤ 14 дней) | — (только чтение) |
| `propose_calendar_event(title, start, end, location?, description?)` | ассистент | создать событие | кнопка |

- Инструмент **проверяет** вход: id из разрешённого списка этого режима и депутата, длина текста (Telegram ≤ 3500,
  письмо ≤ 10 000), время события в будущем и не дольше 12 ч. Ошибку возвращает модели («нет такого контакта»).
- Адреса, телефоны, chat_id в тексте реплики, в материалах и в веб-поиске **не используются как получатели**:
  у инструментов просто нет такого параметра.
- Набор инструментов зависит от режима: в холле — только `propose_hall_request`. Список контактов и имя депутата
  идут в **сообщение хода**, а не в системный промпт — кэш промпта (≈ 23 тыс. токенов) не сбивается.
- После `propose_*` модель коротко говорит «Проверьте текст на экране и нажмите «Отправить»» (правило в промпте).

## 8. Протокол робот ↔ сервер

### WS `/v1/live` — новые кадры
Сервер → робот:
```json
{"type":"action_proposal","action_id":"act_…","kind":"hall_request","mode":"hall",
 "title":"Запрос аппарату Курултая","preview":"…текст как будет отправлен…",
 "recipients":["Аппарат Курултая (Telegram)","Аппарат (почта)"],"expires_in_s":180,"turn_id":"trn_…"}
{"type":"action_status","action_id":"act_…","status":"queued|sent|failed|cancelled|expired|uncertain","message":"…"}
{"type":"assistant_mode","active":true,"deputy":{"id":3,"name":"…"},"expires_at":"…","idle_s":600}
{"type":"assistant_mode","active":false,"reason":"logout|idle|max|sleep|admin|pin_failed|locked"}
```
Робот → сервер (новые `CLIENT_TYPES`, `backend/app/live/protocol.py:31`):
```json
{"type":"action_confirm","action_id":"act_…"}
{"type":"action_cancel","action_id":"act_…"}
{"type":"assistant_login","deputy_id":3,"pin":"1234"}
{"type":"assistant_logout"}
```
- Подтверждение действует, только если действие `proposed`, не истекло и создано в **этой** сессии робота.
- Повторный `action_confirm` того же id — тот же ответ, без второй отправки.
- После `sent`/`failed` сервер сам озвучивает короткую фразу голосом live («Отправил аппарату» / «Не получилось
  отправить, запрос сохранён, сотрудники увидят его в журнале»).

### Запасной режим (без live): `POST /v1/chat` + POST-команды
- SSE `/v1/chat` получает событие `event: action_proposal` (то же тело, что кадр выше).
- `POST /v1/actions/{id}/confirm`, `POST /v1/actions/{id}/cancel` → `{action_id, status}`; тело `{"session_id": "…"}`.
- `GET /v1/actions/{id}` → статус (робот спрашивает раз в 2 с до `sent/failed`, не дольше 60 с).
- `GET /v1/assistant/deputies` → `[{id, name}]` включённых депутатов (для экрана входа).
- `POST /v1/assistant/login {session_id, deputy_id, pin}` → `{assistant_token, deputy, expires_at}`;
  `POST /v1/assistant/logout`. В режиме ассистента запросы `/v1/chat` несут заголовок `X-Assistant-Session`.
- Все — только с токеном профиля kurultai (иначе 404), лимиты тела в `backend/app/guard.py`.

## 9. Админка (`/app/admin`, вход как сейчас — `backend/app/kurultai/admin.py:1–5`)
Новые вкладки в той же странице (`admin_page.html`):
- **Интеграции:** Telegram (токен бота, «Проверить» = `getMe`, «Найти чаты» = `getUpdates`, список увиденных чатов
  с chat_id → «Сделать получателем»), Почта (host, port, STARTTLS/SSL, логин, пароль, «От кого», «Проверить» =
  вход на SMTP + тестовое письмо на указанный адрес), Google (client_id, client_secret, адрес возврата для копирования).
  У каждой — выключатель и итог последней проверки.
- **Холл:** какие получатели получают запросы холла (галочки), шаблон подписи.
- **Депутаты:** имя ru/kk, должность, PIN (задать/сменить, сбросить блок), включён ли; контакты депутата
  (label + Telegram-чат из найденных или e-mail); «Подключить Google» → OAuth → видно аккаунт и срок до истечения.
- **Журнал действий:** фильтры по статусу/режиму/депутату, строка = кто, когда, что (превью), кому (label),
  результат; у `failed/uncertain` — «Повторить» и «Пометить решённым».

API (все с cookie админки + заголовок `X-Kurultai-Admin`, как у материалов):
`GET/PUT /app/admin/api/integrations/{kind}`, `POST …/{kind}/check`, `POST …/telegram/discover`,
`GET/POST/PATCH/DELETE /app/admin/api/recipients`, `GET/POST/PATCH /app/admin/api/deputies`,
`POST /app/admin/api/deputies/{id}/pin`, `POST …/{id}/unlock`, `GET /app/admin/api/deputies/{id}/contacts`,
`GET /app/admin/google/start?deputy_id=…` → Google, `GET /app/admin/google/callback` (адрес возврата),
`POST /app/admin/api/deputies/{id}/google/disconnect`, `GET /app/admin/api/actions?status=&mode=&deputy_id=`,
`POST /app/admin/api/actions/{id}/retry`, `POST …/{id}/resolve`.

## 10. Исполнитель и каналы
- Фоновая задача в lifespan (рядом с `quryltai.run_periodic`, `backend/app/main.py:330`): раз в 2 с берёт
  `queued` с `next_attempt_at <= now` через `SELECT … FOR UPDATE SKIP LOCKED` (несколько процессов не возьмут
  одно действие), ставит `sending`, отправляет, пишет итог.
- Интерфейс канала (WhatsApp потом — новый класс, очередь не меняется):
  ```python
  class Channel(Protocol):
      kind: str                                   # "telegram" | "email" | "whatsapp"
      async def send(self, address: str, msg: OutgoingMessage, key: str) -> SendResult  # key = action id
      async def check(self) -> CheckResult
  ```
  `SendResult` = `ok` / `retry` (временная) / `fatal` / `uncertain` + `external_id`.
- Повторы: 5 попыток, пауза 10 с → 30 с → 2 мин → 10 мин → 30 мин; `Retry-After` Telegram учитывается.
- Сообщение на несколько получателей = отдельная отправка на каждого; итог действия — `sent`, если ушло всем,
  иначе `failed` с перечнем (повтор — только неудавшимся).

## 11. Интеграции
**Telegram.** Бот через Bot API (`https://api.telegram.org/bot<token>/sendMessage`, httpx — он уже есть). Получатели —
группа аппарата (бота добавляют в группу) и люди, нажавшие `/start` у бота. chat_id узнаём кнопкой «Найти чаты»
(`getUpdates`; вебхук не нужен). Не userbot. Текст — обычный, без Markdown (меньше ошибок разметки).

**Почта.** Стандартный `smtplib` в отдельном потоке (`asyncio.to_thread`), новых библиотек не нужно; STARTTLS
(587) или SSL (465). `Message-ID` = id действия — повтор не создаёт «новое» письмо у получателя. После покупки
домена меняются только настройки в админке.

**Google Calendar.** OAuth 2.0 «код + PKCE» напрямую через httpx (без `google-api-python-client`).
Scope минимальный: `https://www.googleapis.com/auth/calendar.events` (читать и создавать события). Адрес возврата:
`https://kurultai.89-144-34-185.sslip.io/app/admin/google/callback`. `access_type=offline`, `prompt=consent`.
Приложение в статусе Testing: депутаты — test users, refresh token живёт 7 дней; админка показывает «осталось N
дней» и предупреждает за 2 дня, робот при истёкшем токене говорит «календарь не подключён, обратитесь к аппарату».
Часовой пояс — `Asia/Almaty`.

## 12. Переменные `.env` сервера Курултая
| переменная | по умолчанию | что |
|---|---|---|
| `KURULTAI_SECRETS_KEY` | пусто → интеграции выключены | ключ шифрования секретов (Fernet) |
| `KURULTAI_SECRETS_KEY_PREVIOUS` | пусто | старый ключ на время ротации |
| `KURULTAI_PUBLIC_URL` | `https://kurultai.89-144-34-185.sslip.io` | для адреса возврата Google |
| `KURULTAI_ACTIONS_ENABLED` | `false` | общий выключатель действий (включим после проверки) |
| `KURULTAI_ACTION_PROPOSAL_TTL_S` | `180` | сколько ждать нажатия «Отправить» |
| `KURULTAI_ACTION_MAX_ATTEMPTS` | `5` | |
| `KURULTAI_ASSISTANT_IDLE_S` / `_MAX_S` | `600` / `7200` | конец сессии ассистента |
| `KURULTAI_PIN_MAX_FAILURES` / `KURULTAI_PIN_LOCK_S` | `5` / `900` | |

Секреты интеграций (токен бота, SMTP-пароль, Google client_secret и refresh token) — **не в .env**, а в базе,
зашифрованными, через админку.

## 13. Изменения на роботе
- **Java** (`LiveVoice.java`, `MainActivity.java`): новые кадры `action_proposal`, `action_status`, `assistant_mode`
  → `window.onActionProposal(json)`, `window.onActionStatus(json)`, `window.onAssistantMode(json)`; мост
  `Robot.confirmAction(id)`, `Robot.cancelAction(id)`, `Robot.assistantDeputies()`, `Robot.assistantLogin(deputyId, pin)`,
  `Robot.assistantLogout()`. Без live — те же действия через POST-аналоги (§8). Сон робота → `assistant_logout`.
- **Отдельный скрипт и стиль** `assets/assistant.js` + `assets/assistant.css` (по образцу `face.js`/`pin.js`):
  карточка подтверждения поверх любой страницы и лица (z-index 9400: выше лица 9000, ниже PIN 9500), вход в режим
  ассистента (выбор депутата + цифровая клавиатура), плашка «Режим ассистента: <имя> · Выйти».
  В `index.html` — две строки подключения. `index.html`, `app.js`, `styles.css` mynbay не перестраиваются.
- Зацепки, которые новый фронтенд должен сохранить, — `docs/kurultai/frontend-hooks.md`.

## 14. Что нужно сделать вам вручную
1. **Ключ шифрования:** на сервере сгенерировать и вписать в `~/kurultai-robot/infra/.env`
   `KURULTAI_SECRETS_KEY=…` (команду дам на этапе 1) и сохранить копию в менеджере паролей.
2. **Telegram:** создать бота у @BotFather (имя, например «Ақылтай · Курултай»), токен вставить в админку;
   добавить бота в группу аппарата; написать в группе `/start@имя_бота`, чтобы бот увидел группу.
3. **Почта:** отдельный ящик (например, Яндекс 360 или Mail.ru для бизнеса; у Gmail — двухэтапная защита + пароль
   приложения), данные SMTP — в админку. Проверить, что хостинг сервера не закрывает исходящие 587/465.
4. **Google Cloud:** проект → включить Google Calendar API → экран согласия «External», статус Testing →
   добавить депутатов в test users → OAuth client «Web application» с адресом возврата из §11 → client_id и
   client_secret в админку.
5. Список депутатов для ассистента, их PIN и контакты — заполнить в админке (это сотрудники аппарата).

## 15. Этапы и приёмка
| этап | что | готово, когда |
|---|---|---|
| 1 | шифрование, миграция, админка «Интеграции», Telegram + «Проверить» и «Найти чаты» | тесты; на сервере «Проверить» = ок |
| 2 | очередь, исполнитель, `propose_hall_request`, кадры, карточка на роботе, журнал | сквозной тест без робота: вопрос → карточка → confirm → сообщение в тестовый чат |
| 3 | SMTP | тесты с фейковым SMTP; тестовое письмо |
| 4 | депутаты, PIN на сервере, вход/выход на роботе, Telegram и почта контактам | тесты лимитов PIN и сессий; проверка на роботе |
| 5 | Google: OAuth, чтение и создание событий, срок токена | тест с фейковым Google; подключение реального аккаунта |
После каждого этапа — стоп и отчёт. Выкатка — только по слову «деплой».

## 16. Открытые вопросы (нужно ваше решение)
1. **Как депутат выбирает себя на роботе:** список имён на экране + PIN (предлагаю) или только PIN (тогда PIN
   должны быть уникальны, а перебор хешей у всех депутатов медленнее)?
2. **Где кнопка входа в режим ассистента:** маленький значок на странице меню (предлагаю) или во вкладке
   «Робот и настройки» (она уже под ADMIN_PIN — нельзя, смешаем PIN)?
3. **Запрос из холла:** спрашивать имя и контакт посетителя для ответа (телефон/почта как *текст* запроса, не
   как получатель)? Это персональные данные — сколько хранить?
4. **Календарь и модель:** события депутата уходят в модель (OpenRouter → провайдер модели), чтобы она
   пересказала их голосом. Допустимо? Если нет — читаем события без модели, готовыми фразами.
5. **Холл:** если включены и Telegram, и почта — слать в оба канала (предлагаю) или выбрать один?
6. **Язык сообщений:** на языке экрана робота (предлагаю) или всегда на русском?
7. **Хранение журнала действий:** 180 дней (предлагаю)?
8. **sslip.io и Google:** Google может не принять адрес возврата на `*.sslip.io`. Проверим первым шагом этапа 5;
   если откажет — нужен свой домен раньше, чем планировали.

## 17. Риски
- **Дубли в Telegram:** у Bot API нет ключа идемпотентности. Если ответ не пришёл, а сообщение ушло, повтор дал бы
  дубль — поэтому такой случай = `uncertain`, без автоповтора (§3).
- **Токен Google на 7 дней:** пока приложение в Testing, депутату придётся переподключать календарь раз в неделю.
  Выход — публикация приложения в Google (проверка) после покупки домена.
- **Исходящая почта с VPS:** часть хостингов режет SMTP-порты; проверим кнопкой «Проверить» на этапе 3.
- **Ошибка модели в тексте:** человек видит ровно тот текст, который уйдёт (`preview`), и подтверждает его.
