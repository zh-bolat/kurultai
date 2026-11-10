# Зацепки, которые фронтенд робота должен сохранить

Фронтенд (`android-app/app/src/main/assets/`: `index.html`, `app.js`, `styles.css`) делает mynbay и иногда меняет
целиком. Логика робота живёт в Java и в наших подключаемых скриптах (`face.js`, `pin.js`, позже `assistant.js`).
Чтобы новый фронтенд не сломал робота, в нём должно остаться всё ниже. Проверка после слияния — сценарий в Chrome
1600×900 (как 07.11) и на роботе.

## Подключения в `index.html`
- `face.css`, `face.js`, `pin.js` — после `app.js` (они оборачивают его функции).
- Будет: `assistant.css`, `assistant.js` (контракт — `assistant-integrations.md` §13).

## Функции и переменные, которые зовут Java и наши скрипты
| что | кто зовёт | зачем |
|---|---|---|
| `window.answer(title, prompt, html, speech)` | Java (`MainActivity`, ответ live и `/v1/chat`) | показать ответ |
| `window.onVoicePartial`, `onRawRecordingStarted/Stopped`, `onSpeechStarted/Finished`, `onVoiceLevel(level, robot)` | Java | голосовая полоса |
| `window.toast(text)` | Java | короткие сообщения |
| `window.onQuryltaiData(data)` | Java | данные quryltai.kz для вкладок |
| `window.onMotionStatus`, `onMotionError`, `onHandsFreeStatus`, `onGreetingMotion` | Java | статусы движения |
| `window.goHome`, `go(page)`, `show(id)`, `applyUiLanguage`, `language` | `face.js`, `pin.js` | навигация и язык |
| `window.vbSubtitle(kind, text)`, `window.vbFromFace(state)` | `face.js` | субтитры в нижней полосе (mynbay, 07.11) |
| `#exitBtn` | `pin.js` | «×» закрывает приложение только по PIN |
| `window.onRobotSettings(json)` | Java (`Robot.refreshSettings` / `Robot.setRobotSetting`) | вкладка «Робот и настройки»: JSON `GET /v1/robot/settings` (контракт `robot-settings.md`) или `{"error": "…"}` → «сервер недоступен» |
| `window.onRobotInfo(json)` | Java (`Robot.getRobotSystemStatus`, после каждой смены поездки) | `{online, battery, charging, map, places:[имена точек], api_ready, navigating, last_trip, error}` — карточка робота, список «Поехать к точке», строка «Последняя поездка» |
| `window.askAdminPin(onOk, onCancel)` | `app.js` (переключатели движка/режима) | окно PIN из `pin.js`; без `ADMIN_PIN` в сборке — сразу `onOk` |

## Мост `window.Robot.*` (Java → JS-интерфейс)
`wakeUp`, `sleepNow`, `checkAdminPin`, `adminPinRequired`, `exitApp`, `askBackend`, `speak`, `stopSpeaking`,
`setLanguage` и смена языка ҚАЗ|РУС → повторный `hello` в live (язык ответа берётся только с экрана),
`move/stopMove/moveHead/navigateTo/returnToCharge/getRobotSystemStatus` (вкладка «Робот и настройки»),
`refreshSettings`, `setRobotSetting(key, value)` (10.11: настройки на сервере, `key` ∈ `live_engine` | `noise_mode`; PIN спрашивает JS),
`returnToPost` (10.11: кнопка «На пост» — поездка на `home` через `startGuidedNavigation` без `auto`),
`stopNavigation` (10.11: остановить поездку «проводить» / авто-возврат — зовёт `face.js` по тапу на баннер или лицо;
`stopSpeaking` и круг микрофона в поездке тоже останавливают робота).
Будет: `confirmAction`, `cancelAction`, `assistantDeputies`, `assistantLogin`, `assistantLogout`.

## События от Java для наших скриптов
`onFaceState`, `onFacePhrase`, `onFaceHeard`, `onFaceEmotion`, `onFaceNotice`, событие DOM `kurultai-face-shown`,
`onNavigation(json)` (10.11: `{navigating, place_id, map_name, auto, result, reason}` — `face.js` показывает баннер
«Еду: <название> · нажмите, чтобы остановить» / «Возвращаюсь на место» и прячет по `navigating:false`; названия точек —
таблица `PLACES` в `face.js` по `place_id` контракта `navigation.md`).
Будет: `onActionProposal(json)`, `onActionStatus(json)`, `onAssistantMode(json)`.

## Live-протокол (LiveVoice.java ↔ сервер), что добавлено 10.11
- `hello.places` — имена точек карты робота (`RobotApi.getPlaceList()` → `Pose.getName()`); список обновляется раз в 20 с
  вместе с диагностикой, изменился — повторный `hello`.
- кадр сервера `action` (`type_`: `guide_to` / `stop_navigation`, `place_id`, `map_name`, `turn_id`) →
  `LiveVoice.Listener.onAction(...)` → `MainActivity.handleLiveAction`.
- `state` от робота: `{"type":"state","navigating":true|false,"place_id","result","reason","auto"}` — `LiveVoice.sendState(...)`,
  null-поля не шлются, `auto: true` только при авто-возврате на пост.
- `{"type":"state","person_present":true|false}` — `LiveVoice.setPersonPresent(...)` при смене присутствия (слежение за лицом,
  не чаще раза в 1 с, повторы не шлются); в `hello` — поле `person_present` (контракт `robot-settings.md`, режим «шумный день»).

## Вкладка «Робот и настройки» (10.11, контракт `robot-settings.md`)
Разметка в `index.html` (`#robot`), логика — блок «Робот и настройки» в `app.js`. Убраны: ключ OpenRouter, модели, собственный шлюз,
встреча, `loadSettingsPanel/testSettings/saveSettings`, `onLlmSettings`, `onLocalMeeting`, `onBackendTestResult`. `window.onAiStatus(hasKey)`
остался заглушкой (Java `pushAiStatus` зовёт его; флаг `directAiReady` для текстового вопроса). Ids, которые должны остаться:
`stServer stEngine stMode stVoice stSync stVer stScreen stApi stNet stNote`, сегменты `#segEngine[data-key=live_engine]`,
`#segMode[data-key=noise_mode]` с `button[data-v]`, `#swStatus`, карточка робота `robotBattery robotCharging robotMap robotPlaces`,
кнопки `refreshRobot chargeRobot homeRobot navigateRobot motionStop`, `select#robotPlace`, `#motionArm`, `[data-motion]`, `[data-head]`,
`#motionStatus`, `#lastTrip`. Опрос сервера и робота — раз в 60 с пока `document.body.dataset.page === 'robot'` и при `show('robot')`.

## Слои (z-index)
лицо 9000 · баннер поездки `#faceNav` 9100 · карточка подтверждения действия 9400 (будет) · окно PIN 9500. Новый
фронтенд не должен класть свои слои выше 9000 поверх лица.
