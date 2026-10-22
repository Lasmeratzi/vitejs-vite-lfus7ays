import './style.css';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hqjriysdhuvdpmfdshyo.supabase.co',
  'sb_publishable_YaMWleTvBCCgI8d4D_TF3A_fv-YtWPx'
);

// ---------- fixed dropdown options ----------
const BUSINESS_TYPES = [
  'Micro-Industries',
  'Cottage Industries',
  'Small-Scale Industries',
  'Medium-Scale Industries',
  'Large-Scale Industries',
];
const APP_TYPES = ['NEW', 'RENEW', 'RETIRE'];
const SURCHARGE_TYPES = ['Business', 'Motorcab'];
const APP_BADGE = { NEW: 'b0', RENEW: 'b1', RETIRE: 'b3' };

// ---------- form fields ----------
// kind: text (default) | select | lookup | year | phone | email | date
const GENERAL = [
  { key: 'business_name', label: 'Business name', full: true },
  { key: 'reg_trade_name', label: 'Registered trade name' },
  { key: 'owner_name', label: 'Owner' },
  { key: 'business_address', label: 'Business address', full: true },
  { key: 'owner_address', label: 'Owner address', full: true },
  { key: 'business_type', label: 'Type of business', kind: 'select', options: BUSINESS_TYPES },
  { key: 'org_type', label: 'Org type', kind: 'lookup', list: 'org_types' },
  { key: 'line_of_business', label: 'Line of business', kind: 'lookup', list: 'lines_of_business' },
  { key: 'app_type', label: 'Application type', kind: 'select', options: APP_TYPES },
  { key: 'app_no', label: 'App no.' },
  { key: 'bin', label: 'BIN' },
  { key: 'applicable_year', label: 'Applicable year', kind: 'year' },
  { key: 'year_started', label: 'Year started', kind: 'year' },
  { key: 'date_created', label: 'Date created', kind: 'date' },
  { key: 'mobile_number', label: 'Mobile number', kind: 'phone' },
  { key: 'phone_number', label: 'Phone number', kind: 'phone' },
  { key: 'email', label: 'Email (optional)', kind: 'email', optional: true },
  { key: 'assessor', label: 'Assessor' },
  { key: 'approver', label: 'Approver' },
  { key: 'created_by', label: 'Created by', readonly: true },
];

const PERMIT_FIELD = {
  key: 'sanitary_permit',
  label: 'Sanitary permit',
  kind: 'lookup',
  list: 'sanitary_permits',
};

const LOOKUP_FIELDS = [...GENERAL.filter((f) => f.kind === 'lookup'), PERMIT_FIELD];

const MONEY_KEYS = [
  'sputum_fee',
  'stool_fee',
  'health_card_fee',
  'sanitary_permit_fee',
  'surcharge_amount',
];

// ---------- helpers ----------
const php = (n) =>
  '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c])
  );

const options = (items, placeholder) =>
  `<option value="">${placeholder}</option>` +
  items.map((i) => `<option value="${esc(i)}">${esc(i)}</option>`).join('');

const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
const keyOf = (s) => norm(s).toLowerCase();
const num = (s) => (s === '' || s === '.' || s == null ? 0 : Number(s));

const todayLocal = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH') : '';

function isDuplicate(error) {
  return (
    error.code === '23505' ||
    /duplicate key|unique constraint/i.test(error.message || '')
  );
}

