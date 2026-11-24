// Painel LumeaPlay — gera e gerencia códigos de acesso de 9 dígitos
const CFG = (window.LUMEA_CONFIG || {}).firebase || {};
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtCode = (c) => c.slice(0, 3) + '-' + c.slice(3, 6) + '-' + c.slice(6);
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '—';
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }
async function copy(t, msg) { try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } toast(msg || 'Copiado!'); }

if (!CFG.apiKey || CFG.apiKey.includes('COLE')) {
  $('#nocfg').classList.remove('hide');
  throw new Error('Firebase não configurado');
}

const V = 'https://www.gstatic.com/firebasejs/10.12.5/';
const [{ initializeApp }, { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut }, { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, orderBy, onSnapshot, serverTimestamp, Timestamp, writeBatch }] =
  await Promise.all([import(V + 'firebase-app.js'), import(V + 'firebase-auth.js'), import(V + 'firebase-firestore.js')]);
const app = initializeApp(CFG);
const auth = getAuth(app);
const db = getFirestore(app);
let rows = [], filter = 'all', unsub = null;

/* ---------- login ---------- */
$('#lf').addEventListener('submit', async (e) => {
  e.preventDefault(); $('#lerr').textContent = '';
  try { await signInWithEmailAndPassword(auth, $('#le').value.trim(), $('#lp').value); }
  catch (err) {
    const c = err.code || '';
    $('#lerr').textContent = c.includes('invalid') || c.includes('wrong') || c.includes('user-not-found') ? 'E-mail ou senha incorretos.' : c.includes('too-many') ? 'Muitas tentativas. Espere alguns minutos.' : 'Não foi possível entrar: ' + (err.message || c);
  }
});
$('#out').onclick = () => signOut(auth);

onAuthStateChanged(auth, (u) => {
  $('#login').classList.toggle('hide', !!u);
  $('#app').classList.toggle('hide', !u);
  if (unsub) { unsub(); unsub = null; }
  if (!u) return;
  $('#who').textContent = u.email;
  unsub = onSnapshot(query(collection(db, 'codes'), orderBy('createdAt', 'desc')), (snap) => {
    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => {
    $('#list').innerHTML = '<p class="err">Sem permissão para ler os códigos. Confira se o seu e-mail está nas regras do Firestore (arquivo firestore.rules).</p>';
    console.error(err);
  });
});

/* ---------- gerar código ---------- */
const VAL = { h4: 4 * 3600e3, h24: 24 * 3600e3, d3: 3 * 864e5, d7: 7 * 864e5, d30: 30 * 864e5, d90: 90 * 864e5, d180: 180 * 864e5, d365: 365 * 864e5 };
function rand9() {
  const a = new Uint32Array(1); crypto.getRandomValues(a);
  return String(100000000 + (a[0] % 900000000));
}
function cleanM3U(u) { return u.trim().replace(/\s+/g, ''); }
function waMsg(code, name, exp) {
  return `Olá${name ? ' ' + name.split(' ')[0] : ''}! Seu acesso ao *LumeaPlay* está pronto.\n\n` +
    `📲 Abra o app e digite o código:\n*${fmtCode(code)}*\n\n` +
    `📅 Válido até: ${fmtDate(exp)}\n\nQualquer dúvida é só chamar!`;
}
function waLink(phone, msg) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p && p.length <= 11) p = '55' + p;
  return 'https://wa.me/' + p + '?text=' + encodeURIComponent(msg);
}

