// One app-anchored dropdown; moving evidence preserves its copy handlers.
(() => {
  "use strict";
  const panel = document.getElementById("app-details");
  if (!panel) return;
  const shotPreview = document.getElementById("test-run-preview");
  const inShotPreview = target => shotPreview && !shotPreview.hidden && shotPreview.contains(target);
  const supportsPopover = typeof panel.showPopover === "function";
  if (!supportsPopover) panel.removeAttribute("popover");
  const content = panel.querySelector(".details-content");
  const title = panel.querySelector("h3");
  const closeButton = panel.querySelector(".details-close");
  let scrollHeld = false, pointerX = null, pointerY = null, openedX = 0, openedY = 0;
  let active = null, pinned = false, closeTimer = 0, suppressed = null, restoringFocus = false;

  function close(restoreFocus = false, suppress = true) {
    clearTimeout(closeTimer);
    if (!active) return;
    const { disclosure, trigger, body } = active;
    active = null;
    document.dispatchEvent(new Event("details-dismiss"));
    pinned = false;
    scrollHeld = false;
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
    const panelWidth = Math.min(card.width * 0.8, width - edge * 2);
    panel.style.width = panelWidth + "px";
    const needed = panel.scrollHeight + 2;
    const onBottom = below >= needed || (above < needed && below >= above);
    panel.style.height = "auto";
    const available = Math.max(44, onBottom ? below : above);
    panel.style.maxHeight = available + "px";
    panel.style.left = Math.max(leftEdge + edge, Math.min(card.right - panelWidth, leftEdge + width - panelWidth - edge)) + "px";
    panel.style.top = (onBottom ? card.bottom + gap : card.top - panel.getBoundingClientRect().height - gap) + "px";
  }

  // Clicks pin explicitly; scrolling only holds hover until the mouse moves.
  function holdForScroll() {
    if (!active) return;
    scrollHeld = true;
    clearTimeout(closeTimer);
  }
  document.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse") return;
    const moved = event.clientX !== pointerX || event.clientY !== pointerY;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!active || !scrollHeld || !moved) return;
    scrollHeld = false;
    if (panel.contains(event.target) || active.trigger.contains(event.target) || inShotPreview(event.target)) clearTimeout(closeTimer);
    else scheduleClose();
  }, { passive: true });
  panel.addEventListener("pointerdown", () => { if (active) pinned = true; });
  document.addEventListener("wheel", event => {
    if (!active) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const dx = event.deltaX * unit, dy = event.deltaY * unit;
    const target = event.target instanceof Element ? event.target : null;
    const scroller = target && target.closest(".shot-viewport, #app-details");
    // Passive wheel events may arrive after the internal scroll has already moved.
    // Let the page scroll listener detect chaining at an overlay's boundaries.
    if (!scroller && Math.max(Math.abs(dx), Math.abs(dy)) >= 80) {
      close(document.activeElement === active.trigger || panel.contains(document.activeElement) || inShotPreview(document.activeElement));
      return;
    }
    holdForScroll();
  }, { passive: true, capture: true });
  closeButton.addEventListener("click", () => close(true));
  document.addEventListener("pointerdown", event => {
    if (active && !panel.contains(event.target) && !active.trigger.contains(event.target) && !inShotPreview(event.target)) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && active && (!shotPreview || shotPreview.hidden)) {
      event.preventDefault();
      close(true);
    }
  });
  document.addEventListener("scroll", event => {
    if (!active) return;
    // Page scrolling can move the anchor away from a stationary pointer.
    // Keep it open rather than treating that movement as an intentional mouse-out.
    if (event.target === document || (event.target instanceof Element && event.target.contains(active.disclosure))) {
      if (Math.max(Math.abs(scrollX - openedX), Math.abs(scrollY - openedY)) >= 80) {
        close(document.activeElement === active.trigger || panel.contains(document.activeElement) || inShotPreview(document.activeElement));
        return;
      }
      holdForScroll();
      position();
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
      if (!active || pinned || scrollHeld) return;
      if (active.trigger.matches(":hover") || panel.matches(":hover")) return;
      if (shotPreview && !shotPreview.hidden && (shotPreview.matches(":hover") || shotPreview.dataset.pinned === "true" || inShotPreview(document.activeElement))) return;
      if (document.activeElement === active.trigger || panel.contains(document.activeElement)) return;
      // Pointer-out is ordinary dismissal, not an explicit request to suppress hover.
      close(false, false);
    }, 180);
  }
  document.addEventListener("test-preview-dismiss", scheduleClose);
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
    const app = disclosure.closest(".app");
    panel.style.setProperty("--status", getComputedStyle(app).getPropertyValue("--status").trim() || "#9cadc8");
    const icon = app.querySelector(".app-icon").cloneNode(true);
    icon.className = "details-app-icon";
    icon.setAttribute("aria-hidden", "true");
    if (icon.tagName === "IMG") icon.alt = "";
    const name = document.createElement("span");
    name.className = "details-name";
    name.textContent = app.querySelector("h3").textContent;
    title.replaceChildren(icon, name);
    active = { disclosure, trigger, body };
    pinned = pin;
    scrollHeld = false;
    content.append(body);
    const pageX = scrollX, pageY = scrollY;
    openedX = pageX;
    openedY = pageY;
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
        // Hiding an overlay can reveal this control under a stationary pointer.
        if (suppressed === trigger && event.clientX === pointerX && event.clientY === pointerY) return;
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
      closeButton.focus({ preventScroll: true });
    });
  }
})();
