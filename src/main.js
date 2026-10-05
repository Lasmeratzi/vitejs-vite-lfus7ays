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

const WORKER_COUNTS = [
  'No specific',
  '1 - 10',
  '11 - 99',
  '100 - 199',
  '200 and above',
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
  <style>
    .wrap { max-width: 900px; margin: 30px auto; font-family: sans-serif; padding: 0 12px; }
    label { display: block; margin-top: 10px; font-weight: 600; }
    input, select { width: 100%; padding: 8px; box-sizing: border-box; }
    button { margin-top: 14px; padding: 10px 18px; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f0f0f0; color: #222; }
    #msg { margin-top: 10px; font-weight: 600; }
    #msg.error { color: #b00020; background: #fdecea; padding: 10px; border-radius: 6px; }
    #msg.success { color: #1b5e20; background: #e8f5e9; padding: 10px; border-radius: 6px; }
    .table-scroll { overflow-x: auto; }
  </style>

  <div class="wrap">
    <h2>ETRACS Pricing Tracker</h2>

    <form id="form">
      <label>Business name</label>
      <input id="name" type="text" placeholder="e.g. Juan's Bakery" />

      <label>Industry</label>
      <select id="category">${options(INDUSTRIES, 'Select industry')}</select>

      <label>Asset size</label>
      <select id="asset">${options(ASSET_SIZES, 'Select asset size')}</select>

      <label>Number of workers</label>
      <select id="workers">${options(
        WORKER_COUNTS,
        'Select number of workers'
      )}</select>

      <label>Base fee (₱)</label>
      <input id="fee" type="number" min="0" step="0.01" placeholder="0.00" />

      <button type="submit">Save business</button>
      <div id="msg"></div>
    </form>

    <h3 style="margin-top:32px">Businesses</h3>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Business name</th><th>Industry</th><th>Asset size</th>
            <th>Workers</th><th>Base fee</th><th>Date added</th>
          </tr>
        </thead>
        <tbody id="list"></tbody>
      </table>
    </div>
  </div>
`;

const form = document.querySelector('#form');
const nameInput = document.querySelector('#name');
const categorySel = document.querySelector('#category');
const assetSel = document.querySelector('#asset');
const workersSel = document.querySelector('#workers');
const feeInput = document.querySelector('#fee');
const msg = document.querySelector('#msg');
const list = document.querySelector('#list');

function showMsg(text, type) {
  msg.textContent = text;
  msg.className = type; // 'error' or 'success'
}

function isDuplicate(error) {
  return (
    error.code === '23505' ||
    /duplicate key|unique constraint/i.test(error.message || '')
  );
}

// ---------- load the list ----------
async function loadBusinesses() {
  const { data, error } = await supabase
    .from('business')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<tr><td colspan="6">Could not load businesses. Please refresh the page.</td></tr>`;
    console.error(error);
    return;
  }
  if (!data.length) {
    list.innerHTML = '<tr><td colspan="6">No businesses yet.</td></tr>';
    return;
  }

  list.innerHTML = data
    .map(
      (b) => `
      <tr>
        <td>${esc(b.business_name)}</td>
        <td>${esc(b.category)}</td>
        <td>${esc(b.asset_size)}</td>
        <td>${esc(b.worker_count)}</td>
        <td>${b.base_fee == null ? '' : php(b.base_fee)}</td>
        <td>${new Date(b.created_at).toLocaleDateString('en-PH')}</td>
      </tr>`
    )
    .join('');
}

// ---------- save ----------
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
    base_fee === ''
  ) {
    showMsg('Please fill in all fields.', 'error');
    return;
  }
  if (Number(base_fee) < 0) {
    showMsg('Base fee cannot be negative.', 'error');
    return;
  }

  const { error } = await supabase.from('business').insert({
    business_name,
    category,
    asset_size,
    worker_count,
    base_fee: Number(base_fee),
  });

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

  form.reset();
  showMsg('Business saved!', 'success');
  loadBusinesses();
});

loadBusinesses();