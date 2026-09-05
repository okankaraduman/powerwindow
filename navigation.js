(() => {
  "use strict";

  const header = document.querySelector(".site-header");
  if (!header) return;

  const more = header.querySelector(".site-more");
  const summary = more?.querySelector("summary");
  if (!more || !summary) return;

  // Preserve links from guides to inputs now inside disclosure sections.
  const revealHashTarget = () => {
    if (!window.location.hash) return;
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    let parent = target.parentElement;
    let revealed = false;
    while (parent) {
      if (parent.tagName === "DETAILS" && !parent.open) {
        parent.open = true;
        revealed = true;
      }
      parent = parent.parentElement;
    }
    if (revealed) requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "auto" });
      target.focus({ preventScroll: true });
    });
  };
  window.addEventListener("hashchange", revealHashTarget);
  window.addEventListener("load", revealHashTarget, { once: true });

  // Native details keeps every destination available without JavaScript.
  // These small enhancements also dismiss the menu with Escape or an outside click.
  const closeMenu = (restoreFocus = false) => {
    more.open = false;
    if (restoreFocus) summary.focus();
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && more.open) {
      event.preventDefault();
      closeMenu(more.contains(document.activeElement));
    }
  });

  document.addEventListener("click", (event) => {
    if (more.open && !more.contains(event.target)) closeMenu();
  });

  header.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      if (more.open && !more.contains(document.activeElement)) closeMenu();
    });
  });

  more.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMenu());
  });
})();
