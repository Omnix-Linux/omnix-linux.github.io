// One app-anchored dropdown; moving evidence preserves its copy handlers.
(() => {
  "use strict";
  const panel = document.getElementById("app-details");
  if (!panel) return;
  const supportsPopover = typeof panel.showPopover === "function";
  if (!supportsPopover) panel.removeAttribute("popover");
  const content = panel.querySelector(".details-content");
  const title = panel.querySelector("h3");
  const moreButton = panel.querySelector(".details-more");
  const excerpt = panel.querySelector(".details-excerpt");
  const closeButton = panel.querySelector(".details-close");
  let active = null, pinned = false, closeTimer = 0, suppressed = null, restoringFocus = false;

  function close(restoreFocus = false, suppress = true) {
    clearTimeout(closeTimer);
    if (!active) return;
    const { disclosure, trigger, body } = active;
    active = null;
    pinned = false;
    panel.classList.remove("is-expanded");
    moreButton.setAttribute("aria-expanded", "false");
    if (suppress) suppressed = trigger;
    // Return focus before hiding so the browser never restores it into hidden evidence.
    if (restoreFocus || panel.contains(document.activeElement)) {
      restoringFocus = true;
      trigger.focus({ preventScroll: true });
      restoringFocus = false;
    }
    if (supportsPopover && panel.matches(":popover-open")) panel.hidePopover();
    panel.hidden = true;
    disclosure.append(body);
    disclosure.open = false;
    trigger.setAttribute("aria-expanded", "false");
  }

  function position() {
    if (!active) return;
    const card = active.disclosure.closest(".app").getBoundingClientRect();
    const viewport = window.visualViewport;
    const width = viewport ? viewport.width : innerWidth;
    const height = viewport ? viewport.height : innerHeight;
    const leftEdge = viewport ? viewport.offsetLeft : 0;
    const topEdge = viewport ? viewport.offsetTop : 0;
    const edge = 12, gap = 6;
    if (card.bottom <= topEdge || card.top >= topEdge + height) { close(panel.contains(document.activeElement)); return; }
    const below = topEdge + height - card.bottom - gap - edge;
    const above = card.top - topEdge - gap - edge;
    const expanded = panel.classList.contains("is-expanded");
    const needed = expanded ? 160 : Math.min(card.height, panel.scrollHeight + 2);
    const onBottom = below >= needed || below >= above;
    const panelWidth = Math.min(card.width, width - edge * 2);
    panel.style.width = panelWidth + "px";
    panel.style.height = "auto";
    const available = Math.max(44, onBottom ? below : above);
    panel.style.maxHeight = (expanded ? available : Math.min(card.height, available)) + "px";
    panel.style.left = Math.max(leftEdge + edge, Math.min(card.left, leftEdge + width - panelWidth - edge)) + "px";
    panel.style.top = (onBottom ? card.bottom + gap : card.top - panel.getBoundingClientRect().height - gap) + "px";
  }

  moreButton.addEventListener("click", () => {
    if (!active) return;
    pinned = true;
    panel.classList.add("is-expanded");
    moreButton.setAttribute("aria-expanded", "true");
    position();
    closeButton.focus({ preventScroll: true });
  });
  // A wheel gesture over a transient preview should scroll the page, not trap it.
  panel.addEventListener("wheel", () => { if (!pinned) close(false, false); }, { passive: true });
  closeButton.addEventListener("click", () => close(true));
  document.addEventListener("pointerdown", event => {
    if (active && !panel.contains(event.target) && !active.trigger.contains(event.target)) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && active) {
      event.preventDefault();
      close(true);
    }
  });
  document.addEventListener("scroll", event => {
    if (active && !panel.contains(event.target)) {
      if (pinned) position();
      else close(false, false);
    }
  }, true);
  window.addEventListener("resize", position);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", position);
    window.visualViewport.addEventListener("scroll", position);
  }
  new ResizeObserver(position).observe(panel);
  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!active || pinned) return;
      if (active.trigger.matches(":hover") || panel.matches(":hover")) return;
      if (document.activeElement === active.trigger || panel.contains(document.activeElement)) return;
      // Pointer-out is ordinary dismissal, not an explicit request to suppress hover.
      close(false, false);
    }, 180);
  }
  panel.addEventListener("pointerenter", () => clearTimeout(closeTimer));
  panel.addEventListener("pointerleave", scheduleClose);
  panel.addEventListener("focusin", () => clearTimeout(closeTimer));
  panel.addEventListener("focusout", scheduleClose);

  function open(disclosure, trigger, pin = false) {
    clearTimeout(closeTimer);
    if (!pin && (suppressed === trigger || (pinned && active && active.trigger !== trigger))) return;
    if (active && active.trigger === trigger) { pinned = pinned || pin; return; }
    close(false, false);
    const body = disclosure.querySelector(":scope > .more-body");
    excerpt.textContent = body.querySelector(".app-desc").textContent;
    title.textContent = disclosure.closest(".app").querySelector("h3").textContent + " — Details";
    active = { disclosure, trigger, body };
    pinned = pin;
    content.append(body);
    const pageX = scrollX, pageY = scrollY;
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    if (supportsPopover) panel.showPopover({ source: trigger });
    // Reopening a scrolled panel must not scroll the document to its old focus.
    if (scrollX !== pageX || scrollY !== pageY) window.scrollTo({ left: pageX, top: pageY, behavior: "instant" });
    panel.scrollTop = 0;
    position();
  }
  for (const disclosure of document.querySelectorAll(".app > .more")) {
    const trigger = disclosure.querySelector(":scope > summary");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", panel.id);
    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse") {
        // A genuine new entry ends suppression from Escape or the close button.
        suppressed = null;
        open(disclosure, trigger);
      }
    });
    trigger.addEventListener("pointerleave", () => { suppressed = null; scheduleClose(); });
    trigger.addEventListener("focus", () => {
      if (restoringFocus) return;
      suppressed = null;
      open(disclosure, trigger);
    });
    trigger.addEventListener("blur", () => { suppressed = null; scheduleClose(); });
    trigger.addEventListener("click", event => {
      event.preventDefault();
      if (active && active.trigger === trigger && pinned) { close(true); return; }
      suppressed = null;
      open(disclosure, trigger, true);
      moreButton.focus({ preventScroll: true });
    });
  }
})();
