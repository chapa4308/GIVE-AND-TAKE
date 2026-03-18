const AUTH_KEY = 'gat_session_v1';
const CARDS_KEY = 'gat_cards_v1';
const TOPUPS_KEY = 'gat_topups_v1';
const BALANCES_KEY = 'gat_balances_v1';

export async function fetchContent() {
  const res = await fetch('./data/content.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Не удалось загрузить content.json');
  return await res.json();
}

function deepGet(obj, path) {
  return path.split('.').reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);
}

export async function applyContent() {
  let content;
  try {
    content = await fetchContent();
  } catch {
    return;
  }

  document.querySelectorAll('[data-t]').forEach((el) => {
    const key = el.getAttribute('data-t');
    const val = deepGet(content, key);
    if (val == null) return;
    el.textContent = String(val);
  });

  document.querySelectorAll('[data-ph]').forEach((el) => {
    const key = el.getAttribute('data-ph');
    const val = deepGet(content, key);
    if (val == null) return;
    el.setAttribute('placeholder', String(val));
  });

  document.querySelectorAll('[data-title]').forEach((el) => {
    const key = el.getAttribute('data-title');
    const val = deepGet(content, key);
    if (val == null) return;
    document.title = String(val);
  });

  document.querySelectorAll('[data-html]').forEach((el) => {
    const key = el.getAttribute('data-html');
    const val = deepGet(content, key);
    if (val == null) return;
    el.innerHTML = String(val);
  });

  // Мобильная адаптация таблиц: преобразуем в "карточный" вид
  wireResponsiveTables();
}

function normalizeSpace(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function applyResponsiveTableLabels(table) {
  const theadThs = Array.from(table.querySelectorAll('thead th'));
  const headers = theadThs.map((th) => normalizeSpace(th.textContent));

  const rows = Array.from(table.querySelectorAll('tbody tr'));

  rows.forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('td'));
    let col = 0;
    cells.forEach((td) => {
      const span = Number(td.getAttribute('colspan') || td.colSpan || 1) || 1;
      // Если colspan > 1 (placeholder: "No data/No message"),
      // не ставим label, чтобы ::before не влиял на видимость текста.
      if (span > 1) {
        td.dataset.label = '';
        td.classList.add('responsive-colspan');
      } else {
        td.dataset.label = headers[col] || '';
        td.classList.remove('responsive-colspan');
      }
      col += span;
    });
  });

  table.setAttribute('data-responsive-table', 'true');
}

export function wireResponsiveTables() {
  const mql = window.matchMedia('(max-width: 640px)');
  if (!mql.matches) return;

  document.querySelectorAll('table.table').forEach((t) => {
    // Если таблица уже помечена, все равно обновим labels (на случай рендера динамических строк)
    applyResponsiveTableLabels(t);
  });
}

export function setSession(session) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(AUTH_KEY);
}

export async function fetchUsers() {
  const res = await fetch('./data/users.txt', { cache: 'no-store' });
  if (!res.ok) throw new Error('Не удалось загрузить users.txt');
  const text = await res.text();
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [email, password, role = 'user'] = l.split('|').map((x) => x?.trim());
      return { email, password, role };
    })
    .filter((u) => u.email && u.password);
}

export async function loginWithTxt(email, password) {
  const users = await fetchUsers();
  const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!found) return { ok: false, message: 'Неверный email или пароль' };
  setSession({ email: found.email, role: found.role });
  return { ok: true, session: getSession() };
}

export function requireAuth({ role } = {}) {
  const s = getSession();
  if (!s) {
    window.location.href = './index.html';
    return null;
  }
  if (role && s.role !== role) {
    window.location.href = './home.html';
    return null;
  }
  return s;
}

export function wireLogout() {
  const btn = document.querySelector('[data-logout]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    clearSession();
    window.location.href = './index.html';
  });
}

export function setActiveNav() {
  const page = document.body.getAttribute('data-page') || '';
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-nav') === page);
  });
}

export function setUserBadge() {
  const s = getSession();
  const el = document.querySelector('[data-user]');
  if (!el) return;
  el.textContent = s ? s.email : '';
}

export function onClick(selector, fn) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.addEventListener('click', fn);
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
}

export function wireModalClose(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', (e) => {
    if (e.target === el) closeModal(id);
  });
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal(id)));
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getCards() {
  return readJson(CARDS_KEY, []);
}

export function addCard(card) {
  const cards = getCards();
  const next = [{ ...card, id: crypto.randomUUID?.() || String(Date.now()) }, ...cards];
  writeJson(CARDS_KEY, next);
  return next;
}

export function deleteCard(id) {
  const cards = getCards().filter((c) => c.id !== id);
  writeJson(CARDS_KEY, cards);
  return cards;
}

