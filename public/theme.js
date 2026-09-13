const themeButton = document.querySelector('#theme-toggle');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
  themeButton.title = theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#101016' : '#f7f7fc';
}
setTheme(document.documentElement.dataset.theme);
themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  try { localStorage.setItem('pro100code-theme', theme); } catch {}
});
systemTheme.addEventListener('change', event => {
  let saved;
  try { saved = localStorage.getItem('pro100code-theme'); } catch {}
  if (saved !== 'light' && saved !== 'dark') setTheme(event.matches ? 'dark' : 'light');
});
window.addEventListener('storage', event => {
  if (event.key === 'pro100code-theme' || event.key === null) {
    const theme = event.newValue;
    setTheme(theme === 'light' || theme === 'dark' ? theme : systemTheme.matches ? 'dark' : 'light');
  }
});
