/* 공통 스토어 + 유틸
   CONFIG(config.js)에 Supabase 값이 있으면 서버 모드, 없으면 데모 모드(localStorage) */

const CFG = window.CONFIG || {};
const IS_DEMO = !(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY)
  || new URLSearchParams(location.search).get('demo') === '1';

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
  getStateAdmin: (pass) => rpc('get_state_admin', { pass: pass }),
  async submitQuestion(roundId, author, content, phone4) {
    const res = await fetch(CFG.SUPABASE_URL + '/rest/v1/questions', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ round_id: roundId, author: author, content: content, phone4: phone4 || '' }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error('등록에 실패했습니다. 질문 접수가 마감됐을 수 있습니다.');
    return JSON.parse(text)[0];
  },
  adminLogin: (pass) => rpc('admin_login', { pass: pass }),
  resetAll: (pass) => rpc('reset_all', { pass: pass }),
  createRound: (pass, title) => rpc('create_round', { pass: pass, p_title: title }),
  closeRound: (pass, id) => rpc('close_round', { pass: pass, p_round_id: id }),
  reopenRound: (pass, id) => rpc('reopen_round', { pass: pass, p_round_id: id }),
  setSelected: (pass, id, sel) => rpc('set_selected', { pass: pass, p_question_id: id, p_selected: sel }),
  deleteQuestion: (pass, id) => rpc('delete_question', { pass: pass, p_question_id: id }),
};

/* ---------- 데모 모드 (localStorage) ---------- */
const DEMO_KEY = 'qws-demo-v2';
function demoRead() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) {}
  if (!d || !Array.isArray(d.sessions)) {
    d = {
      sessions: (CFG.SESSION_TITLES || ['세션 1']).map(function (t, i) {
        return { id: i + 1, title: t, status: 'open', questions: [] };
      }),
      seq: 100,
    };
  }
  return d;
}
function demoWrite(d) { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); }
function demoFind(d, sid) { return d.sessions.find(function (s) { return s.id === sid; }); }

const LocalStore = {
  async getState() {
    const d = demoRead();
    return { sessions: d.sessions.map(function (s, i) {
      return { id: s.id, title: s.title, status: s.status, round_no: i + 1,
        questions: (s.questions || []).map(function (q) {
          const c = Object.assign({}, q); delete c.phone4; return c;
        }) };
    }) };
  },
  async getStateAdmin() {
    const d = demoRead();
    return { sessions: d.sessions.map(function (s, i) {
      return { id: s.id, title: s.title, status: s.status, round_no: i + 1, questions: s.questions || [] };
    }) };
  },
  async submitQuestion(sessionId, author, content, phone4) {
    const d = demoRead();
    const s = demoFind(d, sessionId);
    if (!s || s.status !== 'open') throw new Error('질문 접수가 마감된 프로그램입니다.');
    const q = { id: d.seq++, round_id: sessionId, author: author, content: content, phone4: phone4 || '', selected: false, created_at: new Date().toISOString() };
    s.questions.push(q); demoWrite(d);
    return q;
  },
  async adminLogin() { return true; },
  async resetAll() {
    const d = demoRead();
    d.sessions.forEach(function (s) { s.questions = []; s.status = 'open'; });
    demoWrite(d);
  },
  async createRound(_p, title) {
    const d = demoRead();
    d.sessions.push({ id: d.seq++, title: (title || '').trim() || ('세션 ' + (d.sessions.length + 1)), status: 'open', questions: [] });
    demoWrite(d);
  },
  async closeRound(_p, id) { const d = demoRead(); const s = demoFind(d, id); if (s) s.status = 'closed'; demoWrite(d); },
  async reopenRound(_p, id) { const d = demoRead(); const s = demoFind(d, id); if (s) s.status = 'open'; demoWrite(d); },
  async setSelected(_p, id, sel) {
    const d = demoRead();
    for (const s of d.sessions) {
      const q = (s.questions || []).find(function (x) { return x.id === id; });
      if (!q) continue;
      if (sel) {
        const n = s.questions.filter(function (x) { return x.selected; }).length;
        if (n >= 2) throw new Error('MAX_SELECTED');
      }
      q.selected = sel; demoWrite(d); return;
    }
  },
  async deleteQuestion(_p, id) {
    const d = demoRead();
    d.sessions.forEach(function (s) { s.questions = (s.questions || []).filter(function (q) { return q.id !== id; }); });
    demoWrite(d);
  },
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

function sessionInfo(i) { return (CFG.SESSION_INFO || [])[i] || {}; }
function tileClass(i) { return i < 4 ? 'nt-blue' : (i === 4 ? 'nt-teal' : 'nt-green'); }

// "제목 -연사 직함-" 형태에서 제목과 연사를 분리
function splitTitle(t) {
  const m = /^(.*?)\s*-\s*([^-]{1,40}?)\s*-\s*$/.exec(t || '');
  if (m) return { title: m[1], speaker: m[2] };
  return { title: t || '', speaker: '' };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.setAttribute('role', isErr ? 'alert' : 'status');
  t.setAttribute('aria-live', isErr ? 'assertive' : 'polite');
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
