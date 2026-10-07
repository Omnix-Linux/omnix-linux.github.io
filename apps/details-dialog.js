// One app-anchored dropdown; moving evidence preserves its copy handlers.
(() => {
  "use strict";
  const panel = document.getElementById("app-details");
  if (!panel) return;
  const supportsPopover = typeof panel.showPopover === "function";
  if (!supportsPopover) panel.removeAttribute("popover");
  const content = panel.querySelector(".details-content");
  const title = panel.querySelector("h3");
  const closeButton = panel.querySelector(".details-close");
  let active = null;

  function close(restoreFocus = false) {
    if (!active) return;
    const { disclosure, trigger, body } = active;
    active = null;
    // Return focus before hiding so the browser never restores it into hidden evidence.
    if (restoreFocus || panel.contains(document.activeElement)) trigger.focus({ preventScroll: true });
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
    const onBottom = below >= 160 || below >= above;
    const panelWidth = Math.min(card.width, width - edge * 2);
    panel.style.width = panelWidth + "px";
    panel.style.maxHeight = Math.max(44, onBottom ? below : above) + "px";
    panel.style.left = Math.max(leftEdge + edge, Math.min(card.left, leftEdge + width - panelWidth - edge)) + "px";
    panel.style.top = (onBottom ? card.bottom + gap : card.top - panel.getBoundingClientRect().height - gap) + "px";
  }

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
    if (active && !panel.contains(event.target)) position();
  }, true);
  window.addEventListener("resize", position);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", position);
    window.visualViewport.addEventListener("scroll", position);
  }
  new ResizeObserver(position).observe(panel);
  for (const disclosure of document.querySelectorAll(".app > .more")) {
    const trigger = disclosure.querySelector(":scope > summary");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", panel.id);
    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("click", event => {
      event.preventDefault();
      if (active && active.trigger === trigger) { close(true); return; }
      close();
      const body = disclosure.querySelector(":scope > .more-body");
      title.textContent = disclosure.closest(".app").querySelector("h3").textContent + " — Details";
      active = { disclosure, trigger, body };
      content.append(body);
      const pageX = scrollX, pageY = scrollY;
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      if (supportsPopover) panel.showPopover({ source: trigger });
      // Reopening a scrolled panel must not scroll the document to its old focus.
      if (scrollX !== pageX || scrollY !== pageY) window.scrollTo({ left: pageX, top: pageY, behavior: "instant" });
      panel.scrollTop = 0;
      position();
      closeButton.focus({ preventScroll: true });
    });
  }
})();