function fieldHtml(f) {
  const id = 'f_' + f.key;
  const star = f.optional || f.readonly ? '' : ' <span class="req">*</span>';
  let control;

  if (f.kind === 'select') {
    control = `<select id="${id}">${options(f.options, 'Select')}</select>`;
  } else {
    const attrs = [];
    if (f.kind === 'lookup') attrs.push(`list="dl_${f.list}"`);
    if (f.kind === 'year') attrs.push('inputmode="numeric" maxlength="4" placeholder="e.g. 2026"');
    if (f.kind === 'phone') attrs.push('inputmode="tel"');
    if (f.readonly) attrs.push('readonly');
    const type = f.kind === 'date' ? 'date' : f.kind === 'email' ? 'email' : 'text';
    control = `<input id="${id}" type="${type}" autocomplete="off" ${attrs.join(' ')} />`;
  }

  const hint = f.kind === 'lookup' ? `<small class="hint" id="hint_${f.key}"></small>` : '';
  return `<div class="field${f.full ? ' full' : ''}"><label for="${id}">${f.label}${star}</label>${control}${hint}</div>`;
}

function numberHtml(key, label) {
  return `<div class="field"><label for="f_${key}">${label}</label>
    <input id="f_${key}" type="text" inputmode="numeric" autocomplete="off" placeholder="0" /></div>`;
}

function moneyHtml(key, label) {
  return `<div class="field"><label for="f_${key}">${label} (₱)</label>
    <div class="fee-wrap">
      <input id="f_${key}" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" />
      <div class="fee-ghost"><span class="typed"></span><span class="suffix"></span></div>
    </div></div>`;
}

// ---------- lookups (org types, lines of business, sanitary permits) ----------
const lookups = { org_types: [], sanitary_permits: [], lines_of_business: [] };

// ---------- page ----------
document.querySelector('#app').innerHTML = `
  <div id="loginView" class="login-wrap" hidden>
    <form id="loginForm" class="login-card" novalidate>
      <img class="login-logo" src="/etracslogo.svg" alt="ETRACS logo" />
      <h1>ETRACS Pricing Tracker</h1>
      <p>Sign in to continue</p>

      <label for="email">Email</label>
      <input id="email" type="email" autocomplete="username" />

      <label for="password">Password</label>
      <input id="password" type="password" autocomplete="current-password" />

      <button type="submit" id="loginBtn" class="btn-primary">Sign in</button>
      <div id="loginMsg"></div>
    </form>
  </div>

  <div id="appView" hidden>
    <header class="topbar">
      <div class="container topbar-row">
        <div class="brand">
          <img class="logo" src="/etracslogo.svg" alt="ETRACS logo" />
          <div>
            <h1>ETRACS Pricing Tracker</h1>
            <p>Business assessments, workers, and fees</p>
          </div>
        </div>
        <div class="userbox">
          <span id="userEmail"></span>
          <button type="button" id="logoutBtn" class="btn-light">Sign out</button>
        </div>
      </div>
    </header>

    <main class="container">
      <div class="stats" id="stats"></div>

      <section class="card">
        <div class="toolbar">
          <input id="search" type="search" placeholder="Search by business, owner, BIN, app no., or line of business..." autocomplete="off" />
          <select id="appFilter" aria-label="Filter by application type">${options(APP_TYPES, 'All application types')}</select>
          <button type="button" id="newBtn" class="btn-primary">+ New Business</button>
        </div>

        <div class="card-head row">
          <div>
            <h2>Businesses</h2>
            <p>Click a column title to sort. Use Edit to see and change every detail.</p>
          </div>
          <span class="count" id="count">0 total</span>
        </div>

        <div class="table-scroll">
          <table>
            <thead id="thead">
              <tr>
                <th class="sortable" data-sort="business_name">Business</th>
                <th class="sortable" data-sort="owner_name">Owner</th>
                <th class="sortable" data-sort="line">Line of business</th>
                <th class="sortable" data-sort="app_type">Application</th>
                <th class="sortable num" data-sort="workers">Workers</th>
                <th class="sortable num" data-sort="fees">Total fees</th>
                <th class="sortable" data-sort="date_created">Date created</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody id="list"></tbody>
          </table>
        </div>
        <div class="pager" id="pager"></div>
      </section>
    </main>
  </div>

  <dialog id="modal">
    <div class="modal-head">
      <h2 id="formTitle">Add a business</h2>
      <button type="button" id="closeBtn" class="icon-btn" aria-label="Close">×</button>
    </div>

    <form id="form" novalidate>
      <div id="editBanner"></div>

      <h3 class="section">General information</h3>
      <div class="grid">${GENERAL.map(fieldHtml).join('')}</div>

      <h3 class="section">Workers</h3>
      <div class="grid">
        ${numberHtml('male_workers', 'Male workers')}
        ${numberHtml('female_workers', 'Female workers')}
        <div class="field">
          <label for="f_total_workers">Total workers</label>
          <input id="f_total_workers" type="text" readonly />
        </div>
      </div>

      <h3 class="section">Fees</h3>
      <div class="grid">
        ${moneyHtml('sputum_fee', 'Sputum')}
        ${moneyHtml('stool_fee', 'Stool')}
        ${moneyHtml('health_card_fee', 'Health card')}
        ${fieldHtml(PERMIT_FIELD)}
        ${moneyHtml('sanitary_permit_fee', 'Sanitary permit fee')}
        <div></div>
        <div class="field">
          <label for="f_surcharge_type">Surcharge type</label>
          <select id="f_surcharge_type">${options(SURCHARGE_TYPES, 'None')}</select>
        </div>
        ${moneyHtml('surcharge_amount', 'Surcharge amount')}
      </div>

      <div class="form-actions">
        <button type="submit" id="submitBtn" class="btn-primary">Save business</button>
        <button type="button" id="cancel" class="btn-ghost">Cancel</button>
        <div id="msg"></div>
      </div>
    </form>

    <datalist id="dl_org_types"></datalist>
    <datalist id="dl_lines_of_business"></datalist>
    <datalist id="dl_sanitary_permits"></datalist>
  </dialog>

  <div id="toast"></div>
`;

