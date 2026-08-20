/* 공통 스토어 + 유틸
   CONFIG(config.js)에 Supabase 값이 있으면 서버 모드, 없으면 데모 모드(localStorage) */

const CFG = window.CONFIG || {};
const IS_DEMO = !(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

/* ---------- 서버 모드 (Supabase REST) ---------- */
function sbHeaders(extra) {
  return Object.assign({
    apikey: CFG.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  }, extra || {});
}

async function rpc(fn, args) {
  const res = await fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify(args || {}),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch (e) {}
    throw new Error(msg || ('HTTP ' + res.status));
  }
  return text ? JSON.parse(text) : null;
}

const SupabaseStore = {
  getState: () => rpc('get_state'),
  async submitQuestion(roundId, author, content) {
    const res = await fetch(CFG.SUPABASE_URL + '/rest/v1/questions', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ round_id: roundId, author: author, content: content }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error('등록에 실패했습니다. 질문 접수가 마감됐을 수 있습니다.');
    return JSON.parse(text)[0];
  },
  adminLogin: (pass) => rpc('admin_login', { pass: pass }),
  createRound: (pass, title) => rpc('create_round', { pass: pass, p_title: title }),
  closeRound: (pass, id) => rpc('close_round', { pass: pass, p_round_id: id }),
  reopenRound: (pass, id) => rpc('reopen_round', { pass: pass, p_round_id: id }),
  setSelected: (pass, id, sel) => rpc('set_selected', { pass: pass, p_question_id: id, p_selected: sel }),
  deleteQuestion: (pass, id) => rpc('delete_question', { pass: pass, p_question_id: id }),
};

/* ---------- 데모 모드 (localStorage) ---------- */
const DEMO_KEY = 'qws-demo-v1';
function demoRead() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || { rounds: [], questions: [], seq: 1 }; }
  catch (e) { return { rounds: [], questions: [], seq: 1 }; }
}
function demoWrite(d) { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); }

const LocalStore = {
  async getState() {
    const d = demoRead();
    const last = d.rounds[d.rounds.length - 1] || null;
    const round = last ? Object.assign({}, last, { round_no: d.rounds.length }) : null;
    const questions = last ? d.questions.filter(q => q.round_id === last.id) : [];
    const winners = d.questions.filter(q => q.selected).map(q => {
      const ri = d.rounds.findIndex(r => r.id === q.round_id);
      return Object.assign({}, q, { round_title: (d.rounds[ri] || {}).title || '', round_no: ri + 1 });
    });
    return { round: round, questions: questions, winners: winners };
  },
  async submitQuestion(roundId, author, content) {
    const d = demoRead();
    const r = d.rounds.find(r => r.id === roundId);
    if (!r || r.status !== 'open') throw new Error('질문 접수가 마감됐습니다.');
    const q = { id: d.seq++, round_id: roundId, author: author, content: content, selected: false, created_at: new Date().toISOString() };
    d.questions.push(q); demoWrite(d);
    return q;
  },
  async adminLogin() { return true; },
  async createRound(_p, title) {
    const d = demoRead();
    d.rounds.forEach(r => { r.status = 'closed'; });
    const t = (title || '').trim() || ('라운드 ' + (d.rounds.length + 1));
    d.rounds.push({ id: d.seq++, title: t, status: 'open', created_at: new Date().toISOString() });
    demoWrite(d);
  },
  async closeRound(_p, id) { const d = demoRead(); const r = d.rounds.find(r => r.id === id); if (r) r.status = 'closed'; demoWrite(d); },
  async reopenRound(_p, id) {
    const d = demoRead();
    d.rounds.forEach(r => { r.status = 'closed'; });
    const r = d.rounds.find(r => r.id === id); if (r) r.status = 'open';
    demoWrite(d);
  },
  async setSelected(_p, id, sel) {
    const d = demoRead();
    const q = d.questions.find(q => q.id === id); if (!q) return;
    if (sel) {
      const n = d.questions.filter(x => x.round_id === q.round_id && x.selected).length;
      if (n >= 2) throw new Error('MAX_SELECTED');
    }
    q.selected = sel; demoWrite(d);
  },
  async deleteQuestion(_p, id) { const d = demoRead(); d.questions = d.questions.filter(q => q.id !== id); demoWrite(d); },
};

const store = IS_DEMO ? LocalStore : SupabaseStore;

/* ---------- 공통 유틸 ---------- */
function startPolling(fn, ms) {
  ms = ms || 2500;
  let stopped = false;
  async function tick() {
    if (stopped) return;
    try { await fn(); } catch (e) { console.error(e); }
    if (!stopped) setTimeout(tick, ms);
  }
  tick();
  // 데모 모드: 같은 브라우저의 다른 탭이 저장하면 즉시 반영
  if (IS_DEMO) window.addEventListener('storage', function () { fn().catch(function () {}); });
  return function () { stopped = true; };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, 2600);
}

function mountDemoBadge() {
  if (!IS_DEMO) return;
  const el = document.createElement('div');
  el.className = 'demo-badge';
  el.textContent = '데모 모드 · 데이터가 이 브라우저에만 저장됩니다';
  document.body.appendChild(el);
}
