// Light / dark mode. The choice is remembered in the browser.
const KEY = 'etracs-theme';
const root = document.documentElement;
const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readSaved() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

// saved choice first, otherwise the device setting
function current() {
  return readSaved() || (media && media.matches ? 'dark' : 'light');
}

function apply(theme) {
  root.setAttribute('data-theme', theme);
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  document.querySelectorAll('.theme-toggle').forEach((b) => {
    b.setAttribute('aria-label', label);
    b.title = label;
  });
}

apply(current());

// one listener covers every toggle button on the page
document.addEventListener('click', (e) => {
  if (!e.target.closest('.theme-toggle')) return;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage blocked: the theme still changes for this visit */
  }
  apply(next);
});

// follow the device setting until the person picks one
if (media && media.addEventListener) {
  media.addEventListener('change', () => {
    if (!readSaved()) apply(current());
  });
}

// call once after the page is drawn, so the button labels are right
export const initTheme = () => apply(current());

export const themeButtonHtml = (extraClass = '') => `
  <button type="button" class="theme-toggle ${extraClass}" aria-label="Switch to dark mode" title="Switch to dark mode">
    <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
  </button>`;