const el = (key) => document.getElementById('f_' + key);

const loginView = document.querySelector('#loginView');
const appView = document.querySelector('#appView');
const loginForm = document.querySelector('#loginForm');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const loginBtn = document.querySelector('#loginBtn');
const loginMsg = document.querySelector('#loginMsg');
const logoutBtn = document.querySelector('#logoutBtn');
const userEmail = document.querySelector('#userEmail');

const form = document.querySelector('#form');
const msg = document.querySelector('#msg');
const list = document.querySelector('#list');
const thead = document.querySelector('#thead');
const statsEl = document.querySelector('#stats');
const submitBtn = document.querySelector('#submitBtn');
const cancelBtn = document.querySelector('#cancel');
const editBanner = document.querySelector('#editBanner');
const formTitle = document.querySelector('#formTitle');
const countEl = document.querySelector('#count');
const modal = document.querySelector('#modal');
const searchInput = document.querySelector('#search');
const appFilter = document.querySelector('#appFilter');
const newBtn = document.querySelector('#newBtn');
const closeBtn = document.querySelector('#closeBtn');
const toastEl = document.querySelector('#toast');
const pagerEl = document.querySelector('#pager');

const PAGE_SIZE = 10; // businesses shown per page

let businesses = []; // all rows from the database
let editingId = null; // null = adding, otherwise the id being edited
let searchTerm = '';
let appTerm = '';
let sortKey = 'date_created';
let sortDir = 'desc';
let page = 1;
let loading = true;
let signedIn = false;
let currentEmail = '';
let toastTimer;

// ---------- login / logout ----------
function showApp(session) {
  if (session) {
    currentEmail = session.user.email || '';
    loginView.hidden = true;
    appView.hidden = false;
    userEmail.textContent = currentEmail;

    if (!signedIn) {
      signedIn = true;
      loading = true;
      renderList();
      // run outside the auth callback, as Supabase recommends
      setTimeout(loadAll, 0);
    }
  } else {
    signedIn = false;
    currentEmail = '';
    businesses = [];
    editingId = null;
    if (modal.open) modal.close();
    appView.hidden = true;
    loginView.hidden = false;
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsg.textContent = '';

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    loginMsg.textContent = 'Please enter your email and password.';
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  loginBtn.disabled = false;
  loginBtn.textContent = 'Sign in';

  if (error) {
    loginMsg.textContent = 'Incorrect email or password.';
    console.error(error);
    return;
  }
  loginForm.reset();
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut(); // triggers showApp(null)
});

