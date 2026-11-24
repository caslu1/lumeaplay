// Leitor de listas M3U — separa Canais, Filmes e Séries
(function () {
  'use strict';
  var VOD_EXT = /\.(mp4|mkv|avi|m4v|mov|wmv|flv|webm)(\?|$)/i;
  var SXE = /^(.*?)[\s._\-:|\[(]*S(\d{1,2})[\s._\-]*E(\d{1,4})/i;
  var NXN = /^(.*?)[\s._\-:|]+(\d{1,2})x(\d{1,3})\b/i;
  var YEAR = /[\(\[]((?:19|20)\d{2})[\)\]]|\s-\s((?:19|20)\d{2})\s*$/;

  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function attr(l, k) { var m = l.match(new RegExp('\\b' + k + '="([^"]*)"', 'i')); return m ? m[1].trim() : ''; }
  function titleOf(l) {
    var q = false, last = -1;
    for (var i = 0; i < l.length; i++) { var c = l[i]; if (c === '"') q = !q; else if (c === ',' && !q) last = i; }
    return last >= 0 ? l.slice(last + 1).trim() : '';
  }
  function clean(t) {
    return t.replace(YEAR, '').replace(/\s*[\|\-]\s*(4K|FHD|HD|SD|UHD|H265|HEVC|DUB|LEG|DUBLADO|LEGENDADO)\b.*$/i, '')
      .replace(/\s{2,}/g, ' ').trim();
  }

  function parse(text) {
    var live = [], movies = [], eps = [];
    var lines = text.split(/\r?\n/), cur = null, n = 0;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (!l) continue;
      if (l.charAt(0) === '#') {
        if (/^#EXTINF/i.test(l)) {
          var name = titleOf(l) || attr(l, 'tvg-name');
          cur = { name: name, logo: attr(l, 'tvg-logo'), group: attr(l, 'group-title') || 'Outros', tvg: attr(l, 'tvg-id') };
        } else if (cur && /^#EXTGRP:/i.test(l)) { cur.group = l.slice(8).trim() || cur.group; }
        continue;
      }
      if (!cur) cur = { name: 'Canal ' + (n + 1), logo: '', group: 'Outros' };
      cur.url = l; cur.id = hash(l); n++;
      var u = l.toLowerCase(), g = cur.group.toLowerCase();
      var isVod = VOD_EXT.test(u);
      var m = cur.name.match(SXE) || cur.name.match(NXN);
      if (u.indexOf('/series/') >= 0 || (isVod && (m || /s[eé]rie/.test(g)))) {
        cur.type = 'ep';
        if (m) { cur.show = clean(m[1]) || cur.name; cur.s = +m[2]; cur.e = +m[3]; cur.title = cur.name.slice(m[0].length).replace(/^[\s._\-:|\])]+/, '').trim(); }
        else { cur.show = clean(cur.name); cur.s = 1; cur.e = 0; }
        eps.push(cur);
      } else if (u.indexOf('/movie/') >= 0 || isVod) {
        cur.type = 'movie';
        var y = cur.name.match(YEAR); cur.year = y ? (y[1] || y[2]) : '';
        cur.title = clean(cur.name) || cur.name;
        movies.push(cur);
      } else {
        cur.type = 'live'; cur.num = live.length + 1;
        live.push(cur);
      }
      cur = null;
    }
    // agrupa episódios em séries
    var smap = {}, series = [];
    for (var j = 0; j < eps.length; j++) {
      var e = eps[j], key = (e.show + '|' + e.group).toLowerCase();
      var s = smap[key];
      if (!s) { s = smap[key] = { id: hash(key), type: 'series', title: e.show, name: e.show, group: e.group, logo: e.logo, seasons: {}, count: 0 }; series.push(s); }
      if (!s.logo && e.logo) s.logo = e.logo;
      (s.seasons[e.s] = s.seasons[e.s] || []).push(e);
      e.series = s.id; s.count++;
    }
    series.forEach(function (s) {
      var keys = Object.keys(s.seasons).map(Number).sort(function (a, b) { return a - b; });
      s.seasonList = keys;
      keys.forEach(function (k) {
        var arr = s.seasons[k];
        arr.sort(function (a, b) { return a.e - b.e; });
        arr.forEach(function (ep, idx) { if (!ep.e) ep.e = idx + 1; });
      });
    });
    return { live: live, movies: movies, series: series };
  }

  function groups(items) {
    var map = {}, out = [];
    for (var i = 0; i < items.length; i++) {
      var g = items[i].group || 'Outros';
      if (!map[g]) { map[g] = { name: g, items: [] }; out.push(map[g]); }
      map[g].items.push(items[i]);
    }
    return out;
  }

  var ADULT = /adult|xxx|\+18|18\+|er[oó]tic|hot\b|porn/i;
  var KIDS = /infantil|kids|desenho|crian[cç]a|cartoon|disney|nick|anima[cç]/i;

  window.M3U = { parse: parse, groups: groups, hash: hash, ADULT: ADULT, KIDS: KIDS };
})();
