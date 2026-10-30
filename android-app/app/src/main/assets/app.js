let language=localStorage.language||'kk';let questionLanguage=language;let answerLanguage=localStorage.answerLanguage||'auto';let voiceMode=localStorage.voiceMode||'manual';let endpoint=localStorage.endpoint||'';let lastSpeech='';let lastSpeechLanguage=language;let voiceRequest=false;let lastPrompt='';let directAiReady=false;let continuousVoice=voiceMode==='auto';let continuousStarted=false;let lastVoiceText='';let lastVoiceAt=0;let holdActive=false;let quryltaiOfficial=null;
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
$('.modal-card h2').textContent='Настройки помощника';
$('.modal-card h2').insertAdjacentHTML('afterend','<div class="assistant-preferences"><h3 id="voiceSettingsTitle">Голосовой помощник</h3><label id="voiceModeLabel">Режим микрофона</label><select id="voiceMode"><option value="manual">По кнопке</option><option value="auto">Автоматически при посетителе</option></select><label id="answerLanguageLabel">Язык ответа</label><select id="answerLanguage"><option value="auto">Как в вопросе</option><option value="ru">Всегда русский</option><option value="kk">Әрқашан қазақша</option></select><button id="saveAssistantPreferences" class="save">Сохранить голосовые настройки</button></div>');
$('.modal-card h2').insertAdjacentHTML('afterend','<div class="meeting-settings"><h3>Ближайшая встреча</h3><label>Название</label><input id="meetingTitle" placeholder="Заседание Курултая"><label>Дата и время</label><input id="meetingTime" type="datetime-local"><label>Язык</label><select id="meetingLanguage"><option value="kk">Қазақша</option><option value="ru">Русский</option></select><div id="meetingStatus" class="connection-test"></div><button id="saveMeeting" class="save">Напомнить за час</button></div>');
$('.modal-card h2').insertAdjacentHTML('afterend','<div class="llm-settings"><h3>Модели OpenRouter</h3><label>Режим голоса</label><select id="voiceEngine"><option value="live">Живой разговор через сервер (live)</option><option value="standard">Обычный: вопрос → ответ</option></select><label>Модель ответа</label><input id="llmModel" placeholder="openai/gpt-6-luna" autocomplete="off" spellcheck="false"><label>Модель распознавания речи</label><input id="sttModel" placeholder="google/gemini-3.1-flash-lite" autocomplete="off" spellcheck="false"><label>Озвучка ответа</label><select id="ttsProvider"><option value="server">Голос ElevenLabs (наш сервер)</option><option value="openrouter">Голос через OpenRouter (cedar)</option><option value="robot">Голос робота (RobotOS / Android)</option></select><label>Модель озвучки</label><input id="ttsModel" placeholder="openai/gpt-audio-mini" autocomplete="off" spellcheck="false"><label>Голос</label><input id="ttsVoice" placeholder="cedar" autocomplete="off" spellcheck="false"><button id="saveLlm" class="save">Применить модели</button><label>Ключ OpenRouter</label><input id="openRouterKey" type="password" autocomplete="new-password" spellcheck="false" placeholder="sk-or-…"><button id="pasteOpenRouterKey" class="clipboard-import">Вставить ключ OpenRouter из буфера</button><div id="orKeyStatus" class="connection-test"></div><div class="settings-actions"><button id="deleteOpenRouterKey" class="danger">Удалить ключ</button><button id="saveOpenRouterKey" class="save">Сохранить ключ</button></div></div>');
$('#voiceEngine').onchange=()=>{let v=$('#voiceEngine').value,tp=$('#ttsProvider');if(v==='standard'&&tp.value==='server')tp.value='robot';if(v==='live'&&tp.value==='robot')tp.value='server'};
$('#saveLlm').onclick=()=>{if(window.Robot)Robot.saveLlmSettings($('#llmModel').value.trim(),$('#sttModel').value.trim(),$('#ttsProvider').value,$('#ttsModel').value.trim(),$('#ttsVoice').value.trim(),$('#voiceEngine').value);else toast('Доступно на роботе')};
$('#saveOpenRouterKey').onclick=()=>{let k=$('#openRouterKey').value.trim();if(!k)return toast('Введите ключ OpenRouter');if(window.Robot)Robot.saveOpenRouterKey(k);else toast('Доступно на роботе');$('#openRouterKey').value=''};
$('#pasteOpenRouterKey').onclick=()=>{if(window.Robot)Robot.importOpenRouterKeyFromClipboard();else toast('Импорт доступен на роботе')};
$('#deleteOpenRouterKey').onclick=()=>{if(window.Robot)Robot.clearOpenRouterKey();$('#openRouterKey').value=''};
window.onLlmSettings=(model,sttModel,ttsProvider,ttsModel,ttsVoice,hasKey,message,voiceEngine)=>{$('#voiceEngine').value=voiceEngine||'live';directAiReady=hasKey;window.__sttModel=sttModel||'';window.__ttsLabel=ttsProvider==='robot'?'':ttsProvider==='server'?'ElevenLabs (сервер)':(ttsModel+' / '+ttsVoice);$('#llmModel').value=model||'';$('#sttModel').value=sttModel||'';$('#ttsProvider').value=ttsProvider||'server';$('#ttsModel').value=ttsModel||'';$('#ttsVoice').value=ttsVoice||'';let e=$('#orKeyStatus');e.textContent=(hasKey?'● Ключ OpenRouter установлен. ':'● Ключ OpenRouter не установлен. ')+(message||'');e.className='connection-test '+(hasKey?'success':'failure');if(message)toast(message);if(window.Robot)Robot.getAiStatus()};
const ru={bill:'Анализ законопроекта',brief:'Подготовка выступления',appeal:'Обращения граждан',risk:'Риски региона',session:'Подготовка к заседанию',speech:'Проект выступления',task:'Проект поручения'};
const kk={bill:'Заң жобасын талдау',brief:'Сөз сөйлеуге дайындық',appeal:'Азаматтардың өтініштері',risk:'Өңірлік тәуекелдер',session:'Отырысқа дайындық',speech:'Сөз сөйлеу жобасы',task:'Тапсырма жобасы'};
const uiText={
 ru:{committee:'Курултай Республики Казахстан',brand:'AI-помощник Курултая',nav:['Главная','Аналитика','Законопроекты','Обращения','Заседание','Поручения','Робот и настройки'],title:'Цифровой помощник Курултая',hero:'Курултай Республики Казахстан',heroSub:'Просто начните говорить — или напишите вопрос в строке ниже',status:'Голосовой помощник активен',query:'Напишите ваш вопрос…',ask:'Спросить →',today:'Сегодня',todaySub:'Ближайшие события и задачи',settings:'Настройки помощника',voice:'Голосовой помощник',voiceMode:'Режим микрофона',manual:'По кнопке',auto:'Автоматически при посетителе',answerLanguage:'Язык ответа',same:'Как в вопросе',alwaysRu:'Всегда русский',alwaysKk:'Всегда казахский',saveVoice:'Сохранить голосовые настройки',speak:'🔊 Озвучить'},
 kk:{committee:'Қазақстан Республикасының Құрылтайы',brand:'Құрылтайдың AI-көмекшісі',nav:['Басты бет','Талдау','Заң жобалары','Өтініштер','Отырыс','Тапсырмалар','Робот және баптаулар'],title:'Құрылтайдың цифрлық көмекшісі',hero:'Қазақстан Республикасының Құрылтайы',heroSub:'Жай ғана сөйлей бастаңыз — немесе сұрағыңызды төмендегі жолға жазыңыз',status:'Дауыстық көмекші белсенді',query:'Сұрағыңызды жазыңыз…',ask:'Сұрау →',today:'Бүгін',todaySub:'Жақын іс-шаралар мен міндеттер',settings:'Көмекші баптаулары',voice:'Дауыстық көмекші',voiceMode:'Микрофон режимі',manual:'Батырма арқылы',auto:'Келуші келгенде автоматты',answerLanguage:'Жауап тілі',same:'Сұрақ тілінде',alwaysRu:'Әрқашан орысша',alwaysKk:'Әрқашан қазақша',saveVoice:'Дауыс баптауларын сақтау',speak:'🔊 Дауыстап оқу'}
};
function applyUiLanguage(){let t=uiText[language]||uiText.ru;document.documentElement.lang=language;$('.brand b').textContent='Құрылтай РК';$('.brand span').textContent=t.brand;$('.committee-name').innerHTML=t.committee.replace(', ','<br>');$$('.nav span').forEach((e,i)=>{if(t.nav[i])e.textContent=t.nav[i]});let quick=language==='kk'?[['Бейінді заң жобасы','AI, онлайн-платформалар және цифрлық құқықтар'],['Комитет қорытындысы','Ұстаным, түзетулер және әзірлеушілерге сұрақтар'],['Цифрлық өтініштер','Байланыс, мемлекеттік қызметтер және интернет-алаяқтық'],['AI және кибертәуекелдер','Маңызды сигналдар және реттеу']]:[['Профильный законопроект','AI, онлайн-платформы и цифровые права'],['Заключение комитета','Позиция, поправки и вопросы разработчикам'],['Цифровые обращения','Связь, госуслуги и интернет-мошенничество'],['AI и киберриски','Критические сигналы и регулирование']];$$('.quick').forEach((e,i)=>{if(quick[i]){e.querySelector('b').textContent=quick[i][0];e.querySelector('small').textContent=quick[i][1]}});$('#eyebrow').textContent=language==='kk'?'ҚАЗАҚСТАН РЕСПУБЛИКАСЫНЫҢ ҚҰРЫЛТАЙЫ':'КУРУЛТАЙ РЕСПУБЛИКИ КАЗАХСТАН';$('.full-title').textContent=t.title;$('.compact-title').textContent=t.title;$('.hero .status').innerHTML='<i></i> '+t.status;$('.hero h2').innerHTML=t.hero.replace(', ','<br>');$('.hero p').textContent=t.heroSub;$('#query').placeholder=t.query;$('#send').textContent=t.ask;$('.today h3').textContent=t.today;$('.today>div:first-child p').textContent=t.todaySub;$('.modal-card h2').textContent=t.settings;$('#voiceSettingsTitle').textContent=t.voice;$('#voiceModeLabel').textContent=t.voiceMode;$('#voiceMode option[value="manual"]').textContent=t.manual;$('#voiceMode option[value="auto"]').textContent=t.auto;$('#answerLanguageLabel').textContent=t.answerLanguage;$('#answerLanguage option[value="auto"]').textContent=t.same;$('#answerLanguage option[value="ru"]').textContent=t.alwaysRu;$('#answerLanguage option[value="kk"]').textContent=t.alwaysKk;$('#saveAssistantPreferences').textContent=t.saveVoice;if($('#speak').textContent.indexOf('■')<0)$('#speak').textContent=t.speak;$('#lang').innerHTML='<span data-l="kk"'+(language==='kk'?' class="on"':'')+'>ҚАЗ</span><span data-l="ru"'+(language==='ru'?' class="on"':'')+'>РУС</span>';$('#lang').setAttribute('aria-label',language==='kk'?'Тілді ауыстыру':'Сменить язык')}
function show(id){$$('.page').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active');document.querySelector('main').scrollTop=0}
window.goHome=()=>show('home');$$('.back').forEach(b=>b.onclick=goHome);
function toast(t){let e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function answer(title,prompt,html,speech){$('#answerTitle').textContent=title;$('#answerPrompt').textContent=prompt;$('#answerBody').innerHTML=html;lastSpeech=speech||prompt;show('answer')}
const cards={
 bill:{prompt:'Проанализируй проект закона по вопросам онлайн-платформ, искусственного интеллекта и масс-медиа',html:`<article class="result-card wide"><h3>Суть документа</h3><p>Проект формирует требования к цифровым платформам и применению алгоритмических систем: прозрачность рекомендаций, маркировка синтетического контента, защита персональных данных и ответственность операторов.</p></article><article class="result-card"><h3>Ключевые нормы</h3><ul><li>обязательная идентификация AI-контента;</li><li>аудит алгоритмов высокого риска;</li><li>механизм обжалования автоматизированных решений;</li><li>локализация реагирования на инциденты.</li></ul></article><article class="result-card"><h3>Оценка воздействия</h3><div class="metric-row"><div class="metric"><b>12</b><small>связанных НПА</small></div><div class="metric"><b>6</b><small>госорганов</small></div><div class="metric"><b>4</b><small>зоны риска</small></div></div><p>Потребуется согласование с нормами о персональных данных, связи, кибербезопасности и защите прав потребителей.</p></article><article class="result-card"><h3>Позиция комитета</h3><ul><li>поддержать риск-ориентированный подход;</li><li>исключить избыточную нагрузку на стартапы;</li><li>закрепить независимую оценку алгоритмов.</li></ul></article><article class="result-card"><h3>Вопросы разработчикам</h3><ul><li>Кто определяет класс риска AI-системы?</li><li>Как гражданин оспорит решение алгоритма?</li><li>Какие данные доступны для парламентского контроля?</li></ul></article>`,speech:'Проект регулирует онлайн-платформы и системы искусственного интеллекта. Комитету рекомендуется поддержать риск-ориентированный подход, уточнив аудит алгоритмов, защиту граждан и условия для развития казахстанских стартапов.'},
 appeal:{prompt:'Покажи обращения граждан по вопросам цифровизации',html:`<article class="result-card wide"><h3>Цифровая повестка · последние 30 дней</h3><div class="metric-row"><div class="metric"><b>286</b><small>обращений</small></div><div class="metric"><b>+18%</b><small>к прошлому месяцу</small></div><div class="metric"><b>34</b><small>требуют контроля</small></div></div></article><article class="result-card"><h3>Основные темы</h3><ul><li>качество мобильного интернета — 61</li><li>доступность электронных госуслуг — 38</li><li>интернет-мошенничество — 29</li><li>защита персональных данных — 24</li></ul></article><article class="result-card"><h3>Выявленный сигнал</h3><p><b>Цифровой разрыв в сельских районах.</b> Обращения из трёх территорий показывают нестабильную связь и невозможность воспользоваться социально значимыми онлайн-услугами.</p></article>`,speech:'За месяц поступило 286 обращений по цифровой повестке. Главный сигнал — качество мобильного интернета и доступность электронных услуг в сельских районах. Тридцать четыре обращения требуют парламентского контроля.'},
 risk:{prompt:'Покажи ключевые AI- и киберриски',html:`<article class="result-card wide"><h3>Сигналы для Комитета</h3></article><article class="result-card"><h3>1. Киберинциденты</h3><p>Зафиксирован рост фишинговых атак на граждан и сервисы. Девять рисков имеют высокий приоритет.</p></article><article class="result-card"><h3>2. Алгоритмическая прозрачность</h3><p>Для систем высокого риска отсутствуют единые требования к аудиту, объяснимости и обжалованию решений.</p></article><article class="result-card"><h3>3. Цифровой разрыв</h3><p>Три сельских района отстают от целевых показателей качества и устойчивости связи.</p></article><article class="result-card"><h3>Рекомендация</h3><p>Запросить карту критических цифровых рисков, сроки подключения населённых пунктов и проект единого стандарта безопасного AI.</p></article>`,speech:'Комитету следует обратить внимание на три риска: рост киберинцидентов, отсутствие единых правил аудита искусственного интеллекта и цифровой разрыв между регионами.'},
 session:{prompt:'Подготовь меня к заседанию Комитета по цифровизации, инновациям и науке',html:`<article class="result-card wide"><h3>Повестка · 10:00 · зал 302</h3><p>Цифровой кодекс, регулирование искусственного интеллекта, ратификация Конвенции о компьютерных преступлениях и коммерциализация науки.</p></article><article class="result-card"><h3>Что важно знать</h3><ul><li>53 законопроекта находятся на рассмотрении Курултая;</li><li>9 открытых киберрисков высокого уровня;</li><li>3 региона ниже цели по цифровой доступности;</li><li>2 научные программы отстают от плана.</li></ul></article><article class="result-card"><h3>Вопросы на заседание</h3><ul><li>Как будет контролироваться безопасность AI?</li><li>Когда завершится подключение сельских территорий?</li><li>Как измеряется коммерциализация научных разработок?</li></ul></article>`,speech:'К заседанию Комитета подготовлена справка. В центре внимания — Цифровой кодекс, безопасность искусственного интеллекта, киберпреступность и коммерциализация научных разработок.'}
};
function demo(type){let dict=language==='kk'?kk:ru;if(type==='regionBrief'){let region=$('#regionName').textContent;answer('Аналитическая справка: '+region,'Цифровизация, инновации и наука',`<article class="result-card wide"><h3>Вывод AI-ассистента</h3><p>${region}: сводный показатель цифрового развития демонстрирует положительную динамику, однако сохраняются инфраструктурные различия между городскими и сельскими территориями. Приоритет парламентского контроля — качество связи, доступность государственных цифровых услуг и подготовка кадров.</p></article><article class="result-card"><h3>Сильные стороны</h3><ul><li>высокая доля онлайн-услуг;</li><li>рост цифровой грамотности;</li><li>активность инновационных проектов.</li></ul></article><article class="result-card"><h3>Зона внимания</h3><ul><li>покрытие отдалённых населённых пунктов;</li><li>устойчивость инфраструктуры;</li><li>измеримость эффекта бюджетных программ.</li></ul></article><article class="result-card wide"><h3>Вопрос на заседание</h3><p>Какие конкретные населённые пункты будут подключены в 2026 году, каковы сроки и каким показателем подтверждается качество доступа?</p></article>`,'По выбранному региону подготовлена аналитическая справка. Приоритет контроля — качество связи в сельских территориях, доступность цифровых услуг и измеримый эффект бюджетных программ.');return}if(type==='brief'||type==='speech'){answer(dict.speech,'Выступление на ближайшем заседании',`<article class="result-card wide"><h3>Проект выступления · 75 секунд</h3><p>Уважаемые коллеги! Анализ обращений граждан и региональных показателей показывает, что первоочередного внимания требует подготовка к отопительному сезону. За последние две недели зафиксирован рост связанных обращений жителей, затронуты два района. Предлагаю запросить у ответственных органов пообъектный график работ, источники финансирования и персональную ответственность за соблюдение сроков. Информация об исполнении должна быть открытой и регулярно представляться депутатскому корпусу.</p></article><article class="result-card"><h3>Главный тезис</h3><p>Каждое поручение должно иметь срок, ответственного и проверяемый результат.</p></article><article class="result-card"><h3>Возможный вопрос СМИ</h3><p>Каким образом депутаты будут контролировать реальное исполнение?</p></article>`,'Уважаемые коллеги! Анализ обращений граждан показывает, что первоочередного внимания требует подготовка к отопительному сезону. Предлагаю запросить пообъектный график работ, источники финансирования и персональную ответственность за сроки.');return}if(type==='task'){answer(dict.task,'По проблеме теплоснабжения',`<article class="result-card wide"><h3>Проект депутатского поручения</h3><p>Акимату совместно с ответственными коммунальными организациями представить актуализированный пообъектный план подготовки систем теплоснабжения в затронутых районах.</p></article><article class="result-card"><h3>Срок</h3><p>До 10 сентября 2026 года</p></article><article class="result-card"><h3>Ожидаемый результат</h3><p>График работ, источники финансирования, ответственные лица и фотофиксация исполнения.</p></article>`,'Подготовлен проект поручения по теплоснабжению со сроком до десятого сентября.');return}let c=cards[type]||cards.session;answer(dict[type]||dict.session,c.prompt,c.html,c.speech)}
window.demo=demo;$$('[data-demo]').forEach(b=>b.onclick=()=>demo(b.dataset.demo));
function setVoiceDock(state,text){let d=$('#voiceDock');if(!d)return;d.className='voice-dock '+state;$('#voiceTranscript').textContent=text||'Нажмите «Спросить голосом» и задайте вопрос';let labels={listening:'МИКРОФОН · ИДЁТ ЗАПИСЬ',thinking:'ПОМОЩНИК · ГОТОВИТ ОТВЕТ',speaking:'РОБОТ · ОЗВУЧИВАЮ ОТВЕТ',paused:'НАЖМИТЕ «ГОВОРИТЬ»',active:'ГОТОВ К ВОПРОСУ'};$('#voiceState').textContent=labels[state]||labels.active;$('#dockToggle').textContent=state==='thinking'?'Подождите':state==='listening'&&holdActive?'Стоп':'Говорить';$('#dockToggle').disabled=state==='thinking'||state==='speaking'}
function submit(){let q=$('#query').value.trim();if(!q)return toast('Задайте вопрос');lastPrompt=q;setVoiceDock('thinking',q);if(window.Robot)Robot.pauseListening();let payload=JSON.stringify({message:q,language:questionLanguage,answer_language:answerLanguage,context:'committee_digital_innovation_science',device:'orionstar_os_r_sg04'});if(directAiReady&&window.Robot){showLoading(q);Robot.askOpenAI(payload)}else if(endpoint&&window.Robot){showLoading(q);Robot.askBackend(endpoint,payload)}else{let s=q.toLowerCase();window.demo(s.includes('обращ')?'appeal':s.includes('риск')?'risk':s.includes('закон')?'bill':s.includes('выступ')?'speech':'session');voiceRequest=false;toast('Деморежим: добавьте ключ OpenRouter в настройках');if(continuousVoice&&window.Robot)Robot.resumeContinuousListening(language)}}
$('#send').onclick=submit;$('#query').onkeydown=e=>{if(e.key==='Enter')submit()};
$('#mic').onclick=()=>toast('Нажмите «Спросить голосом» внизу экрана');
function toggleDockVoice(){if(!window.Robot)return toast('Голосовой ввод доступен на роботе');continuousVoice=!continuousVoice;localStorage.continuousVoice=continuousVoice;Robot.setContinuousListening(continuousVoice,language);window.onContinuousVoiceState(continuousVoice)}
function beginHold(e){if(e)e.preventDefault();if(holdActive||!window.Robot)return;holdActive=true;setVoiceDock('listening');Robot.startHoldRecording()}
function endHold(e){if(e)e.preventDefault();if(!holdActive||!window.Robot)return;holdActive=false;setVoiceDock('thinking');Robot.stopHoldRecording()}

window.onVoiceListening=()=>{$('#mic').classList.add('listening');$('#query').placeholder='Говорите…';setVoiceDock('listening',$('#query').value||'Говорите, я слушаю…')};
window.onVoicePaused=()=>{$('#mic').classList.remove('listening')};
window.onContinuousVoiceState=enabled=>{continuousVoice=enabled;let b=$('#mic');b.textContent=enabled?'🎙':'▶';b.title=enabled?'Нажмите, чтобы остановить голосовой режим':'Нажмите, чтобы включить голосовой режим';if(!enabled)b.classList.remove('listening');setVoiceDock(enabled?'active':'paused',enabled?'Готов слушать следующий вопрос':'Нажмите «Слушать», чтобы продолжить')};
window.onVoicePartial=t=>{$('#query').value=t;setVoiceDock('listening',t)};
window.onVoiceVolume=v=>{let a=$('#dockMic');if(a)a.style.transform='scale('+(1+Math.min(100,Math.max(0,v))*.0015)+')'};
window.onHandsFreeStatus=t=>{let text=String(t||'');console.log('[HandsFree]',text);if(text.includes('Микрофон')||text.includes('Голос')||text.includes('Слушаю'))setVoiceDock('listening',text);else setVoiceDock('active',text)};
window.onGreetingMotion=active=>{let orb=$('.orb');if(orb)orb.classList.toggle('greeting',!!active)};
window.onVoiceFallback=()=>{setVoiceDock('listening','RobotOS не ответил — включаю резервный микрофон…');toast('Переключаюсь на резервное распознавание')};
window.onRawRecordingStarted=()=>{setVoiceDock('listening')};
window.onRawRecordingStopped=()=>{setVoiceDock('thinking')};
window.onVoiceServiceError=t=>{setVoiceDock('paused',t);toast(t)};
function detectedLanguage(t){let s=' '+String(t).toLowerCase()+' ';if(/[әғқңөұүһі]/i.test(s))return'kk';let kkWords=[' мен ',' сен ',' сіз ',' бұл ',' және ',' туралы ',' қандай ',' қалай ',' керек ',' болады ',' үшін ',' бойынша ',' қашан ',' қайда '];return kkWords.some(w=>s.includes(w))?'kk':'ru'}
window.onVoiceResult=t=>{t=String(t||'').trim();let now=Date.now();if(!t||(t===lastVoiceText&&now-lastVoiceAt<3000))return;questionLanguage=detectedLanguage(t);lastVoiceText=t;lastVoiceAt=now;voiceRequest=true;$('#mic').classList.remove('listening');$('#query').placeholder=questionLanguage==='kk'?'Сұрағыңызды айтыңыз…':'Задайте вопрос…';$('#query').value=t;setVoiceDock('thinking',t);submit()};window.onVoiceError=t=>{voiceRequest=false;$('#mic').classList.remove('listening');$('#query').placeholder='Скажите вопрос ещё раз…';setVoiceDock('active',t);toast(t)};
window.onVoiceIgnored=t=>{voiceRequest=false;holdActive=false;$('#mic').classList.remove('listening');$('#query').value='';setVoiceDock('active',t||'Повторите ваш вопрос')};
window.onQuryltaiData=(data,fresh)=>{quryltaiOfficial=data||null;if(!data)return;let plans=data.weekly_plans||[];let first=plans[0];let events=$$('.today .event');if(first&&events[0]){let title=String(first.title||'').replace(/\s+/g,' ').trim();events[0].querySelector('strong').textContent='Актуальный недельный план';events[0].querySelector('small').textContent=title}if(fresh)console.log('[Quryltai] Данные обновлены')};
$('#speak').onclick=()=>{if(window.Robot)Robot.speak(lastSpeech,lastSpeechLanguage);else toast('Озвучивание доступно на роботе')};
window.onSpeechStarted=()=>{$('#speak').textContent='■ Остановить';setVoiceDock('speaking',lastSpeech);$('#speak').onclick=()=>{Robot.stopSpeaking();window.onSpeechFinished()}};
window.onSpeechFinished=()=>{$('#speak').textContent='🔊 Озвучить';setVoiceDock(continuousVoice?'active':'paused',continuousVoice?'Готов слушать следующий вопрос':'Нажмите «Спросить голосом» и задайте вопрос');$('#speak').onclick=()=>{if(window.Robot)Robot.speak(lastSpeech,lastSpeechLanguage)}};
function showLoading(q){answer('Готовлю ответ',q,`<article class="result-card wide"><h3>Анализирую вопрос…</h3><p>Ответ появится на экране и будет озвучен.</p></article>`,'')}
window.onBackendResult=(ok,body)=>{let resultLanguage=answerLanguage==='auto'?questionLanguage:answerLanguage;let responseText=body;if(ok){try{let j=JSON.parse(body);responseText=j.answer||j.message||body;resultLanguage=j.language||resultLanguage}catch(e){}}let kk=resultLanguage==='kk';if(!ok){answer(kk?'Қызметпен байланыс жоқ':'Нет связи с сервисом',lastPrompt,`<article class="result-card wide error-card"><h3>${kk?'Сұрау орындалмады':'Запрос не выполнен'}</h3><p>${escapeHtml(body)}</p><button id="retryRequest" class="retry">${kk?'Қайталау':'Повторить запрос'}</button></article>`,'');setTimeout(()=>{let b=$('#retryRequest');if(b)b.onclick=submit},0);voiceRequest=false;return}responseText=String(responseText).replace(/\*\*/g,'').replace(/^#{1,6}\s*/gm,'').replace(/`/g,'').replace(/^\s*(вывод|қорытынды|ответ|жауап|gpt)\s*[:：-]\s*/i,'').trim();lastSpeechLanguage=resultLanguage;answer(kk?'Көмекшінің жауабы':'Ответ помощника',lastPrompt,`<article class="result-card wide"><p>${escapeHtml(responseText).replace(/\n/g,'<br>')}</p></article>`,responseText);if(responseText&&window.Robot)Robot.speak(responseText,resultLanguage);voiceRequest=false};
function escapeHtml(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$('#lang').onclick=e=>{const s=e&&e.target&&e.target.closest&&e.target.closest('[data-l]');if(s&&s.dataset.l===language)return;language=language==='ru'?'kk':'ru';questionLanguage=language;localStorage.language=language;applyUiLanguage();if(continuousVoice&&window.Robot)Robot.setContinuousListening(true,language);toast(language==='ru'?'Русский язык':'Қазақ тілі')};
window.loadSettingsPanel=()=>{$('#endpoint').value=endpoint;$('#voiceMode').value=voiceMode;$('#answerLanguage').value=answerLanguage;$('#connectionTest').textContent='';if(window.Robot){Robot.getAiStatus();Robot.getLocalMeeting();Robot.getAssistantPreferences();Robot.getLlmSettings()}};$('#saveSettings').onclick=()=>{endpoint=$('#endpoint').value.trim().replace(/\/$/,'');localStorage.endpoint=endpoint;toast(endpoint?'Собственный шлюз сохранён':'Собственный шлюз отключён')};
$('#saveAssistantPreferences').onclick=()=>{voiceMode=$('#voiceMode').value;answerLanguage=$('#answerLanguage').value;localStorage.voiceMode=voiceMode;localStorage.answerLanguage=answerLanguage;continuousVoice=voiceMode==='auto';if(window.Robot)Robot.saveAssistantPreferences(voiceMode,answerLanguage);window.onContinuousVoiceState(continuousVoice);toast('Голосовые настройки сохранены')};
window.onAssistantPreferences=(automatic,answer)=>{voiceMode=automatic?'auto':'manual';answerLanguage=answer||'auto';continuousVoice=automatic;localStorage.voiceMode=voiceMode;localStorage.answerLanguage=answerLanguage;if($('#voiceMode'))$('#voiceMode').value=voiceMode;if($('#answerLanguage'))$('#answerLanguage').value=answerLanguage;window.onContinuousVoiceState(automatic)};
$('#saveMeeting').onclick=()=>{let title=$('#meetingTitle').value.trim(),value=$('#meetingTime').value,when=new Date(value).getTime(),lang=$('#meetingLanguage').value;if(!title||!value||!Number.isFinite(when))return toast('Укажите встречу и время');if(when<=Date.now())return toast('Время встречи уже прошло');if(window.Robot)Robot.saveLocalMeeting(title,when,lang)};
window.onLocalMeeting=(title,when,lang,status)=>{if(title)$('#meetingTitle').value=title;if(when>0){let d=new Date(when),z=n=>String(n).padStart(2,'0');$('#meetingTime').value=d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'T'+z(d.getHours())+':'+z(d.getMinutes())}$('#meetingLanguage').value=lang||'kk';$('#meetingStatus').textContent=status||''};
$('#testSettings').onclick=()=>{let url=$('#endpoint').value.trim();if(!url)return toast('Укажите адрес сервера');$('#connectionTest').textContent='Проверяю соединение…';$('#connectionTest').className='connection-test checking';if(window.Robot)Robot.testBackend(url);else window.onBackendTestResult(false,'Проверка доступна в APK')};
window.onBackendTestResult=(ok,message)=>{let e=$('#connectionTest');e.textContent=(ok?'● ':'● ')+message;e.className='connection-test '+(ok?'success':'failure')};
window.onLocalTtsStatus=(ok,info)=>{console.log('[TTS]',ok,info);let text=String(info||'Нет диагностических данных');if(!ok){toast('TTS: '+text);setVoiceDock('paused',text.slice(0,120))}else toast('TTS: '+text)};
window.onWelcomeMode=on=>{console.log('[welcome]',on)};
window.onAiStatus=(hasKey,model,message)=>{directAiReady=hasKey;let m=$('#modelLabel');if(m)m.textContent=model};
window.onRobotStatus=(online,robotSpeech,state)=>{let e=$('#connectionBadge');if(!e)return;e.textContent=online?(robotSpeech?'● Голос RobotOS готов':'● '+(state||'RobotOS подключается')):'● Нет Wi-Fi';e.classList.toggle('offline',!online||!robotSpeech);e.title=state||''};
const dashboards={digital:{title:'Индекс цифровой зрелости регионов',metrics:[['Сводный индекс','78,4','↗ +8,2%','цель: 82'],['Онлайн-госуслуги','91%','↗ +3,1%','от общего числа'],['Покрытие интернетом','89%','↗ +4,7%','населения'],['Сигналы риска','6','↓ −2','требуют внимания']]},innovation:{title:'Инновационная активность регионов',metrics:[['Активные проекты','1 284','↗ +12%','за 2026 год'],['Стартапы','436','↗ +18%','получили поддержку'],['Венчурные сделки','₸48,2 млрд','↗ +9%','объём инвестиций'],['Регионы роста','7','↗ +2','выше среднего']]},science:{title:'Научный потенциал регионов',metrics:[['Научные проекты','2 106','↗ +7%','активные'],['Финансирование','₸214 млрд','↗ +11%','на 2026 год'],['Исследователи','25 840','↗ +4%','человек'],['Коммерциализация','184','↗ +21%','разработки']]},cyber:{title:'Карта киберрисков и устойчивости',metrics:[['Инциденты','327','↓ −14%','за 30 дней'],['Предотвращено','96,8%','↗ +1,2%','атак'],['Критические объекты','42','● контроль','в мониторинге'],['Открытые риски','9','↓ −3','высокий уровень']]},laws:{title:'Законодательная активность по регионам',metrics:[['Законопроекты','53','● I созыв','на рассмотрении'],['Поправки комитета','127','↗ +18','подготовлено'],['Экспертизы','34','● в работе','научно-технические'],['Поручения','82%','↗ +6%','исполнено']]}};
function renderDashboard(key){let d=dashboards[key];$('#mapTitle').textContent=d.title;$('#dashMetrics').innerHTML=d.metrics.map(m=>`<div class="dash-metric"><span>${m[0]}</span><b>${m[1]}</b><em>${m[2]}</em><small>${m[3]}</small></div>`).join('')}
renderDashboard('digital');$$('.dash-tab').forEach(t=>t.onclick=()=>{$$('.dash-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');renderDashboard(t.dataset.dashboard)});
const regionScores={'Астана':92.1,'Алматы':89.6,'Шымкент':81.3,'Атырауская область':79.2,'Мангистауская область':68.4,'Карагандинская область':84.7,'Ұлытау облысы':71.8,'Костанайская область':76.8,'Северо-Казахстанская область':77.4,'Павлодарская область':85.2,'Восточно-Казахстанская область':77.5,'Абай облысы':73.9,'Кызылординская область':69.1,'Актюбинская область':75.6,'Акмолинская область':80.3,'Жамбылская область':74.2,'Туркестанская область':72.9,'Жетісу облысы':74.8,'Алматинская область':83.6,'Западно-Казахстанская область':82.1};
function selectGisRegion(name,score,element){
  $$('.gis-region').forEach(x=>x.classList.remove('selected'));if(element)element.classList.add('selected');
  $('#regionName').textContent=name;$('#regionScore').innerHTML=String(score).replace('.',',')+'<small>/100</small>';$('.progress i').style.width=score+'%';
  $('#mapTooltip').innerHTML='<b>'+name+'</b><small>Индекс: '+String(score).replace('.',',')+' из 100</small>';$('#mapTooltip').classList.remove('hidden');
}
function renderGisMap(){
  if(!window.KZ_MAP_REGIONS)return;
  $('#kzRegionPolygons').innerHTML=KZ_MAP_REGIONS.map(r=>`<path class="gis-region ${r.level}" data-region="${r.name}" data-score="${r.score}" d="${r.path}"><title>${r.name}: ${r.score}</title></path>`).join('');
  $('#kzCityMarkers').innerHTML=KZ_MAP_REGIONS.filter(r=>r.kind==='city').map(r=>`<g class="gis-city" data-region="${r.name}" data-score="${r.score}" transform="translate(${r.cx} ${r.cy})"><circle r="5"/><text y="-10">${r.name}</text></g>`).join('');
  $$('.gis-region').forEach(p=>p.onclick=()=>selectGisRegion(p.dataset.region,Number(p.dataset.score),p));
  $$('.gis-city').forEach(c=>c.onclick=()=>{let p=document.querySelector('.gis-region[data-region="'+c.dataset.region+'"]');selectGisRegion(c.dataset.region,Number(c.dataset.score),p)});
}
renderGisMap();
$$('.nav').forEach(n=>n.onclick=()=>{
  $$('.nav').forEach(x=>x.classList.remove('active'));n.classList.add('active');
  if(n.dataset.page==='home'){goHome();return}if(n.dataset.page==='analytics'){show('analytics');return}
  let titles={bills:'Законопроекты',appeals:'Обращения граждан',session:'Еженедельный план',tasks:'Поручения'};
  let rows={appeals:[['43','ЖКХ и отопление','Срочно'],['27','Социальная поддержка','В работе'],['24','Дороги','В работе']],tasks:[['1','Контроль цифровой инфраструктуры','В работе']]};
  if(n.dataset.page==='bills'&&quryltaiOfficial){rows.bills=[[String(quryltaiOfficial.bill_count||0),'Всего законопроектов','quryltai.kz'],...(quryltaiOfficial.bills||[]).slice(0,10).map(b=>['№ '+b.id,b.title,b.status===5?'На рассмотрении':'Статус '+b.status])]}
  else if(n.dataset.page==='bills')rows.bills=[['—','Данные ещё не загружены','Нужен Wi-Fi']];
  if(n.dataset.page==='session'&&quryltaiOfficial)rows.session=(quryltaiOfficial.weekly_plans||[]).map(p=>['План',String(p.title||'').replace(/\s+/g,' ').trim(),'quryltai.kz']);
  else if(n.dataset.page==='session')rows.session=[['—','Актуальный план ещё не загружен','Нужен Wi-Fi']];
  let safeRows=rows[n.dataset.page]||[];
  $('#listContent').innerHTML=`<div class="list-shell"><h2>${titles[n.dataset.page]||''}</h2><p>Официальные данные Курултая</p>${safeRows.map(r=>`<div class="list-row"><b>${escapeHtml(r[0])}</b><span>${escapeHtml(r[1])}</span><i class="pill">${escapeHtml(r[2])}</i></div>`).join('')}</div>`;show('listPage')
});

const baseDemo=demo;
function committeeDemo(type){
  if(type==='brief'||type==='speech'){
    answer('Проект заключения Комитета','По регулированию искусственного интеллекта',`<article class="result-card wide"><h3>Предлагаемая позиция</h3><p>Поддержать формирование национальной системы безопасного и ответственного применения искусственного интеллекта при условии риск-ориентированного регулирования, защиты прав граждан и сохранения пространства для инноваций.</p></article><article class="result-card"><h3>Поправки</h3><ul><li>закрепить категории AI-систем высокого риска;</li><li>ввести обязательный аудит и журнал решений;</li><li>предусмотреть регуляторную песочницу для стартапов;</li><li>установить право гражданина на объяснение решения.</li></ul></article><article class="result-card"><h3>Парламентский контроль</h3><ul><li>ежегодный публичный отчёт;</li><li>реестр значимых алгоритмических систем;</li><li>показатели безопасности и социального эффекта.</li></ul></article><article class="result-card wide"><h3>Тезис председателя</h3><p>Наша задача — не затормозить технологию, а создать понятные правила, при которых инновации работают в интересах человека и государства.</p></article>`,'Комитет предлагает поддержать риск-ориентированное регулирование искусственного интеллекта, обязательный аудит систем высокого риска, право граждан на объяснение решений и специальные условия для развития отечественных стартапов.');return;
  }
  if(type==='task'){
    answer('Проект поручения Комитета','Цифровая инфраструктура регионов',`<article class="result-card wide"><h3>Содержание поручения</h3><p>Министерству цифрового развития совместно с акиматами представить пообъектную карту населённых пунктов с недостаточным качеством связи и план устранения цифрового разрыва.</p></article><article class="result-card"><h3>Срок</h3><p>До 15 октября 2026 года</p></article><article class="result-card"><h3>Контрольные показатели</h3><p>Покрытие, фактическая скорость, устойчивость канала, число доступных социально значимых услуг и подтверждение независимыми измерениями.</p></article>`,'Подготовлен проект поручения по устранению цифрового разрыва с пообъектной картой, сроками и проверяемыми показателями качества связи.');return;
  }
  baseDemo(type);
}
window.demo=committeeDemo;
$$('[data-demo]').forEach(b=>b.onclick=()=>committeeDemo(b.dataset.demo));
const appealsNav=document.querySelector('[data-page="appeals"]');
const robotNav=document.querySelector('[data-page="robot"]');
robotNav.onclick=()=>{$$('.nav').forEach(x=>x.classList.remove('active'));robotNav.classList.add('active');show('robot');loadSettingsPanel();if(window.Robot)Robot.getRobotSystemStatus()};
let motionArmed=false;
$('#motionArm').onchange=e=>{motionArmed=e.target.checked;$('#motionStatus').textContent=motionArmed?'Управление готово':'Управление заблокировано';if(!motionArmed&&window.Robot)Robot.stopMove()};
function startMotion(direction,e){if(e)e.preventDefault();if(!motionArmed)return toast('Сначала разблокируйте движение');if(window.Robot)Robot.move(direction)}
function stopMotion(e){if(e)e.preventDefault();if(window.Robot)Robot.stopMove()}
$$('[data-motion]').forEach(b=>{let d=b.dataset.motion;b.onmousedown=e=>startMotion(d,e);b.onmouseup=stopMotion;b.onmouseleave=stopMotion;b.ontouchstart=e=>startMotion(d,e);b.ontouchend=stopMotion;b.ontouchcancel=stopMotion});
$('#motionStop').onclick=stopMotion;
$$('[data-head]').forEach(b=>b.onclick=()=>{if(!motionArmed)return toast('Сначала разблокируйте управление');let p=b.dataset.head.split(',').map(Number);if(window.Robot)Robot.moveHead(p[0],p[1])});
$('#navigateRobot').onclick=()=>{if(!motionArmed)return toast('Сначала разблокируйте движение');if(window.Robot)Robot.navigateTo($('#robotPlace').value.trim())};
window.onMotionStatus=t=>{$('#motionStatus').textContent=t};window.onMotionError=t=>{$('#motionStatus').textContent=t;toast(t)};
$('#refreshRobot').onclick=()=>{if(window.Robot)Robot.getRobotSystemStatus()};$('#chargeRobot').onclick=()=>{if(!motionArmed)return toast('Сначала разблокируйте управление');if(window.Robot)Robot.returnToCharge()};
window.onRobotSystemStatus=(online,battery,charging,map,places)=>{$('#robotBattery').textContent=online?battery+'%':'—';$('#robotCharging').textContent=online?(charging?'Да':'Нет'):'—';$('#robotMap').textContent=map;$('#robotPlaces').textContent=places};
window.onVisitorDetected=()=>{continuousVoice=voiceMode==='auto';let out=answerLanguage==='auto'?language:answerLanguage;setVoiceDock('speaking',out==='kk'?'Сәлеметсіз бе. Сұрағыңызды қойыңыз.':'Здравствуйте. Задайте ваш вопрос.');toast(out==='kk'?'Келуші анықталды':'Посетитель обнаружен')};
window.onThinkingPrompt=t=>{setVoiceDock('thinking',t)};
window.onTtsFallback=t=>{setVoiceDock('speaking','Озвучивание: '+t)};
appealsNav.onclick=()=>{
  $$('.nav').forEach(x=>x.classList.remove('active'));appealsNav.classList.add('active');
  const rows=[['61','Качество мобильного интернета','Высокий приоритет'],['38','Доступность электронных госуслуг','В работе'],['29','Интернет-мошенничество','Требует контроля'],['24','Защита персональных данных','В работе'],['17','Финансирование научных проектов','На анализе']];
  $('#listContent').innerHTML=`<div class="list-shell"><h2>Цифровые обращения граждан</h2><p>Тематика Комитета по цифровизации, инновациям и науке · последние 30 дней</p>${rows.map(r=>`<div class="list-row"><b>${r[0]}</b><span>${r[1]}</span><i class="pill">${r[2]}</i></div>`).join('')}</div>`;
  show('listPage');
};
applyUiLanguage();
if(window.Robot)Robot.getAssistantPreferences();
if(window.Robot)Robot.getLlmSettings();

// "Состояние" block on the Robot & settings page. Shows only whether a key is saved, never the key itself.
;(function(){
const T={ru:{stTitle:'Состояние',stVoiceL:'Голос (RobotOS)',stNetL:'Wi-Fi / интернет',stKeyL:'Ключ OpenRouter',stModelL:'Модель ответа',stAsrL:'Распознавание речи',stTtsL:'Озвучивание',stSyncL:'Данные quryltai.kz',stVerL:'Версия приложения',stScreenL:'Экран (WebView)',yes:'установлен ••••',no:'не установлен',online:'в сети',offline:'нет сети',ready:'готов',tts:'RobotOS TTS'},
kk:{stTitle:'Күй',stVoiceL:'Дауыс (RobotOS)',stNetL:'Wi-Fi / интернет',stKeyL:'OpenRouter кілті',stModelL:'Жауап моделі',stAsrL:'Сөйлеуді тану',stTtsL:'Дыбыстау',stSyncL:'quryltai.kz деректері',stVerL:'Қолданба нұсқасы',stScreenL:'Экран (WebView)',yes:'орнатылған ••••',no:'орнатылмаған',online:'желіде',offline:'желі жоқ',ready:'дайын',tts:'RobotOS TTS'}};
const st={online:null,speech:null,state:'',version:'',key:null,model:'',synced:0};
const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=(v===undefined||v===null||v==='')?'—':v};
function render(){const kk=typeof language!=='undefined'&&language==='kk';const t=kk?T.kk:T.ru;
 Object.keys(t).forEach(k=>{if(k.startsWith('st'))set(k,t[k])});
 set('stVoice',st.speech===null?'':(st.speech?t.ready:st.state));
 set('stNet',st.online===null?'':(st.online?t.online:t.offline));
 set('stKey',st.key===null?'':(st.key?t.yes:t.no));
 set('stModel',st.model);set('stAsr',window.__sttModel||'');set('stTts',window.__ttsLabel||t.tts);
 set('stSync',st.synced?new Date(st.synced).toLocaleString(kk?'kk-KZ':'ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'');
 set('stVer',st.version);set('stScreen',innerWidth+'×'+innerHeight+' · DPR '+(window.devicePixelRatio||1))}
window.addEventListener('resize',()=>render());
const rs=window.onRobotStatus;window.onRobotStatus=(online,speech,state)=>{const s=String(state||'');const i=s.lastIndexOf(' · v');st.online=!!online;st.speech=!!speech;st.state=i>=0?s.slice(0,i):s;if(i>=0)st.version=s.slice(i+4);if(rs)rs(online,speech,state);render()};
const ai=window.onAiStatus;window.onAiStatus=(hasKey,model,message)=>{st.key=!!hasKey;st.model=model||'';if(ai)ai(hasKey,model,message);render()};
const qd=window.onQuryltaiData;window.onQuryltaiData=(data,fresh)=>{if(data&&data.updated_at)st.synced=Number(data.updated_at)||0;if(qd)qd(data,fresh);render()};
const ul=applyUiLanguage;applyUiLanguage=function(){const r=ul.apply(this,arguments);render();return r};
render();
})();

// Voice bar: one global state (idle / listening / thinking / speaking), set only by real voice events.
// The same bar is shown on every page, so switching pages never resets or replays it.
// Press and hold the circle to talk; releasing it stops the recording and sends the question.
// A very short tap sends nothing and shows a hint; a tap while the robot speaks stops the speech.
let talkTimer=null,toggleTalk=null;
;(function(){
const TXT={ru:{idle:['Говорите — я слушаю','Просто начните говорить. Чтобы остановить меня, скажите «стоп»','СЛУШАЮ'],listening:['Слушаю…','Говорите, я пойму, когда вы закончите','РОБОТ СЛУШАЕТ'],thinking:['Готовлю ответ…','Подождите немного','ГОТОВЛЮ ОТВЕТ'],speaking:['Отвечаю…','Чтобы остановить, скажите «стоп»','РОБОТ ГОВОРИТ']},
kk:{idle:['Сөйлей беріңіз — тыңдап тұрмын','Жай ғана сөйлей бастаңыз. Тоқтату үшін «тоқта» деңіз','ТЫҢДАП ТҰРМЫН'],listening:['Тыңдап тұрмын…','Сөйлеңіз, сөзіңіз біткенін өзім түсінемін','ТЫҢДАП ТҰР'],thinking:['Жауап дайындап жатырмын…','Сәл күтіңіз','ЖАУАП ДАЙЫНДАЛУДА'],speaking:['Жауап беріп жатырмын…','Тоқтату үшін «тоқта» деңіз','РОБОТ СӨЙЛЕП ТҰР']}};
const SHORT={ru:'Удерживайте круг, пока говорите',kk:'Сөйлеп тұрғанда шеңберді басып тұрыңыз'};
let state='idle',live='',guard=null,pressAt=0,shortTap=false,flash=null;
const norm=s=>(s==='listening'||s==='thinking'||s==='speaking')?s:'idle';
const L=()=>language==='kk'?TXT.kk:TXT.ru;
function render(){const t=L()[state];const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
 set('orbCaption',t[0]);set('orbHint',(state==='listening'&&live)?live.slice(0,140):t[1]);set('vbStatus',t[2]);
 set('vbFabLabel',flash?SHORT[language==='kk'?'kk':'ru']:L().idle[0]);
 const b=document.getElementById('voiceBanner');if(b){b.classList.toggle('listening',state==='listening');b.setAttribute('aria-label',t[0])}
 const o=document.getElementById('orbBtn');if(o){o.classList.toggle('listening',state==='listening');o.classList.toggle('thinking',state==='thinking');o.classList.toggle('speaking',state==='speaking')}
 const d=document.getElementById('voiceDock');if(d)d.className='voice-dock '+(state==='idle'?'active':state)}
setVoiceDock=function(s){const n=norm(s);if(n!==state){state=n;live=''}
 clearTimeout(guard);
 // Safety nets so the bar can never stay stuck if a "finished" event is lost.
 if(n==='speaking')guard=setTimeout(()=>{if(state==='speaking')setVoiceDock('idle')},Math.min(120000,10000+String(typeof lastSpeech==='string'?lastSpeech:'').length*90));
 if(n==='thinking')guard=setTimeout(()=>{if(state==='thinking')setVoiceDock('idle')},60000);
 if(n!=='listening')clearTimeout(talkTimer);
 render()};
function showShortHint(){clearTimeout(flash);flash=setTimeout(()=>{flash=null;render()},2500);render()}
function press(e){if(e&&e.preventDefault)e.preventDefault();if(!window.Robot)return toast('Голосовой ввод доступен на роботе');
 if(state==='speaking'){Robot.stopSpeaking();if(window.onSpeechFinished)window.onSpeechFinished();return}
 if(state==='thinking'||holdActive)return;
 pressAt=Date.now();shortTap=false;beginHold();setVoiceDock('listening');
 const vb=document.getElementById('voiceBanner');try{if(e&&e.pointerId!==undefined&&vb.setPointerCapture)vb.setPointerCapture(e.pointerId)}catch(x){}
 clearTimeout(talkTimer);talkTimer=setTimeout(release,30000)}
function release(e){if(e&&e.preventDefault)e.preventDefault();if(!holdActive)return;clearTimeout(talkTimer);
 const held=Date.now()-pressAt;if(held<400){shortTap=true;endHold();setVoiceDock('idle');showShortHint();return}
 endHold()}
toggleTalk=press;
// A short recording is rejected by the robot; show our hint instead of its error.
const verr=window.onVoiceError;window.onVoiceError=t=>{if(shortTap){shortTap=false;holdActive=false;setVoiceDock('idle');return}if(verr)verr(t)};
const part=window.onVoicePartial;window.onVoicePartial=t=>{if(part)part(t);if(state==='listening'){live=String(t||'');render()}};
const err=window.onVoiceServiceError;window.onVoiceServiceError=t=>{holdActive=false;clearTimeout(talkTimer);if(err)err(t);setVoiceDock('idle')};
const vb=document.getElementById('voiceBanner');
if(vb){vb.onclick=e=>e.preventDefault();
 if(window.PointerEvent){vb.addEventListener('pointerdown',press);['pointerup','pointercancel','pointerleave','lostpointercapture'].forEach(n=>vb.addEventListener(n,release))}
 else{vb.addEventListener('touchstart',press,{passive:false});['touchend','touchcancel'].forEach(n=>vb.addEventListener(n,release));vb.addEventListener('mousedown',press);['mouseup','mouseleave'].forEach(n=>vb.addEventListener(n,release))}
 vb.addEventListener('contextmenu',e=>e.preventDefault())}
const dt=document.getElementById('dockToggle');if(dt)dt.onclick=null;
const ul=applyUiLanguage;applyUiLanguage=function(){const r=ul.apply(this,arguments);render();return r};
render();
})();

// Page flag for layout: the floating language switch is used only on the home page.
;(function(){const sh=show;show=function(id){const r=sh.apply(this,arguments);document.body.classList.toggle('on-home',id==='home');return r};
document.body.classList.toggle('on-home',!!document.querySelector('#home.active'))})();

// ===== Interface matching the design prototype (drawn at 1920×1080) =====
// Texts for both languages, the menu, the new sections (committees, deputy requests, bills, week plan)
// filled from quryltai.kz data, the "Today" row, follow-up questions, and scaling to the real window.
;(function(){
const UI={
 ru:{brand:'ИИ-помощник Курултая',nav:['Главная','Законопроекты','План недели','Комитеты и депутаты','Депутатские запросы','Робот и настройки'],src:'Официальные данные',upd:'обновлено',
  hero:'Добро пожаловать в Курултай Республики Казахстан',heroSub:'Просто начните говорить — или напишите вопрос в строке ниже',query:'Задайте вопрос о Курултае…',ask:'Спросить',
  quick:[['Что такое Курултай','Кратко об органе и его полномочиях'],['Состав комитетов','Какие комитеты и кто их возглавляет'],['Законопроекты этой недели','Что сейчас рассматривает Курултай'],['Как подать обращение','Куда и как обратиться гражданину']],
  today:'Сегодня',todaySub:'По плану Курултая',planT:'Последний опубликованный план',back:'На главную',askLabel:'ВЫ СПРОСИЛИ',fuTitle:'Можно спросить дальше',
  fu:['Какие комитеты есть в Курултае?','Чем Курултай отличается от прежнего Парламента?','Как подать обращение?'],asOf:'По данным на',src2:'Официальные данные Курултая',
  cmTitle:'Комитеты и депутаты',cmSub:n=>'В Курултае '+n+' постоянных комитетов. Выберите комитет, чтобы увидеть председателя и депутатов',cmCap:'СОСТАВ КОМИТЕТА',chairL:'Председатель комитета',chairP:'Председатель: ',member:'Член комитета',cmAsk:'Спросить помощника об этом комитете',cmQ:n=>'Расскажи о комитете Курултая: '+n,
  rqTitle:'Депутатские запросы',rqSub:'Официальные запросы депутатов в министерства и государственные органы — самые свежие сверху',rqCountL:'запросов всего',rqH:['ДАТА','ТЕМА','АВТОРЫ','НОМЕР'],
  billsT:'Законопроекты',billsCount:'законопроектов всего',billsSub:'Законопроекты, которые сейчас рассматривает Курултай, и на каком они этапе. Данные с quryltai.kz',billsH:['НОМЕР','НАЗВАНИЕ','СТАТУС'],planTitle:'План недели',planSub:'Заседания, встречи и мероприятия Курултая по неделям. Данные с quryltai.kz',planH:['ПЛАН','НАЗВАНИЕ','ИСТОЧНИК'],planRow:'План',lastPlan:'Последний опубликованный план:',
  noData:'Данные ещё не загружены — нужно подключение к интернету',rbTitle:'Робот и настройки',review:'На рассмотрении',statusX:'Статус '},
 kk:{brand:'Құрылтайдың ЖИ-көмекшісі',nav:['Басты бет','Заң жобалары','Апта жоспары','Комитеттер мен депутаттар','Депутаттық сауалдар','Робот және баптаулар'],src:'Ресми деректер',upd:'жаңартылды',
  hero:'Қазақстан Республикасының Құрылтайына қош келдіңіз',heroSub:'Жай ғана сөйлей бастаңыз — немесе сұрағыңызды төмендегі жолға жазыңыз',query:'Құрылтай туралы сұрақ қойыңыз…',ask:'Сұрау',
  quick:[['Құрылтай деген не','Орган және оның өкілеттіктері туралы қысқаша'],['Комитеттер құрамы','Қандай комитеттер бар және оларды кім басқарады'],['Осы аптадағы заң жобалары','Құрылтай қазір не қарап жатыр'],['Өтініш қалай беріледі','Азаматқа қайда және қалай жүгінуге болады']],
  today:'Бүгін',todaySub:'Құрылтай жоспары бойынша',planT:'Соңғы жарияланған жоспар',back:'Басты бетке',askLabel:'СІЗ СҰРАДЫҢЫЗ',fuTitle:'Тағы сұрауға болады',
  fu:['Құрылтайда қандай комитеттер бар?','Құрылтай бұрынғы Парламенттен немен ерекшеленеді?','Өтінішті қалай беруге болады?'],asOf:'Деректер күні:',src2:'Құрылтайдың ресми деректері',
  cmTitle:'Комитеттер мен депутаттар',cmSub:n=>'Құрылтайда '+n+' тұрақты комитет бар. Төрағасы мен депутаттарын көру үшін комитетті таңдаңыз',cmCap:'КОМИТЕТ ҚҰРАМЫ',chairL:'Комитет төрағасы',chairP:'Төраға: ',member:'Комитет мүшесі',cmAsk:'Осы комитет туралы көмекшіден сұрау',cmQ:n=>'Құрылтай комитеті туралы айтып бер: '+n,
  rqTitle:'Депутаттық сауалдар',rqSub:'Депутаттардың министрліктер мен мемлекеттік органдарға ресми сауалдары — ең жаңалары жоғарыда',rqCountL:'сауал барлығы',rqH:['КҮНІ','ТАҚЫРЫБЫ','АВТОРЛАРЫ','НӨМІРІ'],
  billsT:'Заң жобалары',billsCount:'заң жобасы барлығы',billsSub:'Құрылтай қазір қарап жатқан заң жобалары және олардың кезеңі. Деректер quryltai.kz сайтынан',billsH:['НӨМІРІ','АТАУЫ','МӘРТЕБЕСІ'],planTitle:'Апта жоспары',planSub:'Құрылтайдың апталық отырыстары, кездесулері мен іс-шаралары. Деректер quryltai.kz сайтынан',planH:['ЖОСПАР','АТАУЫ','ДЕРЕККӨЗ'],planRow:'Жоспар',lastPlan:'Соңғы жарияланған жоспар:',
  noData:'Деректер әлі жүктелмеді — интернет қажет',rbTitle:'Робот және баптаулар',review:'Қаралуда',statusX:'Мәртебе '}};
const T=()=>language==='kk'?UI.kk:UI.ru;
const el=id=>document.getElementById(id);
const setT=(id,v)=>{const e=el(id);if(e)e.textContent=v};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KK_M=['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'];
const fmtDay=d=>{if(language==='kk')return d.getDate()+' '+KK_M[d.getMonth()];try{return d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}catch(e){return d.toDateString()}};
let page='home',cmPick=0;
const ST={ru:{5:'На рассмотрении',6:'Одобрено в первом чтении',12:'Одобрено во втором чтении',7:'Принято',8:'Принято на совместном заседании',9:'Подписано Президентом',10:'Отозвано',13:'Отклонено',11:'Возвращено Сенатом'},kk:{5:'Құрылтайдың қарауында',6:'Бірінші оқылымда мақұлданды',12:'Екінші оқылымда мақұлданды',7:'Қабылданды',8:'Бірлескен отырыста қабылданды',9:'Президент қол қойды',10:'Кері қайтарып алынды',13:'Қабылданбады',11:'Сенат қайтарды'}};
const stName=c=>(ST[language==='kk'?'kk':'ru'][c])||(language==='kk'?'Мәртебесі нақтылануда':'Статус уточняется');

// Scale the 1920px-wide design to the real window (keeps the prototype's proportions on any screen).
function fitToScreen(){const w=document.documentElement.clientWidth||innerWidth,h=document.documentElement.clientHeight||innerHeight;const s=Math.max(.2,Math.min(w/1920,h/1080));const b=document.body.style;document.documentElement.style.zoom='';b.transform='scale('+s+')';b.width=(w/s)+'px';b.height=(h/s)+'px'}
window.addEventListener('orientationchange',()=>setTimeout(fitToScreen,200));
fitToScreen();window.addEventListener('resize',fitToScreen);

function data(){return (typeof quryltaiOfficial!=='undefined'&&quryltaiOfficial)||null}
function setActive(p){document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===p))}

function applyTexts(){const t=T();
 const bs=document.querySelector('.brand b');if(bs)bs.textContent='Құрылтай';const bsp=document.querySelector('.brand span');if(bsp)bsp.textContent=t.brand;
 const order=['home','bills','session','committees','requests','robot'];
 order.forEach((p,i)=>{const n=document.querySelector('.nav[data-page="'+p+'"] span');if(n)n.textContent=t.nav[i]});
 setT('sbSrcT',t.src);
 const hh=document.querySelector('.hero h2');if(hh)hh.textContent=t.hero;const hp=document.querySelector('.hero p');if(hp)hp.textContent=t.heroSub;
 const q=el('query');if(q)q.placeholder=t.query;setT('send',t.ask);
 document.querySelectorAll('.quick').forEach((c,i)=>{if(t.quick[i]){c.querySelector('b').textContent=t.quick[i][0];c.querySelector('small').textContent=t.quick[i][1]}});
 const th=document.querySelector('.today h3');if(th)th.textContent=t.today;const tp=document.querySelector('.today>div:first-child p');if(tp)tp.textContent=t.todaySub;setT('todayPlanT',t.planT);
 document.querySelectorAll('.back-t').forEach(b=>b.textContent=t.back);
 setT('askLabel',t.askLabel);setT('fuTitle',t.fuTitle);
 setT('cmTitle',t.cmTitle);setT('cmCap',t.cmCap);setT('cmAsk',t.cmAsk);
 setT('rqTitle',t.rqTitle);setT('rqSub',t.rqSub);setT('rqCountL',t.rqCountL);t.rqH.forEach((v,i)=>setT('rqH'+(i+1),v));
 setT('rbTitle',t.rbTitle);
 renderSidebarSource();renderToday();renderFollowups();
 if(page==='committees')renderCommittees();if(page==='requests')renderRequests();if(page==='bills'||page==='session')renderList(page)}

function renderSidebarSource(){const d=data();const t=T();setT('sbSrc','quryltai.kz · '+t.upd+' '+(d&&d.updated_at?fmtDay(new Date(Number(d.updated_at))):'—'))}
function renderToday(){setT('todayDate',fmtDay(new Date()));const d=data();const p=d&&d.weekly_plans&&d.weekly_plans[0];setT('todayPlan',p?String(p.title||'').replace(/\s+/g,' ').trim():'—')}
function askNow(q){const i=el('query');if(i)i.value=q;if(typeof submit==='function')submit()}
function renderFollowups(){const box=el('fuList');if(!box)return;box.innerHTML=T().fu.map(f=>'<button type="button">'+esc(f)+'</button>').join('');
 box.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{if(i===0){go('committees');return}askNow(b.textContent)})}

function tableHtml(head,rows,cls){return '<div class="rq-table '+(cls||'')+'"><div class="rq-row rq-th">'+head.map(h=>'<span>'+esc(h)+'</span>').join('')+'</div>'+
 '<div class="rq-body">'+(rows.length?rows.map(r=>'<div class="rq-row"><b>'+esc(r[0])+'</b><span class="t">'+esc(r[1])+'</span>'+(r.length>3?'<span class="a">'+esc(r[2])+'</span><span class="n">'+esc(r[3])+'</span>':'<span class="n">'+esc(r[2])+'</span>')+'</div>').join(''):'<div class="rq-empty">'+esc(T().noData)+'</div>')+'</div></div>'}
function renderList(kind){const t=T(),d=data();let html='';
 if(kind==='bills'){const rows=d&&d.bills?d.bills.slice(0,20).map(b=>['№ '+b.id,b.title,stName(b.status)]):[];
  html='<div class="rq-head"><div class="pg-head"><h1>'+esc(t.billsT)+'</h1><span>'+esc(t.billsSub)+'</span></div>'+(d?'<div class="rq-count"><b>'+esc(d.bill_count||0)+'</b><span>'+esc(t.billsCount)+'</span></div>':'')+'</div>'+tableHtml(t.billsH,rows,'cols3')}
 else{const rows=d&&d.weekly_plans?d.weekly_plans.map(p=>[t.planRow,String(p.title||'').replace(/\s+/g,' ').trim(),'quryltai.kz']):[];
  const last=rows[0]?'<div class="plan-last"><b>'+esc(t.lastPlan)+'</b> '+esc(rows[0][1])+'</div>':'';
  html='<div class="rq-head"><div class="pg-head"><h1>'+esc(t.planTitle)+'</h1><span>'+esc(t.planSub)+'</span></div></div>'+last+tableHtml(t.planH,rows,'cols3')}
 const c=el('listContent');if(c)c.innerHTML=html}
function renderRequests(){const t=T(),d=data();setT('rqCount',d?String(d.deputy_request_count||0):'—');
 const rows=d&&d.deputy_requests?d.deputy_requests.slice(0,30).map(r=>[r.date,r.title,r.authors,r.number]):[];
 const box=el('rqRows');if(box)box.innerHTML=rows.length?rows.map(r=>'<div class="rq-row"><b>'+esc(r[0])+'</b><span class="t">'+esc(r[1])+'</span><span class="a">'+esc(r[2])+'</span><span class="n">'+esc(r[3])+'</span></div>').join(''):'<div class="rq-empty">'+esc(t.noData)+'</div>'}
function chairOf(c){const ds=c.deputies||[];return ds.find(x=>/председател|төраға/i.test(x.position||'')&&!/заместит|орынбасар/i.test(x.position||''))||null}
function renderCommittees(){const t=T(),d=data();const list=(d&&d.committees)||[];setT('cmSub',list.length?t.cmSub(list.length):t.noData);
 const grid=el('cmGrid');if(!grid)return;if(cmPick>=list.length)cmPick=0;
 grid.innerHTML=list.map((c,i)=>{const ch=chairOf(c);return '<button type="button" class="cm-card'+(i===cmPick?' on':'')+'"><b>'+esc(c.name)+'</b><span>'+(ch?esc(t.chairP+ch.name):'&nbsp;')+'</span></button>'}).join('');
 grid.querySelectorAll('.cm-card').forEach((b,i)=>b.onclick=()=>{cmPick=i;renderCommittees()});
 const sel=list[cmPick];setT('cmName',sel?sel.name:'—');
 const ch=sel?chairOf(sel):null;const others=sel?(sel.deputies||[]).filter(x=>x!==ch):[];
 const ini=n=>{const m=String(n||'').match(/\p{L}/u);return esc(m?m[0].toUpperCase():'?')};
 el('cmMembers').innerHTML=(ch?'<div class="cm-m chair"><i>'+ini(ch.name)+'</i><div><b>'+esc(ch.name)+'</b><span>'+esc(t.chairL)+'</span></div></div>':'')+
  others.map(m=>'<div class="cm-m"><i>'+ini(m.name)+'</i><div><b>'+esc(m.name)+'</b><span>'+esc(m.position||t.member)+'</span></div></div>').join('');
 el('cmAsk').onclick=()=>{if(sel)askNow(t.cmQ(sel.name))}}

// Page switching: remember the page on <body> for layout (no :has() on older WebViews)
const sh=show;show=function(id){const r=sh.apply(this,arguments);page=id==='listPage'?page:id;document.body.dataset.page=id;document.body.classList.toggle('on-home',id==='home');return r};
document.body.dataset.page='home';document.body.classList.add('on-home');
function go(p){setActive(p);page=p;
 if(p==='home'){goHome();return}
 if(p==='bills'||p==='session'){renderList(p);show('listPage');page=p;return}
 if(p==='committees'){renderCommittees();show('committees');return}
 if(p==='requests'){renderRequests();show('requests');return}}
document.querySelectorAll('.nav').forEach(n=>{if(n.dataset.page==='robot')return;n.onclick=()=>go(n.dataset.page)});
document.querySelectorAll('.quick').forEach(c=>c.onclick=()=>{const a=c.dataset.act;if(a==='committees')return go('committees');if(a==='bills')return go('bills');askNow(language==='kk'?c.dataset.qKk:c.dataset.qRu)});

// Answer screen: question as the heading, date chip under the answer, follow-up questions
const ans=answer;answer=function(title,prompt,html,speech){const r=ans.apply(this,arguments);setActive('');
 const art=document.querySelector('#answerBody article,#answerBody .result-card');
 if(art&&!art.querySelector('.ans-meta')){const m=document.createElement('div');m.className='ans-meta';m.innerHTML='<span>'+'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg>'+esc(T().asOf+' '+fmtDay(new Date()))+'</span><span>'+'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d=\"M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z\"/></svg>'+esc(T().src2)+'</span>';art.appendChild(m)}
 renderFollowups();return r};

// The connection badge lives in the title row of "Robot and settings"
const badge=el('connectionBadge'),slot=el('rbBadgeSlot');if(badge&&slot)slot.appendChild(badge);

// Re-render when fresh data from quryltai.kz arrives and when the language changes
const qd=window.onQuryltaiData;window.onQuryltaiData=function(){const r=qd?qd.apply(this,arguments):undefined;renderSidebarSource();renderToday();if(page==='committees')renderCommittees();if(page==='requests')renderRequests();if((page==='bills'||page==='session')&&document.body.dataset.page==='listPage')renderList(page);return r};
const ul=applyUiLanguage;applyUiLanguage=function(){const r=ul.apply(this,arguments);applyTexts();return r};
applyTexts();
})();
// Голос без кнопки (2026-10-30): круг больше не кнопка, а визуализация. Полоски двигаются от громкости:
// микрофона, пока робот слушает, и голоса робота, пока он говорит. Разговор открыт всегда (live), перебить — словом «стоп».
;(function(){
const bars=()=>document.querySelectorAll('#orbBtn .orb-core i');
let target=0,shown=0,robot=false,last=0;
window.onVoiceLevel=(lvl,isRobot)=>{target=Math.max(0,Math.min(100,Number(lvl)||0));robot=!!isRobot;last=Date.now()};
function frame(){const now=Date.now();if(now-last>400)target=0;shown+=(target-shown)*0.35;
 const b=bars();const k=[.55,.8,1,.8,.55];
 b.forEach((el,i)=>{const wobble=0.15*Math.sin(now/120+i*1.3);const v=Math.max(.18,Math.min(1.25,(shown/100)*1.6*k[i]+.18+(shown>8?wobble*k[i]:0)));el.style.transform='scaleY('+v.toFixed(3)+')'});
 const o=document.getElementById('orbBtn');if(o)o.classList.toggle('robot-voice',robot&&shown>5);
 requestAnimationFrame(frame)}
requestAnimationFrame(frame);
const vb=document.getElementById('voiceBanner');if(vb){vb.setAttribute('aria-disabled','true');vb.tabIndex=-1}
const lbl=document.getElementById('vbFabLabel');if(lbl)lbl.textContent='';
})();