export function renderCards() {
  const tbody = document.querySelector('[data-cards-tbody]');
  const totalEl = document.querySelector('[data-cards-total]');
  const activeEl = document.querySelector('[data-cards-active]');
  if (!tbody) return;

  const cards = getCards();
  if (totalEl) totalEl.textContent = String(cards.length);
  if (activeEl) activeEl.textContent = String(cards.filter((c) => (c.status || 'Активна') === 'Активна').length);

  if (cards.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center; padding:18px">Нет информации</td></tr>`;
    return;
  }

  tbody.innerHTML = cards
    .map(
      (c) => `<tr>
        <td>${escapeHtml(c.shortId || c.id.slice(0, 6))}</td>
        <td><span class="pill">${escapeHtml(c.status || 'Активна')}</span></td>
        <td>${escapeHtml(c.bank || '-')}</td>
        <td>${escapeHtml(c.ownerName || '-')}</td>
        <td>${escapeHtml(c.cardNumber || '-')}</td>
        <td>${escapeHtml(c.phone || '-')}</td>
        <td>${escapeHtml(c.mileage || '0')}</td>
        <td><button class="btn secondary" data-del-card="${escapeAttr(c.id)}" style="padding:8px 10px;border-radius:10px;font-size:12px">Удалить</button></td>
      </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-del-card]').forEach((b) => {
    b.addEventListener('click', () => {
      deleteCard(b.getAttribute('data-del-card'));
      renderCards();
    });
  });

  wireResponsiveTables();
}

export function getTopups() {
  return readJson(TOPUPS_KEY, []);
}

export function addTopup(req) {
  const list = getTopups();
  const next = [{ ...req, id: crypto.randomUUID?.() || String(Date.now()), createdAt: new Date().toISOString() }, ...list];
  writeJson(TOPUPS_KEY, next);
  return next;
}

export function renderTopups() {
  const tbody = document.querySelector('[data-topups-tbody]');
  if (!tbody) return;
  const list = getTopups();
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted" style="text-align:center; padding:22px">Нет заявок на пополнение</td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map(
      (t) => `<tr>
        <td>${escapeHtml(t.id.slice(0, 6))}</td>
        <td>${escapeHtml(new Date(t.createdAt).toLocaleString())}</td>
        <td>${escapeHtml(t.currency || 'USDT')}</td>
        <td>${escapeHtml(t.wallet || '-')}</td>
        <td>${escapeHtml(String(t.amount || ''))}</td>
        <td>${escapeHtml(String(t.fee || ''))}</td>
        <td><span class="pill">${escapeHtml(t.status || 'New order')}</span></td>
      </tr>`
    )
    .join('');

  wireResponsiveTables();
}

export function getUserBalance(email) {
  const map = readJson(BALANCES_KEY, {});
  const raw = map[email?.toLowerCase?.() || ''] ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

export function setUserBalance(email, amount) {
  const key = email?.toLowerCase?.();
  if (!key) return;
  const map = readJson(BALANCES_KEY, {});
  const num = Number(amount);
  map[key] = Number.isFinite(num) ? num : 0;
  writeJson(BALANCES_KEY, map);
}

export function renderCurrentUserBalance() {
  const s = getSession();
  if (!s) return;
  const bal = getUserBalance(s.email);
  const formatted = bal.toFixed(2);
  document.querySelectorAll('[data-balance-usdt]').forEach((el) => {
    el.textContent = `${formatted} USDT`;
  });
}

export function wireMobileNav({ toggleSelector = '[data-mobile-nav-toggle]', sidebarSelector = '.sidebar' } = {}) {
  const toggleBtn = document.querySelector(toggleSelector);
  const sidebar = document.querySelector(sidebarSelector);
  if (!toggleBtn || !sidebar) return;

  const mql = window.matchMedia('(max-width: 640px)');
  const close = () => sidebar.classList.remove('open');
  const open = () => sidebar.classList.add('open');

  function syncByMedia() {
    if (!mql.matches) close();
  }

  // Всегда начинаем с закрытого состояния на мобилках.
  close();
  syncByMedia();
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', syncByMedia);
  } else {
    // Safari fallback
    mql.addListener(syncByMedia);
  }

  toggleBtn.addEventListener('click', () => {
    if (!mql.matches) return;
    sidebar.classList.toggle('open');
  });

  // Закрываем меню при клике вне списка
  document.addEventListener('click', (e) => {
    if (!sidebar.classList.contains('open')) return;
    const t = e.target;
    if (sidebar.contains(t)) return;
    if (toggleBtn.contains(t)) return;
    close();
  });

  // Закрываем меню и затем переходим по ссылке
  sidebar.querySelectorAll('a[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (!mql.matches) return;
      if (!sidebar.classList.contains('open')) return;

      const href = a.getAttribute('href');
      if (!href) return;

      e.preventDefault();
      close();
      window.setTimeout(() => {
        window.location.href = href;
      }, 50);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll('`', '&#096;');
}

