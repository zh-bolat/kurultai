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

## Мост `window.Robot.*` (Java → JS-интерфейс)
`wakeUp`, `sleepNow`, `checkAdminPin`, `adminPinRequired`, `exitApp`, `askBackend`, `speak`, `stopSpeaking`,
`setLanguage` и смена языка ҚАЗ|РУС → повторный `hello` в live (язык ответа берётся только с экрана),
`move/stopMove/moveHead` (вкладка «Робот и настройки»).
Будет: `confirmAction`, `cancelAction`, `assistantDeputies`, `assistantLogin`, `assistantLogout`.

## События от Java для наших скриптов
`onFaceState`, `onFacePhrase`, `onFaceHeard`, `onFaceEmotion`, `onFaceNotice`, событие DOM `kurultai-face-shown`.
Будет: `onActionProposal(json)`, `onActionStatus(json)`, `onAssistantMode(json)`.

## Слои (z-index)
лицо 9000 · карточка подтверждения действия 9400 (будет) · окно PIN 9500. Новый фронтенд не должен класть свои
слои выше 9000 поверх лица.
