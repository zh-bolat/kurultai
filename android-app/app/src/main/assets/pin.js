/* PIN на вкладку «Робот и настройки» (2026-10-30). PIN сверяет приложение (Robot.checkAdminPin), в JS его нет.
 * После верного PIN вкладка открыта 5 минут; ушли на лицо — снова закрыта. */
;(function () {
  if (typeof show !== 'function') return;
  const TXT = { ru: { title: 'Робот и настройки', sub: 'Введите PIN', wrong: 'Неверный PIN', cancel: 'Отмена' },
    kk: { title: 'Робот және баптаулар', sub: 'PIN енгізіңіз', wrong: 'PIN қате', cancel: 'Болдырмау' } };
  const t = k => TXT[(typeof language !== 'undefined' && language === 'kk') ? 'kk' : 'ru'][k];
  const need = () => !!(window.Robot && Robot.adminPinRequired && Robot.adminPinRequired());
  let unlockedUntil = 0;
  const css = document.createElement('style');
  css.textContent = '#pinPad{position:fixed;inset:0;z-index:9500;background:rgba(6,14,28,.78);display:flex;align-items:center;justify-content:center}'
    + '#pinPad .card{background:#fff;border-radius:28px;padding:30px 34px;width:420px;box-shadow:0 20px 60px rgba(0,0,0,.35);text-align:center;font-family:"Golos Text","Inter",system-ui,sans-serif}'
    + '#pinPad h3{margin:0 0 6px;font-size:26px;color:#182642}#pinPad p{margin:0 0 16px;color:#68748a;font-size:18px}'
    + '#pinPad .dots{display:flex;gap:14px;justify-content:center;margin:6px 0 18px}#pinPad .dots i{width:18px;height:18px;border-radius:50%;border:2px solid #268fc8}'
    + '#pinPad .dots i.on{background:#268fc8}#pinPad .err{color:#b8404b;min-height:22px;font-size:17px;margin-bottom:8px}'
    + '#pinPad .keys{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}#pinPad .keys button{min-height:70px;border-radius:18px;border:1px solid #dce4ee;background:#f3f6fa;font-size:30px;font-weight:700;color:#182642}'
    + '#pinPad .keys button:active{background:#dbeaf6}#pinPad .cancel{margin-top:14px;background:none;border:none;color:#268fc8;font-size:19px;min-height:44px}';
  document.head.appendChild(css);

  function ask(onOk, onCancel) {
    let pin = '';
    const pad = document.createElement('div');
    pad.id = 'pinPad';
    pad.innerHTML = '<div class="card"><h3>' + t('title') + '</h3><p>' + t('sub') + '</p><div class="dots"></div><div class="err"></div>'
      + '<div class="keys">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'].map(k => '<button type="button" data-k="' + k + '">' + k + '</button>').join('') + '</div>'
      + '<button type="button" class="cancel">' + t('cancel') + '</button></div>';
    document.body.appendChild(pad);
    const dots = pad.querySelector('.dots'), err = pad.querySelector('.err');
    const draw = () => { dots.innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => '<i class="' + (i < pin.length ? 'on' : '') + '"></i>').join(''); };
    const close = () => pad.remove();
    const submit = () => {
      if (window.Robot && Robot.checkAdminPin && Robot.checkAdminPin(pin)) { close(); onOk(); return; }
      err.textContent = t('wrong'); pin = ''; draw();
    };
    pad.querySelector('.keys').addEventListener('click', e => {
      const k = e.target && e.target.dataset && e.target.dataset.k; if (k === undefined) return;
      err.textContent = '';
      if (k === '⌫') pin = pin.slice(0, -1); else if (k === 'OK') { submit(); return; } else if (pin.length < 8) pin += k;
      draw();
      if (pin.length === 4 && window.Robot && Robot.checkAdminPin && Robot.checkAdminPin(pin)) { close(); onOk(); }
    });
    pad.querySelector('.cancel').onclick = () => { close(); if (onCancel) onCancel(); };
    draw();
  }

  const guarded = show;
  show = function (id) {
    if (id === 'robot' && need() && Date.now() > unlockedUntil) {
      const self = this, args = arguments;
      ask(() => { unlockedUntil = Date.now() + 5 * 60 * 1000; guarded.apply(self, args); }, () => { if (window.goHome) goHome(); });
      return;
    }
    return guarded.apply(this, arguments);
  };
  const sf = window.showFace;
  if (typeof sf === 'function') window.showFace = function () { unlockedUntil = 0; return sf.apply(this, arguments); };
})();