// ---------- messages ----------
function showMsg(text, type) {
  msg.textContent = text;
  msg.className = type; // 'error' or 'success'
}

function notify(text, type) {
  toastEl.textContent = text;
  toastEl.className = type + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.className = ''), 3500);
}

// ---------- lookups: load, suggest, save new ones ----------
async function loadLookups() {
  for (const table of Object.keys(lookups)) {
    const { data, error } = await supabase.from(table).select('*').order('name');
    if (error) {
      console.error(error);
      continue;
    }
    lookups[table] = data;
  }
  fillDatalists();
  refreshHints();
}

function fillDatalists() {
  for (const table of Object.keys(lookups)) {
    document.querySelector('#dl_' + table).innerHTML = lookups[table]
      .map((r) => `<option value="${esc(r.name)}"></option>`)
      .join('');
  }
}

const findLookup = (table, name) =>
  lookups[table].find((r) => keyOf(r.name) === keyOf(name));

// returns the existing row, or saves the new name and returns it
async function ensureLookup(table, name, extra = {}) {
  const existing = findLookup(table, name);
  if (existing) return existing;

  const { data, error } = await supabase
    .from(table)
    .insert({ name: norm(name), ...extra })
    .select()
    .single();

  if (error) {
    if (isDuplicate(error)) {
      // someone saved it a moment ago, so reload and use that one
      await loadLookups();
      const again = findLookup(table, name);
      if (again) return again;
    }
    throw error;
  }

  lookups[table].push(data);
  lookups[table].sort((a, b) => a.name.localeCompare(b.name));
  fillDatalists();
  return data;
}

// "New entry" note under a lookup field when the typed value isn't saved yet
function refreshHints() {
  LOOKUP_FIELDS.forEach((f) => {
    const value = norm(el(f.key).value);
    document.querySelector('#hint_' + f.key).textContent =
      value && !findLookup(f.list, value)
        ? 'New entry. It will be saved for next time.'
        : '';
  });
}

LOOKUP_FIELDS.forEach((f) => {
  el(f.key).addEventListener('input', () => {
    // known line of business -> fill in the sanitary permit connected to it
    if (f.key === 'line_of_business') {
      const line = findLookup('lines_of_business', el('line_of_business').value);
      if (line && line.sanitary_permit_id) {
        const permit = lookups.sanitary_permits.find(
          (p) => p.id === line.sanitary_permit_id
        );
        if (permit) el('sanitary_permit').value = permit.name;
      }
    }
    refreshHints();
  });
});

// ---------- input rules ----------
function updateTotal() {
  const total = num(el('male_workers').value) + num(el('female_workers').value);
  el('total_workers').value = total.toLocaleString('en-PH');
}

['male_workers', 'female_workers'].forEach((k) => {
  el(k).addEventListener('input', () => {
    el(k).value = el(k).value.replace(/\D/g, '').slice(0, 6);
    updateTotal();
  });
});

GENERAL.filter((f) => f.kind === 'year').forEach((f) => {
  el(f.key).addEventListener('input', () => {
    el(f.key).value = el(f.key).value.replace(/\D/g, '').slice(0, 4);
  });
});

GENERAL.filter((f) => f.kind === 'phone').forEach((f) => {
  el(f.key).addEventListener('input', () => {
    el(f.key).value = el(f.key).value.replace(/[^\d+\-() ]/g, '');
  });
});

