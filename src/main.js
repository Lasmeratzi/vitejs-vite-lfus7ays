import './style.css';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hqjriysdhuvdpmfdshyo.supabase.co',
  'sb_publishable_YaMWleTvBCCgI8d4D_TF3A_fv-YtWPx'
);

// ---------- dropdown options ----------
const INDUSTRIES = [
  'Micro-Industries',
  'Cottage Industries',
  'Small-Scale Industries',
  'Medium-Scale Industries',
  'Large-Scale Industries',
];

const ASSET_SIZES = [
  'Below ₱100,000.00',
  'Over ₱100,000.00 up to ₱500,000.00',
  'Over ₱500,000.00 up to ₱5 million',
  'Over ₱5 million up to ₱20 million',
  'Over ₱20 million',
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

// ---------- page ----------
document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <div class="container">
      <div class="brand">
        <img class="logo" src="/etracslogo.svg" alt="ETRACS logo" />
        <div>
          <h1>ETRACS Pricing Tracker</h1>
          <p>Manage businesses and their base fees</p>
        </div>
      </div>
    </div>
  </header>

  <main class="container">
    <div class="stats" id="stats"></div>

    <section class="card">
      <div class="toolbar">
        <input id="search" type="search" placeholder="Search by business name, industry, or asset size..." autocomplete="off" />
        <select id="industryFilter" aria-label="Filter by industry">${options(INDUSTRIES, 'All industries')}</select>
        <button type="button" id="newBtn" class="btn-primary">+ New Business</button>
      </div>

      <div class="card-head row">
        <div>
          <h2>Businesses</h2>
          <p>All businesses saved in the system. Click a column title to sort.</p>
        </div>
        <span class="count" id="count">0 total</span>
      </div>

      <div class="table-scroll">
        <table>
          <thead id="thead">
            <tr>
              <th class="sortable" data-sort="business_name">Business name</th>
              <th class="sortable" data-sort="category">Industry</th>
              <th class="sortable" data-sort="asset_size">Asset size</th>
              <th class="sortable num" data-sort="worker_count">Workers</th>
              <th class="sortable num" data-sort="base_fee">Base fee</th>
              <th class="sortable" data-sort="created_at">Date added</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="list"></tbody>
        </table>
      </div>
    </section>
  </main>

  <dialog id="modal">
    <div class="modal-head">
      <h2 id="formTitle">Add a business</h2>
      <button type="button" id="closeBtn" class="icon-btn" aria-label="Close">×</button>
    </div>

    <form id="form" novalidate>
      <div id="editBanner"></div>

      <div class="grid">
        <div class="field full">
          <label for="name">Business name</label>
          <input id="name" type="text" placeholder="e.g. Juan's Bakery" autocomplete="off" />
        </div>

        <div class="field">
          <label for="category">Industry</label>
          <select id="category">${options(INDUSTRIES, 'Select industry')}</select>
        </div>

        <div class="field">
          <label for="asset">Asset size</label>
          <select id="asset">${options(ASSET_SIZES, 'Select asset size')}</select>
        </div>

        <div class="field">
          <label for="workers">Number of workers</label>
          <input id="workers" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 25" />
        </div>

        <div class="field">
          <label for="fee">Base fee (₱)</label>
          <div class="fee-wrap">
            <input id="fee" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" />
            <div class="fee-ghost"><span class="typed" id="feeTyped"></span><span id="feeSuffix"></span></div>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" id="submitBtn" class="btn-primary">Save business</button>
        <button type="button" id="cancel" class="btn-ghost">Cancel</button>
        <div id="msg"></div>
      </div>
    </form>
  </dialog>

  <div id="toast"></div>
`;

const form = document.querySelector('#form');
const nameInput = document.querySelector('#name');
const categorySel = document.querySelector('#category');
const assetSel = document.querySelector('#asset');
const workersSel = document.querySelector('#workers');
const feeInput = document.querySelector('#fee');
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
const industryFilter = document.querySelector('#industryFilter');
const newBtn = document.querySelector('#newBtn');
const closeBtn = document.querySelector('#closeBtn');
const toastEl = document.querySelector('#toast');

let businesses = []; // all rows from the database
let editingId = null; // null = adding, otherwise the id being edited
let searchTerm = '';
let industryTerm = '';
let sortKey = 'created_at';
let sortDir = 'desc';
let loading = true;
let toastTimer;

// ---------- messages ----------
// message inside the pop-up
function showMsg(text, type) {
  msg.textContent = text;
  msg.className = type; // 'error' or 'success'
}

// message on the page (outside the pop-up)
function notify(text, type) {
  toastEl.textContent = text;
  toastEl.className = type + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.className = ''), 3500);
}

function isDuplicate(error) {
  return (
    error.code === '23505' ||
    /duplicate key|unique constraint/i.test(error.message || '')
  );
}

// ---------- base fee: ".00" shown while typing ----------
const feeTyped = document.querySelector('#feeTyped');
const feeSuffix = document.querySelector('#feeSuffix');

function updateFeeGhost() {
  const v = feeInput.value;
  feeTyped.textContent = v;
  if (v === '') {
    feeSuffix.textContent = '';
    return;
  }
  const dot = v.indexOf('.');
  feeSuffix.textContent =
    dot === -1 ? '.00' : '0'.repeat(Math.max(0, 2 - (v.length - dot - 1)));
}

feeInput.addEventListener('input', () => {
  // keep only digits and one dot, max 2 decimals
  let v = feeInput.value.replace(/[^\d.]/g, '');
  const i = v.indexOf('.');
  if (i !== -1) {
    v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, 2);
  }
  feeInput.value = v;
  updateFeeGhost();
});

feeInput.addEventListener('blur', () => {
  const v = feeInput.value;
  if (v === '' || v === '.') {
    feeInput.value = '';
  } else {
    feeInput.value = Number(v).toFixed(2);
  }
  updateFeeGhost();
});

// number of workers: whole numbers only
workersSel.addEventListener('input', () => {
  workersSel.value = workersSel.value.replace(/\D/g, '').slice(0, 7);
});

// clear the ghost text after form.reset()
form.addEventListener('reset', () => setTimeout(updateFeeGhost, 0));

// ---------- pop-up (add / edit) ----------
function startEdit(b) {
  editingId = b.id;
  nameInput.value = b.business_name;
  categorySel.value = b.category;
  assetSel.value = b.asset_size;
  workersSel.value = b.worker_count ?? '';
  feeInput.value = b.base_fee == null ? '' : Number(b.base_fee).toFixed(2);
  updateFeeGhost();

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
  formTitle.textContent = 'Add a business';
  editBanner.style.display = 'none';
  submitBtn.textContent = 'Save business';
  renderList();
}

// "+ New Business" opens an empty form
newBtn.addEventListener('click', () => {
  stopEdit();
  showMsg('', '');
  modal.showModal();
  nameInput.focus();
});

cancelBtn.addEventListener('click', () => modal.close());
closeBtn.addEventListener('click', () => modal.close());

// clicking the dark area outside the pop-up closes it
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
  renderList();
});

industryFilter.addEventListener('change', () => {
  industryTerm = industryFilter.value;
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
    sortDir = key === 'base_fee' || key === 'created_at' ? 'desc' : 'asc';
  }
  renderList();
});

function visibleBusinesses() {
  return businesses.filter((b) => {
    if (industryTerm && b.category !== industryTerm) return false;
    if (!searchTerm) return true;
    return [b.business_name, b.category, b.asset_size]
      .join(' ')
      .toLowerCase()
      .includes(searchTerm);
  });
}

function sortValue(b) {
  switch (sortKey) {
    case 'business_name':
      return (b.business_name || '').toLowerCase();
    case 'category':
      return INDUSTRIES.indexOf(b.category);
    case 'asset_size':
      return ASSET_SIZES.indexOf(b.asset_size);
    case 'worker_count':
      return Number(b.worker_count ?? -1);
    case 'base_fee':
      return Number(b.base_fee ?? -1);
    default:
      return new Date(b.created_at).getTime();
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
  const total = businesses.length;
  const sumFee = businesses.reduce((s, b) => s + Number(b.base_fee || 0), 0);
  const avgFee = total ? sumFee / total : 0;
  const workers = businesses.reduce((s, b) => s + Number(b.worker_count || 0), 0);

  const card = (label, value) =>
    `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;

  statsEl.innerHTML =
    card('Total businesses', total.toLocaleString('en-PH')) +
    card('Total base fees', php(sumFee)) +
    card('Average base fee', php(avgFee)) +
    card('Total workers', workers.toLocaleString('en-PH'));
}