$('#nf').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#nn').value.trim(), phone = $('#np').value.trim(), m3u = cleanM3U($('#nm').value), note = $('#no').value.trim();
  if (!/^https?:\/\//i.test(m3u)) { toast('O link M3U precisa começar com http:// ou https://'); return; }
  const btn = $('#nbtn'); btn.disabled = true; btn.textContent = 'Gerando…';
  try {
    let code;
    for (let i = 0; i < 6; i++) { const c = rand9(); if (!(await getDoc(doc(db, 'codes', c))).exists()) { code = c; break; } }
    if (!code) throw new Error('Não foi possível gerar um código livre. Tente de novo.');
    const exp = new Date(Date.now() + VAL[$('#nv').value]);
    await setDoc(doc(db, 'codes', code), {
      code, name, phone, m3u, note, status: 'ativo', plan: $('#nv').value,
      deviceId: null, deviceModel: null, activatedAt: null,
      createdAt: serverTimestamp(), expiresAt: Timestamp.fromDate(exp)
    });
    const msg = waMsg(code, name, exp);
    $('#res').classList.remove('hide');
    $('#res').innerHTML = `<div class="mut sm">Código criado para ${esc(name)}</div><div class="code">${fmtCode(code)}</div>
      <div class="row"><button type="button" class="btn sm" id="rc1">Copiar código</button><button type="button" class="btn sm" id="rc2">Copiar mensagem</button>
      ${phone ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(waLink(phone, msg))}">Enviar no WhatsApp</a>` : ''}</div>
      <div class="mut sm" style="margin-top:.7rem">Válido até ${fmtDate(exp)}</div>`;
    $('#rc1').onclick = () => copy(code, 'Código copiado');
    $('#rc2').onclick = () => copy(msg, 'Mensagem copiada');
    $('#nn').value = ''; $('#np').value = ''; $('#no').value = '';
    toast('Código ' + fmtCode(code) + ' criado!');
  } catch (err) { toast(err.code === 'permission-denied' ? 'Sem permissão. Confira as regras do Firestore.' : (err.message || 'Erro ao criar')); }
  btn.disabled = false; btn.textContent = 'Gerar código de 9 dígitos';
});

/* ---------- lista ---------- */
function stateOf(r) {
  if (r.status !== 'ativo') return 'off';
  const exp = r.expiresAt?.toDate?.();
  if (exp && exp < new Date()) return 'exp';
  if (exp && exp - new Date() < 3 * 864e5) return 'soon';
  return 'ok';
}
const LBL = { ok: 'Ativo', soon: 'Vence logo', exp: 'Vencido', off: 'Bloqueado' };
function left(exp) {
  if (!exp) return '';
  const ms = exp - new Date(); if (ms <= 0) return 'venceu';
  const h = Math.floor(ms / 3600e3); return h < 48 ? h + 'h restantes' : Math.floor(h / 24) + ' dias restantes';
}
$('#q').addEventListener('input', render);
$('#chips').addEventListener('click', (e) => { const f = e.target.dataset.f; if (!f) return; filter = f; document.querySelectorAll('#chips span').forEach((s) => s.classList.toggle('on', s.dataset.f === f)); render(); });

function render() {
  const cnt = { ok: 0, soon: 0, exp: 0, off: 0 };
  rows.forEach((r) => cnt[stateOf(r)]++);
  $('#s1').textContent = cnt.ok + cnt.soon; $('#s2').textContent = cnt.soon; $('#s3').textContent = cnt.exp; $('#s4').textContent = cnt.off;
  const q = $('#q').value.trim().toLowerCase().replace(/-/g, '');
  const list = rows.filter((r) => {
    const st = stateOf(r);
    if (filter !== 'all' && !(filter === st || (filter === 'ok' && st === 'soon'))) return false;
    if (!q) return true;
    return (r.name || '').toLowerCase().includes(q) || r.id.includes(q) || (r.m3u || '').toLowerCase().includes(q) || (r.phone || '').replace(/\D/g, '').includes(q);
  });
  if (!list.length) { $('#list').innerHTML = '<p class="mut">' + (rows.length ? 'Nenhum cliente encontrado.' : 'Nenhum código ainda. Crie o primeiro ao lado.') + '</p>'; return; }
  $('#list').innerHTML = list.slice(0, 300).map((r) => {
    const st = stateOf(r), exp = r.expiresAt?.toDate?.();
    return `<div class="cl" data-id="${r.id}">
      <div class="n">${esc(r.name || 'Sem nome')} <span class="pill p-${st}">${LBL[st]}</span></div>
      <div class="c" data-a="copy">${fmtCode(r.id)}</div>
      <div class="meta"><span>📅 ${fmtDate(exp)} ${exp ? '(' + left(exp) + ')' : ''}</span><span>📺 ${r.deviceId ? esc(r.deviceModel || 'Aparelho') + ' · ' + esc(r.deviceId) : 'Ainda não ativado'}</span>${r.phone ? `<span>📱 ${esc(r.phone)}</span>` : ''}${r.note ? `<span>📝 ${esc(r.note)}</span>` : ''}</div>
      <div class="acts">
        <button class="btn sm" data-a="renew">Renovar</button>
        <button class="btn sm" data-a="edit">Editar</button>
        ${r.deviceId ? '<button class="btn sm" data-a="free">Liberar aparelho</button>' : ''}
        <button class="btn sm" data-a="msg">Mensagem</button>
        <button class="btn sm ${r.status === 'ativo' ? 'red' : ''}" data-a="block">${r.status === 'ativo' ? 'Bloquear' : 'Desbloquear'}</button>
        <button class="btn sm red" data-a="del">Excluir</button>
      </div></div>`;
  }).join('') + (list.length > 300 ? '<p class="mut sm">Mostrando 300 de ' + list.length + '. Use a busca para achar os outros.</p>' : '');
}

$('#list').addEventListener('click', (e) => {
  const a = e.target.dataset.a; if (!a) return;
  const id = e.target.closest('.cl').dataset.id, r = rows.find((x) => x.id === id); if (!r) return;
  const ref = doc(db, 'codes', id);
  const run = (p, ok) => p.then(() => toast(ok)).catch((err) => toast(err.code === 'permission-denied' ? 'Sem permissão.' : 'Erro: ' + err.message));
  if (a === 'copy') copy(id, 'Código copiado');
  if (a === 'msg') copy(waMsg(id, r.name, r.expiresAt?.toDate?.()), 'Mensagem copiada');
  if (a === 'free') confirmBox('Liberar aparelho?', `O código ${fmtCode(id)} poderá ser ativado em outro aparelho. O aparelho atual será desconectado na próxima vez que abrir o app.`, 'Liberar', () => run(updateDoc(ref, { deviceId: null, deviceModel: null, activatedAt: null }), 'Aparelho liberado'));
  if (a === 'block') run(updateDoc(ref, { status: r.status === 'ativo' ? 'bloqueado' : 'ativo' }), r.status === 'ativo' ? 'Código bloqueado' : 'Código desbloqueado');
  if (a === 'del') confirmBox('Excluir código?', `${r.name || ''} — ${fmtCode(id)}. O cliente perde o acesso na hora. Isso não pode ser desfeito.`, 'Excluir', () => run(deleteDoc(ref), 'Código excluído'), true);
  if (a === 'renew') renewBox(r, ref, run);
  if (a === 'edit') editBox(r, ref, run);
});

/* ---------- modais ---------- */
function openModal(html) { $('#mbox').innerHTML = html; $('#modal').classList.remove('hide'); }
function closeModal() { $('#modal').classList.add('hide'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.dataset.close) closeModal(); });
function confirmBox(t, txt, okLabel, fn, danger) {
  openModal(`<h2>${esc(t)}</h2><p class="mut">${esc(txt)}</p><div class="row"><button class="btn" data-close="1">Cancelar</button><button class="btn pri ${danger ? 'red' : ''}" id="mok">${esc(okLabel)}</button></div>`);
  $('#mok').onclick = () => { closeModal(); fn(); };
}
function renewBox(r, ref, run) {
  const exp = r.expiresAt?.toDate?.();
  openModal(`<h2>Renovar ${esc(r.name || fmtCode(r.id))}</h2><p class="mut sm" style="margin-bottom:1rem">Vence: ${fmtDate(exp)}. A renovação soma a partir do vencimento (ou de hoje, se já venceu).</p>
    <label>Adicionar<select id="rv"><option value="d7">7 dias</option><option value="d30" selected>30 dias</option><option value="d90">90 dias</option><option value="d180">180 dias</option><option value="d365">1 ano</option></select></label>
    <div class="row"><button class="btn" data-close="1">Cancelar</button><button class="btn pri" id="mok">Renovar</button></div>`);
  $('#mok').onclick = () => {
    const base = exp && exp > new Date() ? exp.getTime() : Date.now();
    const nd = new Date(base + VAL[$('#rv').value]);
    closeModal(); run(updateDoc(ref, { expiresAt: Timestamp.fromDate(nd), status: 'ativo' }), 'Renovado até ' + fmtDate(nd));
  };
}
function editBox(r, ref, run) {
  openModal(`<h2>Editar ${fmtCode(r.id)}</h2>
    <label>Nome<input id="en" value="${esc(r.name || '')}" maxlength="80"></label>
    <label>WhatsApp<input id="ep" value="${esc(r.phone || '')}" maxlength="20"></label>
    <label>Link M3U<textarea id="em" rows="4">${esc(r.m3u || '')}</textarea></label>
    <label>Observação<input id="eo" value="${esc(r.note || '')}" maxlength="120"></label>
    <div class="row"><button class="btn" data-close="1">Cancelar</button><button class="btn pri" id="mok">Salvar</button></div>`);
  $('#mok').onclick = () => {
    const m3u = cleanM3U($('#em').value);
    if (!/^https?:\/\//i.test(m3u)) { toast('Link M3U inválido'); return; }
    closeModal(); run(updateDoc(ref, { name: $('#en').value.trim(), phone: $('#ep').value.trim(), m3u, note: $('#eo').value.trim() }), 'Alterações salvas');
  };
}

/* ---------- trocar DNS em massa ---------- */
$('#dnsbtn').onclick = () => {
  openModal(`<h2>Trocar DNS em massa</h2><p class="mut sm" style="margin-bottom:1rem">Troca o servidor em todos os links M3U de uma vez. Os clientes recebem o novo link ao abrir o app de novo.</p>
    <label>Servidor antigo<input id="d1" placeholder="http://servidor-antigo.com:8080"></label>
    <label>Servidor novo<input id="d2" placeholder="http://servidor-novo.com:8080"></label>
    <p class="mut sm" id="dprev"></p>
    <div class="row"><button class="btn" data-close="1">Cancelar</button><button class="btn pri" id="mok">Trocar</button></div>`);
  const prev = () => { const a = $('#d1').value.trim(); const n = a ? rows.filter((r) => (r.m3u || '').includes(a)).length : 0; $('#dprev').textContent = a ? n + ' cliente(s) usam esse servidor.' : ''; };
  $('#d1').oninput = prev;
  $('#mok').onclick = async () => {
    const a = $('#d1').value.trim(), b = $('#d2').value.trim();
    if (!a || !b) { toast('Preencha os dois servidores'); return; }
    const hit = rows.filter((r) => (r.m3u || '').includes(a));
    if (!hit.length) { toast('Nenhum link usa esse servidor'); return; }
    closeModal();
    try {
      for (let i = 0; i < hit.length; i += 400) {
        const batch = writeBatch(db);
        hit.slice(i, i + 400).forEach((r) => batch.update(doc(db, 'codes', r.id), { m3u: r.m3u.split(a).join(b) }));
        await batch.commit();
      }
      toast(hit.length + ' link(s) atualizados');
    } catch (err) { toast('Erro: ' + err.message); }
  };
};