// money boxes: ".00" shown while typing
function updateGhost(input) {
  const typed = input.parentElement.querySelector('.typed');
  const suffix = input.parentElement.querySelector('.suffix');
  const v = input.value;
  typed.textContent = v;
  if (v === '') {
    suffix.textContent = '';
    return;
  }
  const dot = v.indexOf('.');
  suffix.textContent =
    dot === -1 ? '.00' : '0'.repeat(Math.max(0, 2 - (v.length - dot - 1)));
}

const updateGhosts = () => MONEY_KEYS.forEach((k) => updateGhost(el(k)));

MONEY_KEYS.forEach((k) => {
  const input = el(k);

  input.addEventListener('input', () => {
    // keep only digits and one dot, max 2 decimals
    let v = input.value.replace(/[^\d.]/g, '');
    const i = v.indexOf('.');
    if (i !== -1) {
      v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, 2);
    }
    input.value = v;
    updateGhost(input);
  });

  input.addEventListener('blur', () => {
    const v = input.value;
    input.value = v === '' || v === '.' ? '' : Number(v).toFixed(2);
    updateGhost(input);
  });
});

// remove the red border as soon as the user fixes a field
function clearInvalid() {
  form.querySelectorAll('.invalid').forEach((x) => x.classList.remove('invalid'));
}
form.addEventListener('input', (e) => e.target.classList.remove('invalid'));
form.addEventListener('change', (e) => e.target.classList.remove('invalid'));

// ---------- pop-up (add / edit) ----------
function setDefaults() {
  el('date_created').value = todayLocal();
  el('created_by').value = currentEmail;
  updateTotal();
  updateGhosts();
  refreshHints();
}

function fillForm(b) {
  const values = {
    ...b,
    org_type: b.org_type,
    line_of_business: b.line,
    sanitary_permit: b.permit,
  };
  [...GENERAL, PERMIT_FIELD].forEach((f) => {
    el(f.key).value = values[f.key] ?? '';
  });
  el('male_workers').value = b.male_workers ?? 0;
  el('female_workers').value = b.female_workers ?? 0;
  MONEY_KEYS.forEach((k) => {
    el(k).value = Number(b[k] ?? 0).toFixed(2);
  });
  el('surcharge_type').value = b.surcharge_type || '';
  updateTotal();
  updateGhosts();
  refreshHints();
}

function startEdit(b) {
  editingId = b.id;
  clearInvalid();
  fillForm(b);

  formTitle.textContent = 'Edit business';
  editBanner.textContent = `You are editing: ${b.business_name}`;
  editBanner.style.display = 'block';
  submitBtn.textContent = 'Update business';
  showMsg('', '');
  renderList();
  modal.showModal();
}

function stopEdit() {
  editingId = null;
  form.reset();
  clearInvalid();
  setDefaults();
  formTitle.textContent = 'Add a business';
  editBanner.style.display = 'none';
  submitBtn.textContent = 'Save business';
  renderList();
}

newBtn.addEventListener('click', () => {
  stopEdit();
  showMsg('', '');
  modal.showModal();
  el('business_name').focus();
});

cancelBtn.addEventListener('click', () => modal.close());
closeBtn.addEventListener('click', () => modal.close());

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.close();
});

// runs whenever the pop-up closes (Cancel, X, Esc key, or after saving)
modal.addEventListener('close', () => {
  stopEdit();
  showMsg('', '');
});

// ---------- search, filter, sort ----------
searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  page = 1;
  renderList();
});

appFilter.addEventListener('change', () => {
  appTerm = appFilter.value;
  page = 1;
  renderList();
});

thead.addEventListener('click', (e) => {
  const th = e.target.closest('th[data-sort]');
  if (!th) return;
  const key = th.dataset.sort;
  if (sortKey === key) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = key;
    sortDir = ['fees', 'workers', 'date_created'].includes(key) ? 'desc' : 'asc';
  }
  page = 1;
  renderList();
});