// ---------- the list ----------
function renderList() {
  renderStats();

  // show the sort arrow on the active column
  thead.querySelectorAll('th[data-sort]').forEach((th) => {
    th.dataset.dir = th.dataset.sort === sortKey ? sortDir : '';
  });

  if (loading) {
    list.innerHTML = '<tr><td class="empty" colspan="7">Loading businesses...</td></tr>';
    return;
  }

  const rows = sortedRows(visibleBusinesses());
  const filtering = searchTerm || industryTerm;

  countEl.textContent = filtering
    ? `${rows.length} of ${businesses.length}`
    : `${businesses.length} total`;

  if (!businesses.length) {
    list.innerHTML =
      '<tr><td class="empty" colspan="7">No businesses yet. Click “+ New Business” to add your first one.</td></tr>';
    return;
  }
  if (!rows.length) {
    list.innerHTML =
      '<tr><td class="empty" colspan="7">No businesses match your search or filter.</td></tr>';
    return;
  }

  list.innerHTML = rows
    .map(
      (b) => `
      <tr class="${String(b.id) === String(editingId) ? 'editing' : ''}">
        <td class="name">${esc(b.business_name)}</td>
        <td><span class="badge b${Math.max(0, INDUSTRIES.indexOf(b.category))}">${esc(b.category)}</span></td>
        <td class="muted">${esc(b.asset_size)}</td>
        <td class="muted num">${b.worker_count == null ? '' : Number(b.worker_count).toLocaleString('en-PH')}</td>
        <td class="fee num">${b.base_fee == null ? '' : php(b.base_fee)}</td>
        <td class="muted">${new Date(b.created_at).toLocaleDateString('en-PH')}</td>
        <td class="actions">
          <button type="button" class="btn-edit" data-action="edit" data-id="${esc(b.id)}">Edit</button>
          <button type="button" class="btn-delete" data-action="delete" data-id="${esc(b.id)}">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

async function loadBusinesses() {
  const { data, error } = await supabase
    .from('business')
    .select('*')
    .order('created_at', { ascending: false });

  loading = false;

  if (error) {
    list.innerHTML =
      '<tr><td class="empty" colspan="7">Could not load businesses. Please refresh the page.</td></tr>';
    console.error(error);
    return;
  }
  businesses = data;
  renderList();
}

// Edit / Delete button clicks
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
    const ok = confirm(
      `Delete "${b.business_name}"?\n\nThis cannot be undone.`
    );
    if (!ok) return;

    const { data, error } = await supabase
      .from('business')
      .delete()
      .eq('id', b.id)
      .select();

    if (error) {
      notify('Could not delete the business. Please try again.', 'error');
      console.error(error);
      return;
    }
    if (!data || data.length === 0) {
      notify(
        'Nothing was deleted. The database may not allow deleting yet (check the Supabase policy).',
        'error'
      );
      return;
    }

    notify(`"${b.business_name}" was deleted.`, 'success');
    loadBusinesses();
  }
});

// ---------- save / update ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg('', '');

  const business_name = nameInput.value.trim();
  const category = categorySel.value;
  const asset_size = assetSel.value;
  const worker_count = workersSel.value;
  const base_fee = feeInput.value;

  if (
    !business_name ||
    !category ||
    !asset_size ||
    !worker_count ||
    base_fee === '' ||
    base_fee === '.'
  ) {
    showMsg('Please fill in all fields.', 'error');
    return;
  }
  if (Number(base_fee) < 0) {
    showMsg('Base fee cannot be negative.', 'error');
    return;
  }

  const record = {
    business_name,
    category,
    asset_size,
    worker_count: Number(worker_count),
    base_fee: Number(base_fee),
  };

  submitBtn.disabled = true; // prevent double submits
  let error;
  let updatedRows = null;

  if (editingId === null) {
    ({ error } = await supabase.from('business').insert(record));
  } else {
    const res = await supabase
      .from('business')
      .update(record)
      .eq('id', editingId)
      .select();
    error = res.error;
    updatedRows = res.data;
  }
  submitBtn.disabled = false;

  if (error) {
    if (isDuplicate(error)) {
      showMsg(
        `"${business_name}" is already in the system. Please use a different business name.`,
        'error'
      );
    } else {
      showMsg('Something went wrong while saving. Please try again.', 'error');
      console.error(error);
    }
    return;
  }

  if (editingId !== null && (!updatedRows || updatedRows.length === 0)) {
    showMsg(
      'Nothing was updated. The database may not allow editing yet (check the Supabase policy).',
      'error'
    );
    return;
  }

  const wasEditing = editingId !== null;
  modal.close(); // also resets the form through the 'close' handler
  notify(wasEditing ? 'Business updated!' : 'Business saved!', 'success');
  loadBusinesses();
});

renderList(); // shows the "Loading..." row and empty summary cards
loadBusinesses();