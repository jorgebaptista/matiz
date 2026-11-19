// Runs in the head before paint, in both the website and offline game.
(() => {
  const key = "matiz.theme";
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const root = document.documentElement;
  const valid = value => value === "light" || value === "dark" ? value : null;
  let preference = null;
  try { preference = valid(localStorage.getItem(key)); }
  catch { /* A blocked store still permits an in-memory theme choice. */ }

  function apply(notify = false) {
    const theme = preference || (system.matches ? "dark" : "light");
    const changed = root.dataset.theme !== theme;
    root.dataset.theme = theme;
    if (changed) document.dispatchEvent(new Event("matiz-theme-change"));
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#14231e" : "#f7f5ed");
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      button.setAttribute("aria-pressed", String(theme === "dark"));
    });
    if (notify && location.protocol === "file:" && location.pathname.startsWith("/android_asset/"))
      location.href = "matiz-theme://" + theme;
  }

  apply();
  document.addEventListener("DOMContentLoaded", () => apply());
  document.addEventListener("click", event => {
    if (!event.target.closest("[data-theme-toggle]")) return;
    preference = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(key, preference); }
    catch { /* Keep the selected theme for this page when storage is unavailable. */ }
    apply(true);
  });
  system.addEventListener("change", () => { if (!preference) apply(true); });
  window.addEventListener("storage", event => {
    if (event.key === key || event.key === null) {
      preference = valid(event.newValue);
      apply(true);
    }
  });
})();