const workersOf = (b) => Number(b.male_workers || 0) + Number(b.female_workers || 0);
const feesOf = (b) =>
  Number(b.sputum_fee || 0) +
  Number(b.stool_fee || 0) +
  Number(b.health_card_fee || 0) +
  Number(b.sanitary_permit_fee || 0) +
  Number(b.surcharge_amount || 0);

function visibleBusinesses() {
  return businesses.filter((b) => {
    if (appTerm && b.app_type !== appTerm) return false;
    if (!searchTerm) return true;
    return [
      b.business_name,
      b.owner_name,
      b.reg_trade_name,
      b.bin,
      b.app_no,
      b.line,
      b.org_type,
      b.business_address,
    ]
      .join(' ')
      .toLowerCase()
      .includes(searchTerm);
  });
}

function sortValue(b) {
  switch (sortKey) {
    case 'business_name':
      return (b.business_name || '').toLowerCase();
    case 'owner_name':
      return (b.owner_name || '').toLowerCase();
    case 'line':
      return (b.line || '').toLowerCase();
    case 'app_type':
      return APP_TYPES.indexOf(b.app_type);
    case 'workers':
      return workersOf(b);
    case 'fees':
      return feesOf(b);
    default:
      return b.date_created || '';
  }
}

function sortedRows(rows) {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = sortValue(a);
    const y = sortValue(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

// ---------- summary cards ----------
function renderStats() {
  const count = (t) => businesses.filter((b) => b.app_type === t).length;
  const workers = businesses.reduce((s, b) => s + workersOf(b), 0);
  const fees = businesses.reduce((s, b) => s + feesOf(b), 0);

  const card = (label, value) =>
    `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;

  statsEl.innerHTML =
    card('Total businesses', businesses.length.toLocaleString('en-PH')) +
    card('New / Renew / Retire', `${count('NEW')} / ${count('RENEW')} / ${count('RETIRE')}`) +
    card('Total workers', workers.toLocaleString('en-PH')) +
    card('Total fees', php(fees));
}

// ---------- the list ----------
function renderList() {
  renderStats();

  thead.querySelectorAll('th[data-sort]').forEach((th) => {
    th.dataset.dir = th.dataset.sort === sortKey ? sortDir : '';
  });

  if (loading) {
    list.innerHTML = '<tr><td class="empty" colspan="8">Loading businesses...</td></tr>';
    pagerEl.innerHTML = '';
    return;
  }

  const allRows = sortedRows(visibleBusinesses());
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  const start = (page - 1) * PAGE_SIZE;
  const rows = allRows.slice(start, start + PAGE_SIZE);
  const filtering = searchTerm || appTerm;

  countEl.textContent = filtering
    ? `${allRows.length} of ${businesses.length}`
    : `${businesses.length} total`;

  if (!businesses.length) {
    list.innerHTML =
      '<tr><td class="empty" colspan="8">No businesses yet. Click “+ New Business” to add your first one.</td></tr>';
    pagerEl.innerHTML = '';
    return;
  }
  if (!allRows.length) {
    list.innerHTML =
      '<tr><td class="empty" colspan="8">No businesses match your search or filter.</td></tr>';
    pagerEl.innerHTML = '';
    return;
  }

  list.innerHTML = rows
    .map(
      (b) => `
      <tr class="${String(b.id) === String(editingId) ? 'editing' : ''}">
        <td class="name">${esc(b.business_name)}<small>BIN ${esc(b.bin)}</small></td>
        <td>${esc(b.owner_name)}</td>
        <td>${esc(b.line)}</td>
        <td><span class="badge ${APP_BADGE[b.app_type] || 'b0'}">${esc(b.app_type)}</span></td>
        <td class="num">${workersOf(b).toLocaleString('en-PH')}<small>M ${b.male_workers} · F ${b.female_workers}</small></td>
        <td class="fee num">${php(feesOf(b))}</td>
        <td class="muted">${fmtDate(b.date_created)}</td>
        <td class="actions">
          <button type="button" class="btn-edit" data-action="edit" data-id="${esc(b.id)}">Edit</button>
          <button type="button" class="btn-delete" data-action="delete" data-id="${esc(b.id)}">Delete</button>
        </td>
      </tr>`
    )
    .join('');

  renderPager(allRows.length, totalPages, start, rows.length);
}

// ---------- pagination ----------
function pageNumbers(current, last) {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const set = new Set([1, last, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (current >= last - 2) [last - 1, last - 2, last - 3].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

function renderPager(total, totalPages, start, shown) {
  const info = `<span class="pager-info">Showing ${start + 1}–${start + shown} of ${total}</span>`;

  if (totalPages <= 1) {
    pagerEl.innerHTML = info;
    return;
  }

  const nums = pageNumbers(page, totalPages)
    .map((n) =>
      n === '…'
        ? '<span class="pager-gap">…</span>'
        : `<button type="button" class="pg ${n === page ? 'active' : ''}" data-page="${n}">${n}</button>`
    )
    .join('');

  pagerEl.innerHTML = `
    ${info}
    <div class="pager-buttons">
      <button type="button" class="pg" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹ Previous</button>
      ${nums}
      <button type="button" class="pg" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>Next ›</button>
    </div>`;
}

pagerEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-page]');
  if (!btn || btn.disabled) return;
  page = Number(btn.dataset.page);
  renderList();
});

// ---------- load data ----------
async function loadBusinesses() {
  const { data, error } = await supabase
    .from('businesses')
    .select('*, org_types(name), lines_of_business(name), sanitary_permits(name)')
    .order('created_at', { ascending: false });

  loading = false;

  if (error) {
    list.innerHTML =
      '<tr><td class="empty" colspan="8">Could not load businesses. Please refresh the page.</td></tr>';
    console.error(error);
    return;
  }

  businesses = data.map((b) => ({
    ...b,
    org_type: b.org_types?.name || '',
    line: b.lines_of_business?.name || '',
    permit: b.sanitary_permits?.name || '',
  }));
  renderList();
}

async function loadAll() {
  await loadLookups();
  await loadBusinesses();
}

// ---------- edit / delete buttons ----------
list.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const b = businesses.find((x) => String(x.id) === btn.dataset.id);
  if (!b) return;

  if (btn.dataset.action === 'edit') {
    startEdit(b);
    return;
  }

  if (btn.dataset.action === 'delete') {
    const ok = confirm(`Delete "${b.business_name}"?\n\nThis cannot be undone.`);
    if (!ok) return;

    const { data, error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', b.id)
      .select();

    if (error) {
      notify('Could not delete the business. Please try again.', 'error');
      console.error(error);
      return;
    }
    if (!data || data.length === 0) {
      notify('Nothing was deleted. Check the Supabase policy for this table.', 'error');
      return;
    }

    notify(`"${b.business_name}" was deleted.`, 'success');
    loadBusinesses();
  }
});

// ---------- save / update ----------
function readForm() {
  const v = {};
  [...GENERAL, PERMIT_FIELD].forEach((f) => (v[f.key] = norm(el(f.key).value)));
  ['male_workers', 'female_workers', ...MONEY_KEYS].forEach((k) => (v[k] = el(k).value));
  v.surcharge_type = el('surcharge_type').value;
  return v;
}

function validate(v) {
  const bad = [];
  GENERAL.forEach((f) => {
    if (!f.optional && !f.readonly && !v[f.key]) bad.push(f.key);
  });
  if (!v.sanitary_permit) bad.push('sanitary_permit');
  if (bad.length) return { keys: bad, text: 'Please fill in the highlighted fields.' };

  const yearOk = (y) => /^\d{4}$/.test(y) && y >= 1900 && y <= 2100;
  if (!yearOk(v.applicable_year))
    return { keys: ['applicable_year'], text: 'Enter a valid 4-digit applicable year.' };
  if (!yearOk(v.year_started))
    return { keys: ['year_started'], text: 'Enter a valid 4-digit year started.' };
  if (v.email && !/^\S+@\S+\.\S+$/.test(v.email))
    return { keys: ['email'], text: 'Enter a valid email address, or leave it empty.' };
  if (num(v.surcharge_amount) > 0 && !v.surcharge_type)
    return { keys: ['surcharge_type'], text: 'Choose the surcharge type.' };
  return null;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg('', '');
  clearInvalid();

  const v = readForm();
  const problem = validate(v);
  if (problem) {
    problem.keys.forEach((k) => el(k).classList.add('invalid'));
    showMsg(problem.text, 'error');
    return;
  }

  submitBtn.disabled = true; // prevent double submits
  try {
    // save any new org type / line of business / sanitary permit
    const org = await ensureLookup('org_types', v.org_type);
    const permit = await ensureLookup('sanitary_permits', v.sanitary_permit);
    const line = await ensureLookup('lines_of_business', v.line_of_business, {
      sanitary_permit_id: permit.id,
    });

    // keep the line of business connected to the permit that was just chosen
    if (line.sanitary_permit_id !== permit.id) {
      const { error: linkError } = await supabase
        .from('lines_of_business')
        .update({ sanitary_permit_id: permit.id })
        .eq('id', line.id);
      if (linkError) throw linkError;
      line.sanitary_permit_id = permit.id;
    }

    const record = {
      business_name: v.business_name,
      reg_trade_name: v.reg_trade_name,
      owner_name: v.owner_name,
      business_type: v.business_type,
      business_address: v.business_address,
      owner_address: v.owner_address,
      org_type_id: org.id,
      line_of_business_id: line.id,
      sanitary_permit_id: permit.id,
      app_type: v.app_type,
      app_no: v.app_no,
      bin: v.bin,
      applicable_year: Number(v.applicable_year),
      year_started: Number(v.year_started),
      date_created: v.date_created,
      mobile_number: v.mobile_number,
      phone_number: v.phone_number,
      email: v.email || null,
      created_by: v.created_by || currentEmail,
      assessor: v.assessor,
      approver: v.approver,
      male_workers: num(v.male_workers),
      female_workers: num(v.female_workers),
      sputum_fee: num(v.sputum_fee),
      stool_fee: num(v.stool_fee),
      health_card_fee: num(v.health_card_fee),
      sanitary_permit_fee: num(v.sanitary_permit_fee),
      surcharge_amount: num(v.surcharge_amount),
      surcharge_type: num(v.surcharge_amount) > 0 ? v.surcharge_type : null,
    };

    let error;
    let updatedRows = null;

    if (editingId === null) {
      ({ error } = await supabase.from('businesses').insert(record));
    } else {
      const res = await supabase
        .from('businesses')
        .update(record)
        .eq('id', editingId)
        .select();
      error = res.error;
      updatedRows = res.data;
    }

    if (error) {
      if (isDuplicate(error)) {
        el('bin').classList.add('invalid');
        el('applicable_year').classList.add('invalid');
        showMsg(
          `A record for BIN ${v.bin} in ${v.applicable_year} already exists.`,
          'error'
        );
      } else {
        showMsg('Something went wrong while saving. Please try again.', 'error');
        console.error(error);
      }
      return;
    }

    if (editingId !== null && (!updatedRows || updatedRows.length === 0)) {
      showMsg('Nothing was updated. Check the Supabase policy for this table.', 'error');
      return;
    }

    const wasEditing = editingId !== null;
    modal.close(); // also resets the form through the 'close' handler
    notify(wasEditing ? 'Business updated!' : 'Business saved!', 'success');
    loadBusinesses();
  } catch (err) {
    showMsg('Something went wrong while saving. Please try again.', 'error');
    console.error(err);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- start ----------
setDefaults();
renderList();
supabase.auth.onAuthStateChange((_event, session) => showApp(session));
supabase.auth.getSession().then(({ data }) => showApp(data.session));