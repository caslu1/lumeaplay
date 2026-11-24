/* LumeaPlay — app de TV (Android TV / Fire TV / LG webOS / Samsung Tizen / navegador) */
(function () {
  'use strict';
  var CFG = window.LUMEA_CONFIG || {};
  var FB = CFG.firebase || {};
  var N = window.LumeaNative || null;
  var DEMO_CODE = '123456789';

  /* ---------- utilidades ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function remPx() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(sec) { sec = Math.max(0, Math.floor(sec || 0)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); }
  function fmtDate(iso) { if (!iso) return '—'; var d = new Date(iso); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function daysLeft(iso) { if (!iso) return null; return Math.max(0, Math.ceil((new Date(iso) - new Date()) / 864e5)); }
  function fmtCode(c) { return c.slice(0, 3) + '-' + c.slice(3, 6) + '-' + c.slice(6); }
  function initials(n) { return String(n || '?').replace(/[^\wÀ-ú ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '?'; }
  var GRADS = ['#6a5cff', '#3b82f6', '#06b6d4', '#8b5cf6', '#2563eb', '#0ea5e9', '#7c3aed', '#14b8a6'];
  function colorOf(id) { var h = 0; id = String(id); for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return GRADS[Math.abs(h) % GRADS.length]; }
  var ARTC = {};
  function art(id) { var h = Math.abs(parseInt(String(id).slice(0, 6), 36) || 0) % 24; if (!ARTC[h]) ARTC[h] = scene(TYPES[h % TYPES.length], h + 3, 400, 600, false); return ARTC[h]; }
  function cssUrl(u) { return "url('" + String(u).replace(/'/g, '%27').replace(/[\n\r]/g, '') + "')"; }
  function pimg(u) { return u ? '<img src="' + esc(u) + '" onerror="this.parentNode.classList.remove(\'img\');this.remove()">' : ''; }
  function img(u, cls) { return u ? '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + esc(u) + '" onerror="this.remove()">' : ''; }

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('lp_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('lp_' + k, JSON.stringify(v)); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem('lp_' + k); } catch (e) { } }
  };

  var IC = {
    tv: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M9 21h6M8 3l4 3 4-3"/></svg>',
    film: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
    ser: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M6 4h12M10 11l5 2.5-5 2.5z"/></svg>',
    cog: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 6.5l2.6 1.5M17.2 16l2.6 1.5M4.2 17.5l2.6-1.5M17.2 8l2.6-1.5"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>'
  };

  /* ---------- toast / loading / modal ---------- */
  var toastT;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 3200); }
  function loading(msg) { var l = $('#loading'); if (msg) { $('#loadmsg').textContent = msg; l.classList.remove('hide'); } else l.classList.add('hide'); }
  var Modal = {
    open: false, i: 0, btns: [],
    show: function (title, text, btns) {
      this.open = true; this.btns = btns; this.i = 0;
      var m = $('#modal'); m.classList.remove('hide');
      this.title = title; this.text = text; this.draw();
    },
    draw: function () {
      var self = this;
      $('#modal').innerHTML = '<div class="mbox"><h2>' + esc(this.title) + '</h2><p>' + esc(this.text) + '</p><div class="btns">' +
        this.btns.map(function (b, i) { return '<div class="btn ' + (b.w ? 'w ' : '') + (i === self.i ? 'on' : '') + '">' + esc(b.t) + '</div>'; }).join('') + '</div></div>';
    },
    close: function () { this.open = false; $('#modal').classList.add('hide'); },
    key: function (k) {
      if (k === 'left' && this.i > 0) { this.i--; this.draw(); }
      else if (k === 'right' && this.i < this.btns.length - 1) { this.i++; this.draw(); }
      else if (k === 'ok') { var b = this.btns[this.i]; this.close(); if (b.fn) b.fn(); }
      else if (k === 'back') this.close();
      return true;
    }
  };

  /* ---------- aparelho ---------- */
  function deviceId() {
    if (N && N.getDeviceId) { try { var d = N.getDeviceId(); if (d) return d; } catch (e) { } }
    var id = store.get('dev');
    if (!id) {
      var b = new Uint8Array(6); (window.crypto || window.msCrypto).getRandomValues(b);
      id = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2).toUpperCase(); }).join(':');
      store.set('dev', id);
    }
    return id;
  }
  function deviceModel() {
    if (N && N.getDeviceModel) { try { return N.getDeviceModel(); } catch (e) { } }
    var ua = navigator.userAgent;
    if (/Tizen/i.test(ua)) return 'Samsung Tizen'; if (/Web0S|webOS/i.test(ua)) return 'LG webOS'; return 'Navegador';
  }
  function exitApp() {
    if (N && N.exitApp) return N.exitApp();
    try { if (window.tizen) return tizen.application.getCurrentApplication().exit(); } catch (e) { }
    try { if (window.webOS && webOS.platformBack) return webOS.platformBack(); } catch (e) { }
    window.close();
  }

  /* ---------- Firebase (REST) ---------- */
  function fbReady() { return FB.apiKey && FB.projectId && FB.apiKey.indexOf('COLE') < 0; }
  function docUrl(code) { return 'https://firestore.googleapis.com/v1/projects/' + FB.projectId + '/databases/(default)/documents/codes/' + code + '?key=' + FB.apiKey; }
  function fval(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue; if ('timestampValue' in v) return v.timestampValue;
    if ('integerValue' in v) return +v.integerValue; if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue; return null;
  }
  function getCode(code) {
    return fetch(docUrl(code)).then(function (r) {
      if (r.status === 404 || r.status === 403) return null;
      if (!r.ok) throw new Error('net');
      return r.json().then(function (j) { var o = {}, f = j.fields || {}; for (var k in f) o[k] = fval(f[k]); return o; });
    });
  }
  function bindCode(code) {
    var u = docUrl(code) + '&updateMask.fieldPaths=deviceId&updateMask.fieldPaths=activatedAt&updateMask.fieldPaths=deviceModel&currentDocument.exists=true';
    return fetch(u, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { deviceId: { stringValue: deviceId() }, activatedAt: { timestampValue: new Date().toISOString() }, deviceModel: { stringValue: deviceModel() } } })
    }).then(function (r) { if (!r.ok) throw new Error('bind'); });
  }
  function validate(code) {
    if (CFG.demo && code === DEMO_CODE) return Promise.resolve({ ok: { code: code, name: 'Demonstração', m3u: 'demo:', status: 'ativo', expiresAt: new Date(Date.now() + 30 * 864e5).toISOString() } });
    if (!fbReady()) return Promise.resolve({ err: 'O painel ainda não foi configurado. Fale com seu revendedor.' });
    return getCode(code).then(function (d) {
      if (!d) return { err: 'Código não encontrado. Confira os números e tente de novo.', bad: true };
      if (d.status && d.status !== 'ativo') return { err: 'Este código está bloqueado. Fale com seu revendedor.' };
      if (d.expiresAt && new Date(d.expiresAt) < new Date()) return { err: 'Este código venceu em ' + fmtDate(d.expiresAt) + '. Fale com seu revendedor para renovar.' };
      if (d.deviceId && d.deviceId !== deviceId()) return { err: 'Este código já está sendo usado em outro aparelho.' };
      d.code = code;
      if (!d.deviceId) return bindCode(code).then(function () { return { ok: d }; }, function () { return { ok: d }; });
      return { ok: d };
    });
  }

  /* ---------- lista ---------- */
  var DATA = null;
  function demoM3U() {
    var S = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', out = ['#EXTM3U'];
    var L = { 'Abertos': ['TV Aurora', 'Canal Horizonte', 'Rede Brasil Sul', 'TV Litoral', 'Canal 7 Norte'], 'Esportes': ['Arena Sports 1', 'Arena Sports 2', 'Gol Total HD', 'Premier Futebol', 'Raquete TV', 'Motor Max', 'Fight Zone'], 'Notícias': ['Jornal 24h', 'Notícia Já', 'Mundo News'], 'Infantil': ['Toon Kids', 'Mundo Mágico', 'Baby TV Plus'], 'Filmes 24h': ['Cine Ação', 'Cine Drama', 'Terror 24h', 'Comédia Total'], 'Música': ['Hits FM TV', 'Sertanejo Mix'] };
    for (var g in L) L[g].forEach(function (n) { out.push('#EXTINF:-1 tvg-logo="" group-title="' + g + '",' + n, S); });
    var M = { 'Lançamentos': ['Horizonte Perdido (2026)', 'Rota Final (2025)', 'O Último Farol (2026)', 'Código Azul (2025)', 'Neblina (2026)', 'Velocidade Zero (2025)', 'A Herdeira (2026)'], 'Ação': ['Impacto (2024)', 'Fronteira (2023)', 'Operação Sol (2024)', 'Ferro e Fogo (2022)', 'Alvo Duplo (2025)'], 'Comédia': ['Casamento? (2024)', 'Turno da Noite (2023)', 'Os Vizinhos (2025)', 'Cozinha Louca (2024)'], 'Infantil': ['O Dragão Azul (2024)', 'Aventura no Gelo (2023)'] };
    for (var m in M) M[m].forEach(function (n) { out.push('#EXTINF:-1 tvg-logo="" group-title="' + m + '",' + n, S.replace('.m3u8', '.m3u8?movie=' + encodeURIComponent(n)).replace('x36xhzz.m3u8', 'x36xhzz.m3u8') + '#.mp4'); });
    var SR = { 'Séries em alta': ['Distrito 7', 'Reino de Areia', 'Os Detetives', 'Vale Escuro'], 'Comédia': ['Apê 302', 'Plantão'] };
    for (var s in SR) SR[s].forEach(function (n) { for (var t = 1; t <= 2; t++) for (var e = 1; e <= 6; e++) out.push('#EXTINF:-1 tvg-logo="" group-title="' + s + '",' + n + ' S0' + t + 'E0' + e, S + '?s=' + encodeURIComponent(n) + t + e + '#/series/x.mp4'); });
    return out.join('\n');
  }
  function fetchList(url, refresh) {
    if (url === 'demo:') return Promise.resolve(demoM3U());
    var u = N ? '/proxy?cache=' + (refresh ? 0 : 1) + '&url=' + encodeURIComponent(url) : url;
    return fetch(u).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
  }
  function loadList(refresh) {
    loading(refresh ? 'Atualizando sua lista…' : 'Carregando seus canais, filmes e séries…');
    return fetchList(Session.get().m3u, refresh).then(function (txt) {
      var p = M3U.parse(txt);
      if (!p.live.length && !p.movies.length && !p.series.length) throw new Error('vazia');
      DATA = p; DATA.byId = {};
      p.live.concat(p.movies, p.series).forEach(function (x) { DATA.byId[x.id] = x; });
      p.series.forEach(function (s) { s.seasonList.forEach(function (k) { s.seasons[k].forEach(function (e) { DATA.byId[e.id] = e; }); }); });
      store.set('updated', Date.now());
      loading();
      return DATA;
    }).catch(function (e) { loading(); throw e; });
  }

  /* ---------- sessão e perfis ---------- */
  var Session = {
    get: function () { return store.get('session', null); },
    set: function (s) { store.set('session', { code: s.code, name: s.name || '', m3u: s.m3u, expiresAt: s.expiresAt || null, status: s.status || 'ativo' }); },
    clear: function () { store.del('session'); }
  };
  var AVS = ['😎', '🍿', '🦖', '🎧', '🌟', '🐱'];
  var AVBG = ['linear-gradient(135deg,#6a5cff,#22d3ee)', 'linear-gradient(135deg,#2563eb,#7c3aed)', 'linear-gradient(135deg,#06b6d4,#34d399)', 'linear-gradient(135deg,#f43f5e,#8b5cf6)', 'linear-gradient(135deg,#f59e0b,#ef4444)', 'linear-gradient(135deg,#0ea5e9,#6366f1)'];
  var Prof = {
    list: function () { var l = store.get('profiles', null); if (!l || !l.length) { l = [{ id: 'p1', name: 'Principal', av: 0 }]; store.set('profiles', l); } return l; },
    cur: function () { var id = store.get('curProfile', 'p1'), l = this.list(); return l.filter(function (p) { return p.id === id; })[0] || l[0]; },
    use: function (p) { store.set('curProfile', p.id); },
    k: function (k) { return k + '_' + this.cur().id; },
    get: function (k, d) { return store.get(this.k(k), d); },
    set: function (k, v) { store.set(this.k(k), v); },
    kids: function () { return !!this.cur().kids; }
  };
  function favs() { return Prof.get('fav', []); }
  function isFav(id) { return favs().indexOf(id) >= 0; }
  function toggleFav(id) { var f = favs(), i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.unshift(id); Prof.set('fav', f.slice(0, 500)); toast(i >= 0 ? 'Removido dos favoritos' : 'Adicionado aos favoritos'); return i < 0; }
  function addRecent(id) { var r = Prof.get('rec', []).filter(function (x) { return x !== id; }); r.unshift(id); Prof.set('rec', r.slice(0, 40)); }
  function progress() { return Prof.get('prog', {}); }
  function setProgress(id, pos, dur) {
    var p = progress(); p[id] = { p: Math.floor(pos), d: Math.floor(dur), t: Date.now() };
    var keys = Object.keys(p); if (keys.length > 400) { keys.sort(function (a, b) { return p[a].t - p[b].t; }).slice(0, keys.length - 400).forEach(function (k) { delete p[k]; }); }
    Prof.set('prog', p);
  }
  function allowed(it) {
    var g = it.group || '';
    if (!store.get('adult', false) && M3U.ADULT.test(g)) return false;
    if (Prof.kids() && !M3U.KIDS.test(g)) return false;
    return true;
  }

  /* ---------- reprodução ---------- */
  var PlayCtx = null;
  function titleFor(it) { if (it.type === 'ep') { var s = DATA.byId[it.series]; return (s ? s.title : it.show) + ' • T' + it.s + ':E' + it.e; } return it.title || it.name; }
  function play(it, opts) {
    opts = opts || {};
    var list = it.type === 'live' ? (opts.list || [it]) : [it];
    var idx = it.type === 'live' ? Math.max(0, list.indexOf(it)) : 0;
    if (it.type === 'live') addRecent(it.id);
    if (it.type === 'ep') { var last = Prof.get('lastEp', {}); last[it.series] = it.id; Prof.set('lastEp', last); }
    PlayCtx = { item: it, list: list };
    var payload = { url: it.url, title: titleFor(it), sub: it.group || '', id: it.id, type: it.type === 'live' ? 'live' : 'vod', start: Math.floor((opts.start || 0) * 1000), index: idx, resize: store.get('resize', 'fit') };
    if (N && N.play) {
      try { N.setPlaylist(JSON.stringify(list.map(function (x) { return { u: x.url, n: x.name, l: x.logo || '', id: x.id, num: x.num || 0 }; }))); } catch (e) { }
      N.play(JSON.stringify(payload));
    } else WebPlayer.open(payload, list);
  }
  function onPlayerResult(r) {
    if (!r || !DATA) return;
    if (r.type === 'vod' && r.dur > 0) setProgress(r.id, r.pos / 1000, r.dur / 1000);
    if (r.type === 'live' && PlayCtx && PlayCtx.list[r.index]) { addRecent(PlayCtx.list[r.index].id); App.notify('live', PlayCtx.list[r.index]); }
    App.notify('progress');
  }

  /* player web (LG / Samsung / navegador) */
  var WebPlayer;
  WebPlayer = {
    isOpen: false, list: [], idx: 0, p: null, hideT: null,
    open: function (p, list) {
      this.p = p; this.list = list || []; this.idx = p.index || 0; this.isOpen = true;
      $('#wp').classList.remove('hide'); this.load(p.url, p.title, p.start / 1000);
    },
    load: function (url, title, start) {
      var v = $('#wv'); $('#wt').textContent = title; v.src = url;
      v.onloadedmetadata = function () { if (start) v.currentTime = start; };
      v.onerror = function () { toast('Não foi possível reproduzir este conteúdo.'); };
      v.ontimeupdate = function () { if (v.duration && isFinite(v.duration)) { $('#wb').style.width = (v.currentTime / v.duration * 100) + '%'; $('#wc').textContent = fmtTime(v.currentTime); $('#wd').textContent = fmtTime(v.duration); } };
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () { });
      this.osd();
    },
    osd: function () { var o = $('#wp .ov'); o.style.opacity = 1; clearTimeout(this.hideT); this.hideT = setTimeout(function () { o.style.opacity = 0; }, 4000); },
    close: function () {
      var v = $('#wv'); var r = { id: this.p.id, type: this.p.type, pos: (v.currentTime || 0) * 1000, dur: (isFinite(v.duration) ? v.duration : 0) * 1000, index: this.idx };
      v.pause(); v.removeAttribute('src'); try { v.load(); } catch (e) { }
      this.isOpen = false; $('#wp').classList.add('hide'); onPlayerResult(r);
    },
    key: function (k) {
      var v = $('#wv'); this.osd();
      if (k === 'back') this.close();
      else if (k === 'ok') { if (v.paused) v.play(); else v.pause(); }
      else if (k === 'left' && this.p.type === 'vod') v.currentTime = Math.max(0, v.currentTime - 10);
      else if (k === 'right' && this.p.type === 'vod') v.currentTime = v.currentTime + 10;
      else if ((k === 'up' || k === 'down' || k === 'chup' || k === 'chdown') && this.p.type === 'live' && this.list.length > 1) {
        this.idx = (this.idx + (k === 'up' || k === 'chup' ? -1 : 1) + this.list.length) % this.list.length;
        var it = this.list[this.idx]; addRecent(it.id); this.load(it.url, it.name, 0);
      }
      return true;
    }
  };

  /* ---------- listas virtuais (rápidas mesmo com milhares de itens) ---------- */
  function VList(el, opt) {
    this.el = el; this.h = opt.h; this.render = opt.render; this.onFocus = opt.onFocus; this.empty = opt.empty || 'Nada por aqui ainda';
    this.items = []; this.i = 0; this.top = 0; this.active = false; this.nodes = {};
    el.classList.add('vl'); el.innerHTML = '<div class="tr"></div>'; this.tr = el.firstChild;
  }
  VList.prototype.set = function (items, i) { this.items = items || []; this.i = Math.max(0, Math.min(i || 0, this.items.length - 1)); this.top = 0; this.nodes = {}; this.tr.innerHTML = ''; this.draw(); };
  VList.prototype.draw = function () {
    var n = this.items.length, ih = this.h * remPx(), H = this.el.clientHeight || 600, per = Math.max(1, Math.floor(H / ih));
    if (!n) { this.tr.innerHTML = '<div class="empty">' + esc(this.empty) + '</div>'; this.tr.style.transform = ''; this.nodes = {}; return; }
    var top = this.top;
    if (this.i < top + 1) top = this.i - 1;
    if (this.i > top + per - 2) top = this.i - per + 2;
    top = Math.max(0, Math.min(top, n - per)); this.top = top;
    var s = Math.max(0, top - 3), e = Math.min(n, top + per + 3), keep = {};
    for (var k = s; k < e; k++) {
      var node = this.nodes[k];
      if (!node) { node = document.createElement('div'); node.className = 'it'; node.style.top = (k * ih) + 'px'; node.style.height = ih + 'px'; node.innerHTML = this.render(this.items[k], k); this.tr.appendChild(node); }
      keep[k] = node;
      var c = node.firstElementChild; if (c) c.classList.toggle('on', this.active && k === this.i);
    }
    for (var key in this.nodes) if (!keep[key]) this.tr.removeChild(this.nodes[key]);
    this.nodes = keep;
    this.tr.style.height = (n * ih) + 'px';
    this.tr.style.transform = 'translateY(' + (-top * ih) + 'px)';
  };
  VList.prototype.refresh = function () { for (var k in this.nodes) this.tr.removeChild(this.nodes[k]); this.nodes = {}; this.draw(); };
  VList.prototype.move = function (d) {
    var n = this.items.length; if (!n) return false;
    var j = this.i + d; if (j < 0 || j >= n) { if (Math.abs(d) > 1) j = j < 0 ? 0 : n - 1; else return false; }
    if (j === this.i) return false;
    this.i = j; this.draw(); if (this.onFocus) this.onFocus(this.cur()); return true;
  };
  VList.prototype.cur = function () { return this.items[this.i]; };
  VList.prototype.setActive = function (a) { this.active = a; this.draw(); };

  function Strip(el, opt) {
    this.el = el; this.w = opt.w; this.render = opt.render; this.items = []; this.i = 0; this.active = false; this.nodes = {};
    el.innerHTML = '<div class="tr"></div>'; this.tr = el.firstChild;
  }
  Strip.prototype.set = function (items, i) { this.items = items; this.i = Math.max(0, Math.min(i || 0, items.length - 1)); this.nodes = {}; this.tr.innerHTML = ''; this.draw(); };
  Strip.prototype.draw = function () {
    var n = this.items.length, w = this.w * remPx(), first = Math.max(0, this.i - 1), keep = {};
    var s = Math.max(0, first - 2), e = Math.min(n, first + 12);
    for (var k = s; k < e; k++) {
      var node = this.nodes[k];
      if (!node) { var d = document.createElement('div'); d.innerHTML = this.render(this.items[k], k); node = d.firstElementChild; node.style.left = (k * w) + 'px'; this.tr.appendChild(node); }
      keep[k] = node; node.classList.toggle('on', this.active && k === this.i);
    }
    for (var key in this.nodes) if (!keep[key]) this.tr.removeChild(this.nodes[key]);
    this.nodes = keep; this.tr.style.transform = 'translateX(' + (-first * w) + 'px)';
  };
  Strip.prototype.move = function (d) { var j = this.i + d; if (j < 0 || j >= this.items.length) return false; this.i = j; this.draw(); return true; };
  Strip.prototype.cur = function () { return this.items[this.i]; };
  Strip.prototype.setActive = function (a) { this.active = a; this.draw(); };

  /* ---------- telas ---------- */
  var App = {
    stack: [],
    root: function () { return $('#app'); },
    show: function (scr) { this.stack = [scr]; this.mount(); },
    push: function (scr) { this.stack.push(scr); this.mount(); },
    pop: function () { if (this.stack.length > 1) { this.stack.pop(); this.mount(true); return true; } return false; },
    top: function () { return this.stack[this.stack.length - 1]; },
    mount: function (back) { var r = this.root(); r.innerHTML = ''; this.top().mount(r, back); },
    notify: function (what, arg) { var t = this.top(); if (t && t.notify) t.notify(what, arg); },
    key: function (k) {
      if (WebPlayer.isOpen) return WebPlayer.key(k);
      if (Modal.open) return Modal.key(k);
      var t = this.top(); if (!t) return false;
      var h = t.key(k);
      if (!h && k === 'back') return this.back();
      return h;
    },
    back: function () {
      if (WebPlayer.isOpen) { WebPlayer.close(); return true; }
      if (Modal.open) { Modal.close(); return true; }
      var t = this.top(); if (t && t.back && t.back()) return true;
      if (this.pop()) return true;
      Modal.show('Sair do LumeaPlay?', 'Você pode voltar a qualquer momento.', [{ t: 'Sair', fn: exitApp }, { t: 'Continuar assistindo', w: 1 }]);
      Modal.i = 1; Modal.draw();
      return true;
    }
  };

  /* ===== Ativação ===== */
  function ActScreen(msg) { this.code = ''; this.f = 4; this.msg = msg || ''; }
  ActScreen.prototype.mount = function (r) {
    var cols = [0, 1, 2, 3, 4].map(function (c) {
      return '<div class="colp" style="transform:translateY(' + [-6, 4, -12, 2, -4][c] + 'rem)">' + [0, 1, 2, 3].map(function (k) { return '<div class="pp" style="background-image:' + art('a' + (c * 4 + k) + 'x') + '"></div>'; }).join('') + '</div>';
    }).join('');
    r.innerHTML = '<div class="screen"><div class="lg-wrap"><div class="lg-left"><div class="stack">' + cols + '</div><div class="lg-fade"></div>' +
      '<div class="lg-copy"><div class="logo big"><b></b><span>Lumea<em>Play</em></span></div><h1>Tudo o que você ama<br><span>em um só lugar.</span></h1>' +
      '<div class="feat"><div>' + IC.tv + '<b>Ao vivo</b><small>canais da TV</small></div><div>' + IC.film + '<b>Filmes</b><small>lançamentos</small></div><div>' + IC.ser + '<b>Séries</b><small>todas as temporadas</small></div></div></div></div>' +
      '<div class="lg-right"><div class="lg-card"><span class="step">ATIVAÇÃO</span><h2>Digite seu código</h2><p class="sub" id="amsg"></p><div class="code9" id="acode"></div>' +
      '<div class="kp" id="akp"></div><div class="enter" id="aent">Entrar →</div><div class="dev"><span>ID DO APARELHO</span><b>' + esc(deviceId()) + '</b></div></div></div></div></div>';
    this.draw();
  };
  ActScreen.prototype.draw = function () {
    var c = this.code, h = '';
    for (var g = 0; g < 3; g++) { h += '<div class="g">'; for (var k = 0; k < 3; k++) { var i = g * 3 + k; h += '<div class="d ' + (i < c.length ? 'fill ' : '') + (i === c.length ? 'cur' : '') + '">' + (c[i] || '') + '</div>'; } h += '</div>'; }
    $('#acode').innerHTML = h;
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'], f = this.f;
    $('#akp').innerHTML = keys.map(function (k, i) { return '<div class="' + (i === f ? 'on ' : '') + (k === '⌫' ? 'del' : k === '✓' ? 'okk' : '') + '">' + k + '</div>'; }).join('');
    $('#aent').classList.toggle('on', f === 12);
    var m = $('#amsg'); m.textContent = this.msg || 'São 9 números que você recebeu do seu revendedor.'; m.classList.toggle('err', !!this.msg);
  };
  ActScreen.prototype.type = function (d) { if (this.code.length < 9) { this.code += d; this.msg = ''; this.draw(); if (this.code.length === 9) { this.f = 12; this.draw(); } } };
  ActScreen.prototype.key = function (k) {
    if (/^d\d$/.test(k)) { this.type(k[1]); return true; }
    var f = this.f;
    if (k === 'left' && f < 12 && f % 3 > 0) this.f--;
    else if (k === 'right' && f < 12 && f % 3 < 2) this.f++;
    else if (k === 'up') { if (f === 12) this.f = 10; else if (f >= 3) this.f -= 3; }
    else if (k === 'down') { if (f < 9) this.f += 3; else if (f < 12) this.f = 12; }
    else if (k === 'ok') {
      if (f === 9) { this.code = this.code.slice(0, -1); this.msg = ''; }
      else if (f === 11 || f === 12) { this.submit(); return true; }
      else this.type(['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0'][f]);
    } else if (k === 'back') { if (this.code) { this.code = this.code.slice(0, -1); this.draw(); return true; } return false; }
    else return false;
    this.draw(); return true;
  };
  ActScreen.prototype.submit = function () {
    var self = this;
    if (this.code.length !== 9) { this.msg = 'O código tem 9 números. Faltam ' + (9 - this.code.length) + '.'; this.shake(); return; }
    var lock = store.get('lock', { n: 0, until: 0 });
    if (lock.until > Date.now()) { this.msg = 'Muitas tentativas. Aguarde ' + Math.ceil((lock.until - Date.now()) / 60000) + ' min e tente de novo.'; this.shake(); return; }
    loading('Verificando seu código…');
    validate(this.code).then(function (res) {
      loading();
      if (res.err) {
        if (res.bad) { lock.n++; if (lock.n >= 5) { lock.until = Date.now() + 5 * 60000; lock.n = 0; } store.set('lock', lock); }
        self.msg = res.err; self.shake(); return;
      }
      store.set('lock', { n: 0, until: 0 });
      Session.set(res.ok); startMain();
    }).catch(function () { loading(); self.msg = 'Sem conexão com a internet. Verifique e tente de novo.'; self.shake(); });
  };
  ActScreen.prototype.shake = function () { this.draw(); var c = $('#acode'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); };

  /* ===== Perfis ===== */
  function ProfScreen(fromSettings) { this.f = 0; this.edit = false; this.fromSettings = fromSettings; }
  ProfScreen.prototype.mount = function (r) { this.r = r; this.draw(); };
  ProfScreen.prototype.draw = function () {
    var l = Prof.list(), f = this.f, self = this, n = l.length;
    var items = l.map(function (p, i) { return '<div class="pf ' + (f === i ? 'on' : '') + '"><div class="a" style="background:' + AVBG[p.av % AVBG.length] + '">' + AVS[p.av % AVS.length] + '</div>' + esc(p.name) + (p.kids ? ' 🧸' : '') + (self.edit && n > 1 ? '<span class="x">Apagar</span>' : '') + '</div>'; });
    if (n < 5 && !this.edit) items.push('<div class="pf ' + (f === n ? 'on' : '') + '"><div class="a" style="background:rgba(255,255,255,.06);color:#8f9bc4">＋</div>Adicionar</div>');
    var cnt = items.length;
    this.r.innerHTML = '<div class="screen"><div class="prof"><div class="logo"><b></b><span>Lumea<em>Play</em></span></div><h1>' + (this.edit ? 'Gerenciar perfis' : 'Quem está assistindo?') + '</h1><p class="s">' + (this.edit ? 'Escolha um perfil para apagar' : 'Escolha um perfil para continuar') + '</p><div class="pfs">' + items.join('') + '</div><div class="ghost ' + (f === cnt ? 'on' : '') + '">' + (this.edit ? 'CONCLUÍDO' : 'GERENCIAR PERFIS') + '</div></div></div>';
    this.cnt = cnt;
  };
  ProfScreen.prototype.key = function (k) {
    var l = Prof.list(), self = this;
    if (k === 'left' && this.f > 0 && this.f < this.cnt) this.f--;
    else if (k === 'right' && this.f < this.cnt - 1) this.f++;
    else if (k === 'down') this.f = this.cnt;
    else if (k === 'up' && this.f === this.cnt) this.f = 0;
    else if (k === 'ok') {
      if (this.f === this.cnt) { this.edit = !this.edit; this.f = 0; }
      else if (this.edit) {
        var p = l[this.f]; if (!p || l.length < 2) return true;
        Modal.show('Apagar o perfil ' + p.name + '?', 'Favoritos e histórico deste perfil serão apagados.', [{ t: 'Apagar', fn: function () { store.set('profiles', l.filter(function (x) { return x.id !== p.id; })); if (store.get('curProfile') === p.id) store.set('curProfile', Prof.list()[0].id); self.f = 0; self.draw(); } }, { t: 'Cancelar', w: 1 }]);
        return true;
      } else if (this.f === l.length) {
        var names = ['Família', 'Kids', 'Perfil 4', 'Perfil 5'], used = l.map(function (x) { return x.name; });
        var nm = names.filter(function (x) { return used.indexOf(x) < 0; })[0] || ('Perfil ' + (l.length + 1));
        l.push({ id: 'p' + Date.now().toString(36), name: nm, av: l.length % AVS.length, kids: nm === 'Kids' });
        store.set('profiles', l); toast('Perfil "' + nm + '" criado' + (nm === 'Kids' ? ' — mostra só conteúdo infantil' : ''));
      } else { Prof.use(l[this.f]); App.show(new HomeScreen()); return true; }
    } else if (k === 'back') { if (this.edit) { this.edit = false; this.f = 0; } else return false; }
    else return false;
    this.draw(); return true;
  };

  /* ===== Home com abas ===== */
  var TABS = [['tv', 'Canais'], ['film', 'Filmes'], ['ser', 'Séries'], ['cog', 'Configurações']];
  function HomeScreen(tab) { this.tab = tab || store.get('lastTab', 0); this.zone = 'tab'; this.nf = this.tab; this.tabs = {}; }
  HomeScreen.prototype.mount = function (r) {
    var p = Prof.cur();
    r.innerHTML = '<div class="screen"><div id="tab"></div><div class="nav"><div class="logo"><b></b><span>Lumea<em>Play</em></span></div><div class="items" id="navi"></div>' +
      '<div class="right"><span class="ib" id="nsr">' + IC.search + '</span><span id="clock"></span><div class="av" id="nav-av" style="background:' + AVBG[p.av % AVBG.length] + '">' + AVS[p.av % AVS.length] + '</div></div></div></div>';
    this.drawNav(); tick(); this.openTab(this.tab, true);
  };
  HomeScreen.prototype.drawNav = function () {
    var self = this;
    $('#navi').innerHTML = TABS.map(function (t, i) { return '<div class="' + (self.zone === 'nav' && self.nf === i ? 'on' : i === self.tab ? 'sel' : '') + '">' + IC[t[0]] + t[1] + '</div>'; }).join('');
    $('#nsr').classList.toggle('on', this.zone === 'nav' && this.nf === 4);
    $('#nav-av').classList.toggle('on', this.zone === 'nav' && this.nf === 5);
  };
  HomeScreen.prototype.openTab = function (i, focus) {
    this.tab = i; store.set('lastTab', i);
    if (!this.tabs[i]) this.tabs[i] = i === 0 ? new LiveTab() : i === 1 ? new VodTab('movies') : i === 2 ? new VodTab('series') : new SettingsTab();
    var el = $('#tab'); el.innerHTML = ''; this.tabs[i].mount(el);
    if (focus) { this.zone = 'tab'; this.tabs[i].focus(true); } else this.tabs[i].focus(false);
    this.drawNav();
  };
  HomeScreen.prototype.key = function (k) {
    if (this.zone === 'nav') {
      if (k === 'left' && this.nf > 0) { this.nf--; if (this.nf < 4) this.openTab(this.nf, false); }
      else if (k === 'right' && this.nf < 5) { this.nf++; if (this.nf < 4) this.openTab(this.nf, false); }
      else if (k === 'down' || (k === 'ok' && this.nf < 4)) { this.nf = Math.min(this.nf, 3); if (this.nf !== this.tab) this.openTab(this.nf, false); this.zone = 'tab'; this.tabs[this.tab].focus(true); }
      else if (k === 'ok' && this.nf === 4) { App.push(new SearchScreen()); return true; }
      else if (k === 'ok' && this.nf === 5) { App.show(new ProfScreen()); return true; }
      else if (k === 'back') { if (this.tab !== 0 && false) { } return false; }
      else return /^(up|left|right)$/.test(k);
      this.drawNav(); return true;
    }
    var t = this.tabs[this.tab];
    if (t.key(k)) return true;
    if (k === 'up' || k === 'back') { this.zone = 'nav'; this.nf = this.tab; t.focus(false); this.drawNav(); return true; }
    return false;
  };
  HomeScreen.prototype.notify = function (w, a) { var t = this.tabs[this.tab]; if (t && t.notify) t.notify(w, a); };

  /* ===== Aba Canais ===== */
  var CAT_IC = [[/favorit/i, '⭐'], [/recent/i, '🕘'], [/esport|sport|futebol|premiere|combate|ufc|nba/i, '⚽'], [/not[ií]c|news|jornal/i, '📰'], [/infantil|kids|desenho|crian/i, '🧸'], [/filme|movie|cine|telecine|hbo/i, '🎬'], [/s[ée]rie/i, '🍿'], [/document|discovery|natgeo|hist/i, '🌍'], [/m[uú]sica|music|show|r[aá]dio/i, '🎵'], [/relig|gospel|cat[oó]lic|evang/i, '⛪'], [/abert|globo|sbt|record|band/i, '📡'], [/adult|xxx|\+18/i, '🔞'], [/4k|uhd/i, '✨'], [/variedad|entreten/i, '🎭']];
  function catIcon(n) { for (var i = 0; i < CAT_IC.length; i++) if (CAT_IC[i][0].test(n)) return CAT_IC[i][1]; return '📺'; }
  function logoHTML(it) { return '<span class="lgo" style="background:linear-gradient(135deg,' + colorOf(it.id) + ',#0b1440)">' + esc(initials(it.name)) + img(it.logo) + '</span>'; }

  function LiveTab() { this.mode = 'cats'; this.ci = 0; this.zone = 'list'; this.bi = 0; this.chIdx = {}; }
  LiveTab.prototype.cats = function () {
    var live = DATA.live.filter(allowed), byId = DATA.byId;
    var fav = favs().map(function (id) { return byId[id]; }).filter(function (x) { return x && x.type === 'live' && allowed(x); });
    var rec = Prof.get('rec', []).map(function (id) { return byId[id]; }).filter(function (x) { return x && allowed(x); });
    var out = [{ name: 'Favoritos', items: fav, ic: '⭐' }, { name: 'Recentes', items: rec, ic: '🕘' }, { name: 'Todos os canais', items: live, ic: '📺' }];
    M3U.groups(live).forEach(function (g) { out.push({ name: g.name, items: g.items, ic: catIcon(g.name) }); });
    return out;
  };
  LiveTab.prototype.mount = function (el) {
    var self = this;
    el.innerHTML = '<div class="lv-cols"><div class="panel" id="lvp"></div></div><div class="pv" id="pv"></div><div class="lv-info" id="lvi"></div>';
    this.C = this.cats();
    if (this.first !== false) { this.first = false; this.ci = this.C[1].items.length ? 1 : this.C[0].items.length ? 0 : 2; }
    this.build();
  };
  LiveTab.prototype.build = function () {
    var self = this, p = $('#lvp');
    if (this.mode === 'cats') {
      p.innerHTML = '<h4>CATEGORIAS · ' + (this.C.length - 3) + '</h4><div id="lvl" style="flex:1"></div>';
      this.vl = new VList($('#lvl'), {
        h: 4.6, render: function (c) { return '<div class="cat"><em>' + c.ic + '</em><b class="ell">' + esc(c.name) + '</b><span>' + c.items.length + '</span><i>›</i></div>'; },
        onFocus: function () { self.preview(); }
      });
      this.vl.set(this.C, this.ci);
    } else {
      var c = this.C[this.ci];
      p.innerHTML = '<div class="back"><span>‹</span><div><small>VOLTAR PARA CATEGORIAS</small><b class="ell" style="display:block;max-width:24rem">' + c.ic + ' ' + esc(c.name) + '</b></div><em>' + c.items.length + ' canais</em></div><div id="lvl" style="flex:1"></div>';
      this.vl = new VList($('#lvl'), {
        h: 4.9, empty: c.name === 'Favoritos' ? 'Nenhum favorito ainda. Abra um canal e escolha ★ Favoritar.' : 'Nenhum canal aqui.',
        render: function (it) { return '<div class="chi"><span class="no">' + (it.num || '') + '</span>' + logoHTML(it) + '<div class="tx"><b class="ell">' + esc(it.name) + '</b><small class="ell">' + esc(it.group) + '</small></div>' + (isFav(it.id) ? '<span class="st">★</span>' : '') + '</div>'; },
        onFocus: function () { self.preview(); }
      });
      this.vl.set(c.items, this.chIdx[this.ci] || 0);
    }
    this.vl.setActive(this.focused && this.zone === 'list');
    this.preview();
  };
  LiveTab.prototype.current = function () {
    if (this.mode === 'chs') return this.vl.cur();
    var r = Prof.get('rec', []); return r.length ? DATA.byId[r[0]] : null;
  };
  LiveTab.prototype.preview = function () {
    var it = this.current(), pv = $('#pv'), info = $('#lvi');
    if (!pv) return;
    if (!it) {
      pv.innerHTML = '<div class="big"><div class="logo big"><b></b><span>Lumea<em>Play</em></span></div></div>';
      info.innerHTML = '<div style="flex:1"><div class="chn">Canais ao vivo</div><h2>' + (DATA.live.length) + ' canais disponíveis</h2><p>Escolha uma categoria e aperte OK.</p></div>';
      this.btns = []; return;
    }
    pv.innerHTML = '<div class="blur" style="background-image:' + (it.logo ? cssUrl(it.logo) : 'none') + '"></div><div class="big">' + (it.logo ? '<img src="' + esc(it.logo) + '" onerror="this.outerHTML=\'<span class=ini>' + esc(initials(it.name)) + '</span>\'">' : '<span class="ini">' + esc(initials(it.name)) + '</span>') + '</div>' +
      '<div class="hint"><span><b>OK</b>Assistir</span><span><b>▶</b>Mais opções</span>' + (this.mode === 'chs' ? '<span><b>◀</b>Categorias</span>' : '') + '</div>';
    this.btns = this.mode === 'cats' ? [{ t: '▶ Continuar', fn: 'play' }] : [{ t: '▶ Assistir', fn: 'play' }, { t: isFav(it.id) ? '★ Remover favorito' : '☆ Favoritar', fn: 'fav' }];
    var self = this;
    info.innerHTML = '<span class="badge">AO VIVO</span><div style="flex:1;min-width:0"><div class="chn">' + (this.mode === 'cats' ? 'Último canal assistido' : (it.num ? it.num + ' · ' : '') + esc(it.group)) + '</div><h2 class="ell">' + esc(it.name) + '</h2></div><div class="btns">' +
      this.btns.map(function (b, i) { return '<div class="btn ' + (i === 0 ? 'w ' : '') + (self.zone === 'btn' && self.bi === i ? 'on' : '') + '">' + b.t + '</div>'; }).join('') + '</div>';
  };
  LiveTab.prototype.focus = function (on) { this.focused = on; if (!on) this.zone = 'list'; if (this.vl) this.vl.setActive(on && this.zone === 'list'); this.preview(); };
  LiveTab.prototype.act = function (fn) {
    var it = this.current(); if (!it) return;
    if (fn === 'play') { var list = this.mode === 'chs' ? this.C[this.ci].items : [it]; play(it, { list: list }); }
    else if (fn === 'fav') { toggleFav(it.id); this.C[0].items = favs().map(function (id) { return DATA.byId[id]; }).filter(function (x) { return x && x.type === 'live'; }); this.vl.refresh(); this.preview(); }
  };
  LiveTab.prototype.key = function (k) {
    if (this.zone === 'btn') {
      if (k === 'left') { if (this.bi > 0) this.bi--; else { this.zone = 'list'; this.vl.setActive(true); } }
      else if (k === 'right') { if (this.bi < this.btns.length - 1) this.bi++; }
      else if (k === 'ok') { this.act(this.btns[this.bi].fn); return true; }
      else if (k === 'back') { this.zone = 'list'; this.vl.setActive(true); }
      else if (k === 'up') return false;
      else return true;
      this.preview(); return true;
    }
    if (k === 'up') return this.vl.move(-1);
    if (k === 'down') { this.vl.move(1); return true; }
    if (k === 'chup' || k === 'pgup') { this.vl.move(-8); return true; }
    if (k === 'chdown' || k === 'pgdn') { this.vl.move(8); return true; }
    if (k === 'right') { if (this.btns && this.btns.length) { this.zone = 'btn'; this.bi = 0; this.vl.setActive(false); this.preview(); } return true; }
    if (this.mode === 'cats') {
      if (k === 'ok') { this.ci = this.vl.i; this.mode = 'chs'; this.build(); return true; }
      return false;
    }
    if (k === 'ok') { this.act('play'); return true; }
    if (k === 'left' || k === 'back') { this.chIdx[this.ci] = this.vl.i; this.mode = 'cats'; this.build(); return true; }
    return false;
  };
  LiveTab.prototype.notify = function (w, it) {
    if (w === 'live' && this.vl) { this.C = this.cats(); if (this.mode === 'chs' && it) { var idx = this.C[this.ci].items.indexOf(it); if (idx >= 0) { this.vl.i = idx; } } this.vl.refresh(); this.preview(); }
  };

  /* ===== Abas Filmes e Séries ===== */
  function posterHTML(it) {
    var pr = progress()[it.id], pg = pr && pr.d ? Math.min(100, pr.p / pr.d * 100) : 0;
    return '<div class="po' + (it.logo ? ' img' : '') + '" style="background-image:' + art(it.id) + '"><div class="t">' + esc(it.title || it.name) + '</div>' + img(it.logo) +
      (pg > 2 && pg < 97 ? '<div class="pg"><i style="width:' + pg + '%"></i></div>' : '') + '</div>';
  }
  function heroHTML(it, kind) {
    if (!it) return '';
    var meta = [];
    if (it.type === 'series') { meta.push('<span class="m">' + it.seasonList.length + (it.seasonList.length > 1 ? ' temporadas' : ' temporada') + '</span>', '<span>' + it.count + ' episódios</span>'); }
    else { if (it.year) meta.push('<span class="m">' + it.year + '</span>'); var pr = progress()[it.id]; if (pr && pr.d && pr.p / pr.d < .97 && pr.p > 30) meta.push('<span>Parou em ' + fmtTime(pr.p) + '</span>'); }
    meta.push('<span>' + esc(it.group) + '</span>');
    return '<div class="kind"><i></i>' + (it.type === 'series' ? 'Série' : 'Filme') + '</div><div class="ttl">' + esc(it.title || it.name) + '</div><div class="meta">' + meta.join('') + '</div>';
  }
  function VodTab(kind) { this.kind = kind; this.r = 0; this.cols = {}; }
  VodTab.prototype.rows = function () {
    var items = (this.kind === 'movies' ? DATA.movies : DATA.series).filter(allowed), byId = DATA.byId, rows = [], kind = this.kind;
    if (kind === 'movies') {
      var p = progress(), cont = Object.keys(p).filter(function (id) { var x = p[id]; return byId[id] && byId[id].type === 'movie' && x.d && x.p > 30 && x.p / x.d < .95; }).sort(function (a, b) { return p[b].t - p[a].t; }).map(function (id) { return byId[id]; });
      if (cont.length) rows.push({ title: 'Continuar assistindo', items: cont });
    } else {
      var last = Prof.get('lastEp', {}), pp = progress();
      var cs = Object.keys(last).map(function (sid) { return byId[sid]; }).filter(Boolean).sort(function (a, b) { var ta = (pp[last[a.id]] || {}).t || 0, tb = (pp[last[b.id]] || {}).t || 0; return tb - ta; });
      if (cs.length) rows.push({ title: 'Continuar assistindo', items: cs });
    }
    var fv = favs().map(function (id) { return byId[id]; }).filter(function (x) { return x && x.type === (kind === 'movies' ? 'movie' : 'series') && allowed(x); });
    if (fv.length) rows.push({ title: 'Minha lista', items: fv });
    if (items.length > 12) rows.push({ title: 'Adicionados recentemente', items: items.slice(-30).reverse() });
    M3U.groups(items).forEach(function (g) { rows.push({ title: g.name, items: g.items }); });
    return rows;
  };
  VodTab.prototype.mount = function (el) {
    this.R = this.rows(); if (this.r >= this.R.length) this.r = 0;
    if (!this.R.length) { el.innerHTML = '<div class="vod-empty">Sua lista não tem ' + (this.kind === 'movies' ? 'filmes' : 'séries') + (Prof.kids() ? ' infantis' : '') + '.</div>'; return; }
    el.innerHTML = '<div class="hero"><div class="bgb" id="hbb"></div><div class="bg" id="hbg"></div><div class="hc" id="hc"></div></div><div class="rows" id="rows"></div>';
    this.drawRows();
  };
  VodTab.prototype.drawRows = function () {
    var box = $('#rows'); if (!box) return;
    var self = this, rowH = 24 * remPx(); box.innerHTML = ''; this.strips = {};
    for (var i = Math.max(0, this.r - 1); i < Math.min(this.R.length, this.r + 3); i++) {
      var row = this.R[i], d = document.createElement('div');
      d.className = 'row'; d.style.top = ((i - this.r) * rowH) + 'px';
      d.innerHTML = '<h3>' + esc(row.title) + ' <small>' + row.items.length + '</small></h3><div class="strip"></div>';
      box.appendChild(d);
      var st = new Strip(d.lastChild, { w: 12.8, render: posterHTML });
      st.set(row.items, this.cols[i] || 0); this.strips[i] = st;
    }
    this.mark();
  };
  VodTab.prototype.mark = function () {
    for (var i in this.strips) this.strips[i].setActive(this.focused && +i === this.r);
    this.hero();
  };
  VodTab.prototype.hero = function () {
    var st = this.strips && this.strips[this.r]; if (!st) return;
    var it = st.cur(); if (!it) return;
    $('#hc').innerHTML = heroHTML(it);
    var bg = it.logo ? cssUrl(it.logo) + ', ' + art(it.id) : art(it.id);
    $('#hbg').style.backgroundImage = bg; $('#hbb').style.backgroundImage = bg;
  };
  VodTab.prototype.focus = function (on) { this.focused = on; if (this.strips) this.mark(); };
  VodTab.prototype.key = function (k) {
    if (!this.R || !this.R.length) return false;
    var st = this.strips[this.r];
    if (k === 'left') { if (st.move(-1)) { this.cols[this.r] = st.i; this.hero(); } return true; }
    if (k === 'right') { if (st.move(1)) { this.cols[this.r] = st.i; this.hero(); } return true; }
    if (k === 'down') { if (this.r < this.R.length - 1) { this.r++; this.drawRows(); } return true; }
    if (k === 'up') { if (this.r > 0) { this.r--; this.drawRows(); return true; } return false; }
    if (k === 'ok') { var it = st.cur(); if (it) App.push(it.type === 'series' ? new SeriesScreen(it) : new MovieScreen(it)); return true; }
    if (k === 'back' && (this.r > 0 || st.i > 0)) { this.r = 0; this.cols = {}; this.drawRows(); return true; }
    return false;
  };
  VodTab.prototype.notify = function (w) { if (w === 'progress' || w === 'fav') { this.R = this.rows(); if (this.r >= this.R.length) this.r = 0; this.drawRows(); } };

  /* ===== Detalhe do filme ===== */
  function MovieScreen(it) { this.it = it; this.b = 0; }
  MovieScreen.prototype.mount = function (r) { this.r = r; this.draw(); };
  MovieScreen.prototype.draw = function () {
    var it = this.it, pr = progress()[it.id], resume = pr && pr.d && pr.p > 30 && pr.p / pr.d < .95, self = this;
    this.btns = [];
    if (resume) { this.btns.push({ t: '▶ Continuar de ' + fmtTime(pr.p), fn: function () { play(it, { start: pr.p }); } }); this.btns.push({ t: '↺ Do início', fn: function () { play(it); } }); }
    else this.btns.push({ t: '▶ Assistir', fn: function () { play(it); } });
    this.btns.push({ t: isFav(it.id) ? '✓ Na minha lista' : '＋ Minha lista', fn: function () { toggleFav(it.id); self.draw(); } });
    var bg = it.logo ? cssUrl(it.logo) + ', ' + art(it.id) : art(it.id);
    this.r.innerHTML = '<div class="screen det"><div class="hero"><div class="bgb" style="background-image:' + esc(bg) + '"></div></div><div class="hc">' + heroHTML(it) +
      '<div class="syn">' + (resume ? 'Você assistiu ' + Math.round(pr.p / pr.d * 100) + '% deste filme.' : 'Aperte OK para começar a assistir.') + '</div><div class="btns">' +
      this.btns.map(function (b, i) { return '<div class="btn ' + (i === 0 ? 'w ' : '') + (i === self.b ? 'on' : '') + '">' + b.t + '</div>'; }).join('') +
      '</div></div><div class="poster" style="background-image:' + esc(art(it.id)) + '">' + img(it.logo) + '</div><div class="logo" style="position:absolute;z-index:3;top:3rem;left:4rem"><b></b><span>Lumea<em>Play</em></span></div></div>';
  };
  MovieScreen.prototype.key = function (k) {
    if (k === 'left' && this.b > 0) this.b--; else if (k === 'right' && this.b < this.btns.length - 1) this.b++;
    else if (k === 'ok') { this.btns[this.b].fn(); return true; } else return k !== 'back';
    this.draw(); return true;
  };
  MovieScreen.prototype.notify = function (w) { if (w === 'progress') { this.b = 0; this.draw(); } };

  /* ===== Detalhe da série ===== */
  function SeriesScreen(s) {
    this.s = s; this.z = 2; this.b = 0;
    var lastId = Prof.get('lastEp', {})[s.id], last = lastId && DATA.byId[lastId];
    this.si = last ? Math.max(0, s.seasonList.indexOf(last.s)) : 0;
    this.ei = last ? Math.max(0, s.seasons[last.s].indexOf(last)) : 0;
  }
  SeriesScreen.prototype.eps = function () { return this.s.seasons[this.s.seasonList[this.si]] || []; };
  SeriesScreen.prototype.mount = function (r) {
    var s = this.s, bg = s.logo ? cssUrl(s.logo) + ', ' + art(s.id) : art(s.id);
    r.innerHTML = '<div class="screen det"><div class="hero"><div class="bgb" style="background-image:' + esc(bg) + '"></div></div><div class="hc" id="shc"></div>' +
      '<div class="poster" style="background-image:' + esc(art(s.id)) + ';top:5rem;width:15rem;height:22.5rem">' + img(s.logo) + '</div>' +
      '<div class="logo" style="position:absolute;z-index:3;top:3rem;left:4rem"><b></b><span>Lumea<em>Play</em></span></div>' +
      '<div class="eprow"><div class="sel-s" id="ssn"></div><div class="eps" id="seps"></div></div></div>';
    var pr = progress();
    this.strip = new Strip($('#seps'), {
      w: 22.4, render: function (e) {
        var p = pr[e.id], pg = p && p.d ? Math.min(100, p.p / p.d * 100) : 0;
        return '<div class="ep"><span class="n">EPISÓDIO ' + e.e + '</span>' + (pg >= 95 ? '<span class="ok">✓ VISTO</span>' : '') + '<h5>' + esc(e.title || 'Episódio ' + e.e) + '</h5>' + (pg > 2 && pg < 95 ? '<div class="pg"><i style="width:' + pg + '%"></i></div>' : '') + '</div>';
      }
    });
    this.draw(true);
  };
  SeriesScreen.prototype.draw = function (full) {
    var s = this.s, self = this, last = Prof.get('lastEp', {})[s.id], le = last && DATA.byId[last];
    this.btns = [{ t: le ? '▶ Continuar T' + le.s + ':E' + le.e : '▶ Assistir T' + s.seasonList[0] + ':E1', fn: function () { var e = le || s.seasons[s.seasonList[0]][0]; var p = progress()[e.id]; play(e, { start: p && p.d && p.p / p.d < .95 ? p.p : 0 }); } },
      { t: isFav(s.id) ? '✓ Na minha lista' : '＋ Minha lista', fn: function () { toggleFav(s.id); self.draw(); } }];
    $('#shc').innerHTML = heroHTML(s) + '<div class="btns">' + this.btns.map(function (b, i) { return '<div class="btn ' + (i === 0 ? 'w ' : '') + (self.z === 0 && i === self.b ? 'on' : '') + '">' + b.t + '</div>'; }).join('') + '</div>';
    $('#ssn').innerHTML = s.seasonList.map(function (n, i) { return '<span class="' + (i === self.si ? (self.z === 1 ? 'on' : 's') : '') + '">Temporada ' + n + '</span>'; }).join('');
    if (full) this.strip.set(this.eps(), this.ei);
    this.strip.setActive(this.z === 2);
  };
  SeriesScreen.prototype.key = function (k) {
    if (k === 'up') { if (this.z > 0) this.z--; else return true; }
    else if (k === 'down') { if (this.z < 2) this.z++; }
    else if (this.z === 0) { if (k === 'left' && this.b > 0) this.b--; else if (k === 'right' && this.b < 1) this.b++; else if (k === 'ok') { this.btns[this.b].fn(); return true; } else return k !== 'back'; }
    else if (this.z === 1) {
      if (k === 'left' && this.si > 0) { this.si--; this.ei = 0; this.draw(true); return true; }
      if (k === 'right' && this.si < this.s.seasonList.length - 1) { this.si++; this.ei = 0; this.draw(true); return true; }
      if (k === 'ok') this.z = 2; else return k !== 'back';
    } else {
      if (k === 'left') { this.strip.move(-1); this.ei = this.strip.i; return true; }
      if (k === 'right') { this.strip.move(1); this.ei = this.strip.i; return true; }
      if (k === 'ok') { var e = this.strip.cur(), p = progress()[e.id]; play(e, { start: p && p.d && p.p / p.d < .95 ? p.p : 0 }); return true; }
      return k !== 'back';
    }
    this.draw(); return true;
  };
  SeriesScreen.prototype.notify = function (w) { if (w === 'progress') this.mount(App.root()); };

  /* ===== Configurações ===== */
  var OPTS = ['Minha conta', 'Atualizar lista', 'Player', 'Conteúdo adulto', 'Perfis', 'Trocar código'];
  function SettingsTab() { this.o = 0; this.zone = 'opts'; this.c = 0; }
  SettingsTab.prototype.mount = function (el) { this.el = el; this.draw(); };
  SettingsTab.prototype.focus = function (on) { this.focused = on; if (!on) this.zone = 'opts'; this.draw(); };
  SettingsTab.prototype.controls = function () {
    var self = this;
    switch (this.o) {
      case 1: return { type: 'btn', items: [{ t: '🔄 Atualizar agora', fn: function () { reloadList(); } }] };
      case 2: var rz = store.get('resize', 'fit'); return { type: 'choice', items: [['fit', 'Ajustar à tela'], ['fill', 'Preencher (cortar bordas)'], ['zoom', 'Esticar']].map(function (x) { return { t: x[1], s: rz === x[0], fn: function () { store.set('resize', x[0]); self.draw(); toast('Formato da tela: ' + x[1]); } }; }) };
      case 3: var ad = store.get('adult', false); return { type: 'choice', items: [{ t: 'Oculto', s: !ad, fn: function () { store.set('adult', false); refreshAll(); self.draw(); } }, { t: 'Visível', s: ad, fn: function () { Modal.show('Mostrar conteúdo adulto?', 'Categorias adultas vão aparecer em todos os perfis, menos no Kids.', [{ t: 'Mostrar', fn: function () { store.set('adult', true); refreshAll(); self.draw(); } }, { t: 'Cancelar', w: 1 }]); } }] };
      case 4: return { type: 'btn', items: [{ t: '👤 Trocar de perfil', fn: function () { App.show(new ProfScreen()); } }] };
      case 5: return { type: 'btn', items: [{ t: '🚪 Sair e trocar código', fn: function () { Modal.show('Trocar o código?', 'Você vai precisar digitar um código de acesso de novo.', [{ t: 'Sair', fn: function () { Session.clear(); DATA = null; App.show(new ActScreen()); } }, { t: 'Cancelar', w: 1 }]); } }] };
    }
    return null;
  };
  SettingsTab.prototype.draw = function () {
    var self = this, s = Session.get() || {}, dl = daysLeft(s.expiresAt), cnt = DATA ? DATA.live.length + ' canais · ' + DATA.movies.length + ' filmes · ' + DATA.series.length + ' séries' : '—';
    var up = store.get('updated', 0), upd = up ? new Date(up) : null;
    var ctl = this.controls(); this.ctl = ctl;
    var body = '';
    if (this.o === 0) {
      body = '<div class="plan"><div class="logo"><b></b></div><div><h3>' + (dl === 0 ? 'Assinatura vencida' : 'Assinatura ativa') + '</h3><p>' + (s.expiresAt ? 'Válida até ' + fmtDate(s.expiresAt) : 'Sem data de vencimento') + '</p></div>' + (dl != null ? '<div class="d"><b>' + dl + '</b><small>' + (dl === 1 ? 'dia restante' : 'dias restantes') + '</small></div>' : '') + '</div>' +
        '<div class="pan"><div class="li"><div><small>CÓDIGO DE ACESSO</small>' + (s.code ? s.code.slice(0, 3) + '-•••-' + s.code.slice(6) : '—') + '</div><span class="g">● Ativo</span></div>' +
        (s.name ? '<div class="li"><div><small>CLIENTE</small>' + esc(s.name) + '</div></div>' : '') +
        '<div class="li"><div><small>ID DO APARELHO</small>' + esc(deviceId()) + '</div><span class="m">Este aparelho</span></div>' +
        '<div class="li"><div><small>SUA LISTA</small>' + cnt + '</div><span class="m">' + (upd ? 'Atualizada ' + fmtDate(upd.toISOString()) + ' ' + pad(upd.getHours()) + ':' + pad(upd.getMinutes()) : '') + '</span></div>' +
        '<div class="li"><div><small>VERSÃO</small>LumeaPlay ' + esc(CFG.version || '1.0') + '</div></div></div>';
    } else {
      var desc = ['', 'Baixa a lista de novo do servidor, com os canais, filmes e séries mais recentes.', 'Como o vídeo ocupa a tela da sua TV.', 'Esconde ou mostra as categorias adultas da lista.', 'Perfil atual: ' + esc(Prof.cur().name) + '. Cada perfil tem seus favoritos e o seu "continuar assistindo".', 'Sai desta conta neste aparelho. O código continua válido.'][this.o];
      body = '<div class="pan"><div class="li"><div><small>' + OPTS[this.o].toUpperCase() + '</small><span style="font-weight:500;color:#cfd6f2">' + desc + '</span></div></div>' +
        (ctl.type === 'choice' ? '<div class="choice">' + ctl.items.map(function (x, i) { return '<span class="' + (self.zone === 'ctl' && self.c === i ? 'on' : x.s ? 's' : '') + '">' + esc(x.t) + '</span>'; }).join('') + '</div>'
          : '<div class="btns">' + ctl.items.map(function (x, i) { return '<div class="btn w ' + (self.zone === 'ctl' && self.c === i ? 'on' : '') + '">' + x.t + '</div>'; }).join('') + '</div>') + '</div>';
    }
    this.el.innerHTML = '<div class="cfg"><h1>Configurações</h1><div class="opts">' + OPTS.map(function (o, i) { return '<div class="' + (self.focused && self.zone === 'opts' && i === self.o ? 'on' : i === self.o ? 'sel' : '') + '">' + o + '</div>'; }).join('') + '</div><div>' + body + '</div></div>';
  };
  SettingsTab.prototype.key = function (k) {
    if (this.zone === 'ctl') {
      if (k === 'left') { if (this.c > 0) this.c--; else this.zone = 'opts'; }
      else if (k === 'right') { if (this.c < this.ctl.items.length - 1) this.c++; }
      else if (k === 'ok') { this.ctl.items[this.c].fn(); return true; }
      else if (k === 'back') this.zone = 'opts';
      else if (k === 'up') { this.zone = 'opts'; }
      else return true;
      this.draw(); return true;
    }
    if (k === 'up') { if (this.o > 0) { this.o--; this.draw(); return true; } return false; }
    if (k === 'down') { if (this.o < OPTS.length - 1) this.o++; this.draw(); return true; }
    if ((k === 'right' || k === 'ok') && this.controls()) { this.zone = 'ctl'; this.c = 0; this.draw(); return true; }
    return k === 'right' || k === 'left';
  };

  /* ===== Busca ===== */
  var KB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split('').concat(['ESPAÇO', 'APAGAR', 'LIMPAR']);
  function SearchScreen() { this.q = ''; this.k = 0; this.zone = 'kb'; }
  SearchScreen.prototype.mount = function (r) {
    r.innerHTML = '<div class="screen"><div class="nav"><div class="logo"><b></b><span>Lumea<em>Play</em></span></div><div style="flex:1"></div><div class="right"><span>Busca</span></div></div>' +
      '<div class="srch"><div><div class="sq" id="sq"></div><div class="kb" id="kb"></div></div><div class="panel res"><h4 id="sh">RESULTADOS</h4><div id="sres" style="flex:1"></div></div></div></div>';
    this.vl = new VList($('#sres'), {
      h: 4.9, empty: 'Digite pelo menos 2 letras para buscar canais, filmes e séries.',
      render: function (it) { var t = { live: 'CANAL', movie: 'FILME', series: 'SÉRIE' }[it.type]; return '<div class="chi">' + logoHTML(it) + '<div class="tx"><b class="ell">' + esc(it.title || it.name) + '</b><small class="ell">' + esc(it.group) + '</small></div><span class="tp">' + t + '</span></div>'; }
    });
    this.vl.set([]); this.draw();
  };
  SearchScreen.prototype.draw = function () {
    var self = this;
    $('#sq').innerHTML = IC.search + (this.q ? esc(this.q) : '<span>Buscar…</span>');
    $('#kb').innerHTML = KB.map(function (c, i) { return '<div class="' + (c.length > 1 ? 'w2 ' : '') + (self.zone === 'kb' && self.k === i ? 'on' : '') + '">' + c + '</div>'; }).join('');
    this.vl.setActive(this.zone === 'res');
  };
  SearchScreen.prototype.run = function () {
    var self = this; clearTimeout(this.t);
    this.t = setTimeout(function () {
      var q = norm(self.q.trim()), res = [];
      if (q.length >= 2) {
        var pool = DATA.live.concat(DATA.movies, DATA.series);
        for (var i = 0; i < pool.length && res.length < 300; i++) { var it = pool[i]; if (allowed(it) && norm(it.title || it.name).indexOf(q) >= 0) res.push(it); }
      }
      self.vl.empty = q.length >= 2 ? 'Nada encontrado para "' + self.q + '".' : 'Digite pelo menos 2 letras para buscar canais, filmes e séries.';
      self.vl.set(res); self.vl.setActive(self.zone === 'res');
      $('#sh').textContent = q.length >= 2 ? res.length + (res.length === 300 ? '+' : '') + ' RESULTADOS' : 'RESULTADOS';
    }, 250);
  };
  SearchScreen.prototype.key = function (k) {
    if (this.zone === 'res') {
      if (k === 'up') this.vl.move(-1); else if (k === 'down') this.vl.move(1);
      else if (k === 'left' || k === 'back') { this.zone = 'kb'; this.draw(); }
      else if (k === 'ok') { var it = this.vl.cur(); if (it) { if (it.type === 'live') play(it, { list: [it] }); else App.push(it.type === 'series' ? new SeriesScreen(it) : new MovieScreen(it)); } }
      return true;
    }
    var i = this.k, cols = 6;
    if (/^d\d$/.test(k)) { this.q += k[1]; this.run(); }
    else if (k === 'left') { if (i < 36 ? i % cols > 0 : i > 36) this.k--; }
    else if (k === 'right') { if ((i < 36 && i % cols === cols - 1) || i === 38) { if (this.vl.items.length) this.zone = 'res'; } else this.k++; }
    else if (k === 'up') { if (i >= 36) this.k = 30 + (i - 36) * 2; else if (i >= cols) this.k -= cols; else return false; }
    else if (k === 'down') { if (i + cols < 36) this.k += cols; else if (i < 36) this.k = 36 + Math.floor((i % cols) / 2); }
    else if (k === 'ok') { var c = KB[i]; if (c === 'ESPAÇO') this.q += ' '; else if (c === 'APAGAR') this.q = this.q.slice(0, -1); else if (c === 'LIMPAR') this.q = ''; else this.q += c; this.run(); }
    else if (k === 'back') { if (this.q) { this.q = this.q.slice(0, -1); this.run(); } else return false; }
    else return false;
    this.draw(); return true;
  };

  /* ---------- fluxo principal ---------- */
  function tick() { var c = $('#clock'); if (c) { var d = new Date(); c.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()); } }
  setInterval(tick, 15000);
  function refreshAll() { var h = App.stack[0]; if (h instanceof HomeScreen) { var keep = h.tabs[h.tab]; h.tabs = {}; h.tabs[h.tab] = keep; } }
  function reloadList() {
    loadList(true).then(function () { toast('Lista atualizada!'); App.show(new HomeScreen(3)); })
      .catch(function () { toast('Não foi possível atualizar a lista agora. Tente mais tarde.'); });
  }
  function goHome() { var l = Prof.list(); if (l.length > 1) App.show(new ProfScreen()); else { Prof.use(l[0]); App.show(new HomeScreen()); } }
  function startMain() {
    loadList(false).then(goHome).catch(function (e) {
      App.show(new ActScreen('Não conseguimos carregar sua lista (' + (e.message || 'erro') + '). Fale com seu revendedor.'));
    });
  }
  function boot() {
    var s = Session.get();
    if (!s) { App.show(new ActScreen()); return; }
    if (s.m3u === 'demo:' || !fbReady()) { startMain(); return; }
    loading('Verificando seu acesso…');
    getCode(s.code).then(function (d) {
      loading();
      if (!d) { Session.clear(); App.show(new ActScreen('Seu código não existe mais. Digite um novo código.')); return; }
      if (d.status && d.status !== 'ativo') { App.show(new ActScreen('Seu acesso foi bloqueado. Fale com seu revendedor.')); return; }
      if (d.expiresAt && new Date(d.expiresAt) < new Date()) { App.show(new ActScreen('Seu acesso venceu em ' + fmtDate(d.expiresAt) + '. Fale com seu revendedor para renovar.')); return; }
      if (d.deviceId && d.deviceId !== deviceId()) { Session.clear(); App.show(new ActScreen('Este código foi liberado para outro aparelho.')); return; }
      d.code = s.code; Session.set(d); startMain();
    }).catch(function () {
      loading();
      if (s.expiresAt && new Date(s.expiresAt) < new Date()) App.show(new ActScreen('Seu acesso venceu. Fale com seu revendedor.'));
      else startMain();
    });
  }

  /* ---------- teclas ---------- */
  function keyName(e) {
    var k = e.keyCode;
    switch (k) {
      case 37: return 'left'; case 38: return 'up'; case 39: return 'right'; case 40: return 'down';
      case 13: case 23: case 66: return 'ok';
      case 8: case 27: case 461: case 10009: case 4: return 'back';
      case 33: case 427: return 'chup'; case 34: case 428: return 'chdown';
    }
    if (k >= 48 && k <= 57) return 'd' + (k - 48);
    if (k >= 96 && k <= 105) return 'd' + (k - 96);
    return null;
  }
  document.addEventListener('keydown', function (e) {
    var k = keyName(e); if (!k) return;
    e.preventDefault();
    var handled = App.key(k);
    if (!handled && k === 'back') exitApp();
  });
  try { if (window.tizen && tizen.tvinputdevice) ['ChannelUp', 'ChannelDown', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) { } }); } catch (e) { }

  /* ponte com o Android */
  window.LP = {
    back: function () { return App.back(); },
    key: function (k) { return App.key(k); },
    onPlayerResult: function (json) { try { onPlayerResult(typeof json === 'string' ? JSON.parse(json) : json); } catch (e) { } },
    onResume: function () { tick(); }
  };

  boot();
})();
