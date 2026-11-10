let language=localStorage.language||'kk';let questionLanguage=language;let answerLanguage=localStorage.answerLanguage||'auto';let voiceMode=localStorage.voiceMode||'manual';let lastSpeech='';let lastSpeechLanguage=language;let voiceRequest=false;let lastPrompt='';let directAiReady=false;let continuousVoice=voiceMode==='auto';let continuousStarted=false;let lastVoiceText='';let lastVoiceAt=0;let holdActive=false;let quryltaiOfficial=null;
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
// 2026-11-10: блок «Настройки помощника» (модели, ключ OpenRouter, собственный шлюз, встреча) убран — контракт docs/kurultai/robot-settings.md
const ru={bill:'Анализ законопроекта',brief:'Подготовка выступления',appeal:'Обращения граждан',risk:'Риски региона',session:'Подготовка к заседанию',speech:'Проект выступления',task:'Проект поручения'};
const kk={bill:'Заң жобасын талдау',brief:'Сөз сөйлеуге дайындық',appeal:'Азаматтардың өтініштері',risk:'Өңірлік тәуекелдер',session:'Отырысқа дайындық',speech:'Сөз сөйлеу жобасы',task:'Тапсырма жобасы'};
const uiText={
 ru:{committee:'Курултай Республики Казахстан',brand:'AI-помощник Курултая',nav:['Главная','Аналитика','Законопроекты','Обращения','Заседание','Поручения','Робот и настройки'],title:'Цифровой помощник Курултая',hero:'Курултай Республики Казахстан',heroSub:'Просто начните говорить — или напишите вопрос в строке ниже',status:'Голосовой помощник активен',query:'Напишите ваш вопрос…',ask:'Спросить →',today:'Сегодня',todaySub:'Ближайшие события и задачи',settings:'Настройки помощника',voice:'Голосовой помощник',voiceMode:'Режим микрофона',manual:'По кнопке',auto:'Автоматически при посетителе',answerLanguage:'Язык ответа',same:'Как в вопросе',alwaysRu:'Всегда русский',alwaysKk:'Всегда казахский',saveVoice:'Сохранить голосовые настройки',speak:'🔊 Озвучить'},
 kk:{committee:'Қазақстан Республикасының Құрылтайы',brand:'Құрылтайдың AI-көмекшісі',nav:['Басты бет','Талдау','Заң жобалары','Өтініштер','Отырыс','Тапсырмалар','Робот және баптаулар'],title:'Құрылтайдың цифрлық көмекшісі',hero:'Қазақстан Республикасының Құрылтайы',heroSub:'Жай ғана сөйлей бастаңыз — немесе сұрағыңызды төмендегі жолға жазыңыз',status:'Дауыстық көмекші белсенді',query:'Сұрағыңызды жазыңыз…',ask:'Сұрау →',today:'Бүгін',todaySub:'Жақын іс-шаралар мен міндеттер',settings:'Көмекші баптаулары',voice:'Дауыстық көмекші',voiceMode:'Микрофон режимі',manual:'Батырма арқылы',auto:'Келуші келгенде автоматты',answerLanguage:'Жауап тілі',same:'Сұрақ тілінде',alwaysRu:'Әрқашан орысша',alwaysKk:'Әрқашан қазақша',saveVoice:'Дауыс баптауларын сақтау',speak:'🔊 Дауыстап оқу'}
};
function applyUiLanguage(){let t=uiText[language]||uiText.ru;document.documentElement.lang=language;$('.brand b').textContent='Құрылтай РК';$('.brand span').textContent=t.brand;$('.committee-name').innerHTML=t.committee.replace(', ','<br>');$$('.nav span').forEach((e,i)=>{if(t.nav[i])e.textContent=t.nav[i]});let quick=language==='kk'?[['Бейінді заң жобасы','AI, онлайн-платформалар және цифрлық құқықтар'],['Комитет қорытындысы','Ұстаным, түзетулер және әзірлеушілерге сұрақтар'],['Цифрлық өтініштер','Байланыс, мемлекеттік қызметтер және интернет-алаяқтық'],['AI және кибертәуекелдер','Маңызды сигналдар және реттеу']]:[['Профильный законопроект','AI, онлайн-платформы и цифровые права'],['Заключение комитета','Позиция, поправки и вопросы разработчикам'],['Цифровые обращения','Связь, госуслуги и интернет-мошенничество'],['AI и киберриски','Критические сигналы и регулирование']];$$('.quick').forEach((e,i)=>{if(quick[i]){e.querySelector('b').textContent=quick[i][0];e.querySelector('small').textContent=quick[i][1]}});$('#eyebrow').textContent=language==='kk'?'ҚАЗАҚСТАН РЕСПУБЛИКАСЫНЫҢ ҚҰРЫЛТАЙЫ':'КУРУЛТАЙ РЕСПУБЛИКИ КАЗАХСТАН';$('.full-title').textContent=t.title;$('.compact-title').textContent=t.title;$('.hero .status').innerHTML='<i></i> '+t.status;$('.hero h2').innerHTML=t.hero.replace(', ','<br>');$('.hero p').textContent=t.heroSub;$('#query').placeholder=t.query;$('#send').textContent=t.ask;$('.today h3').textContent=t.today;$('.today>div:first-child p').textContent=t.todaySub;if($('#speak').textContent.indexOf('■')<0)$('#speak').textContent=t.speak;$('#lang').innerHTML='<span data-l="kk"'+(language==='kk'?' class="on"':'')+'>ҚАЗ</span><span data-l="ru"'+(language==='ru'?' class="on"':'')+'>РУС</span>';$('#lang').setAttribute('aria-label',language==='kk'?'Тілді ауыстыру':'Сменить язык')}
function show(id){$$('.page').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active');document.querySelector('main').scrollTop=0}
window.goHome=()=>show('home');$$('.back').forEach(b=>b.onclick=goHome);
function toast(t){let e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function answer(title,prompt,html,speech){$('#answerTitle').textContent=title;$('#answerPrompt').textContent=prompt;$('#answerBody').innerHTML=html;lastSpeech=speech||prompt}  // 2026-11-07: страница ответа не открывается — робот отвечает голосом, экран остаётся как был
const cards={
 bill:{prompt:'Проанализируй проект закона по вопросам онлайн-платформ, искусственного интеллекта и масс-медиа',html:`<article class="result-card wide"><h3>Суть документа</h3><p>Проект формирует требования к цифровым платформам и применению алгоритмических систем: прозрачность рекомендаций, маркировка синтетического контента, защита персональных данных и ответственность операторов.</p></article><article class="result-card"><h3>Ключевые нормы</h3><ul><li>обязательная идентификация AI-контента;</li><li>аудит алгоритмов высокого риска;</li><li>механизм обжалования автоматизированных решений;</li><li>локализация реагирования на инциденты.</li></ul></article><article class="result-card"><h3>Оценка воздействия</h3><div class="metric-row"><div class="metric"><b>12</b><small>связанных НПА</small></div><div class="metric"><b>6</b><small>госорганов</small></div><div class="metric"><b>4</b><small>зоны риска</small></div></div><p>Потребуется согласование с нормами о персональных данных, связи, кибербезопасности и защите прав потребителей.</p></article><article class="result-card"><h3>Позиция комитета</h3><ul><li>поддержать риск-ориентированный подход;</li><li>исключить избыточную нагрузку на стартапы;</li><li>закрепить независимую оценку алгоритмов.</li></ul></article><article class="result-card"><h3>Вопросы разработчикам</h3><ul><li>Кто определяет класс риска AI-системы?</li><li>Как гражданин оспорит решение алгоритма?</li><li>Какие данные доступны для парламентского контроля?</li></ul></article>`,speech:'Проект регулирует онлайн-платформы и системы искусственного интеллекта. Комитету рекомендуется поддержать риск-ориентированный подход, уточнив аудит алгоритмов, защиту граждан и условия для развития казахстанских стартапов.'},
 appeal:{prompt:'Покажи обращения граждан по вопросам цифровизации',html:`<article class="result-card wide"><h3>Цифровая повестка · последние 30 дней</h3><div class="metric-row"><div class="metric"><b>286</b><small>обращений</small></div><div class="metric"><b>+18%</b><small>к прошлому месяцу</small></div><div class="metric"><b>34</b><small>требуют контроля</small></div></div></article><article class="result-card"><h3>Основные темы</h3><ul><li>качество мобильного интернета — 61</li><li>доступность электронных госуслуг — 38</li><li>интернет-мошенничество — 29</li><li>защита персональных данных — 24</li></ul></article><article class="result-card"><h3>Выявленный сигнал</h3><p><b>Цифровой разрыв в сельских районах.</b> Обращения из трёх территорий показывают нестабильную связь и невозможность воспользоваться социально значимыми онлайн-услугами.</p></article>`,speech:'За месяц поступило 286 обращений по цифровой повестке. Главный сигнал — качество мобильного интернета и доступность электронных услуг в сельских районах. Тридцать четыре обращения требуют парламентского контроля.'},
 risk:{prompt:'Покажи ключевые AI- и киберриски',html:`<article class="result-card wide"><h3>Сигналы для Комитета</h3></article><article class="result-card"><h3>1. Киберинциденты</h3><p>Зафиксирован рост фишинговых атак на граждан и сервисы. Девять рисков имеют высокий приоритет.</p></article><article class="result-card"><h3>2. Алгоритмическая прозрачность</h3><p>Для систем высокого риска отсутствуют единые требования к аудиту, объяснимости и обжалованию решений.</p></article><article class="result-card"><h3>3. Цифровой разрыв</h3><p>Три сельских района отстают от целевых показателей качества и устойчивости связи.</p></article><article class="result-card"><h3>Рекомендация</h3><p>Запросить карту критических цифровых рисков, сроки подключения населённых пунктов и проект единого стандарта безопасного AI.</p></article>`,speech:'Комитету следует обратить внимание на три риска: рост киберинцидентов, отсутствие единых правил аудита искусственного интеллекта и цифровой разрыв между регионами.'},
 session:{prompt:'Подготовь меня к заседанию Комитета по цифровизации, инновациям и науке',html:`<article class="result-card wide"><h3>Повестка · 10:00 · зал 302</h3><p>Цифровой кодекс, регулирование искусственного интеллекта, ратификация Конвенции о компьютерных преступлениях и коммерциализация науки.</p></article><article class="result-card"><h3>Что важно знать</h3><ul><li>53 законопроекта находятся на рассмотрении Курултая;</li><li>9 открытых киберрисков высокого уровня;</li><li>3 региона ниже цели по цифровой доступности;</li><li>2 научные программы отстают от плана.</li></ul></article><article class="result-card"><h3>Вопросы на заседание</h3><ul><li>Как будет контролироваться безопасность AI?</li><li>Когда завершится подключение сельских территорий?</li><li>Как измеряется коммерциализация научных разработок?</li></ul></article>`,speech:'К заседанию Комитета подготовлена справка. В центре внимания — Цифровой кодекс, безопасность искусственного интеллекта, киберпреступность и коммерциализация научных разработок.'}
};
function demo(type){let dict=language==='kk'?kk:ru;if(type==='regionBrief'){let region=$('#regionName').textContent;answer('Аналитическая справка: '+region,'Цифровизация, инновации и наука',`<article class="result-card wide"><h3>Вывод AI-ассистента</h3><p>${region}: сводный показатель цифрового развития демонстрирует положительную динамику, однако сохраняются инфраструктурные различия между городскими и сельскими территориями. Приоритет парламентского контроля — качество связи, доступность государственных цифровых услуг и подготовка кадров.</p></article><article class="result-card"><h3>Сильные стороны</h3><ul><li>высокая доля онлайн-услуг;</li><li>рост цифровой грамотности;</li><li>активность инновационных проектов.</li></ul></article><article class="result-card"><h3>Зона внимания</h3><ul><li>покрытие отдалённых населённых пунктов;</li><li>устойчивость инфраструктуры;</li><li>измеримость эффекта бюджетных программ.</li></ul></article><article class="result-card wide"><h3>Вопрос на заседание</h3><p>Какие конкретные населённые пункты будут подключены в 2026 году, каковы сроки и каким показателем подтверждается качество доступа?</p></article>`,'По выбранному региону подготовлена аналитическая справка. Приоритет контроля — качество связи в сельских территориях, доступность цифровых услуг и измеримый эффект бюджетных программ.');return}if(type==='brief'||type==='speech'){answer(dict.speech,'Выступление на ближайшем заседании',`<article class="result-card wide"><h3>Проект выступления · 75 секунд</h3><p>Уважаемые коллеги! Анализ обращений граждан и региональных показателей показывает, что первоочередного внимания требует подготовка к отопительному сезону. За последние две недели зафиксирован рост связанных обращений жителей, затронуты два района. Предлагаю запросить у ответственных органов пообъектный график работ, источники финансирования и персональную ответственность за соблюдение сроков. Информация об исполнении должна быть открытой и регулярно представляться депутатскому корпусу.</p></article><article class="result-card"><h3>Главный тезис</h3><p>Каждое поручение должно иметь срок, ответственного и проверяемый результат.</p></article><article class="result-card"><h3>Возможный вопрос СМИ</h3><p>Каким образом депутаты будут контролировать реальное исполнение?</p></article>`,'Уважаемые коллеги! Анализ обращений граждан показывает, что первоочередного внимания требует подготовка к отопительному сезону. Предлагаю запросить пообъектный график работ, источники финансирования и персональную ответственность за сроки.');return}if(type==='task'){answer(dict.task,'По проблеме теплоснабжения',`<article class="result-card wide"><h3>Проект депутатского поручения</h3><p>Акимату совместно с ответственными коммунальными организациями представить актуализированный пообъектный план подготовки систем теплоснабжения в затронутых районах.</p></article><article class="result-card"><h3>Срок</h3><p>До 10 сентября 2026 года</p></article><article class="result-card"><h3>Ожидаемый результат</h3><p>График работ, источники финансирования, ответственные лица и фотофиксация исполнения.</p></article>`,'Подготовлен проект поручения по теплоснабжению со сроком до десятого сентября.');return}let c=cards[type]||cards.session;answer(dict[type]||dict.session,c.prompt,c.html,c.speech)}
window.demo=demo;$$('[data-demo]').forEach(b=>b.onclick=()=>demo(b.dataset.demo));
function setVoiceDock(state,text){let d=$('#voiceDock');if(!d)return;d.className='voice-dock '+state;$('#voiceTranscript').textContent=text||'Нажмите «Спросить голосом» и задайте вопрос';let labels={listening:'МИКРОФОН · ИДЁТ ЗАПИСЬ',thinking:'ПОМОЩНИК · ГОТОВИТ ОТВЕТ',speaking:'РОБОТ · ОЗВУЧИВАЮ ОТВЕТ',paused:'НАЖМИТЕ «ГОВОРИТЬ»',active:'ГОТОВ К ВОПРОСУ'};$('#voiceState').textContent=labels[state]||labels.active;$('#dockToggle').textContent=state==='thinking'?'Подождите':state==='listening'&&holdActive?'Стоп':'Говорить';$('#dockToggle').disabled=state==='thinking'||state==='speaking'}
function submit(){let q=$('#query').value.trim();if(!q)return toast('Задайте вопрос');lastPrompt=q;setVoiceDock('thinking',q);if(window.Robot)Robot.pauseListening();let payload=JSON.stringify({message:q,language:questionLanguage,answer_language:answerLanguage,context:'committee_digital_innovation_science',device:'orionstar_os_r_sg04'});if(directAiReady&&window.Robot){showLoading(q);Robot.askOpenAI(payload)}else{let s=q.toLowerCase();window.demo(s.includes('обращ')?'appeal':s.includes('риск')?'risk':s.includes('закон')?'bill':s.includes('выступ')?'speech':'session');voiceRequest=false;toast(window.Robot?'Нет связи с сервером':'Деморежим');if(continuousVoice&&window.Robot)Robot.resumeContinuousListening(language)}}
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
function showLoading(q){if(window.vbSubtitle)window.vbSubtitle('heard',q);answer('Готовлю ответ',q,`<article class="result-card wide"><h3>Анализирую вопрос…</h3><p>Ответ появится на экране и будет озвучен.</p></article>`,'')}
window.onBackendResult=(ok,body)=>{let resultLanguage=answerLanguage==='auto'?questionLanguage:answerLanguage;let responseText=body;if(ok){try{let j=JSON.parse(body);responseText=j.answer||j.message||body;resultLanguage=j.language||resultLanguage}catch(e){}}let kk=resultLanguage==='kk';if(!ok){answer(kk?'Қызметпен байланыс жоқ':'Нет связи с сервисом',lastPrompt,`<article class="result-card wide error-card"><h3>${kk?'Сұрау орындалмады':'Запрос не выполнен'}</h3><p>${escapeHtml(body)}</p><button id="retryRequest" class="retry">${kk?'Қайталау':'Повторить запрос'}</button></article>`,'');setTimeout(()=>{let b=$('#retryRequest');if(b)b.onclick=submit},0);voiceRequest=false;return}responseText=String(responseText).replace(/\*\*/g,'').replace(/^#{1,6}\s*/gm,'').replace(/`/g,'').replace(/^\s*(вывод|қорытынды|ответ|жауап|gpt)\s*[:：-]\s*/i,'').trim();lastSpeechLanguage=resultLanguage;answer(kk?'Көмекшінің жауабы':'Ответ помощника',lastPrompt,`<article class="result-card wide"><p>${escapeHtml(responseText).replace(/\n/g,'<br>')}</p></article>`,responseText);if(responseText&&window.Robot)Robot.speak(responseText,resultLanguage);voiceRequest=false};
function escapeHtml(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$('#lang').onclick=e=>{const s=e&&e.target&&e.target.closest&&e.target.closest('[data-l]');if(s&&s.dataset.l===language)return;language=language==='ru'?'kk':'ru';questionLanguage=language;localStorage.language=language;applyUiLanguage();if(window.Robot&&Robot.setUiLanguage)Robot.setUiLanguage(language);if(continuousVoice&&window.Robot)Robot.setContinuousListening(true,language);toast(language==='ru'?'Русский язык':'Қазақ тілі')};
window.onAssistantPreferences=(automatic,answer)=>{voiceMode=automatic?'auto':'manual';answerLanguage=answer||'auto';continuousVoice=automatic;localStorage.voiceMode=voiceMode;localStorage.answerLanguage=answerLanguage;window.onContinuousVoiceState(automatic)};
window.onLocalTtsStatus=(ok,info)=>{console.log('[TTS]',ok,info);let text=String(info||'Нет диагностических данных');if(!ok){toast('TTS: '+text);setVoiceDock('paused',text.slice(0,120))}else toast('TTS: '+text)};
window.onWelcomeMode=on=>{console.log('[welcome]',on)};
window.onAiStatus=(hasKey,model,message)=>{directAiReady=!!hasKey};  // совместимая заглушка: Java шлёт pushAiStatus; модель больше не показываем
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
robotNav.onclick=()=>{$$('.nav').forEach(x=>x.classList.remove('active'));robotNav.classList.add('active');show('robot')};  // опрос сервера и робота — в блоке «Робот и настройки» ниже (по show('robot'))
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

// «Робот и настройки» (контракт docs/kurultai/robot-settings.md, 2026-11-10).
// Состояние — с сервера: Robot.refreshSettings() → GET /v1/robot/settings → window.onRobotSettings(json) (при ошибке {"error": "…"}),
// раз в 60 с пока вкладка открыта и при её открытии. Переключатели движка и режима — под PIN (pin.js: window.askAdminPin) →
// Robot.setRobotSetting(key, value) → POST → onRobotSettings. Робот: Robot.getRobotSystemStatus() → window.onRobotInfo(json)
// {online, battery, charging, map, places:[имена], api_ready, navigating, last_trip}. Адрес сервера — только из сборки (BACKEND_URL).
;(function(){
const T={ru:{stTitle:'Состояние',stServerL:'Сервер',stEngineL:'Движок',stModeL:'Режим',stVoiceL:'Голос',stSyncL:'Данные quryltai.kz',stVerL:'Версия приложения',stScreenL:'Экран (WebView)',stApiL:'RobotAPI',stNetL:'Wi-Fi / интернет',
  swTitle:'Переключатели',swEngineL:'Движок',swModeL:'Режим',swEngineHint:'OpenAI — быстрее, с навигацией и поиском; OpenRouter — запасной, без навигации',swModeHint:'Шумный день: перебить можно только словом „стоп“, робот отвечает лишь тому, кто стоит перед ним',
  realtime:'OpenAI',pipeline:'OpenRouter',normal:'Обычный',noisy:'Шумный день',
  rpTitle:'Робот',rbBatL:'Батарея',rbChgL:'Зарядка',rbMapL:'Карта',rbPlacesL:'Точки',refreshRobot:'Обновить',chargeRobot:'На зарядку',homeRobot:'На пост',rbWarn:'Перед движением освободите пространство вокруг робота.',rbArmL:'Разблокировать движение',rbHeadL:'Голова и камера',head:['Влево','Центр','Вправо','Вверх'],navigateRobot:'Поехать к точке',noPlaces:'Точки карты не получены',
  online:'онлайн',offline:'недоступен',checking:'проверяю…',noServer:'Сервер недоступен',fallback:'OpenRouter (запасной)',fallbackNote:(r,n)=>'OpenAI недоступен: '+r+', работает OpenRouter'+(n?', повтор через '+n+' мин':''),
  credits:n=>'ElevenLabs: '+n+' кредитов',noCredits:'ElevenLabs: нет данных',yes:'да',no:'нет',ready:'готов',notReady:'нет',saved:'Сохранено',saving:'Сохраняю…',onRobot:'Доступно на роботе',
  locked:'Управление заблокировано',armed:'Управление готово',armFirst:'Сначала разблокируйте движение',lastTrip:'Последняя поездка',arrived:'приехал',failed:'не доехал',stopped:'остановлен',sec:'с',
  reasons:{credit_balance_exhausted:'кончились средства OpenAI',insufficient_quota:'кончились средства OpenAI',no_openai_key:'нет ключа OpenAI',no_key:'нет ключа OpenAI',no_voice:'нет голоса',no_route:'нет пути',obstacle:'препятствие',timeout:'время вышло',api_error:'ошибка RobotAPI',unknown_place:'точки нет на карте'},
  places:{museum:'Музей Курултая',restroom:'Туалет',wardrobe:'Гардероб',lobby:'Холл',invitation_room:'Комната для приглашённых',home:'Пост робота'}},
 kk:{stTitle:'Күй',stServerL:'Сервер',stEngineL:'Қозғалтқыш',stModeL:'Режим',stVoiceL:'Дауыс',stSyncL:'quryltai.kz деректері',stVerL:'Қолданба нұсқасы',stScreenL:'Экран (WebView)',stApiL:'RobotAPI',stNetL:'Wi-Fi / интернет',
  swTitle:'Ауыстырғыштар',swEngineL:'Қозғалтқыш',swModeL:'Режим',swEngineHint:'OpenAI — жылдамырақ, навигация мен іздеу бар; OpenRouter — қосалқы, навигациясыз',swModeHint:'Шулы күн: тек „тоқта“ сөзімен бөлуге болады, робот алдында тұрған адамға ғана жауап береді',
  realtime:'OpenAI',pipeline:'OpenRouter',normal:'Қалыпты',noisy:'Шулы күн',
  rpTitle:'Робот',rbBatL:'Батарея',rbChgL:'Зарядтау',rbMapL:'Карта',rbPlacesL:'Нүктелер',refreshRobot:'Жаңарту',chargeRobot:'Зарядтауға',homeRobot:'Орнына',rbWarn:'Қозғалыс алдында роботтың айналасын босатыңыз.',rbArmL:'Қозғалысты ашу',rbHeadL:'Бас және камера',head:['Солға','Ортаға','Оңға','Жоғары'],navigateRobot:'Нүктеге бару',noPlaces:'Карта нүктелері алынбады',
  online:'желіде',offline:'қолжетімсіз',checking:'тексеріп жатырмын…',noServer:'Сервер қолжетімсіз',fallback:'OpenRouter (қосалқы)',fallbackNote:(r,n)=>'OpenAI қолжетімсіз: '+r+', OpenRouter жұмыс істейді'+(n?', '+n+' минуттан кейін қайталау':''),
  credits:n=>'ElevenLabs: '+n+' кредит',noCredits:'ElevenLabs: деректер жоқ',yes:'иә',no:'жоқ',ready:'дайын',notReady:'жоқ',saved:'Сақталды',saving:'Сақтап жатырмын…',onRobot:'Роботта қолжетімді',
  locked:'Басқару бұғатталған',armed:'Басқару дайын',armFirst:'Алдымен қозғалысты ашыңыз',lastTrip:'Соңғы сапар',arrived:'жетті',failed:'жете алмады',stopped:'тоқтатылды',sec:'с',
  reasons:{credit_balance_exhausted:'OpenAI қаражаты бітті',insufficient_quota:'OpenAI қаражаты бітті',no_openai_key:'OpenAI кілті жоқ',no_key:'OpenAI кілті жоқ',no_voice:'дауыс жоқ',no_route:'жол жоқ',obstacle:'кедергі',timeout:'уақыт бітті',api_error:'RobotAPI қатесі',unknown_place:'нүкте картада жоқ'},
  places:{museum:'Құрылтай мұражайы',restroom:'Дәретхана',wardrobe:'Гардероб',lobby:'Холл',invitation_room:'Шақырылғандар бөлмесі',home:'Робот орны'}}};
const t=()=>(typeof language!=='undefined'&&language==='kk')?T.kk:T.ru;
const st={online:null,speech:null,state:'',version:'',synced:0,settings:null,settingsErr:'',busy:false,pendingSave:false,robot:null};
const set=(id,v,warn)=>{const e=document.getElementById(id);if(!e)return;e.textContent=(v===undefined||v===null||v==='')?'—':v;e.classList.toggle('warn',!!warn)};
const num=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const reasonText=r=>{r=String(r||'');return t().reasons[r]||r};
const fmtWhen=ms=>{try{return new Date(ms).toLocaleString(language==='kk'?'kk-KZ':'ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(e){return new Date(ms).toLocaleString()}};
function render(){const x=t();
 ['stTitle','stServerL','stEngineL','stModeL','stVoiceL','stSyncL','stVerL','stScreenL','stApiL','stNetL','swTitle','swEngineL','swModeL','swEngineHint','swModeHint','rpTitle','rbBatL','rbChgL','rbMapL','rbPlacesL','refreshRobot','chargeRobot','homeRobot','rbWarn','rbArmL','rbHeadL','navigateRobot'].forEach(k=>set(k,x[k]));
 document.querySelectorAll('[data-head]').forEach((b,i)=>{if(x.head[i])b.textContent=x.head[i]});
 document.querySelectorAll('.seg button').forEach(b=>{b.textContent=x[b.dataset.v]||b.dataset.v});
 const s=st.settings,eng=s&&s.engine||null,srv=s&&s.server||null,voice=s&&s.voice||null;
 set('stServer',s?x.online+(srv&&srv.version?' · '+srv.version+(srv.git?' ('+srv.git+')':''):''):st.settingsErr?x.offline:x.checking,!s&&!!st.settingsErr);
 const fallback=!!(eng&&eng.effective&&eng.selected&&eng.effective!==eng.selected);
 set('stEngine',eng?(fallback?x.fallback:(x[eng.effective]||eng.effective)):'',fallback);
 const note=document.getElementById('stNote');
 if(note){let txt='';if(fallback){const br=eng.breaker||{};txt=x.fallbackNote(reasonText(br.reason||'breaker'),br.retry_in_s?Math.max(1,Math.ceil(br.retry_in_s/60)):0)}else if(!s&&st.settingsErr)txt=x.noServer+': '+st.settingsErr;note.textContent=txt;note.hidden=!txt}
 set('stMode',s?(x[s.noise_mode]||s.noise_mode):'');
 const low=voice&&typeof voice.credits==='number'&&voice.credits<20000;
 set('stVoice',voice?(typeof voice.credits==='number'?x.credits(num(voice.credits)):x.noCredits):'',low);
 set('stSync',st.synced?fmtWhen(st.synced):(s&&s.quryltai_updated_at?String(s.quryltai_updated_at).replace('T',' ').slice(0,16):''));
 set('stVer',st.version);set('stScreen',innerWidth+'×'+innerHeight+' · DPR '+(window.devicePixelRatio||1));
 const r=st.robot;set('stApi',r?(r.api_ready?x.ready:x.notReady):(st.speech===null?'':(st.speech?x.ready:x.notReady)),r?!r.api_ready:false);
 set('stNet',st.online===null?'':(st.online?x.online:x.offline),st.online===false);
 document.querySelectorAll('.seg').forEach(g=>{const key=g.dataset.key;const cur=s?(key==='live_engine'?(eng&&eng.selected):s.noise_mode):null;
  g.classList.toggle('busy',st.busy);g.classList.toggle('off',!s);
  g.querySelectorAll('button').forEach(b=>{b.classList.toggle('on',!!cur&&b.dataset.v===cur);b.disabled=st.busy||!s})});
 const sw=document.getElementById('swStatus');if(sw){sw.textContent=st.busy?x.saving:(st.settingsErr?x.noServer+': '+st.settingsErr:'');sw.classList.toggle('warn',!!st.settingsErr&&!st.busy)}
 renderRobot()}
function renderRobot(){const x=t(),r=st.robot;
 set('robotBattery',r&&r.online?r.battery+'%':'');set('robotCharging',r&&r.online?(r.charging?x.yes:x.no):'');set('robotMap',r&&r.online?r.map:'');
 const places=(r&&r.places)||[];set('robotPlaces',r&&r.online?String(places.length):(r&&r.error?r.error:''));
 const sel=document.getElementById('robotPlace');
 if(sel){const keep=sel.value;const list=places.filter(n=>!/заряд|пополнен|charg/i.test(String(n)));  // служебные зарядные точки не показываем
  sel.innerHTML=list.length?list.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join(''):'<option value="">'+esc(x.noPlaces)+'</option>';
  if(keep&&list.indexOf(keep)>=0)sel.value=keep}
 const lt=r&&r.last_trip,e=document.getElementById('lastTrip');
 if(e){if(!lt){e.textContent='';e.hidden=true}else{const name=x.places[lt.place_id]||lt.place_id;const res=lt.result==='arrived'?x.arrived:lt.result==='stopped'?x.stopped:x.failed+(lt.reason?' ('+reasonText(lt.reason)+')':'');
  e.textContent=x.lastTrip+': '+name+' — '+res+(lt.seconds?', '+lt.seconds+' '+x.sec:'')+(lt.at?' · '+String(lt.at).replace('T',' ').slice(11,16):'');e.hidden=false}}}
function esc(v){return String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
window.addEventListener('resize',()=>render());
// --- сервер: настройки ---
window.onRobotSettings=json=>{let j=json;try{if(typeof j==='string')j=JSON.parse(j)}catch(e){j={error:String(json)}}
 st.busy=false;
 if(!j||j.error){st.settingsErr=String(j&&j.error||'?');if(st.pendingSave)toast(t().noServer+': '+st.settingsErr);st.pendingSave=false;render();return}
 st.settings=j;st.settingsErr='';if(st.pendingSave){st.pendingSave=false;toast(t().saved)}render()};
function setSetting(key,value){const s=st.settings;if(st.busy||!s)return;
 const cur=key==='live_engine'?(s.engine&&s.engine.selected):s.noise_mode;if(cur===value)return;
 if(!window.Robot||!Robot.setRobotSetting)return toast(t().onRobot);
 const doPost=()=>{st.busy=true;st.pendingSave=true;render();Robot.setRobotSetting(key,value)};
 if(window.askAdminPin)window.askAdminPin(doPost);else doPost()}
document.querySelectorAll('.seg').forEach(g=>g.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('button[data-v]'):null;if(!b||b.disabled)return;setSetting(g.dataset.key,b.dataset.v)}));
let timer=null;
function poll(){if(!window.Robot)return;if(Robot.refreshSettings)Robot.refreshSettings();if(Robot.getRobotSystemStatus)Robot.getRobotSystemStatus()}
function stopPoll(){if(timer){clearInterval(timer);timer=null}}
function startPoll(){stopPoll();poll();timer=setInterval(()=>{if(document.body.dataset.page!=='robot'){stopPoll();return}poll()},60000)}
const sh=show;show=function(id){const r=sh.apply(this,arguments);if(id==='robot')startPoll();else stopPoll();return r};
document.addEventListener('kurultai-face-shown',stopPoll);
// --- робот ---
window.onRobotInfo=json=>{let j=json;try{if(typeof j==='string')j=JSON.parse(j)}catch(e){j=null}st.robot=j||null;render()};
let motionArmed=false;
const arm=document.getElementById('motionArm');if(arm)arm.onchange=e=>{motionArmed=e.target.checked;set('motionStatus',motionArmed?t().armed:t().locked);if(!motionArmed&&window.Robot)Robot.stopMove()};
function startMotion(direction,e){if(e)e.preventDefault();if(!motionArmed)return toast(t().armFirst);if(window.Robot)Robot.move(direction)}
function stopMotion(e){if(e&&e.preventDefault)e.preventDefault();if(window.Robot)Robot.stopMove()}
document.querySelectorAll('[data-motion]').forEach(b=>{const d=b.dataset.motion;b.onmousedown=e=>startMotion(d,e);b.onmouseup=stopMotion;b.onmouseleave=stopMotion;b.ontouchstart=e=>startMotion(d,e);b.ontouchend=stopMotion;b.ontouchcancel=stopMotion});
const ms=document.getElementById('motionStop');if(ms)ms.onclick=stopMotion;
document.querySelectorAll('[data-head]').forEach(b=>b.onclick=()=>{if(!motionArmed)return toast(t().armFirst);const p=b.dataset.head.split(',').map(Number);if(window.Robot)Robot.moveHead(p[0],p[1])});
const nv=document.getElementById('navigateRobot');if(nv)nv.onclick=()=>{if(!motionArmed)return toast(t().armFirst);const v=(document.getElementById('robotPlace')||{}).value||'';if(!v)return toast(t().noPlaces);if(window.Robot)Robot.navigateTo(v)};
const hm=document.getElementById('homeRobot');if(hm)hm.onclick=()=>{if(!motionArmed)return toast(t().armFirst);if(window.Robot&&Robot.returnToPost)Robot.returnToPost();else toast(t().onRobot)};
const rf=document.getElementById('refreshRobot');if(rf)rf.onclick=poll;
const ch=document.getElementById('chargeRobot');if(ch)ch.onclick=()=>{if(!motionArmed)return toast(t().armFirst);if(window.Robot)Robot.returnToCharge()};
window.onMotionStatus=v=>{set('motionStatus',v)};window.onMotionError=v=>{set('motionStatus',v);toast(v)};
// --- сеть, голос RobotOS, версия (Java: onRobotStatus), данные quryltai.kz ---
const rs=window.onRobotStatus;window.onRobotStatus=(online,speech,state)=>{const s=String(state||'');const i=s.lastIndexOf(' · v');st.online=!!online;st.speech=!!speech;st.state=i>=0?s.slice(0,i):s;if(i>=0)st.version=s.slice(i+4);if(rs)rs(online,speech,state);render()};
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
let state='idle',live='',subQ='',subA='',guard=null,pressAt=0,shortTap=false,flash=null;
const norm=s=>(s==='listening'||s==='thinking'||s==='speaking')?s:'idle';
const L=()=>language==='kk'?TXT.kk:TXT.ru;
var vbBusyPrev=false;
// голосовая полоса занята (робот говорит / думает / слушает): страница плавно поднимается, чтобы карточки не прятались под ней
function vbFit(){const busy=state!=='idle';if(busy===vbBusyPrev)return;vbBusyPrev=busy;const m=document.querySelector('main'),dock=document.querySelector('.voice-dock');if(!m||!dock)return;if(!busy){m.scrollTo({top:0,behavior:'smooth'});return}const barTop=dock.getBoundingClientRect().top;const pb=parseFloat(getComputedStyle(m).paddingBottom)||0;const want=Math.max(0,Math.ceil(m.scrollHeight-pb-(barTop-24)));m.scrollTo({top:want,behavior:'smooth'})}
function render(){const t=L()[state];const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
 const q=subQ?'«'+subQ+'»':'';  // субтитры: вопрос посетителя и то, что робот говорит сейчас
 set('orbCaption',(state==='speaking'||state==='thinking')&&q?q:t[0]);
 set('orbHint',(state==='listening'&&(live||subQ))?(live||subQ).slice(-160):(state==='speaking'&&subA)?subA:(state==='thinking'&&q)?t[0]:t[1]);set('vbStatus',t[2]);
 set('vbFabLabel',flash?SHORT[language==='kk'?'kk':'ru']:L().idle[0]);
 const b=document.getElementById('voiceBanner');if(b){b.classList.toggle('listening',state==='listening');b.setAttribute('aria-label',t[0])}
 const o=document.getElementById('orbBtn');if(o){o.classList.toggle('listening',state==='listening');o.classList.toggle('thinking',state==='thinking');o.classList.toggle('speaking',state==='speaking')}
 const d=document.getElementById('voiceDock');if(d)d.className='voice-dock '+(state==='idle'?'active':state);document.documentElement.classList.toggle('voice-busy',state!=='idle');vbFit()}
setVoiceDock=function(s){const n=norm(s);if(n!==state){state=n;live='';if(n==='idle'){subQ='';subA=''}}
 clearTimeout(guard);
 // Safety nets so the bar can never stay stuck if a "finished" event is lost.
 if(n==='speaking')guard=setTimeout(()=>{if(state==='speaking')setVoiceDock('idle')},Math.min(120000,10000+String(typeof lastSpeech==='string'?lastSpeech:'').length*90));
 if(n==='thinking')guard=setTimeout(()=>{if(state==='thinking')setVoiceDock('idle')},60000);
 if(n!=='listening')clearTimeout(talkTimer);
 render()};
// ответ робота на лице (говорит/думает) — та же полоса внизу; тишина — полоса уходит
window.vbFromFace=s=>{if(s==='speaking')setVoiceDock('speaking');else if(s==='thinking')setVoiceDock('thinking');else if(state==='speaking'||state==='thinking')setVoiceDock('idle')};
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
window.vbSubtitle=(kind,t)=>{t=String(t||'').replace(/\s+/g,' ').trim();if(!t)return;if(kind==='heard'){subQ=t;subA=''}else subA=t;render()};
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
 ru:{brand:'ИИ-помощник Курултая',nav:['Главная','Законопроекты','План недели','Пленарное заседание','Комитеты и депутаты','Депутатские запросы','Робот и настройки'],src:'Официальные данные',upd:'обновлено',
  hero:'Добро пожаловать в Курултай Республики Казахстан',heroSub:'Просто начните говорить — или напишите вопрос в строке ниже',query:'Задайте вопрос о Курултае…',ask:'Спросить',
  quick:[['Что такое Курултай','Кратко об органе и его полномочиях'],['Состав комитетов','Какие комитеты и кто их возглавляет'],['Законопроекты этой недели','Что сейчас рассматривает Курултай'],['Как подать обращение','Куда и как обратиться гражданину']],
  today:'Сегодня',todaySub:'По плану Курултая',planT:'Последний опубликованный план',back:'На главную',askLabel:'ВЫ СПРОСИЛИ',fuTitle:'Можно спросить дальше',
  fu:['Какие комитеты есть в Курултае?','Чем Курултай отличается от прежнего Парламента?','Как подать обращение?'],asOf:'По данным на',src2:'Официальные данные Курултая',
  cmTitle:'Комитеты и депутаты',cmSub:n=>'В Курултае '+n+' постоянных комитетов. Выберите комитет, чтобы увидеть председателя и депутатов',cmCap:'СОСТАВ КОМИТЕТА',chairL:'Председатель комитета',chairP:'Председатель: ',member:'Член комитета',cmAsk:'Спросить помощника об этом комитете',cmQ:n=>'Расскажи о комитете Курултая: '+n,
  rqTitle:'Депутатские запросы',rqSub:'Официальные запросы депутатов в министерства и государственные органы — самые свежие сверху',rqCountL:'запросов всего',rqH:['ДАТА','ТЕМА','АВТОРЫ','НОМЕР'],
  billsT:'Законопроекты',billsCount:'законопроектов всего',billsSub:'Законопроекты, которые сейчас рассматривает Курултай, и на каком они этапе. Данные с quryltai.kz',billsH:['НОМЕР','НАЗВАНИЕ','СТАТУС'],planTitle:'План недели',planSub:'Заседания, встречи и мероприятия Курултая по неделям. Данные с quryltai.kz',planH:['ПЛАН','НАЗВАНИЕ','ИСТОЧНИК'],planRow:'План',lastPlan:'Последний опубликованный план:',
  plTitle:'Пленарное заседание',plSub:'Заседание, на котором собираются все депутаты Курултая: здесь обсуждают и принимают законопроекты',plWhatT:'Как проходит',plWhat:'Депутаты вместе рассматривают законопроекты в чтениях и голосуют. Итог каждого чтения — новый статус законопроекта',plWhenT:'Когда',plWhenNo:'Дата есть в плане недели Курултая',plDoneT:'Решения',plDone:'законопроектов одобрено или принято',plTableT:'Законопроекты с решениями пленарных заседаний',plH:['НОМЕР','НАЗВАНИЕ','РЕШЕНИЕ'],plAskT:'Спросите Ақылтая',plQ:['Когда ближайшее пленарное заседание?','Что рассматривали на последнем пленарном заседании?','Какие законопроекты вынесут на пленарное заседание?'],plEmpty:'Пока нет законопроектов с решениями',
  noData:'Данные ещё не загружены — нужно подключение к интернету',rbTitle:'Робот и настройки',review:'На рассмотрении',statusX:'Статус '},
 kk:{brand:'Құрылтайдың ЖИ-көмекшісі',nav:['Басты бет','Заң жобалары','Апта жоспары','Пленарлық отырыс','Комитеттер мен депутаттар','Депутаттық сауалдар','Робот және баптаулар'],src:'Ресми деректер',upd:'жаңартылды',
  hero:'Қазақстан Республикасының Құрылтайына қош келдіңіз',heroSub:'Жай ғана сөйлей бастаңыз — немесе сұрағыңызды төмендегі жолға жазыңыз',query:'Құрылтай туралы сұрақ қойыңыз…',ask:'Сұрау',
  quick:[['Құрылтай деген не','Орган және оның өкілеттіктері туралы қысқаша'],['Комитеттер құрамы','Қандай комитеттер бар және оларды кім басқарады'],['Осы аптадағы заң жобалары','Құрылтай қазір не қарап жатыр'],['Өтініш қалай беріледі','Азаматқа қайда және қалай жүгінуге болады']],
  today:'Бүгін',todaySub:'Құрылтай жоспары бойынша',planT:'Соңғы жарияланған жоспар',back:'Басты бетке',askLabel:'СІЗ СҰРАДЫҢЫЗ',fuTitle:'Тағы сұрауға болады',
  fu:['Құрылтайда қандай комитеттер бар?','Құрылтай бұрынғы Парламенттен немен ерекшеленеді?','Өтінішті қалай беруге болады?'],asOf:'Деректер күні:',src2:'Құрылтайдың ресми деректері',
  cmTitle:'Комитеттер мен депутаттар',cmSub:n=>'Құрылтайда '+n+' тұрақты комитет бар. Төрағасы мен депутаттарын көру үшін комитетті таңдаңыз',cmCap:'КОМИТЕТ ҚҰРАМЫ',chairL:'Комитет төрағасы',chairP:'Төраға: ',member:'Комитет мүшесі',cmAsk:'Осы комитет туралы көмекшіден сұрау',cmQ:n=>'Құрылтай комитеті туралы айтып бер: '+n,
  rqTitle:'Депутаттық сауалдар',rqSub:'Депутаттардың министрліктер мен мемлекеттік органдарға ресми сауалдары — ең жаңалары жоғарыда',rqCountL:'сауал барлығы',rqH:['КҮНІ','ТАҚЫРЫБЫ','АВТОРЛАРЫ','НӨМІРІ'],
  billsT:'Заң жобалары',billsCount:'заң жобасы барлығы',billsSub:'Құрылтай қазір қарап жатқан заң жобалары және олардың кезеңі. Деректер quryltai.kz сайтынан',billsH:['НӨМІРІ','АТАУЫ','МӘРТЕБЕСІ'],planTitle:'Апта жоспары',planSub:'Құрылтайдың апталық отырыстары, кездесулері мен іс-шаралары. Деректер quryltai.kz сайтынан',planH:['ЖОСПАР','АТАУЫ','ДЕРЕККӨЗ'],planRow:'Жоспар',lastPlan:'Соңғы жарияланған жоспар:',
  plTitle:'Пленарлық отырыс',plSub:'Құрылтайдың барлық депутаттары жиналатын отырыс: мұнда заң жобалары талқыланып, қабылданады',plWhatT:'Қалай өтеді',plWhat:'Депутаттар заң жобаларын оқылымдарда бірге қарап, дауыс береді. Әр оқылымның қорытындысы — заң жобасының жаңа мәртебесі',plWhenT:'Қашан',plWhenNo:'Күні Құрылтайдың апта жоспарында көрсетілген',plDoneT:'Шешімдер',plDone:'заң жобасы мақұлданды немесе қабылданды',plTableT:'Пленарлық отырыс шешім қабылдаған заң жобалары',plH:['НӨМІРІ','АТАУЫ','ШЕШІМ'],plAskT:'Ақылтайдан сұраңыз',plQ:['Жақын пленарлық отырыс қашан болады?','Соңғы пленарлық отырыста не қаралды?','Пленарлық отырысқа қандай заң жобалары шығарылады?'],plEmpty:'Әзірге шешім қабылданған заң жобалары жоқ',
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
 const bs=document.querySelector('.brand b');if(bs)bs.textContent='Ақылтай';const bsp=document.querySelector('.brand span');if(bsp)bsp.textContent=t.brand;
 const order=['home','bills','session','plenary','committees','requests','robot'];
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
 setT('rbTitle',t.rbTitle);const ex0=el('exitBtn');if(ex0)ex0.setAttribute('aria-label',language==='kk'?'Жабу':'Закрыть');
 renderSidebarSource();renderToday();renderFollowups();
 if(page==='committees')renderCommittees();if(page==='requests')renderRequests();if(page==='bills'||page==='session'||page==='plenary')renderList(page)}

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
 else if(kind==='plenary'){const done=d&&d.bills?d.bills.filter(b=>[6,12,7,8,9].indexOf(Number(b.status))>=0):[];
  const rows=done.slice(0,20).map(b=>['№ '+b.id,b.title,stName(b.status)]);
  const plan=d&&d.weekly_plans&&d.weekly_plans[0]?String(d.weekly_plans[0].title||'').replace(/\s+/g,' ').trim():'';
  const card=(icon,title,body,big)=>'<div class="pl-card"><i>'+icon+'</i><span>'+esc(title)+'</span>'+(big!=null?'<b>'+esc(big)+'</b>':'')+'<p>'+esc(body)+'</p></div>';
  const ic=p=>'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'+p+'</svg>';
  html='<div class="rq-head"><div class="pg-head"><h1>'+esc(t.plTitle)+'</h1><span>'+esc(t.plSub)+'</span></div></div>'+
   '<div class="pl-cards">'+card(ic('<path d="M3 21h18M5 21v-9M12 21v-9M19 21v-9M3 12h18L12 4z"/>'),t.plWhatT,t.plWhat)+
   card(ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),t.plWhenT,plan?t.lastPlan+' '+plan:t.plWhenNo)+
   card(ic('<path d="M5 12l5 5 9-10"/>'),t.plDoneT,t.plDone,d?done.length:'—')+'</div>'+
   '<div class="pl-ask"><span>'+esc(t.plAskT)+'</span><div>'+t.plQ.map(q=>'<button type="button">'+esc(q)+'</button>').join('')+'</div></div>'+
   '<h2 class="pl-h">'+esc(t.plTableT)+'</h2>'+(d&&!rows.length?'<div class="rq-empty">'+esc(t.plEmpty)+'</div>':tableHtml(t.plH,rows,'cols3'))}
 else{const rows=d&&d.weekly_plans?d.weekly_plans.map(p=>[t.planRow,String(p.title||'').replace(/\s+/g,' ').trim(),'quryltai.kz']):[];
  const last=rows[0]?'<div class="plan-last"><b>'+esc(t.lastPlan)+'</b> '+esc(rows[0][1])+'</div>':'';
  html='<div class="rq-head"><div class="pg-head"><h1>'+esc(t.planTitle)+'</h1><span>'+esc(t.planSub)+'</span></div></div>'+last+tableHtml(t.planH,rows,'cols3')}
 const c=el('listContent');if(c){c.innerHTML=html;c.querySelectorAll('.pl-ask button').forEach(b=>b.onclick=()=>askNow(b.textContent));
  if(kind!=='session'){const grp={5:'review',6:'step',12:'step',7:'done',8:'done',9:'done',10:'off',13:'off',11:'off'};const name={};[5,6,12,7,8,9,10,13,11].forEach(k=>{name[stName(k)]=grp[k]});c.querySelectorAll('.rq-body .rq-row .n').forEach(n=>{const g=name[n.textContent];if(g){n.classList.add('st-'+g);n.parentNode.classList.add('row-'+g)}});addLegend(c)}}}
function addLegend(c){const kk=language==='kk';const lab={review:kk?'Қаралуда':'На рассмотрении',step:kk?'Оқылымда, жұмыс жалғасуда':'В работе, идут чтения',done:kk?'Қабылданды немесе қол қойылды':'Принят или подписан',off:kk?'Кері қайтарылды немесе қабылданбады':'Отозван или отклонён'};
 const have=['review','step','done','off'].filter(g=>c.querySelector('.rq-row.row-'+g));const h=c.querySelector('.pg-head');if(!have.length||!h)return;
 const L=document.createElement('div');L.className='st-legend';L.innerHTML=have.map(g=>'<span class="lg lg-'+g+'"><i></i>'+esc(lab[g])+'</span>').join('');h.appendChild(L)}
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
 if(p==='bills'||p==='session'||p==='plenary'){renderList(p);show('listPage');page=p;return}
 if(p==='committees'){renderCommittees();show('committees');return}
 if(p==='requests'){renderRequests();show('requests');return}}
document.querySelectorAll('.nav').forEach(n=>{if(n.dataset.page==='robot')return;n.onclick=()=>go(n.dataset.page)});
// 2026-11-07: «×» в правом верхнем углу — закрыть страницы и вернуться к лицу робота (под лицом — главная)
const ex=el('exitBtn');if(ex)ex.onclick=()=>{if(window.Robot&&window.Robot.exitApp){window.Robot.exitApp();return}go('home');if(window.showFace)window.showFace()};
document.querySelectorAll('.quick').forEach(c=>c.onclick=()=>{const a=c.dataset.act;if(a==='committees')return go('committees');if(a==='bills')return go('bills');askNow(language==='kk'?c.dataset.qKk:c.dataset.qRu)});

// Answer screen: question as the heading, date chip under the answer, follow-up questions
const ans=answer;answer=function(title,prompt,html,speech){const r=ans.apply(this,arguments);setActive('');
 const art=document.querySelector('#answerBody article,#answerBody .result-card');
 if(art&&!art.querySelector('.ans-meta')){const m=document.createElement('div');m.className='ans-meta';m.innerHTML='<span>'+'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg>'+esc(T().asOf+' '+fmtDay(new Date()))+'</span><span>'+'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d=\"M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z\"/></svg>'+esc(T().src2)+'</span>';art.appendChild(m)}
 renderFollowups();return r};

// The connection badge lives in the title row of "Robot and settings"
const badge=el('connectionBadge'),slot=el('rbBadgeSlot');if(badge&&slot)slot.appendChild(badge);

// Re-render when fresh data from quryltai.kz arrives and when the language changes
const qd=window.onQuryltaiData;window.onQuryltaiData=function(){const r=qd?qd.apply(this,arguments):undefined;renderSidebarSource();renderToday();if(page==='committees')renderCommittees();if(page==='requests')renderRequests();if((page==='bills'||page==='session'||page==='plenary')&&document.body.dataset.page==='listPage')renderList(page);return r};
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
