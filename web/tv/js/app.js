/* LumeaPlay — app de TV (Android TV / Fire TV / LG webOS / Samsung Tizen / navegador) */
(function () {
  'use strict';
  var CFG = window.LUMEA_CONFIG || {};
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
  var ARTS = ['#1a1f2b', '#1d1b26', '#17212a', '#211d1d', '#1b2224', '#201f29'];
  function art(id) { var h = Math.abs(parseInt(String(id).slice(0, 6), 36) || 0) % ARTS.length; return ARTC[h] || (ARTC[h] = 'linear-gradient(165deg,' + ARTS[h] + ',#0e1015)'); }
  /* No APK as imagens passam pelo app (cabeçalhos de navegador, sem Referer, cache em disco):
     resolve logos e pôsteres que o servidor bloqueia quando vêm de dentro de um app. */
  function iu(u) { u = String(u || '').trim(); return N && /^https?:\/\//i.test(u) ? '/img?url=' + encodeURIComponent(u) : u; }
  function cssUrl(u) { return "url('" + iu(u).replace(/'/g, '%27').replace(/[\n\r]/g, '') + "')"; }
  function pimg(u) { return u ? '<img src="' + esc(iu(u)) + '" onerror="this.parentNode.classList.remove(\'img\');this.remove()">' : ''; }
  function img(u, cls) { return u ? '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + esc(iu(u)) + '" onerror="this.remove()">' : ''; }

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
  function loading(msg, sub, pct) {
    var l = $('#loading');
    if (!msg) { l.classList.add('hide'); return; }
    $('#loadmsg').textContent = msg; $('#loadsub').textContent = sub || '';
    var b = $('#loadbar'); l.classList.toggle('ind', pct == null); if (pct != null) b.style.width = Math.max(3, Math.min(100, pct)) + '%';
    l.classList.remove('hide');
  }
  var LANG = store.get('lang', 'pt');
  function setLang(l) { LANG = l; store.set('lang', l); try { window.LumeaI18n && LumeaI18n.apply(l); } catch (e) { } }
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

  /* ---------- Supabase ---------- */
  var SB = CFG.supabase || {};
  function sbReady() { return SB.url && SB.anonKey && SB.url.indexOf('COLE') < 0 && SB.anonKey.indexOf('COLE') < 0; }
  function checkCode(code) {
    return fetch(SB.url.replace(/\/+$/, '') + '/rest/v1/rpc/lp_check', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey },
      body: JSON.stringify({ p_code: code, p_device: deviceId(), p_model: deviceModel() })
    }).then(function (r) { if (!r.ok) throw new Error('net'); return r.json(); });
  }
  function codeError(d) {
    if (!d || d.err === 'notfound') return 'Código não encontrado. Confira os números e tente de novo.';
    if (d.err === 'blocked') return 'Este código está bloqueado. Fale com seu revendedor.';
    if (d.err === 'expired') return 'Este código venceu em ' + fmtDate(d.expires_at) + '. Fale com seu revendedor para renovar.';
    if (d.err === 'device') return 'Este código já está sendo usado em outro aparelho.';
    if (d.err === 'locked') return 'Muitas tentativas erradas. Aguarde alguns minutos e tente de novo.';
    return '';
  }
  function validate(code) {
    if (CFG.demo && code === DEMO_CODE) return Promise.resolve({ ok: { code: code, name: 'Demonstração', m3u: 'demo:', status: 'ativo', expiresAt: new Date(Date.now() + 30 * 864e5).toISOString() } });
    if (!sbReady()) return Promise.resolve({ err: 'O painel ainda não foi configurado. Fale com seu revendedor.' });
    return checkCode(code).then(function (d) {
      var e = codeError(d);
      if (e) return { err: e, bad: !d || d.err === 'notfound' };
      return { ok: { code: code, name: d.name || '', m3u: d.m3u, expiresAt: d.expires_at, status: 'ativo' } };
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
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (!r.body || !r.body.getReader || !window.TextDecoder) return r.text();
      var rd = r.body.getReader(), dec = new TextDecoder('utf-8'), parts = [], got = 0, tot = +r.headers.get('content-length') || 0, last = 0;
      function pump() {
        return rd.read().then(function (x) {
          if (x.done) { parts.push(dec.decode()); return parts.join(''); }
          got += x.value.length; parts.push(dec.decode(x.value, { stream: true }));
          var now = Date.now();
          if (now - last > 150) { last = now; loading('Baixando canais, filmes e séries…', (got / 1048576).toFixed(1).replace('.', ',') + ' MB baixados', tot ? 20 + got / tot * 55 : Math.min(72, 20 + got / 1048576 * 4)); }
          return pump();
        });
      }
      return pump();
    });
  }
  function loadList(refresh) {
    loading(refresh ? 'Atualizando sua lista…' : 'Conectando ao servidor…', '', 8);
    return fetchList(Session.get().m3u, refresh).then(function (txt) {
      loading('Organizando canais, filmes e séries…', '', 82);
      return new Promise(function (res) { setTimeout(function () { res(txt); }, 60); });
    }).then(function (txt) {
      var p = M3U.parse(txt);
      if (!p.live.length && !p.movies.length && !p.series.length) throw new Error('vazia');
      DATA = p; DATA.byId = {};
      p.live.concat(p.movies, p.series).forEach(function (x) { DATA.byId[x.id] = x; });
      p.series.forEach(function (s) { s.seasonList.forEach(function (k) { s.seasons[k].forEach(function (e) { DATA.byId[e.id] = e; }); }); });
      store.set('updated', Date.now());
      loading('Tudo pronto!', p.live.length + ' canais · ' + p.movies.length + ' filmes · ' + p.series.length + ' séries', 100);
      return new Promise(function (res) { setTimeout(function () { loading(); res(DATA); }, 450); });
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
    var payload = { url: it.url, title: titleFor(it), sub: it.group || '', id: it.id, type: it.type === 'live' ? 'live' : 'vod', start: Math.floor((opts.start || 0) * 1000), index: idx, resize: store.get('resize', 'fit'), buf: store.get('buf', 'alto'), q: store.get('vq', 'auto') };
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

  /* player web (LG / Samsung / navegador)
     - HLS (.m3u8) pelo hls.js (MSE: a TV decodifica por hardware), sem limite de resolução,
       começa em qualidade alta e sobe rápido / desce devagar
     - outros formatos, ou se o hls.js não existir / falhar: <video> nativo da TV
     - tecla vermelha / Menu / Info troca a qualidade (Auto → maior → … → menor) */
  var FIT = { fit: 'contain', fill: 'cover', zoom: 'fill' };
  var WebPlayer;
  WebPlayer = {
    isOpen: false, list: [], idx: 0, p: null, hideT: null, hls: null, url: '', title: '', q: -1, fails: 0,
    open: function (p, list) {
      this.p = p; this.list = list || []; this.idx = p.index || 0; this.isOpen = true;
      var v = $('#wv'); v.style.objectFit = FIT[p.resize] || 'contain';
      $('#wp').classList.remove('hide'); this.load(p.url, p.title, p.start / 1000);
    },
    hlsCfg: function (live) {
      return {
        enableWorker: true, lowLatencyMode: false,
        capLevelToPlayerSize: false, startLevel: -1,
        abrEwmaDefaultEstimate: 8000000, abrBandWidthFactor: 0.95, abrBandWidthUpFactor: 0.85,
        maxBufferLength: 30, maxMaxBufferLength: 60, backBufferLength: live ? 10 : 30, maxBufferSize: 60 * 1000 * 1000,
        liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 10, maxLiveSyncPlaybackRate: 1.05,
        fragLoadingMaxRetry: 6, manifestLoadingMaxRetry: 4, levelLoadingMaxRetry: 4
      };
    },
    stopHls: function () { if (this.hls) { try { this.hls.destroy(); } catch (e) { } this.hls = null; } },
    native: function (v, url) { this.stopHls(); v.src = url; var pr = v.play(); if (pr && pr.catch) pr.catch(function () { }); },
    load: function (url, title, start) {
      var self = this, v = $('#wv'); this.url = url; this.title = title; this.q = -1; this.fails = 0;
      $('#wt').textContent = title; $('#wq').textContent = '';
      this.stopHls(); v.removeAttribute('src');
      v.onloadedmetadata = function () { if (start) v.currentTime = start; self.info(); };
      v.onresize = function () { self.info(); };
      v.onerror = function () { if (!self.hls) toast('Não foi possível reproduzir este conteúdo.'); };
      v.ontimeupdate = function () { if (v.duration && isFinite(v.duration)) { $('#wb').style.width = (v.currentTime / v.duration * 100) + '%'; $('#wc').textContent = fmtTime(v.currentTime); $('#wd').textContent = fmtTime(v.duration); } };
      var H = window.Hls, useHls = false;
      try { useHls = !!(H && H.isSupported() && /\.m3u8(\?|$)/i.test(url)); } catch (e) { }
      if (useHls) {
        try {
          var h = new H(this.hlsCfg(this.p.type === 'live')); this.hls = h;
          h.on(H.Events.MANIFEST_PARSED, function () {
            if (store.get('vq', 'auto') === 'max' && h.levels.length > 1) { self.q = h.levels.length - 1; h.currentLevel = self.q; }
            var pr = v.play(); if (pr && pr.catch) pr.catch(function () { }); self.info();
          });
          h.on(H.Events.LEVEL_SWITCHED, function () { self.info(); });
          h.on(H.Events.ERROR, function (ev, d) {
            if (!d || !d.fatal) return;
            self.fails++;
            if (self.fails <= 3 && d.type === H.ErrorTypes.NETWORK_ERROR) { setTimeout(function () { if (self.hls === h) h.startLoad(); }, 1000 * self.fails); return; }
            if (self.fails <= 3 && d.type === H.ErrorTypes.MEDIA_ERROR) { h.recoverMediaError(); return; }
            self.native(v, url); // fallback silencioso para o player nativo da TV
          });
          h.loadSource(url); h.attachMedia(v);
        } catch (e) { this.native(v, url); }
      } else this.native(v, url);
      this.osd();
    },
    /* resolução atual e quantas qualidades o canal tem */
    info: function () {
      var v = $('#wv'), h = this.hls, hh = v.videoHeight || 0, txt = hh ? hh + 'p' : '';
      if (h && h.levels && h.levels.length) {
        var lv = h.levels[h.currentLevel] || h.levels[h.loadLevel];
        if (!hh && lv && lv.height) txt = lv.height + 'p';
        var en = LANG === 'en', n = h.levels.length;
        txt += (txt ? ' · ' : '') + (this.q < 0 ? (en ? 'Auto' : 'Automática') : 'Manual');
        txt += ' · ' + (n > 1 ? n + (en ? ' qualities' : ' qualidades') : (en ? 'single quality' : 'qualidade única'));
        if (h.bandwidthEstimate) txt += ' · ' + Math.round(h.bandwidthEstimate / 1000).toLocaleString(en ? 'en-US' : 'pt-BR') + ' kbps';
      }
      $('#wq').textContent = txt;
    },
    cycleQuality: function () {
      var h = this.hls;
      if (!h || !h.levels || h.levels.length < 2) { toast('Este canal tem uma qualidade só.'); return; }
      // Auto → maior → … → menor → Auto
      if (this.q < 0) this.q = h.levels.length - 1; else this.q--;
      h.currentLevel = this.q; // -1 = automática
      var lv = h.levels[this.q];
      toast(this.q < 0 ? 'Qualidade: Automática' : 'Qualidade: ' + (lv.height ? lv.height + 'p' : Math.round(lv.bitrate / 1000) + ' kbps'));
      this.info();
    },
    osd: function () { var o = $('#wp .ov'); this.info(); o.style.opacity = 1; clearTimeout(this.hideT); this.hideT = setTimeout(function () { o.style.opacity = 0; }, 4000); },
    close: function () {
      var v = $('#wv'); var r = { id: this.p.id, type: this.p.type, pos: (v.currentTime || 0) * 1000, dur: (isFinite(v.duration) ? v.duration : 0) * 1000, index: this.idx };
      this.stopHls(); v.pause(); v.removeAttribute('src'); try { v.load(); } catch (e) { }
      this.isOpen = false; $('#wp').classList.add('hide'); onPlayerResult(r);
    },
    key: function (k) {
      var v = $('#wv'); this.osd();
      if (k === 'back') this.close();
      else if (k === 'opt') this.cycleQuality();
      else if (k === 'ok') { if (v.paused) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () { }); } else v.pause(); }
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
  var ACT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫'];
  function ActScreen(msg) { this.code = ''; this.f = 0; this.msg = msg || ''; }
  ActScreen.prototype.mount = function (r) {
    r.innerHTML = '<div class="screen act2">' +
      '<div class="a2-top"><div class="logo"><b></b><span>Lumea<em>Play</em></span></div><div class="a2-dev"><span>ID do aparelho</span><b>' + esc(deviceId()) + '</b></div></div>' +
      '<div class="a2-main"><span class="a2-kicker">Ativação</span><h1>Ative o LumeaPlay</h1><p class="a2-sub" id="amsg"></p>' +
      '<div class="a2-code" id="acode"></div><div class="a2-keys" id="akp"></div><div class="a2-acts" id="aacts"></div></div>' +
      '<div class="a2-steps"><div><b>1</b><span>Receba o código de 9 dígitos do seu revendedor</span></div><div><b>2</b><span>Digite pelo controle remoto ou pelo teclado da tela</span></div><div><b>3</b><span>Aperte Entrar e comece a assistir</span></div></div></div>';
    this.draw();
  };
  ActScreen.prototype.draw = function () {
    var c = this.code, h = '', f = this.f;
    for (var g = 0; g < 3; g++) { h += '<div class="g">'; for (var k = 0; k < 3; k++) { var i = g * 3 + k; h += '<div class="d ' + (i < c.length ? 'fill ' : '') + (i === c.length ? 'cur' : '') + '">' + (c[i] || '') + '</div>'; } h += '</div>'; }
    $('#acode').innerHTML = h;
    $('#akp').innerHTML = ACT_KEYS.map(function (k, i) { return '<div class="' + (i === f ? 'on' : '') + (k === '⌫' ? ' del' : '') + '">' + k + '</div>'; }).join('');
    $('#aacts').innerHTML = '<div class="a2-btn pri ' + (f === 11 ? 'on' : '') + '">Entrar</div><div class="a2-btn ' + (f === 12 ? 'on' : '') + '">Usar link M3U</div>';
    var m = $('#amsg'); m.textContent = this.msg || 'Digite o código de 9 dígitos enviado pelo seu revendedor.'; m.classList.toggle('err', !!this.msg);
  };
  ActScreen.prototype.type = function (d) { if (this.code.length < 9) { this.code += d; this.msg = ''; if (this.code.length === 9) this.f = 11; this.draw(); } };
  ActScreen.prototype.key = function (k) {
    if (/^d\d$/.test(k)) { this.type(k[1]); return true; }
    var f = this.f;
    if (k === 'left') { if (f > 0 && f <= 10) this.f--; else if (f === 12) this.f = 11; }
    else if (k === 'right') { if (f < 10) this.f++; else if (f === 11) this.f = 12; }
    else if (k === 'down') { if (f <= 10) this.f = f < 6 ? 11 : 12; }
    else if (k === 'up') { if (f >= 11) this.f = f === 11 ? 4 : 7; }
    else if (k === 'ok') {
      if (f === 12) { App.push(new M3UScreen()); return true; }
      if (f === 11) { this.submit(); return true; }
      if (f === 10) { this.code = this.code.slice(0, -1); this.msg = ''; }
      else this.type(ACT_KEYS[f]);
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

  /* ===== Criar perfil ===== */
  var PK = [];
  (function () {
    ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZÇÃÉ-'].forEach(function (r, ri) { r.split('').forEach(function (c, ci) { PK.push({ t: c, v: c, r: ri, c0: ci, c1: ci }); }); });
    [['Espaço', ' ', 0, 3], ['Apagar', 'del', 4, 6], ['Limpar', 'clear', 7, 9]].forEach(function (x) { PK.push({ t: x[0], v: x[1], r: 3, c0: x[2], c1: x[3] }); });
    PK.push({ t: 'kids', v: 'kids', r: 4, c0: 0, c1: 4 });
    PK.push({ t: 'Continuar', v: 'go', r: 4, c0: 5, c1: 9 });
  })();
  function gridMove(keys, i, k) {
    var cur = keys[i];
    function row(r) { return keys.filter(function (x) { return x.r === r; }); }
    if (k === 'left' || k === 'right') { var rr = row(cur.r), j = rr.indexOf(cur) + (k === 'left' ? -1 : 1); return j >= 0 && j < rr.length ? keys.indexOf(rr[j]) : i; }
    var tr = cur.r + (k === 'up' ? -1 : 1), col = Math.round((cur.c0 + cur.c1) / 2);
    var t = row(tr).filter(function (x) { return x.c0 <= col && x.c1 >= col; })[0] || row(tr)[0];
    return t ? keys.indexOf(t) : -1;
  }
  function NewProfileScreen(first) { this.first = first; this.name = ''; this.av = Prof.list().length % AVS.length; this.kids = false; this.z = 'av'; this.k = 0; this.msg = ''; }
  NewProfileScreen.prototype.mount = function (r) {
    r.innerHTML = '<div class="screen setup"><div class="su-top"><div class="logo"><b></b><span>Lumea<em>Play</em></span></div>' + (this.first ? '<span class="su-step">Passo 1 de 2</span>' : '') + '</div>' +
      '<div class="su-card np"><div class="np-l"><div class="np-av" id="npav"></div><div class="np-name" id="npname"></div><div class="np-tag" id="nptag"></div></div>' +
      '<div class="np-r"><h1>' + (this.first ? 'Crie seu perfil' : 'Novo perfil') + '</h1><p class="su-sub" id="npmsg"></p><div class="np-avs" id="npavs"></div><div class="np-field" id="npfield"></div><div class="mkb np-kb" id="npkb"></div></div></div></div>';
    this.draw();
  };
  NewProfileScreen.prototype.draw = function () {
    var self = this, av = this.av;
    $('#npav').style.background = AVBG[av]; $('#npav').textContent = AVS[av];
    $('#npname').textContent = this.name || 'Seu nome';
    $('#nptag').textContent = this.kids ? 'Perfil infantil' : 'Perfil padrão';
    $('#npavs').innerHTML = AVS.map(function (a, i) { return '<div class="' + (i === av ? 'cur ' : '') + (self.z === 'av' && self.k === i ? 'on' : '') + '" style="background:' + AVBG[i] + '">' + a + '</div>'; }).join('');
    $('#npfield').innerHTML = (this.name ? esc(this.name) : '<em>Digite o nome do perfil</em>') + '<i class="cur"></i>';
    $('#npkb').innerHTML = PK.map(function (x, i) {
      var t = x.v === 'kids' ? 'Infantil: ' + (self.kids ? 'Sim' : 'Não') : x.t;
      return '<div style="grid-row:' + (x.r + 1) + ';grid-column:' + (x.c0 + 1) + '/' + (x.c1 + 2) + '" class="' + (self.z === 'kb' && i === self.k ? 'on ' : '') + (x.v === 'go' ? 'go ' : '') + (x.t.length > 1 ? 'sp' : '') + '">' + esc(t) + '</div>';
    }).join('');
    var m = $('#npmsg'); m.textContent = this.msg || 'Escolha um avatar e digite o seu nome.'; m.classList.toggle('err', !!this.msg);
  };
  NewProfileScreen.prototype.typeChar = function (t) { if (/^[\wÀ-ú \-]$/i.test(t) && this.name.length < 16) { this.name = (this.name + t).replace(/^\s+/, ''); if (this.name.length === 1) this.name = this.name.toUpperCase(); this.msg = ''; this.draw(); } };
  NewProfileScreen.prototype.save = function () {
    var nm = this.name.trim();
    if (!nm) { this.msg = 'Digite um nome para o perfil.'; this.draw(); return; }
    var p = { id: 'p' + Date.now().toString(36), name: nm, av: this.av, kids: this.kids };
    if (this.first) { store.set('profiles', [p]); Prof.use(p); App.show(new LangScreen(true)); }
    else { var l = Prof.list(); l.push(p); store.set('profiles', l); toast('Perfil "' + nm + '" criado'); App.pop(); }
  };
  NewProfileScreen.prototype.key = function (k) {
    if (/^d\d$/.test(k)) return true;
    if (this.z === 'av') {
      if (k === 'left' && this.k > 0) this.av = --this.k;
      else if (k === 'right' && this.k < AVS.length - 1) this.av = ++this.k;
      else if (k === 'ok') this.av = this.k;
      else if (k === 'down') { this.av = this.k; this.z = 'kb'; this.k = 0; }
      else return k !== 'back';
      this.draw(); return true;
    }
    if (k === 'up' || k === 'down' || k === 'left' || k === 'right') {
      var j = gridMove(PK, this.k, k);
      if (j < 0) { if (k === 'up') { this.z = 'av'; this.k = this.av; } } else this.k = j;
    } else if (k === 'ok') {
      var v = PK[this.k].v;
      if (v === 'go') { this.save(); return true; }
      if (v === 'kids') this.kids = !this.kids;
      else if (v === 'del') this.name = this.name.slice(0, -1);
      else if (v === 'clear') this.name = '';
      else { this.typeChar(v === ' ' ? ' ' : (this.name ? v.toLowerCase() : v)); return true; }
    } else if (k === 'back') { if (this.name) { this.name = this.name.slice(0, -1); } else return false; }
    else return false;
    this.draw(); return true;
  };

  /* ===== Idioma ===== */
  function LangScreen(first) { this.first = first; this.sel = store.get('lang', 'pt') === 'en' ? 1 : 0; this.f = this.sel; }
  LangScreen.prototype.mount = function (r) { this.r = r; this.draw(); };
  LangScreen.prototype.draw = function () {
    var self = this;
    var opts = [['pt', 'Português', 'Brasil', 'BR'], ['en', 'English', 'United States', 'US']];
    this.r.innerHTML = '<div class="screen setup"><div class="su-top"><div class="logo"><b></b><span>Lumea<em>Play</em></span></div>' + (this.first ? '<span class="su-step">Passo 2 de 2</span>' : '') + '</div>' +
      '<div class="su-card lang"><h1>Escolha o idioma</h1><p class="su-sub">Selecione uma opção e confirme.</p><div class="lg-opts">' +
      opts.map(function (o, i) { return '<div class="lg-opt ' + (i === self.sel ? 'sel ' : '') + (i === self.f ? 'on' : '') + '"><span class="cc">' + o[3] + '</span><b>' + o[1] + '</b><small>' + o[2] + '</small><i class="ck">' + (i === self.sel ? '✓' : '') + '</i></div>'; }).join('') +
      '</div><div class="a2-btn pri wide ' + (this.f === 2 ? 'on' : '') + '">Confirmar</div></div></div>';
  };
  LangScreen.prototype.key = function (k) {
    if (k === 'left' && this.f === 1) this.f = 0;
    else if (k === 'right' && this.f === 0) this.f = 1;
    else if (k === 'down' && this.f < 2) this.f = 2;
    else if (k === 'up' && this.f === 2) this.f = this.sel;
    else if (k === 'ok') {
      if (this.f < 2) { this.sel = this.f; this.f = 2; }
      else {
        setLang(this.sel === 1 ? 'en' : 'pt');
        if (this.first) { store.set('setup', 1); App.show(new HomeScreen(0)); } else { App.pop(); toast(LANG === 'en' ? 'Language updated' : 'Idioma atualizado'); }
        return true;
      }
    } else return k !== 'back';
    this.draw(); return true;
  };


  /* ===== Entrar com link M3U ===== */
  var MK = [];
  (function () {
    var rows = ['1234567890', 'qwertyuiop', 'asdfghjkl:', 'zxcvbnm./-', '_?=&@%+~#,'];
    rows.forEach(function (r, ri) { r.split('').forEach(function (c, ci) { MK.push({ t: c, v: c, r: ri, c0: ci, c1: ci }); }); });
    [['⇧ ABC', 'shift'], ['http://', 'http://'], ['https://', 'https://'], ['.com', '.com'], ['⌫ Apagar', 'del']].forEach(function (x, i) { MK.push({ t: x[0], v: x[1], r: 5, c0: i * 2, c1: i * 2 + 1 }); });
    [[':8080', ':8080'], ['get.php?', 'get.php?'], ['username=', 'username='], ['&password=', '&password='], ['Limpar', 'clear']].forEach(function (x, i) { MK.push({ t: x[0], v: x[1], r: 6, c0: i * 2, c1: i * 2 + 1 }); });
    MK.push({ t: 'Carregar lista →', v: 'go', r: 7, c0: 0, c1: 9 });
  })();
  function M3UScreen() { this.url = store.get('lastM3U', ''); this.k = 0; this.up = false; this.msg = ''; }
  M3UScreen.prototype.mount = function (r) {
    r.innerHTML = '<div class="screen m3u"><div class="logo"><b></b><span>Lumea<em>Play</em></span></div><div class="mcard"><span class="step">LINK M3U</span><h2>Entrar com sua lista</h2><p class="sub" id="mmsg"></p>' +
      '<div class="murl" id="murl"></div><div class="mkb" id="mkb"></div><p class="mtip">Dica: com teclado ou celular conectado você também pode digitar ou colar o link. <b>Voltar</b> retorna para o código.</p></div></div>';
    this.draw();
  };
  M3UScreen.prototype.draw = function () {
    var self = this, u = this.url;
    $('#murl').innerHTML = (u ? '<span>' + esc(u) + '</span>' : '<em>http://servidor:porta/get.php?username=...&amp;password=...&amp;type=m3u_plus</em>') + '<i class="cur"></i>';
    $('#mkb').innerHTML = MK.map(function (x, i) {
      var t = x.t.length === 1 && self.up ? x.t.toUpperCase() : x.t;
      return '<div style="grid-row:' + (x.r + 1) + ';grid-column:' + (x.c0 + 1) + '/' + (x.c1 + 2) + '" class="' + (i === self.k ? 'on ' : '') + (x.v === 'go' ? 'go ' : '') + (x.v === 'shift' && self.up ? 'act ' : '') + (x.t.length > 1 ? 'sp' : '') + '">' + esc(t) + '</div>';
    }).join('');
    var m = $('#mmsg'); m.textContent = this.msg || 'Digite o link da sua lista (M3U) pelo controle.'; m.classList.toggle('err', !!this.msg);
  };
  M3UScreen.prototype.typeChar = function (t) { this.url = (this.url + t).replace(/[\r\n\t]/g, '').slice(0, 1000); this.msg = ''; this.draw(); };
  M3UScreen.prototype.submit = function () {
    var u = this.url.trim();
    if (!/^https?:\/\/[^\s]+\.[^\s]+|^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(u)) { this.msg = 'Link inválido. Ele precisa começar com http:// ou https://'; this.draw(); return; }
    store.set('lastM3U', u);
    Session.set({ code: 'm3u', name: 'Lista própria', m3u: u, expiresAt: null, status: 'ativo' });
    startMain();
  };
  M3UScreen.prototype.key = function (k) {
    var cur = MK[this.k], self = this;
    function row(r) { return MK.filter(function (x) { return x.r === r; }); }
    if (/^d\d$/.test(k)) { this.typeChar(k[1]); return true; }
    if (k === 'left' || k === 'right') {
      var rr = row(cur.r), idx = rr.indexOf(cur) + (k === 'left' ? -1 : 1);
      if (idx >= 0 && idx < rr.length) this.k = MK.indexOf(rr[idx]);
    } else if (k === 'up' || k === 'down') {
      var tr = cur.r + (k === 'up' ? -1 : 1); if (tr < 0 || tr > 7) return true;
      var col = cur.r === 7 ? 4 : cur.c0, t = row(tr).filter(function (x) { return x.c0 <= col && x.c1 >= col; })[0];
      if (t) this.k = MK.indexOf(t);
    } else if (k === 'ok') {
      var v = cur.v;
      if (v === 'go') { this.submit(); return true; }
      if (v === 'shift') this.up = !this.up;
      else if (v === 'del') this.url = this.url.slice(0, -1);
      else if (v === 'clear') this.url = '';
      else this.url += (v.length === 1 && this.up) ? v.toUpperCase() : v;
      this.msg = '';
    } else if (k === 'back') { if (this.url && false) { } return false; }
    else return false;
    this.draw(); return true;
  };

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
        App.push(new NewProfileScreen(false)); return true;
      } else { Prof.use(l[this.f]); App.show(new HomeScreen()); return true; }
    } else if (k === 'back') { if (this.edit) { this.edit = false; this.f = 0; } else return false; }
    else return false;
    this.draw(); return true;
  };

  /* ===== Home com abas ===== */
  var TABS = [['tv', 'Canais'], ['film', 'Filmes'], ['ser', 'Séries'], ['rec', 'Playback'], ['cog', 'Configurações']];
  var NT = TABS.length;
  function HomeScreen(tab) { this.tab = tab || store.get('lastTab', 0); this.zone = 'tab'; this.nf = this.tab; this.tabs = {}; }
  HomeScreen.prototype.mount = function (r) {
    var p = Prof.cur();
    r.innerHTML = '<div class="screen"><div id="tab"></div><div class="nav"><div class="nl"><div class="logo"><b></b><span>Lumea<em>Play</em></span></div><span id="clock"></span></div><div class="items" id="navi"></div>' +
      '<div class="right"><span class="ib" id="nsr">' + IC.search + '</span><div class="av" id="nav-av" style="background:' + AVBG[p.av % AVBG.length] + '">' + AVS[p.av % AVS.length] + '</div></div></div></div>';
    this.drawNav(); tick(); this.openTab(this.tab, true);
  };
  HomeScreen.prototype.drawNav = function () {
    var self = this;
    $('#navi').innerHTML = TABS.map(function (t, i) { return '<div class="' + (self.zone === 'nav' && self.nf === i ? 'on' : i === self.tab ? 'sel' : '') + '">' + t[1] + '</div>'; }).join('');
    $('#nsr').classList.toggle('on', this.zone === 'nav' && this.nf === NT);
    $('#nav-av').classList.toggle('on', this.zone === 'nav' && this.nf === NT + 1);
  };
  HomeScreen.prototype.openTab = function (i, focus) {
    this.tab = i; store.set('lastTab', i);
    if (!this.tabs[i]) this.tabs[i] = i === 0 ? new LiveTab() : i === 1 ? new VodTab('movies') : i === 2 ? new VodTab('series') : i === 3 ? new PlaybackTab() : new SettingsTab();
    var el = $('#tab'); el.innerHTML = ''; this.tabs[i].mount(el);
    if (focus) { this.zone = 'tab'; this.tabs[i].focus(true); } else this.tabs[i].focus(false);
    this.drawNav();
  };
  HomeScreen.prototype.key = function (k) {
    if (this.zone === 'nav') {
      if (k === 'left' && this.nf > 0) { this.nf--; if (this.nf < NT) this.openTab(this.nf, false); }
      else if (k === 'right' && this.nf < NT + 1) { this.nf++; if (this.nf < NT) this.openTab(this.nf, false); }
      else if (k === 'down' || (k === 'ok' && this.nf < NT)) { this.nf = Math.min(this.nf, NT - 1); if (this.nf !== this.tab) this.openTab(this.nf, false); this.zone = 'tab'; this.tabs[this.tab].focus(true); }
      else if (k === 'ok' && this.nf === NT) { App.push(new SearchScreen()); return true; }
      else if (k === 'ok' && this.nf === NT + 1) { App.show(new ProfScreen()); return true; }
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
  /* nome do canal sem a qualidade (SD, HD, FHD, 4K…): ela já aparece na etiqueta ao lado */
  var QRE = /[\[(|]?\s*\b(?:SD|HD|FHD|UHD|4K|8K|HDR|HEVC|H\.?265|H\.?264|1080[pi]?|720p?|2160p?|480p?)\b\s*[\])|]?/gi;
  function cname(n) { var c = String(n || '').replace(/[ᴴᴰ²³]+/g, ' ').replace(QRE, ' ').replace(/\s*[-|:]\s*$/, '').replace(/\s{2,}/g, ' ').trim(); return c || String(n || ''); }
  function logoHTML(it) { return '<span class="lgo">' + esc(initials(it.name)) + img(it.logo) + '</span>'; }
  function quality(n) {
    n = String(n || '');
    if (/\b(4k|uhd|2160p?)\b/i.test(n)) return '4K'; if (/\b(fhd|1080p?)\b/i.test(n)) return 'FHD';
    if (/\b(hd|720p?)\b/i.test(n)) return 'HD'; if (/\bsd\b/i.test(n)) return 'SD'; return '';
  }
  var SV = {
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    hd: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4M10 10v4M7 12h3M13 10v4h2a2 2 0 0 0 0-4z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
    redo: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/></svg>'
  };

  /* ---------- guia de programação (EPG) ---------- */
  function b64(s) { if (!s) return ''; try { return decodeURIComponent(escape(atob(s))); } catch (e) { try { return atob(s); } catch (e2) { return String(s); } } }
  function xtream(url) { var m = String(url || '').match(/^(https?:\/\/[^\/?#]+)\/(?:live\/)?([^\/?#]+)\/([^\/?#]+)\/(\d+)(?:\.[a-z0-9]+)?(?:[?#].*)?$/i); return m ? { base: m[1], user: m[2], pass: m[3], id: m[4] } : null; }
  function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  var DEMO_SHOWS = ['Jornal da Manhã', 'Futebol ao Vivo', 'Mesa Redonda', 'Cine Tarde', 'Documentário', 'Show da Noite', 'Esporte Total', 'Novela das Nove', 'Desenhos', 'Telejornal'];
  function demoEpg(it) {
    var h = 0, id = String(it.id) + it.name; for (var z = 0; z < id.length; z++) h = (h * 31 + id.charCodeAt(z)) >>> 0; var s = Date.now() - (h % 50 + 5) * 60000, out = [];
    for (var k = 0; k < 6; k++) { var len = (30 + ((h + k * 7) % 4) * 30) * 60000; out.push({ t: DEMO_SHOWS[(h + k) % DEMO_SHOWS.length], d: 'Programa de exemplo da lista de demonstração.', s: s, e: s + len }); s += len; }
    return out;
  }
  var EPG = {
    c: {}, q: [], run: 0, cb: null,
    get: function (it) { var e = it && this.c[it.id]; if (!e) return null; var now = Date.now(); e.list = e.list.filter(function (p) { return p.e > now; }); return e; },
    want: function (it, front) {
      if (!it || it.type !== 'live') return;
      var e = this.c[it.id]; if (e && Date.now() - e.t < 15 * 60000) return;
      var i = this.q.indexOf(it); if (i >= 0) this.q.splice(i, 1);
      if (front) this.q.unshift(it); else this.q.push(it);
      if (this.q.length > 24) this.q.length = 24;
      this.pump();
    },
    pump: function () {
      var self = this;
      while (this.run < 3 && this.q.length) {
        (function (it) {
          self.run++;
          self.load(it).then(function (l) { self.c[it.id] = { t: Date.now(), list: l }; }, function () { self.c[it.id] = { t: Date.now(), list: [] }; })
            .then(function () { self.run--; if (self.cb) self.cb(it); self.pump(); });
        })(this.q.shift());
      }
    },
    load: function (it) {
      var s = Session.get();
      if (s && s.m3u === 'demo:') return Promise.resolve(demoEpg(it));
      var x = xtream(it.url); if (!x) return Promise.resolve([]);
      var api = x.base + '/player_api.php?username=' + encodeURIComponent(x.user) + '&password=' + encodeURIComponent(x.pass) + '&action=get_short_epg&stream_id=' + x.id + '&limit=8';
      return fetch(N ? '/proxy?mem=1&url=' + encodeURIComponent(api) : api).then(function (r) { if (!r.ok) throw new Error('epg'); return r.json(); }).then(function (j) {
        return ((j && j.epg_listings) || []).map(function (p) { return { t: b64(p.title), d: b64(p.description), s: +p.start_timestamp * 1000, e: +p.stop_timestamp * 1000 }; })
          .filter(function (p) { return p.t && p.e > Date.now(); }).sort(function (a, b) { return a.s - b.s; });
      });
    }
  };
  function nowProg(it) { var e = EPG.get(it); if (!e || !e.list.length) return null; return e.list[0].s <= Date.now() ? e.list[0] : null; }
  function pct(p) { return Math.max(0, Math.min(100, (Date.now() - p.s) / (p.e - p.s) * 100)); }

  function LiveTab() { this.mode = 'cats'; this.ci = 0; this.zone = 'list'; this.bi = 0; this.chIdx = {}; }
  LiveTab.prototype.cats = function () {
    var live = DATA.live.filter(allowed), byId = DATA.byId;
    var fav = favs().map(function (id) { return byId[id]; }).filter(function (x) { return x && x.type === 'live' && allowed(x); });
    var rec = Prof.get('rec', []).map(function (id) { return byId[id]; }).filter(function (x) { return x && allowed(x); });
    var out = [{ name: 'Favoritos', items: fav }, { name: 'Recentes', items: rec }, { name: 'Todos os canais', items: live }];
    M3U.groups(live).forEach(function (g) { out.push({ name: g.name, items: g.items }); });
    return out;
  };
  LiveTab.prototype.mount = function (el) {
    var self = this;
    el.innerHTML = '<div class="lv-left"><div class="lv-head" id="lvh"></div><div id="lvl" class="lv-list"></div></div><div class="lv-pv" id="pv"></div><div class="lv-now" id="lvn"></div><div class="lv-next" id="lvx"></div>';
    this.C = this.cats();
    if (this.first !== false) { this.first = false; this.ci = this.C[1].items.length ? 1 : this.C[0].items.length ? 0 : 2; }
    EPG.cb = function (it) {
      if (!document.getElementById('lvl') || !self.vl) return;
      clearTimeout(self.rt);
      self.rt = setTimeout(function () { if (self.mode === 'chs') self.vl.refresh(); self.preview(); }, 150);
    };
    this.build();
  };
  LiveTab.prototype.wantVisible = function () {
    var self = this; clearTimeout(this.wt);
    this.wt = setTimeout(function () {
      if (!self.vl) return;
      var cur = self.current(); if (cur) EPG.want(cur, true);
      if (self.mode !== 'chs') return;
      for (var k = self.vl.top; k < Math.min(self.vl.items.length, self.vl.top + 9); k++) EPG.want(self.vl.items[k]);
    }, 180);
  };
  LiveTab.prototype.build = function () {
    var self = this;
    if (this.mode === 'cats') {
      $('#lvh').innerHTML = '<span class="lbl">Categorias</span><em>' + (this.C.length - 3) + '</em>';
      this.vl = new VList($('#lvl'), {
        h: 6.2, render: function (c) { return '<div class="lc cat"><div class="tx"><b class="ell">' + esc(c.name) + '</b></div><span class="cnt">' + c.items.length + '</span><div class="ar">›</div></div>'; },
        onFocus: function () { self.preview(); }
      });
      this.vl.set(this.C, this.ci);
    } else {
      var c = this.C[this.ci];
      $('#lvh').innerHTML = '<span class="bk">‹</span><span class="lbl ell">' + esc(c.name) + '</span><em>' + c.items.length + ' canais</em>';
      this.vl = new VList($('#lvl'), {
        h: 8.6, empty: c.name === 'Favoritos' ? 'Nenhum favorito ainda. Escolha um canal, aperte ▶ e depois Favoritar.' : 'Nenhum canal aqui.',
        render: function (it) {
          var q = quality(it.name), p = nowProg(it);
          return '<div class="lc"><div class="th">' + logoHTML(it) + '</div><div class="tx"><div class="nm"><span class="no">' + (it.num || '') + '</span><b class="ell">' + esc(cname(it.name)) + '</b>' + (q ? '<em class="q">' + q + '</em>' : '') + (isFav(it.id) ? '<i class="fv">★</i>' : '') + '</div>' +
            (p ? '<small class="ell">' + esc(p.t) + '</small><div class="pb"><i style="width:' + pct(p) + '%"></i></div>' : '<small class="ell dim">' + esc(it.group) + '</small>') + '</div></div>';
        },
        onFocus: function () { self.preview(); self.wantVisible(); }
      });
      this.vl.set(c.items, this.chIdx[this.ci] || 0);
    }
    this.vl.setActive(this.focused && this.zone === 'list');
    this.preview(); this.wantVisible();
  };
  LiveTab.prototype.current = function () {
    if (this.mode === 'chs') return this.vl.cur();
    var r = Prof.get('rec', []); return r.length ? DATA.byId[r[0]] : null;
  };
  LiveTab.prototype.preview = function () {
    var it = this.current(), pv = $('#pv'), self = this;
    if (!pv) return;
    if (!it) {
      pv.innerHTML = '<div class="pv-c"><div class="logo big"><b></b><span>Lumea<em>Play</em></span></div></div><div class="pv-hint"><span><b>OK</b>Abrir categoria</span></div>';
      $('#lvn').innerHTML = '<div class="sec">Canais ao vivo</div><h2>' + DATA.live.length + ' canais disponíveis</h2><p class="desc">Escolha uma categoria à esquerda e aperte OK para ver os canais.</p>';
      $('#lvx').innerHTML = '<div class="sec">Programação</div><p class="mut">Escolha um canal para ver o que está passando e o que vem a seguir.</p>';
      this.btns = []; return;
    }
    EPG.want(it, true);
    var q = quality(it.name), cats = this.mode === 'cats', e = EPG.get(it), list = e ? e.list : null, p = nowProg(it);
    pv.innerHTML = '<div class="pv-c">' + (it.logo ? '<img src="' + esc(iu(it.logo)) + '" onerror="this.outerHTML=\'<span class=ini>' + esc(initials(it.name)) + '</span>\'">' : '<span class="ini">' + esc(initials(it.name)) + '</span>') + '</div>' +
      '<div class="pv-tags"><span class="live">AO VIVO</span>' + (q ? '<span>' + q + '</span>' : '') + (it.num ? '<span>Canal ' + it.num + '</span>' : '') + '</div>' +
      '<div class="pv-hint">' + (cats ? '<span><b>OK</b>Abrir categoria</span><span><b>▶</b>Continuar assistindo</span>' : '<span><b>OK</b>Assistir</span><span><b>▶</b>Opções</span><span><b>◀</b>Categorias</span>') + '</div>';
    this.btns = cats ? [{ t: SV.play + 'Continuar', fn: 'play' }] : [{ t: SV.play + 'Assistir', fn: 'play' }, { t: isFav(it.id) ? 'Remover dos favoritos' : 'Favoritar', fn: 'fav' }];
    $('#lvn').innerHTML = '<div class="sec">' + (cats ? 'Último canal assistido' : 'Agora no ar') + '</div>' +
      '<h2 class="ell">' + esc(p ? p.t : cname(it.name)) + '</h2><p class="sub ell">' + esc(cname(it.name)) + (p ? ' · ' + hm(p.s) + ' – ' + hm(p.e) : ' · ' + esc(it.group)) + '</p>' +
      (p ? '<div class="pbar"><i style="width:' + pct(p) + '%"></i></div><p class="desc">' + esc(p.d || 'Sem descrição.') + '</p>' : '<p class="desc">' + (e ? 'Este canal não tem guia de programação.' : 'Carregando programação…') + '</p>') +
      '<div class="fns">' + this.btns.map(function (b, i) { return '<div class="fn ' + (i === 0 ? 'pri ' : '') + (self.zone === 'btn' && self.bi === i ? 'on' : '') + '">' + b.t + '</div>'; }).join('') + '</div>';
    var next = list ? list.slice(p ? 1 : 0, (p ? 1 : 0) + 5) : [];
    $('#lvx').innerHTML = '<div class="sec">A seguir</div>' + (next.length ? next.map(function (x) {
      return '<div class="gp"><span class="tm">' + hm(x.s) + '</span><div class="tx"><b class="ell">' + esc(x.t) + '</b><small>' + Math.round((x.e - x.s) / 60000) + ' min</small></div></div>';
    }).join('') : '<p class="mut">' + (e ? 'Sem programação disponível.' : 'Carregando…') + '</p>');
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
    if (w === 'live' && this.vl) { this.C = this.cats(); if (this.mode === 'chs' && it) { var idx = this.C[this.ci].items.indexOf(it); if (idx >= 0) this.vl.i = idx; } this.vl.refresh(); this.preview(); }
  };

  /* ===== Aba Playback (assistir o que já passou) =====
     - canais com arquivo: atributo catchup / catchup-days / timeshift / tvg-rec na lista
       ou tv_archive=1 na API Xtream (get_live_streams)
     - programação do dia: get_simple_data_table; vídeo: /timeshift/usuário/senha/duração/AAAA-MM-DD:HH-MM/id.ts */
  var WD3 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], MO3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function dayStart(off) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - off); return d.getTime(); }
  function isDemo() { var s = Session.get(); return !!(s && s.m3u === 'demo:'); }
  function apiGet(x, action, extra, big) {
    var api = x.base + '/player_api.php?username=' + encodeURIComponent(x.user) + '&password=' + encodeURIComponent(x.pass) + '&action=' + action + (extra || '');
    var u = N ? (big ? '/proxy?cache=1&url=' : '/proxy?mem=1&url=') + encodeURIComponent(api) : api;
    return fetch(u).then(function (r) { if (!r.ok) throw new Error('api'); return r.json(); });
  }
  var Archive = {
    map: null, busy: null,
    /* dias de arquivo por id de canal */
    load: function () {
      if (this.map) return Promise.resolve(this.map);
      if (this.busy) return this.busy;
      var self = this, m = {}, live = DATA.live;
      live.forEach(function (it, i) { if (it.arc) m[it.id] = it.arc; else if (isDemo() && i % 3 === 0) m[it.id] = 7; });
      var x = null; for (var i = 0; i < live.length && !x; i++) x = xtream(live[i].url);
      if (!x || isDemo()) { this.map = m; return Promise.resolve(m); }
      var byStream = {}; live.forEach(function (it) { var y = xtream(it.url); if (y) byStream[y.id] = it.id; });
      this.busy = apiGet(x, 'get_live_streams', '', true).then(function (j) {
        (j || []).forEach(function (s) { var id = byStream[s.stream_id]; if (id && +s.tv_archive === 1) m[id] = Math.max(1, Math.min(14, +s.tv_archive_duration || 3)); });
      }).catch(function () { }).then(function () { self.map = m; self.busy = null; return m; });
      return this.busy;
    },
    c: {},
    /* programas (já começados) do canal, todos os dias de arquivo */
    progs: function (it, days) {
      var key = it.id, e = this.c[key];
      if (e && Date.now() - e.t < 10 * 60000) return Promise.resolve(e.l);
      var self = this, done = function (l) { self.c[key] = { t: Date.now(), l: l }; return l; };
      if (isDemo()) return Promise.resolve(done(this.demo(it, days)));
      var x = xtream(it.url); if (!x) return Promise.resolve([]);
      return apiGet(x, 'get_simple_data_table', '&stream_id=' + x.id).then(function (j) {
        var now = Date.now(), from = dayStart(days);
        return done(((j && j.epg_listings) || []).map(function (p) {
          return { t: b64(p.title), d: b64(p.description), s: +p.start_timestamp * 1000, e: +p.stop_timestamp * 1000, st: String(p.start || ''), arc: +p.has_archive === 1 };
        }).filter(function (p) { return p.t && p.s < now && p.s >= from; }).sort(function (a, b) { return a.s - b.s; }));
      }).catch(function () { return []; });
    },
    demo: function (it, days) {
      var out = [], h = 0, id = String(it.id); for (var z = 0; z < id.length; z++) h = (h * 31 + id.charCodeAt(z)) >>> 0;
      var s = dayStart(days), now = Date.now(), k = 0;
      while (s < now) { var len = (30 + ((h + k * 7) % 4) * 30) * 60000; out.push({ t: DEMO_SHOWS[(h + k) % DEMO_SHOWS.length], d: 'Programa de exemplo da lista de demonstração. Aperte OK para assistir desde o início.', s: s, e: s + len, st: '', arc: true }); s += len; k++; }
      return out;
    },
    url: function (it, p) {
      if (isDemo()) return it.url;
      var x = xtream(it.url); if (!x) return it.url;
      var d = new Date(p.s), st = /^\d{4}-\d\d-\d\d \d\d:\d\d/.test(p.st) ? p.st.slice(0, 10) + ':' + p.st.slice(11, 13) + '-' + p.st.slice(14, 16)
        : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ':' + pad(d.getHours()) + '-' + pad(d.getMinutes());
      var dur = Math.max(1, Math.ceil((p.e - p.s) / 60000)), ext = /\.m3u8(\?|$)/i.test(it.url) ? '.m3u8' : '.ts';
      return x.base + '/timeshift/' + encodeURIComponent(x.user) + '/' + encodeURIComponent(x.pass) + '/' + dur + '/' + st + '/' + x.id + ext;
    }
  };

  function PlaybackTab() { this.zone = 'ch'; this.day = 0; this.ci = 0; this.req = 0; }
  PlaybackTab.prototype.mount = function (el) {
    var self = this; this.el = el;
    el.innerHTML = '<div class="pb-left"><div class="lv-head"><span class="lbl">Playback</span><em id="pbn"></em></div><div id="pbl" class="lv-list"></div></div>' +
      '<div class="pb-main"><div class="pb-top" id="pbt"></div><div class="pb-days" id="pbd"></div>' +
      '<div class="pb-body"><div class="pb-progs"><div class="pb-ph" id="pbh"></div><div id="pbp" class="pb-plist"></div></div><div class="pb-info" id="pbi"></div></div></div>';
    this.vl = new VList($('#pbl'), {
      h: 7.2, empty: 'Carregando canais com Playback…',
      render: function (it) {
        return '<div class="lc"><div class="th">' + logoHTML(it) + '</div><div class="tx"><div class="nm"><span class="no">' + (it.num || '') + '</span><b class="ell">' + esc(cname(it.name)) + '</b>' + (quality(it.name) ? '<em class="q">' + quality(it.name) + '</em>' : '') + '</div>' +
          '<small class="ell">' + self.map[it.id] + (self.map[it.id] > 1 ? ' dias de Playback' : ' dia de Playback') + '</small></div></div>';
      },
      onFocus: function () { clearTimeout(self.ft); self.ft = setTimeout(function () { self.pickChannel(); }, 220); }
    });
    this.pl = new VList($('#pbp'), {
      h: 6, empty: 'Carregando programação…',
      render: function (p) {
        var now = Date.now(), live = p.e > now;
        return '<div class="pr' + (live ? ' nowp' : '') + '"><span class="tm">' + hm(p.s) + '</span><div class="tx"><b class="ell">' + esc(p.t) + '</b><small>' + hm(p.s) + ' – ' + hm(p.e) + ' · ' + Math.round((p.e - p.s) / 60000) + ' min</small></div>' +
          (live ? '<em class="tg">AGORA</em>' : '<em class="pl">' + SV.play + '</em>') + '</div>';
      },
      onFocus: function () { self.info(); }
    });
    $('#pbn').textContent = '…';
    Archive.load().then(function (m) {
      if (!document.getElementById('pbl')) return;
      self.map = m; self.chs = DATA.live.filter(function (it) { return m[it.id] && allowed(it); });
      $('#pbn').textContent = self.chs.length + ' canais';
      if (!self.chs.length) { self.vl.empty = 'Sua lista não tem canais com Playback.'; self.vl.set([]); self.drawEmpty(); return; }
      self.vl.set(self.chs, self.ci); self.sync(); self.pickChannel();
    });
    this.map = {}; this.drawTop(); this.drawDays();
  };
  PlaybackTab.prototype.drawEmpty = function () {
    $('#pbt').innerHTML = '<div class="pb-ch"><div class="tx"><h2>Assista ao que já passou</h2><p>Canais com Playback guardam a programação dos últimos dias para você assistir quando quiser.</p></div></div>';
    $('#pbd').innerHTML = ''; $('#pbh').innerHTML = ''; this.pl.empty = 'Nenhum canal da sua lista oferece Playback.'; this.pl.set([]);
    $('#pbi').innerHTML = '<div class="sec">Como funciona</div><p class="desc">O Playback depende do seu servidor. Quando ele grava os canais, eles aparecem aqui automaticamente.</p>';
  };
  PlaybackTab.prototype.cur = function () { return this.vl && this.vl.cur(); };
  PlaybackTab.prototype.days = function () { var it = this.cur(); return Math.min(7, (it && this.map[it.id]) || 0); };
  PlaybackTab.prototype.drawTop = function () {
    var it = this.cur(); if (!it) return;
    var n = this.map[it.id];
    $('#pbt').innerHTML = '<div class="pb-ch"><div class="th">' + logoHTML(it) + '</div><div class="tx"><h2 class="ell">' + esc(cname(it.name)) + '</h2><p>' + esc(it.group) + ' · Disponível por ' + n + (n > 1 ? ' dias' : ' dia') + '</p></div><span class="rec">● PLAYBACK</span></div>';
  };
  PlaybackTab.prototype.drawDays = function () {
    var n = this.days(), h = '';
    for (var i = 0; i <= n; i++) {
      var d = new Date(dayStart(i)), lb = i === 0 ? 'Hoje' : i === 1 ? 'Ontem' : WD3[d.getDay()];
      h += '<div class="dy' + (i === this.day ? ' sel' : '') + (this.zone === 'day' && i === this.day ? ' on' : '') + '"><small>' + lb + '</small><b>' + d.getDate() + ' ' + MO3[d.getMonth()] + '</b></div>';
    }
    $('#pbd').innerHTML = h;
  };
  PlaybackTab.prototype.pickChannel = function () {
    var it = this.cur(); if (!it) return;
    if (this.day > this.days()) this.day = 0;
    this.drawTop(); this.drawDays(); this.loadDay();
  };
  PlaybackTab.prototype.loadDay = function () {
    var self = this, it = this.cur(), rq = ++this.req; if (!it) return;
    var d0 = dayStart(this.day), d1 = d0 + 86400000, d = new Date(d0);
    $('#pbh').innerHTML = '<span class="lbl">' + (this.day === 0 ? 'Hoje' : this.day === 1 ? 'Ontem' : WD3[d.getDay()]) + ', ' + d.getDate() + ' ' + MO3[d.getMonth()] + '</span><em></em>';
    this.pl.empty = 'Carregando programação…'; this.pl.set([]); this.info();
    Archive.progs(it, this.days()).then(function (all) {
      if (rq !== self.req || !document.getElementById('pbp')) return;
      var l = all.filter(function (p) { return p.s >= d0 && p.s < d1; });
      self.pl.empty = all.length ? 'Nenhum programa gravado neste dia.' : 'Este canal não tem programação para o Playback.';
      $('#pbh em').textContent = l.length ? l.length + (l.length > 1 ? ' programas' : ' programa') : '';
      var start = 0; if (self.day === 0 && l.length) start = Math.max(0, l.length - 2);
      self.pl.set(l, start); self.sync(); self.info();
    });
  };
  PlaybackTab.prototype.info = function () {
    var it = this.cur(), p = this.pl && this.pl.cur(), el = $('#pbi'); if (!el) return;
    if (!it || !p) { el.innerHTML = '<div class="sec">Programa</div><p class="mut">Escolha um programa na lista para ver os detalhes.</p>'; return; }
    var d = new Date(p.s), live = p.e > Date.now();
    el.innerHTML = '<div class="sec">' + (live ? 'Passando agora' : 'Já passou') + '</div><h2 class="ell2">' + esc(p.t) + '</h2>' +
      '<p class="sub">' + WD3[d.getDay()] + ', ' + d.getDate() + ' ' + MO3[d.getMonth()] + ' · ' + hm(p.s) + ' – ' + hm(p.e) + ' · ' + Math.round((p.e - p.s) / 60000) + ' min</p>' +
      '<p class="desc">' + esc(p.d || 'Sem descrição.') + '</p>' +
      '<div class="fns"><div class="fn pri' + (this.zone === 'pr' ? ' on' : '') + '">' + SV.play + (live ? 'Assistir do início' : 'Assistir') + '</div></div>';
  };
  PlaybackTab.prototype.sync = function () {
    if (this.vl) this.vl.setActive(this.focused && this.zone === 'ch');
    if (this.pl) this.pl.setActive(this.focused && this.zone === 'pr');
    if (this.chs && this.chs.length) this.drawDays();
    this.info();
  };
  PlaybackTab.prototype.focus = function (on) { this.focused = on; if (!on) this.zone = 'ch'; this.sync(); };
  PlaybackTab.prototype.play = function () {
    var it = this.cur(), p = this.pl.cur(); if (!it || !p) return;
    var d = new Date(p.s);
    play({ type: 'movie', id: 'pb:' + it.id + ':' + p.s, name: it.name + ' · ' + p.t, title: it.name + ' · ' + p.t, group: WD3[d.getDay()] + ', ' + d.getDate() + ' ' + MO3[d.getMonth()] + ' · ' + hm(p.s) + ' – ' + hm(p.e), url: Archive.url(it, p) });
  };
  PlaybackTab.prototype.key = function (k) {
    if (!this.chs || !this.chs.length) return false;
    if (this.zone === 'ch') {
      if (k === 'up') return this.vl.move(-1);
      if (k === 'down') { this.vl.move(1); return true; }
      if (k === 'chup') { this.vl.move(-8); return true; }
      if (k === 'chdown') { this.vl.move(8); return true; }
      if (k === 'right' || k === 'ok') { clearTimeout(this.ft); if (k === 'ok') this.pickChannel(); this.zone = this.pl.items.length ? 'pr' : 'day'; this.sync(); return true; }
      return false;
    }
    if (this.zone === 'day') {
      var n = this.days();
      // a faixa vai de Hoje (esquerda) para os dias anteriores (direita)
      if (k === 'left') { if (this.day > 0) { this.day--; this.loadDay(); this.drawDays(); } else { this.zone = 'ch'; this.sync(); } return true; }
      if (k === 'right') { if (this.day < n) { this.day++; this.loadDay(); } this.drawDays(); return true; }
      if (k === 'down' || k === 'ok') { if (this.pl.items.length) { this.zone = 'pr'; this.sync(); } return true; }
      if (k === 'back') { this.zone = 'ch'; this.sync(); return true; }
      return false;
    }
    // zona dos programas
    if (k === 'up') { if (!this.pl.move(-1)) { this.zone = 'day'; this.sync(); } return true; }
    if (k === 'down') { this.pl.move(1); return true; }
    if (k === 'chup') { this.pl.move(-8); return true; }
    if (k === 'chdown') { this.pl.move(8); return true; }
    if (k === 'ok' || k === 'right') { this.play(); return true; }
    if (k === 'left' || k === 'back') { this.zone = 'ch'; this.sync(); return true; }
    return false;
  };

  /* ===== Filmes e Séries ===== */
  function posterHTML(it, nw) {
    var pr = progress()[it.id], pg = pr && pr.d ? Math.min(100, pr.p / pr.d * 100) : 0;
    return '<div class="po' + (it.logo ? ' img' : '') + '" style="background-image:' + art(it.id) + '"><div class="t">' + esc(it.title || it.name) + '</div>' + pimg(it.logo) +
      (nw ? '<span class="nw">' + (it.type === 'series' ? 'NOVA SÉRIE' : 'NOVO FILME') + '</span>' : '') +
      (pg > 2 && pg < 97 ? '<div class="pg"><i style="width:' + pg + '%"></i></div>' : '') + '</div>';
  }
  function metaLine(it) {
    var s = '<span>' + (it.type === 'series' ? 'SÉRIE' : 'FILME') + ' • ' + esc(it.group) + '</span>';
    if (it.type === 'series') s += '<i>|</i><span>' + it.seasonList.length + (it.seasonList.length > 1 ? ' temporadas' : ' temporada') + '</span><i>|</i><span>' + it.count + ' episódios</span>';
    else if (it.year) s += '<i>|</i><span>' + it.year + '</span>';
    return '<div class="ml">' + s + '</div>';
  }
  function heroHTML(it) {
    var pr = progress()[it.id], line = '';
    if (it.type === 'movie' && pr && pr.d && pr.p > 30 && pr.p / pr.d < .95) line = 'Você parou em ' + fmtTime(pr.p) + ' de ' + fmtTime(pr.d) + '.';
    else if (it.type === 'series') { var le = DATA.byId[Prof.get('lastEp', {})[it.id]]; if (le) line = 'Último assistido: temporada ' + le.s + ', episódio ' + le.e + '.'; }
    return '<div class="ttl">' + esc(it.title || it.name) + '</div>' + metaLine(it) + (line ? '<p class="syn">' + esc(line) + '</p>' : '');
  }
  function heroBg(it) { return it.logo ? cssUrl(it.logo) + ', ' + art(it.id) : art(it.id); }
  function bgLayer(it) { var b = esc(heroBg(it)); return '<div class="hero"><div class="bgb" style="background-image:' + b + '"></div><div class="bg" style="background-image:' + b + '"></div></div>'; }
  function tagHTML(it) { var q = quality(it.name); return q ? '<div class="etag">' + q + '</div>' : ''; }

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
    var recent = items.slice(-30).reverse();
    if (kind === 'series' && items.length >= 5) rows.push({ title: 'Últimas 10 adicionadas', items: recent.slice(0, 10), rank: true });
    if (kind === 'movies' && items.length > 12) rows.push({ title: 'Adicionados recentemente', items: recent, nw: true });
    var fv = favs().map(function (id) { return byId[id]; }).filter(function (x) { return x && x.type === (kind === 'movies' ? 'movie' : 'series') && allowed(x); });
    if (fv.length) rows.push({ title: 'Minha lista', items: fv });
    if (kind === 'movies' && items.length >= 5) rows.push({ title: 'Top 10 mais recentes', items: recent.slice(0, 10), rank: true });
    if (kind === 'series' && items.length > 12) rows.push({ title: 'Adicionadas recentemente', items: recent, nw: true });
    M3U.groups(items).forEach(function (g) { rows.push({ title: g.name, items: g.items }); });
    return rows;
  };
  VodTab.prototype.mount = function (el) {
    this.R = this.rows(); if (this.r >= this.R.length) this.r = 0;
    if (!this.R.length) { el.innerHTML = '<div class="vod-empty">Sua lista não tem ' + (this.kind === 'movies' ? 'filmes' : 'séries') + (Prof.kids() ? ' infantis' : '') + '.</div>'; return; }
    el.innerHTML = '<div class="hero"><div class="bgb" id="hbb"></div><div class="bg" id="hbg"></div></div><div class="hc" id="hc"></div><div id="htag"></div><div class="rows" id="rows"></div><div class="rmark" id="rmark"></div>';
    this.drawRows();
  };
  VodTab.prototype.drawRows = function () {
    var box = $('#rows'); if (!box) return;
    var rowH = 22 * remPx(); box.innerHTML = ''; this.strips = {};
    for (var i = Math.max(0, this.r - 1); i < Math.min(this.R.length, this.r + 3); i++) {
      var row = this.R[i], d = document.createElement('div');
      d.className = 'row' + (i === this.r ? ' act' : ''); d.style.top = ((i - this.r) * rowH) + 'px';
      d.innerHTML = '<h3>' + esc(row.title) + '</h3><div class="strip"></div>';
      box.appendChild(d);
      var st = row.rank ? new Strip(d.lastChild, { w: 20, render: function (it, k) { return '<div class="rk"><span class="num">' + (k + 1) + '</span>' + posterHTML(it) + '</div>'; } })
        : new Strip(d.lastChild, { w: 12.2, render: (function (nw) { return function (it) { return posterHTML(it, nw); }; })(row.nw) });
      st.set(row.items, this.cols[i] || 0); this.strips[i] = st;
    }
    this.mark();
  };
  VodTab.prototype.mark = function () {
    for (var i in this.strips) this.strips[i].setActive(this.focused && +i === this.r);
    var m = $('#rmark'); if (m) m.style.opacity = this.focused ? 1 : 0;
    this.hero();
  };
  VodTab.prototype.hero = function () { var self = this; clearTimeout(this.ht); this.ht = setTimeout(function () { self.heroNow(); }, 110); };
  VodTab.prototype.heroNow = function () {
    var st = this.strips && this.strips[this.r]; if (!st) return;
    var it = st.cur(); if (!it) return;
    $('#hc').innerHTML = heroHTML(it);
    $('#htag').innerHTML = tagHTML(it);
    var bg = heroBg(it);
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

  var LOGO_SM = '<div class="logo sm"><b></b><span>Lumea<em>Play</em></span></div>';

  /* ===== Detalhe do filme ===== */
  function MovieScreen(it) {
    this.it = it; this.b = 0; this.z = 'a'; this.ri = 0;
    this.rel = DATA.movies.filter(function (x) { return x !== it && x.group === it.group && allowed(x); }).slice(0, 24);
  }
  MovieScreen.prototype.mount = function (r) { this.r = r; this.draw(); };
  MovieScreen.prototype.draw = function () {
    var it = this.it, pr = progress()[it.id], resume = pr && pr.d && pr.p > 30 && pr.p / pr.d < .95, self = this, q = quality(it.name), A = this.z === 'a';
    this.btns = [];
    if (resume) { this.btns.push({ t: SV.play + 'Continuar de ' + fmtTime(pr.p), fn: function () { play(it, { start: pr.p }); } }); this.btns.push({ t: SV.redo + 'Assistir do início', fn: function () { play(it); } }); }
    else this.btns.push({ t: SV.play + 'Assistir', fn: function () { play(it); } });
    this.btns.push({ t: (isFav(it.id) ? SV.check + 'Na minha lista' : SV.plus + 'Adicionar à minha lista'), fn: function () { toggleFav(it.id); self.draw(); } });
    var tiles = '<div class="tiles dt"><div class="tl">' + SV.folder + '<div><small>Categoria</small><b class="ell">' + esc(it.group) + '</b></div></div>' +
      '<div class="tl">' + SV.redo + '<div><small>' + (resume ? 'Assistido' : 'Ano') + '</small><b>' + (resume ? Math.round(pr.p / pr.d * 100) + '%' : (it.year || '—')) + '</b></div></div>' +
      '<div class="tl">' + SV.hd + '<div><small>Qualidade</small><b>' + (q || '—') + '</b></div></div></div>';
    this.r.innerHTML = '<div class="screen det">' + bgLayer(it) + '<div class="dl">' + LOGO_SM + heroHTML(it) + tiles + '<div class="acts">' +
      this.btns.map(function (b, i) { return '<div class="ac ' + (i === 0 ? 'pri ' : '') + (A && i === self.b ? 'on' : '') + '">' + b.t + '</div>'; }).join('') + '</div></div>' + tagHTML(it) +
      (this.rel.length ? '<div class="rel"><div class="sl">Da mesma categoria</div><div class="strip" id="mrel"></div></div>' : '') + '</div>';
    if (this.rel.length) { this.st = new Strip($('#mrel'), { w: 12.2, render: function (x) { return posterHTML(x); } }); this.st.set(this.rel, this.ri); this.st.setActive(!A); }
  };
  MovieScreen.prototype.key = function (k) {
    if (this.z === 'r') {
      if (k === 'left') { this.st.move(-1); this.ri = this.st.i; return true; }
      if (k === 'right') { this.st.move(1); this.ri = this.st.i; return true; }
      if (k === 'up') { this.z = 'a'; this.draw(); return true; }
      if (k === 'ok') { App.push(new MovieScreen(this.st.cur())); return true; }
      return k !== 'back';
    }
    if (k === 'up' && this.b > 0) this.b--;
    else if (k === 'down') { if (this.b < this.btns.length - 1) this.b++; else if (this.rel.length) this.z = 'r'; }
    else if (k === 'ok') { this.btns[this.b].fn(); return true; } else return k !== 'back';
    this.draw(); return true;
  };
  MovieScreen.prototype.notify = function (w) { if (w === 'progress') { this.b = 0; this.z = 'a'; this.draw(); } };

  /* ===== Detalhe da série ===== */
  function SeriesScreen(s) {
    this.s = s; this.z = 'left'; this.li = 0;
    var lastId = Prof.get('lastEp', {})[s.id], last = lastId && DATA.byId[lastId];
    this.si = last ? Math.max(0, s.seasonList.indexOf(last.s)) : 0;
    this.ei = last ? Math.max(0, s.seasons[last.s].indexOf(last)) : 0;
  }
  SeriesScreen.prototype.eps = function () { return this.s.seasons[this.s.seasonList[this.si]] || []; };
  SeriesScreen.prototype.mount = function (r) {
    var s = this.s, pr = progress(), thumb = esc(heroBg(s));
    r.innerHTML = '<div class="screen det">' + bgLayer(s) + '<div class="dl ser">' + LOGO_SM + '<div id="shc"></div><div class="acts" id="sacts"></div><div class="sl">Temporadas</div><div class="sns"><div class="tr" id="ssn"></div></div></div>' +
      '<div class="eps-r"><div class="sl">Episódios <em id="sen"></em></div><div id="seps" class="epl"></div></div></div>';
    this.vl = new VList($('#seps'), {
      h: 9.6, render: function (e) {
        var p = pr[e.id], pg = p && p.d ? Math.min(100, p.p / p.d * 100) : 0;
        return '<div class="ep"><div class="th" style="background-image:' + thumb + '"><span class="se">T' + e.s + ' E' + e.e + '</span>' + (pg > 2 && pg < 95 ? '<div class="pg"><i style="width:' + pg + '%"></i></div>' : '') + '</div>' +
          '<div class="tx"><b class="ell">' + esc(e.title || ('Episódio ' + e.e)) + '</b><small>' + (pg >= 95 ? '✓ Assistido' : pg > 2 ? 'Faltam ' + fmtTime(p.d - p.p) : 'Temporada ' + e.s + ' • Episódio ' + e.e) + '</small></div></div>';
      }
    });
    this.draw(true);
  };
  SeriesScreen.prototype.draw = function (full) {
    var s = this.s, self = this, last = Prof.get('lastEp', {})[s.id], le = last && DATA.byId[last];
    this.btns = [{ t: SV.play + (le ? 'Continuar T' + le.s + ':E' + le.e : 'Assistir T' + s.seasonList[0] + ':E1'), fn: function () { var e = le || s.seasons[s.seasonList[0]][0]; var p = progress()[e.id]; play(e, { start: p && p.d && p.p / p.d < .95 ? p.p : 0 }); } },
      { t: isFav(s.id) ? SV.check + 'Na minha lista' : SV.plus + 'Adicionar à minha lista', fn: function () { toggleFav(s.id); self.draw(); } }];
    var L = this.z === 'left';
    $('#shc').innerHTML = heroHTML(s);
    $('#sacts').innerHTML = this.btns.map(function (b, i) { return '<div class="ac ' + (i === 0 ? 'pri ' : '') + (L && self.li === i ? 'on' : '') + '">' + b.t + '</div>'; }).join('');
    var sn = $('#ssn');
    sn.innerHTML = s.seasonList.map(function (n, i) { return '<div class="sn' + (i === self.si ? ' cur' : '') + (L && self.li === i + 2 ? ' on' : '') + '"><span>Temporada ' + n + '</span><em>' + s.seasons[n].length + ' episódios</em></div>'; }).join('');
    sn.style.transform = 'translateY(' + (-Math.max(0, this.si - 2) * 4.4 * remPx()) + 'px)';
    $('#sen').textContent = '· Temporada ' + s.seasonList[this.si];
    if (full) this.vl.set(this.eps(), this.ei);
    this.vl.setActive(this.z === 'eps');
  };
  SeriesScreen.prototype.key = function (k) {
    var n = 2 + this.s.seasonList.length;
    if (this.z === 'eps') {
      if (k === 'up') { this.vl.move(-1); this.ei = this.vl.i; return true; }
      if (k === 'down') { this.vl.move(1); this.ei = this.vl.i; return true; }
      if (k === 'left' || k === 'back') { this.z = 'left'; this.draw(); return true; }
      if (k === 'ok') { var e = this.vl.cur(); if (e) { var p = progress()[e.id]; play(e, { start: p && p.d && p.p / p.d < .95 ? p.p : 0 }); } return true; }
      return true;
    }
    if (k === 'up') { if (this.li > 0) this.li--; else return true; }
    else if (k === 'down') { if (this.li < n - 1) this.li++; }
    else if (k === 'right') { if (this.eps().length) { if (this.li >= 2) this.li = this.si + 2; this.z = 'eps'; } }
    else if (k === 'ok') { if (this.li < 2) { this.btns[this.li].fn(); return true; } this.z = 'eps'; }
    else return k !== 'back';
    if (this.li >= 2 && this.li - 2 !== this.si) { this.si = this.li - 2; this.ei = 0; this.draw(true); return true; }
    this.draw(); return true;
  };
  SeriesScreen.prototype.notify = function (w) { if (w === 'progress') this.mount(App.root()); };

  /* ===== Configurações ===== */
  var OPTS = ['Minha conta', 'Atualizar lista', 'Formato da tela', 'Qualidade de vídeo', 'Anti-travamento', 'Conteúdo adulto', 'Perfis', 'Idioma', 'Trocar código'];
  function SettingsTab() { this.o = 0; this.zone = 'opts'; this.c = 0; }
  SettingsTab.prototype.mount = function (el) { this.el = el; this.draw(); };
  SettingsTab.prototype.focus = function (on) { this.focused = on; if (!on) this.zone = 'opts'; this.draw(); };
  SettingsTab.prototype.controls = function () {
    var self = this;
    switch (this.o) {
      case 1: return { type: 'btn', items: [{ t: 'Atualizar agora', fn: function () { reloadList(); } }] };
      case 2: var rz = store.get('resize', 'fit'); return { type: 'choice', items: [['fit', 'Ajustar (padrão)'], ['fill', 'Preencher (cortar bordas)'], ['zoom', 'Esticar']].map(function (x) { return { t: x[1], s: rz === x[0], fn: function () { store.set('resize', x[0]); self.draw(); toast('Formato da tela: ' + x[1]); } }; }) };
      case 3: var vq = store.get('vq', 'auto'); return { type: 'choice', items: [['auto', 'Automática (recomendado)'], ['max', 'Máxima']].map(function (x) { return { t: x[1], s: vq === x[0], fn: function () { store.set('vq', x[0]); self.draw(); toast('Qualidade de vídeo: ' + x[1]); } }; }) };
      case 4: var bf = store.get('buf', 'alto'); return { type: 'choice', items: [['normal', 'Normal'], ['alto', 'Alto (recomendado)'], ['max', 'Máximo']].map(function (x) { return { t: x[1], s: bf === x[0], fn: function () { store.set('buf', x[0]); self.draw(); toast('Anti-travamento: ' + x[1]); } }; }) };
      case 5: var ad = store.get('adult', false); return { type: 'choice', items: [{ t: 'Oculto', s: !ad, fn: function () { store.set('adult', false); refreshAll(); self.draw(); } }, { t: 'Visível', s: ad, fn: function () { Modal.show('Mostrar conteúdo adulto?', 'Categorias adultas vão aparecer em todos os perfis, menos no Kids.', [{ t: 'Mostrar', fn: function () { store.set('adult', true); refreshAll(); self.draw(); } }, { t: 'Cancelar', w: 1 }]); } }] };
      case 6: return { type: 'btn', items: [{ t: 'Trocar de perfil', fn: function () { App.show(new ProfScreen()); } }] };
      case 7: return { type: 'btn', items: [{ t: 'Mudar idioma', fn: function () { App.push(new LangScreen(false)); } }] };
      case 8: return { type: 'btn', items: [{ t: 'Sair e trocar código', fn: function () { Modal.show('Trocar o código?', 'Você vai precisar digitar um código de acesso de novo.', [{ t: 'Sair', fn: function () { Session.clear(); DATA = null; App.show(new ActScreen()); } }, { t: 'Cancelar', w: 1 }]); } }] };
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
        '<div class="pan"><div class="li"><div><small>CÓDIGO DE ACESSO</small>' + (s.code === 'm3u' ? 'Link M3U próprio' : s.code ? s.code.slice(0, 3) + '-•••-' + s.code.slice(6) : '—') + '</div><span class="g">● Ativo</span></div>' +
        (s.name ? '<div class="li"><div><small>CLIENTE</small>' + esc(s.name) + '</div></div>' : '') +
        '<div class="li"><div><small>ID DO APARELHO</small>' + esc(deviceId()) + '</div><span class="m">Este aparelho</span></div>' +
        '<div class="li"><div><small>SUA LISTA</small>' + cnt + '</div><span class="m">' + (upd ? 'Atualizada ' + fmtDate(upd.toISOString()) + ' ' + pad(upd.getHours()) + ':' + pad(upd.getMinutes()) : '') + '</span></div>' +
        '<div class="li"><div><small>VERSÃO</small>LumeaPlay ' + esc(CFG.version || '1.0') + '</div></div></div>';
    } else {
      var desc = ['', 'Baixa a lista de novo do servidor, com os canais, filmes e séries mais recentes.', 'Como o vídeo ocupa a tela da sua TV. Ajustar mantém a proporção original, sem cortar nem esticar.', 'Automática troca a qualidade sozinha conforme a sua internet, como no YouTube. Máxima trava na maior qualidade do canal. No player, a tecla vermelha, Menu ou Info troca a qualidade.', 'Guarda mais segundos de vídeo antes de tocar e reconecta sozinho quando o sinal cai. Use Máximo em internet instável.', 'Esconde ou mostra as categorias adultas da lista.', 'Perfil atual: ' + esc(Prof.cur().name) + '. Cada perfil tem seus favoritos e o seu "continuar assistindo".', 'Escolha o idioma do aplicativo.', 'Sai desta conta neste aparelho. O código continua válido.'][this.o];
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
  var WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], MO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function tick() { var c = $('#clock'); if (c) { var d = new Date(); c.textContent = (LANG === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ', ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate() : WD[d.getDay()] + ', ' + d.getDate() + ' ' + MO[d.getMonth()]) + ' • ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); } }
  setInterval(tick, 15000);
  function refreshAll() { var h = App.stack[0]; if (h instanceof HomeScreen) { var keep = h.tabs[h.tab]; h.tabs = {}; h.tabs[h.tab] = keep; } }
  function reloadList() {
    loadList(true).then(function () { toast('Lista atualizada!'); App.show(new HomeScreen(4)); })
      .catch(function () { toast('Não foi possível atualizar a lista agora. Tente mais tarde.'); });
  }
  function goHome() {
    if (!store.get('setup')) { if (store.get('profiles', null)) store.set('setup', 1); else { App.show(new NewProfileScreen(true)); return; } }
    var l = Prof.list(); if (l.length > 1) App.show(new ProfScreen()); else { Prof.use(l[0]); App.show(new HomeScreen()); }
  }
  function startMain() {
    loadList(false).then(goHome).catch(function (e) {
      App.show(new ActScreen('Não conseguimos carregar sua lista (' + (e.message || 'erro') + '). Fale com seu revendedor.'));
    });
  }
  function boot() {
    var s = Session.get();
    if (!s) { App.show(new ActScreen()); return; }
    if (s.m3u === 'demo:' || s.code === 'm3u' || !sbReady()) { startMain(); return; }
    loading('Verificando seu acesso…');
    checkCode(s.code).then(function (d) {
      loading();
      var e = codeError(d);
      if (e) { if (!d || d.err === 'notfound' || d.err === 'device') Session.clear(); App.show(new ActScreen(e)); return; }
      Session.set({ code: s.code, name: d.name || '', m3u: d.m3u, expiresAt: d.expires_at, status: 'ativo' }); startMain();
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
      case 403: case 457: case 93: case 82: return 'opt';
    }
    if (k >= 48 && k <= 57) return 'd' + (k - 48);
    if (k >= 96 && k <= 105) return 'd' + (k - 96);
    return null;
  }
  document.addEventListener('keydown', function (e) {
    var tp = App.top();
    if (tp && tp.typeChar && !Modal.open && e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !/^\d$/.test(e.key)) { e.preventDefault(); tp.typeChar(e.key); return; }
    var k = keyName(e); if (!k) return;
    e.preventDefault();
    var handled = App.key(k);
    if (!handled && k === 'back') exitApp();
  });
  document.addEventListener('paste', function (e) { var tp = App.top(), t = (e.clipboardData || window.clipboardData).getData('text'); if (tp && tp.typeChar && t) { e.preventDefault(); tp.typeChar(t.trim()); } });
  try { if (window.tizen && tizen.tvinputdevice) ['ChannelUp', 'ChannelDown', 'ColorF0Red', 'Info', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) { } }); } catch (e) { }

  /* ponte com o Android */
  window.LP = {
    back: function () { return App.back(); },
    key: function (k) { return App.key(k); },
    onPlayerResult: function (json) { try { onPlayerResult(typeof json === 'string' ? JSON.parse(json) : json); } catch (e) { } },
    onResume: function () { tick(); }
  };

  setLang(LANG);
  boot();
})();
