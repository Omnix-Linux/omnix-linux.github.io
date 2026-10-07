// Full-resolution screenshot preview, independent of the compact Details width.
(() => {
  "use strict";
  const preview = document.getElementById("test-run-preview");
  const details = document.getElementById("app-details");
  if (!preview || !details) return;
  const supportsPopover = typeof preview.showPopover === "function";
  if (!supportsPopover) preview.removeAttribute("popover");
  const image = preview.querySelector("img");
  const viewport = preview.querySelector(".shot-viewport");
  const sizeButton = preview.querySelector(".shot-size");
  const closeButton = preview.querySelector(".shot-close");
  let active = null, pinned = false, actualSize = false, closeTimer = 0, openTimer = 0;
  let suppressed = null, restoringFocus = false;

  function position() {
    if (!active || preview.hidden) return;
    const visual = window.visualViewport;
    const width = visual ? visual.width : innerWidth;
    const height = visual ? visual.height : innerHeight;
    const leftEdge = visual ? visual.offsetLeft : 0;
    const topEdge = visual ? visual.offsetTop : 0;
    const source = active.querySelector("img");
    const naturalWidth = source.naturalWidth || image.naturalWidth;
    const naturalHeight = source.naturalHeight || image.naturalHeight;
    if (!naturalWidth || !naturalHeight) return;
    const trigger = active.getBoundingClientRect();
    const appTrigger = document.querySelector('.app > .more > summary[aria-expanded="true"]');
    const card = appTrigger ? appTrigger.closest(".app").getBoundingClientRect() : trigger;
    const panel = details.getBoundingClientRect();
    const bounds = { left: leftEdge + 12, top: topEdge + 12, right: leftEdge + width - 12, bottom: topEdge + height - 12 };
    function freeRegion(rect) {
      const fullWidth = bounds.right - bounds.left, fullHeight = bounds.bottom - bounds.top;
      const sides = [
        { side: "right", left: rect.right + 8, top: bounds.top, width: bounds.right - rect.right - 8, height: fullHeight },
        { side: "left", left: bounds.left, top: bounds.top, width: rect.left - bounds.left - 8, height: fullHeight }
      ];
      const vertical = [
        { side: "below", left: bounds.left, top: rect.bottom + 8, width: fullWidth, height: bounds.bottom - rect.bottom - 8 },
        { side: "above", left: bounds.left, top: bounds.top, width: fullWidth, height: rect.top - bounds.top - 8 }
      ];
      const usable = regions => regions.filter(region => region.width >= 240 && region.height >= 160).sort((a, b) => b.width * b.height - a.width * a.height);
      return usable(sides)[0] || usable(vertical)[0];
    }
    // Protect the whole focused card and Details first, then their controls on tight screens.
    const region = freeRegion({ left: Math.min(card.left, panel.left), right: Math.max(card.right, panel.right), top: Math.min(card.top, panel.top), bottom: Math.max(card.bottom, panel.bottom) })
      || freeRegion({ left: Math.min(card.left, trigger.left), right: Math.max(card.right, trigger.right), top: Math.min(card.top, trigger.top), bottom: Math.max(card.bottom, trigger.bottom) })
      || { side: "screen", left: bounds.left, top: bounds.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top };
    const scale = Math.min(1, (region.width - 18) / naturalWidth, (region.height - 62) / naturalHeight);
    const ratio = actualSize ? 1 : scale;
    image.style.width = naturalWidth * ratio + "px";
    image.style.height = naturalHeight * ratio + "px";
    preview.style.width = Math.min(region.width, naturalWidth * ratio + 18) + "px";
    viewport.style.maxHeight = Math.max(44, region.height - 62) + "px";
    preview.querySelector(".shot-caption").textContent = `Test run · ${naturalWidth} × ${naturalHeight}`;
    sizeButton.hidden = scale === 1;
    sizeButton.textContent = actualSize ? "Fit" : "1:1";
    sizeButton.setAttribute("aria-label", actualSize ? "Fit screenshot to screen" : "Show actual size");
    sizeButton.setAttribute("aria-pressed", String(actualSize));
    const box = preview.getBoundingClientRect();
    const left = region.side === "left" ? region.left + region.width - box.width : region.left;
    preview.style.left = left + "px";
    preview.style.top = Math.max(region.top, Math.min(trigger.top, region.top + region.height - box.height)) + "px";
    preview.dataset.placement = region.side;
  }

  function close(restoreFocus = false, suppress = false) {
    clearTimeout(closeTimer);
    clearTimeout(openTimer);
    if (!active) return;
    const previous = active;
    active = null;
    pinned = false;
    preview.dataset.pinned = "false";
    previous.setAttribute("aria-expanded", "false");
    if (suppress) suppressed = previous;
    if (restoreFocus && !details.hidden) {
      restoringFocus = true;
      previous.focus({ preventScroll: true });
      restoringFocus = false;
    }
    restoringFocus = true;
    if (supportsPopover && preview.matches(":popover-open")) preview.hidePopover();
    restoringFocus = false;
    preview.hidden = true;
    document.dispatchEvent(new Event("test-preview-dismiss"));
  }

  function open(link, pin = false) {
    if (details.hidden) return;
    clearTimeout(closeTimer);
    if (!pin && suppressed === link) return;
    if (active !== link) {
      close();
      active = link;
      actualSize = false;
      pinned = false;
      image.src = link.href;
      image.alt = link.querySelector("img").alt;
      preview.setAttribute("aria-label", link.getAttribute("aria-label"));
      preview.querySelector(".shot-original").href = link.href;
      viewport.scrollTop = viewport.scrollLeft = 0;
    }
    pinned = pinned || pin;
    preview.dataset.pinned = String(pinned);
    link.setAttribute("aria-expanded", "true");
    preview.hidden = false;
    if (supportsPopover && !preview.matches(":popover-open")) preview.showPopover({ source: link });
    position();
  }

  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!active || pinned) return;
      if (active.matches(":hover") || preview.matches(":hover")) return;
      if (document.activeElement === active || preview.contains(document.activeElement)) return;
      close();
    }, 180);
  }
  for (const link of document.querySelectorAll(".validation-shot")) {
    link.setAttribute("aria-haspopup", "dialog");
    link.setAttribute("aria-controls", preview.id);
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("pointerenter", event => {
      if (event.pointerType !== "mouse") return;
      clearTimeout(openTimer);
      openTimer = setTimeout(() => open(link), 120);
    });
    link.addEventListener("pointerleave", () => { clearTimeout(openTimer); suppressed = null; scheduleClose(); });
    link.addEventListener("focus", () => {
      if (restoringFocus) return;
      suppressed = null;
      open(link);
    });
    link.addEventListener("blur", scheduleClose);
    link.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      suppressed = null;
      open(link, true);
      closeButton.focus({ preventScroll: true });
    });
  }
  preview.addEventListener("pointerenter", () => clearTimeout(closeTimer));
  preview.addEventListener("pointerleave", scheduleClose);
  preview.addEventListener("focusin", () => clearTimeout(closeTimer));
  preview.addEventListener("focusout", scheduleClose);
  sizeButton.addEventListener("click", () => {
    actualSize = !actualSize;
    pinned = true;
    preview.dataset.pinned = "true";
    position();
    viewport.scrollTop = viewport.scrollLeft = 0;
  });
  closeButton.addEventListener("click", () => close(true, true));
  document.addEventListener("details-dismiss", () => { close(false, true); suppressed = null; });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && active) {
      event.preventDefault();
      close(true, true);
    }
  });
  document.addEventListener("pointerdown", event => {
    if (active && !preview.contains(event.target) && !active.contains(event.target)) close();
  });
  document.addEventListener("scroll", () => { if (active) requestAnimationFrame(position); }, true);
  window.addEventListener("resize", position);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", position);
    window.visualViewport.addEventListener("scroll", position);
  }
  image.addEventListener("load", position);
})();
