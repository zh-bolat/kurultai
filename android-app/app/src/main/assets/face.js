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
    + '<div class="swipe-hint" aria-hidden="true"><span class="chev"><i>‹</i><i>‹</i><i>‹</i></span><b id="faceMenuLabel"></b><small id="faceMenuSub"></small></div>'
    + '<div class="face-sleep-hint" id="faceSleepHint"></div>';
  document.body.appendChild(root);
  const toFace = document.createElement('button');
  toFace.id = 'toFace';
  toFace.type = 'button';
  toFace.hidden = true;
  document.body.appendChild(toFace);
  const svg = root.querySelector('svg'), statusLine = root.querySelector('#faceStatusLine'),
    heardLine = root.querySelector('#faceHeardLine'), subLine = root.querySelector('#faceSubLine');

  let state = 'sleep', mood = null, moodTimer = null, shownExpr = '', level = 0, lastTouch = Date.now(), subTimer = null;

  function render() {
    const x = mood || STATE_EXPR[state] || 'neutral';
    if (x !== shownExpr) { svg.innerHTML = EXPR[x](); shownExpr = x; }
    root.classList.toggle('asleep', state === 'sleep');
    statusLine.textContent = t(state) || '';
    root.querySelector('#faceSleepHint').textContent = state === 'sleep' ? t('wakeHint') : '';
    root.querySelector('#faceMenuLabel').textContent = t('menu');
    root.querySelector('#faceMenuSub').textContent = t('menuSub');
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
    if (state === 'sleep') { subLine.textContent = ''; heardLine.textContent = ''; showFace(); }
    if (state === 'listening') heardLine.textContent = '';
    render();
  };
  window.onFacePhrase = text => {
    return; // субтитры на лице убраны
    subLine.textContent = String(text || '');
    clearTimeout(subTimer);
    subTimer = setTimeout(() => { if (state !== 'speaking') subLine.textContent = ''; }, 6000);
  };
  window.onFaceHeard = () => {}; // «услышанное» на лице убрано
  window.onFaceEmotion = name => {
    const x = EMOTION[name];
    clearTimeout(moodTimer);
    mood = x || null;
    render();
    if (mood) moodTimer = setTimeout(() => { mood = null; render(); }, 2200);
  };
  const prevLevel = window.onVoiceLevel;
  window.onVoiceLevel = (lvl, robot) => { if (prevLevel) prevLevel(lvl, robot); level = Math.max(level, Number(lvl) || 0); };

  /* --- лицо ↔ страница --- */
  function showFace() { root.classList.remove('hidden', 'dragging'); root.style.transform = ''; toFace.hidden = true; }
  function showMenu() { root.classList.remove('dragging'); root.style.transform = ''; root.classList.add('hidden'); toFace.hidden = false; lastTouch = Date.now(); }
  window.showFace = showFace;
  toFace.onclick = () => showFace();

  /* жесты на лице: свайп влево — меню (лёгкий: палец ведёт экран, хватает короткого быстрого взмаха);
     тап — разбудить; двойной тап — уснуть */
  let x0 = 0, y0 = 0, t0 = 0, lastX = 0, lastT = 0, vx = 0, dragging = false, moved = false, lastTap = 0, tapTimer = null;
  const SWIPE_DIST = () => window.innerWidth * 0.08, FLICK_V = 0.35; // px/мс
  root.addEventListener('pointerdown', e => {
    x0 = lastX = e.clientX; y0 = e.clientY; t0 = lastT = performance.now(); vx = 0; dragging = true; moved = false;
    root.classList.add('dragging');
    try { root.setPointerCapture(e.pointerId); } catch (_) {}
  });
  root.addEventListener('pointermove', e => {
    if (!dragging) return;
    const now = performance.now(), dx = e.clientX - x0, dy = e.clientY - y0;
    if (now > lastT) vx = 0.7 * vx + 0.3 * ((e.clientX - lastX) / (now - lastT));
    lastX = e.clientX; lastT = now;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) moved = true;
    if (dx < 0 && Math.abs(dx) > Math.abs(dy) * 0.6) root.style.transform = 'translate3d(' + dx + 'px,0,0)';
  });
  const end = e => {
    if (!dragging) return;
    dragging = false;
    const dx = (e.clientX || lastX) - x0, dy = (e.clientY || y0) - y0;
    root.classList.remove('dragging');
    const horizontal = Math.abs(dx) > Math.abs(dy) * 0.6;
    if (moved && horizontal && (dx < -SWIPE_DIST() || (vx < -FLICK_V && dx < -20))) { showMenu(); return; }
    root.style.transform = '';
    if (moved) return;
    const now = Date.now();
    if (now - lastTap < 380) {               // двойной тап — уснуть
      clearTimeout(tapTimer); lastTap = 0;
      if (window.Robot && Robot.sleepNow) Robot.sleepNow();
      return;
    }
    lastTap = now;
    tapTimer = setTimeout(() => {            // одиночный тап: спит — проснуться и поздороваться, не спит — улыбнуться
      if (state === 'sleep') { if (window.Robot && Robot.wakeUp) Robot.wakeUp(); }
      else window.onFaceEmotion('happy');
    }, 380);
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', () => { dragging = false; root.classList.remove('dragging'); root.style.transform = ''; });

  /* на странице: свайп вправо — к лицу; минута без касаний — к лицу */
  let px = 0, py = 0;
  document.addEventListener('pointerdown', e => { lastTouch = Date.now(); px = e.clientX; py = e.clientY; }, true);
  document.addEventListener('pointerup', e => {
    if (!root.classList.contains('hidden')) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    if (dx > window.innerWidth * 0.12 && Math.abs(dy) < Math.abs(dx) * 0.6) showFace();
  }, true);
  setInterval(() => { if (root.classList.contains('hidden') && Date.now() - lastTouch > 60000) showFace(); }, 5000);

  const ul = typeof applyUiLanguage === 'function' ? applyUiLanguage : null;
  if (ul) applyUiLanguage = function () { const r = ul.apply(this, arguments); render(); return r; };
  render();
})();
