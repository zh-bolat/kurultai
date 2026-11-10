/* Лицо робота — первый экран, как у Astana Hub (глаза и выражения — из прототипа mynbay robot-mvp.html v9).
 * Свайп влево — основная страница; свайп вправо по странице, кнопка «‹ лицо» или минута без касаний — обратно.
 * Сон как у Astana Hub: после запуска спит; тап по лицу — проснуться, поздороваться и слушать; двойной тап — уснуть;
 * сам засыпает через 5 минут без разговора (решает приложение). Камера разговор не начинает.
 * Робот → лицо: onFaceState(state), onFacePhrase(text), onFaceHeard(text), onFaceEmotion(name), onVoiceLevel(lvl, robot).
 */
;(function () {
  const TXT = {
    ru: { sleep: 'Сплю', idle: 'Слушаю', listening: 'Слушаю', user_speaking: 'Слушаю вас', thinking: 'Думаю', speaking: 'Говорю',
      wakeHint: 'Коснитесь экрана, чтобы разбудить', menu: 'Меню', menuSub: 'Проведите влево', face: 'лицо' },
    kk: { sleep: 'Ұйықтап жатырмын', idle: 'Тыңдап тұрмын', listening: 'Тыңдап тұрмын', user_speaking: 'Сізді тыңдап тұрмын', thinking: 'Ойланып жатырмын',
      speaking: 'Сөйлеп тұрмын', wakeHint: 'Ояту үшін экранды түртіңіз', menu: 'Мәзір', menuSub: 'Солға сырғытыңыз', face: 'бет' },
  };
  const lang = () => (typeof language !== 'undefined' && language === 'kk') ? 'kk' : 'ru';
  const t = k => TXT[lang()][k];

  /* --- глаза: выражения прототипа (viewBox 200×100), цвет — currentColor (#3AA8F5) --- */
  const X2 = [50, 150];
  const g = (body, cls) => `<g class="look"><g class="eyes ${cls || ''}" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</g></g>`;
  const each = f => X2.map((x, i) => f(x, i)).join('');
  const hl = (x, cy, rx, ry) => `<ellipse cx="${x - rx * 0.36}" cy="${cy - ry * 0.4}" rx="${rx * 0.22}" ry="${ry * 0.17}" fill="#CDEFFF" stroke="none" opacity=".75"/>`;
  const EXPR = {
    neutral: () => g(each(x => `<ellipse cx="${x}" cy="50" rx="18" ry="22" stroke="none"/>${hl(x, 50, 18, 22)}`), 'bl'),
    listen: () => g(each(x => `<ellipse cx="${x}" cy="50" rx="21" ry="26" stroke="none"/>${hl(x, 50, 21, 26)}`), 'bl'),
    speak: () => g(each(x => `<ellipse cx="${x}" cy="50" rx="18" ry="22" stroke="none"/>${hl(x, 50, 18, 22)}`), 'bl talk'),
    think: () => g(each(x => `<rect x="${x - 17}" y="46" width="34" height="9" rx="2" stroke="none"/>`) + `<text x="180" y="34" text-anchor="middle" font-size="26" font-weight="800" font-family="Nunito, sans-serif" stroke="none">?</text>`),
    wide: () => g(each(x => `<ellipse cx="${x}" cy="50" rx="21" ry="26" stroke="none"/>${hl(x, 50, 21, 26)}`) + `<path d="M28 26 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" stroke="none"/>`, 'bl'),
    happy: () => g(each(x => `<path d="M${x - 15} 58 L${x} 43 L${x + 15} 58" fill="none" stroke-width="8"/>`)),
    sparkle: () => g(each(x => `<path d="M${x} 26 Q${x + 3} 47 ${x + 12} 50 Q${x + 3} 53 ${x} 74 Q${x - 3} 53 ${x - 12} 50 Q${x - 3} 47 ${x} 26Z" stroke="none"/>`)),
    sad: () => g(`<rect x="30" y="48" width="36" height="8" rx="2" stroke="none"/><rect x="132" y="48" width="36" height="8" rx="2" stroke="none"/><path d="M162 60 q8 11 0 16 q-8 -5 0 -16z" stroke="none"/>`),
    blush: () => `<defs><filter id="fz" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>`
      + `<ellipse cx="32" cy="70" rx="16" ry="8" fill="#FF2D3D" opacity=".7" filter="url(#fz)"/><ellipse cx="168" cy="70" rx="16" ry="8" fill="#FF2D3D" opacity=".7" filter="url(#fz)"/>`
      + g(each(x => `<path d="M${x - 18} 52 Q${x} 38 ${x + 18} 52" fill="none" stroke-width="6"/>`)),
    wink: () => g(`<ellipse cx="50" cy="50" rx="18" ry="22" stroke="none"/>${hl(50, 50, 18, 22)}<path d="M162 34 L140 50 L162 66" fill="none" stroke-width="8"/>`),
    sleep: () => g(each(x => `<path d="M${x - 18} 48 Q${x} 62 ${x + 18} 48" fill="none" stroke-width="6"/>`)
      + `<circle class="zz" cx="174" cy="28" r="5" fill="none" stroke-width="2.5"/><circle class="zz z2" cx="186" cy="16" r="3" fill="none" stroke-width="2"/>`),
  };
  const EMOTION = { happy: 'happy', excited: 'sparkle', surprised: 'wide', sad: 'sad', thinking: 'think', neutral: null };
  const STATE_EXPR = { sleep: 'sleep', idle: 'neutral', listening: 'listen', user_speaking: 'listen', thinking: 'think', speaking: 'speak' };

  /* --- разметка --- */
  const root = document.createElement('div');
  root.id = 'faceScreen';
  root.innerHTML = '<div class="face-eyes"><svg viewBox="0 0 200 100" aria-hidden="true"></svg></div>'
    + '<div class="face-status" id="faceStatusLine"></div><div class="face-heard" id="faceHeardLine"></div>'
    + '<p class="face-sub" id="faceSubLine" aria-live="polite"></p>'
    + '<div class="swipe-hint" aria-hidden="true"><svg viewBox="0 0 24 48"><path d="M17 6 L7 24 L17 42" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg><b id="faceMenuLabel"></b></div>'
    + '<div class="face-sleep-hint" id="faceSleepHint"></div>'
    + '<div class="face-lang" id="faceLang"><button type="button" data-l="kk">ҚАЗ</button><i></i><button type="button" data-l="ru">РУС</button></div>';
  // 2026-11-07: надпись «сплю» не показываем; подсказка внизу сама чередуется қазақша ↔ по-русски каждые 6 секунд;
  // переключатель ҚАЗ|РУС — внизу по центру, тонким текстом без рамки.
  document.body.appendChild(root);
  const toFace = document.createElement('button');
  toFace.id = 'toFace';
  toFace.type = 'button';
  toFace.hidden = true;
  document.body.appendChild(toFace);
  const svg = root.querySelector('svg'), statusLine = root.querySelector('#faceStatusLine'),
    heardLine = root.querySelector('#faceHeardLine'), subLine = root.querySelector('#faceSubLine');

  let hintLang = 'kk';
  setInterval(() => {  // подсказка сна и «Мәзір / Меню» чередуют язык вместе
    const fading = root.querySelectorAll('#faceSleepHint, #faceMenuLabel');
    fading.forEach(e => e.classList.add('fade'));
    setTimeout(() => { hintLang = hintLang === 'kk' ? 'ru' : 'kk'; render(); fading.forEach(e => e.classList.remove('fade')); }, 400);
  }, 6000);

  let state = 'sleep', mood = null, moodTimer = null, shownExpr = '', level = 0, lastTouch = Date.now(), subTimer = null;

  function render() {
    try { renderNav(); } catch (e) { /* баннер ещё не создан */ }  // баннер поездки — на языке экрана
    root.querySelectorAll('#faceLang button').forEach(b => b.classList.toggle('on', b.getAttribute('data-l') === lang()));
    const x = mood || STATE_EXPR[state] || 'neutral';
    if (x !== shownExpr) { svg.innerHTML = EXPR[x](); shownExpr = x; }
    root.classList.toggle('asleep', state === 'sleep');
    statusLine.textContent = state === 'sleep' ? '' : (t(state) || '');
    root.querySelector('#faceSleepHint').textContent = state === 'sleep' ? TXT[hintLang].wakeHint : '';
    root.querySelector('#faceMenuLabel').textContent = TXT[hintLang].menu;
    toFace.innerHTML = '›<small>' + t('face') + '</small>';
  }

  /* моргание и взгляды — как в прототипе */
  (function blinkLoop() {
    if (state !== 'sleep' && state !== 'thinking' && !mood) {
      root.classList.remove('blink'); void root.offsetWidth; root.classList.add('blink');
      if (Math.random() < 0.2) setTimeout(() => { root.classList.remove('blink'); void root.offsetWidth; root.classList.add('blink'); }, 260);
    }
    setTimeout(blinkLoop, 2600 + Math.random() * 3200);
  })();
  (function glanceLoop() {
    const look = svg.querySelector('.look');
    if (look) {
      if (state === 'idle' || state === 'speaking') {
        const r = Math.random(), x = r < 0.3 ? -8 : r < 0.6 ? 8 : 0;
        look.style.setProperty('--gx', x + 'px'); look.style.setProperty('--gy', (x && Math.random() < 0.4 ? 2 : 0) + 'px');
        if (x) setTimeout(() => { look.style.setProperty('--gx', '0px'); look.style.setProperty('--gy', '0px'); }, 900 + Math.random() * 700);
      } else { look.style.setProperty('--gx', '0px'); look.style.setProperty('--gy', '0px'); }
    }
    setTimeout(glanceLoop, 3500 + Math.random() * 3500);
  })();
  /* речь: глаза чуть сжимаются в такт голосу робота; слушает — чуть «тянутся» к голосу посетителя */
  (function levelLoop() {
    const eyes = svg.querySelector('.eyes');
    if (eyes) {
      level *= 0.85;
      const k = state === 'speaking' ? 1 - Math.min(0.28, level / 260) : state === 'user_speaking' ? 1 + Math.min(0.12, level / 600) : 1;
      eyes.style.transform = k === 1 ? '' : 'scaleY(' + k.toFixed(3) + ')';
    }
    requestAnimationFrame(levelLoop);
  })();

  /* --- вход от робота --- */
  window.onFaceState = s => {
    state = STATE_EXPR[s] ? s : 'idle';
    if (window.vbFromFace) window.vbFromFace(s);
    if (state === 'sleep') { subLine.textContent = ''; heardLine.textContent = ''; showFace(); }
    if (state === 'listening') heardLine.textContent = '';
    render();
  };
  window.onFacePhrase = text => {
    if (window.vbSubtitle) window.vbSubtitle('say', text);  // субтитры — в нижней полосе страницы
    return; // на самом лице субтитров нет
    subLine.textContent = String(text || '');
    clearTimeout(subTimer);
    subTimer = setTimeout(() => { if (state !== 'speaking') subLine.textContent = ''; }, 6000);
  };
  window.onFaceHeard = text => { if (window.vbSubtitle) window.vbSubtitle('heard', text); }; // вопрос — в нижней полосе, не на лице
  window.onFaceEmotion = name => {
    const x = EMOTION[name];
    clearTimeout(moodTimer);
    mood = x || null;
    render();
    if (mood) moodTimer = setTimeout(() => { mood = null; render(); }, 2200);
  };
  const prevLevel = window.onVoiceLevel;
  window.onVoiceLevel = (lvl, robot) => { if (prevLevel) prevLevel(lvl, robot); level = Math.max(level, Number(lvl) || 0); };

  /* --- поездка «проводить» (docs/kurultai/navigation.md): баннер поверх лица, тап по нему или по лицу — стоп.
     Java → window.onNavigation({navigating, place_id, map_name, auto, result, reason}); слой 9100 (лицо 9000, PIN 9500). --- */
  const PLACES = {  // place_id контракта → имя для баннера; home — пост робота (авто-возврат)
    museum: { ru: 'Музей Курултая', kk: 'Құрылтай мұражайы' },
    restroom: { ru: 'Туалет', kk: 'Дәретхана' },
    wardrobe: { ru: 'Гардероб', kk: 'Гардероб' },
    lobby: { ru: 'Холл', kk: 'Холл' },
    invitation_room: { ru: 'Комната для приглашённых', kk: 'Шақырылғандар бөлмесі' },
    reception: { ru: 'Пункт приёма', kk: 'Қабылдау пункті' },
    home: { ru: 'Пост робота', kk: 'Робот орны' },
  };
  const NAV_TXT = {
    ru: { going: 'Еду: ', home: 'Возвращаюсь на место', stop: 'нажмите, чтобы остановить' },
    kk: { going: 'Бара жатырмын: ', home: 'Орныма қайтамын', stop: 'тоқтату үшін басыңыз' },
  };
  const navBar = document.createElement('div');
  navBar.id = 'faceNav';
  navBar.hidden = true;
  navBar.innerHTML = '<b id="faceNavTitle"></b><small id="faceNavHint"></small>';
  document.body.appendChild(navBar);
  let navigating = false, navInfo = null;
  function renderNav() {
    if (!navigating || !navInfo) { navBar.hidden = true; return; }
    const L = lang(), tx = NAV_TXT[L], p = PLACES[navInfo.place_id];
    const name = p ? p[L] : (navInfo.map_name || navInfo.place_id || '');
    navBar.querySelector('#faceNavTitle').textContent = navInfo.auto || navInfo.place_id === 'home' ? tx.home : tx.going + name;
    navBar.querySelector('#faceNavHint').textContent = tx.stop;
    navBar.hidden = false;
  }
  window.onNavigation = info => {
    try { if (typeof info === 'string') info = JSON.parse(info); } catch (e) { info = null; }
    navInfo = info || null;
    navigating = !!(info && info.navigating);
    if (navigating) showFace();  // поездка идёт с лица: баннер и глаза
    renderNav();
  };
  function stopNavigation() { if (window.Robot && Robot.stopNavigation) Robot.stopNavigation(); }
  // касания баннера не доходят до лица (иначе тап разбудил бы/усыпил), сам баннер — «стоп»
  ['touchstart', 'touchmove', 'pointerdown', 'mousedown'].forEach(type => navBar.addEventListener(type, e => e.stopPropagation(), { passive: true }));
  let navTapAt = 0;
  const navTap = e => { e.stopPropagation(); const now = Date.now(); if (now - navTapAt < 600) return; navTapAt = now; stopNavigation(); };
  navBar.addEventListener('touchend', navTap, { passive: true });
  navBar.addEventListener('click', navTap);

  /* --- лицо ↔ страница --- */
  function showFace() {
    root.classList.remove('hidden', 'dragging'); root.style.transform = ''; toFace.hidden = true; document.documentElement.classList.add('face-on');
    // лицо показано (таймер, свайп, кнопка, сон) — окно PIN и открытая вкладка настроек закрываются (pin.js)
    try { const ev = document.createEvent('Event'); ev.initEvent('kurultai-face-shown', false, false); document.dispatchEvent(ev); } catch (e) { /* старый WebView */ }
  }
  function showMenu() { root.classList.remove('dragging'); root.style.transform = ''; root.classList.add('hidden'); toFace.hidden = false; lastTouch = Date.now(); document.documentElement.classList.remove('face-on'); }
  window.showFace = showFace;
  document.documentElement.classList.add('face-on');
  toFace.onclick = () => showFace();

  /* Ввод: на роботе старый WebView без Pointer Events — поэтому touch-события в первую очередь, pointer и mouse — запасные.
     Одно касание обрабатывается один раз (после touch браузер может прислать ещё и mouse/pointer — их пропускаем). */
  const HAS_TOUCH = 'ontouchstart' in window, HAS_POINTER = !!window.PointerEvent;
  let lastTouchEndAt = 0;
  function pointFrom(e) {
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
    return { x: t.clientX, y: t.clientY };
  }
  function bind(el, onStart, onMove, onEnd, onCancel) {
    if (HAS_TOUCH) {
      el.addEventListener('touchstart', e => onStart(pointFrom(e), e), { passive: true });
      el.addEventListener('touchmove', e => onMove(pointFrom(e), e), { passive: true });
      el.addEventListener('touchend', e => { lastTouchEndAt = Date.now(); onEnd(pointFrom(e), e); }, { passive: true });
      el.addEventListener('touchcancel', e => onCancel(e), { passive: true });
    }
    const skip = () => HAS_TOUCH && Date.now() - lastTouchEndAt < 800;
    if (HAS_POINTER) {
      el.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && HAS_TOUCH) return; try { el.setPointerCapture(e.pointerId); } catch (_) {} if (!skip()) onStart(pointFrom(e), e); });
      el.addEventListener('pointercancel', e => { if (e.pointerType === 'touch' && HAS_TOUCH) return; onCancel(e); });
      el.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && HAS_TOUCH) return; onMove(pointFrom(e), e); });
      el.addEventListener('pointerup', e => { if (e.pointerType === 'touch' && HAS_TOUCH) return; if (!skip()) onEnd(pointFrom(e), e); });
    } else {
      el.addEventListener('mousedown', e => { if (!skip()) onStart(pointFrom(e), e); });
      el.addEventListener('mousemove', e => onMove(pointFrom(e), e));
      el.addEventListener('mouseup', e => { if (!skip()) onEnd(pointFrom(e), e); });
    }
  }

  /* жесты на лице: свайп влево — меню (палец ведёт экран, хватает короткого быстрого взмаха);
     тап — спит: проснуться и поздороваться; двойной тап — уснуть */
  let x0 = 0, y0 = 0, lastX = 0, lastT = 0, vx = 0, k = 1, dragging = false, moved = false, lastTap = 0, tapTimer = null;
  const SWIPE_DIST = () => window.innerWidth * 0.08, FLICK_V = 0.35; // px/мс
  function onTap() {
    const now = Date.now();
    if (now - lastTap < 380) {               // двойной тап — уснуть
      clearTimeout(tapTimer); lastTap = 0;
      if (window.Robot && Robot.sleepNow) Robot.sleepNow();
      return;
    }
    lastTap = now;
    tapTimer = setTimeout(() => {
      if (navigating) {  // тап по лицу в поездке — стоп; во сне (авто-возврат) — ещё и обычное пробуждение
        stopNavigation();
        if (state === 'sleep') { notice(''); if (window.Robot && Robot.wakeUp) Robot.wakeUp(); }
        return;
      }
      if (state === 'sleep') { notice(''); if (window.Robot && Robot.wakeUp) Robot.wakeUp(); }
      else window.onFaceEmotion('happy');
    }, 380);
  }
  bind(root, p => {
    x0 = lastX = p.x; y0 = p.y; lastT = Date.now(); vx = 0; dragging = true;
    k = root.offsetWidth ? (root.getBoundingClientRect().width / root.offsetWidth) || 1 : 1; // страница масштабирована — экран идёт ровно за пальцем
    moved = false; root.classList.add('dragging');
  }, p => {
    if (!dragging) return;
    const now = Date.now(), dx = p.x - x0, dy = p.y - y0;
    if (now > lastT) vx = 0.7 * vx + 0.3 * ((p.x - lastX) / (now - lastT));
    lastX = p.x; lastT = now;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) moved = true;
    if (dx < 0 && Math.abs(dx) > Math.abs(dy) * 0.6) root.style.transform = 'translate3d(' + (dx / k) + 'px,0,0)';
  }, p => {
    if (!dragging) return;
    dragging = false;
    const dx = (p.x == null ? lastX : p.x) - x0, dy = (p.y == null ? y0 : p.y) - y0;
    root.classList.remove('dragging');
    if (moved && Math.abs(dx) > Math.abs(dy) * 0.6 && (dx < -SWIPE_DIST() || (vx < -FLICK_V && dx < -20))) { showMenu(); return; }
    root.style.transform = '';
    if (!moved) onTap();
  }, () => { dragging = false; root.classList.remove('dragging'); root.style.transform = ''; });

  /* сообщения на лице (ошибки связи, «сервер недоступен») — раньше toast прятался под лицом */
  let noticeTimer = null;
  function notice(text) {
    clearTimeout(noticeTimer);
    const el = root.querySelector('#faceSleepHint');
    if (!text) { render(); return; }
    el.textContent = String(text);
    el.style.color = '#ffb4b4';
    noticeTimer = setTimeout(() => { el.style.color = ''; render(); }, 7000);
  }
  window.onFaceNotice = notice;

  /* на странице: свайп вправо — к лицу; минута без касаний — к лицу */
  let px = 0, py = 0;
  const pageStart = p => { lastTouch = Date.now(); px = p.x; py = p.y; };
  const pageEnd = p => {
    if (!root.classList.contains('hidden')) return;
    const dx = p.x - px, dy = p.y - py;
    if (dx > window.innerWidth * 0.12 && Math.abs(dy) < Math.abs(dx) * 0.6) showFace();
  };
  if (HAS_TOUCH) {
    document.addEventListener('touchstart', e => pageStart(pointFrom(e)), { capture: true, passive: true });
    document.addEventListener('touchend', e => pageEnd(pointFrom(e)), { capture: true, passive: true });
  } else {
    document.addEventListener(HAS_POINTER ? 'pointerdown' : 'mousedown', e => pageStart(pointFrom(e)), true);
    document.addEventListener(HAS_POINTER ? 'pointerup' : 'mouseup', e => pageEnd(pointFrom(e)), true);
  }
  setInterval(() => { if (root.classList.contains('hidden') && Date.now() - lastTouch > 60000) showFace(); }, 5000);

  /* Язык экрана (ҚАЗ|РУС) — робот отвечает на нём. fromRobot — сервер сам перешёл на язык фразы, обратно не сообщаем. */
  window.setUiLanguage = (l, fromRobot) => {
    if ((l !== 'ru' && l !== 'kk') || typeof language === 'undefined') return;
    if (l !== language) {
      language = l; questionLanguage = l;
      try { localStorage.language = l; } catch (e) {}
      if (typeof applyUiLanguage === 'function') applyUiLanguage();
    }
    render();
    if (!fromRobot && window.Robot && Robot.setUiLanguage) Robot.setUiLanguage(l);
  };
  /* переключатель на лице: свои касания гасит, чтобы лицо не приняло их за тап (разбудить) или свайп */
  const langBox = root.querySelector('#faceLang');
  ['touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'mouseup'].forEach(type =>
    langBox.addEventListener(type, e => e.stopPropagation(), { passive: true }));
  langBox.addEventListener('click', e => {
    e.stopPropagation();
    const b = e.target && e.target.closest ? e.target.closest('button[data-l]') : null;
    if (b) window.setUiLanguage(b.getAttribute('data-l'));
  });

  const ul = typeof applyUiLanguage === 'function' ? applyUiLanguage : null;
  if (ul) applyUiLanguage = function () { const r = ul.apply(this, arguments); render(); return r; };
  render();
  if (window.Robot && Robot.setUiLanguage && typeof language !== 'undefined') Robot.setUiLanguage(language);  // язык экрана → робот
})();
