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
    const scale = Math.min(1, (width - 42) / naturalWidth, (height - 86) / naturalHeight);
    const ratio = actualSize ? 1 : scale;
    image.style.width = naturalWidth * ratio + "px";
    image.style.height = naturalHeight * ratio + "px";
    preview.style.width = Math.min(width - 24, naturalWidth * ratio + 18) + "px";
    viewport.style.maxHeight = Math.max(44, height - 86) + "px";
    preview.querySelector(".shot-caption").textContent = `Test run · ${naturalWidth} × ${naturalHeight}`;
    sizeButton.hidden = scale === 1;
    sizeButton.textContent = actualSize ? "Fit" : "1:1";
    sizeButton.setAttribute("aria-label", actualSize ? "Fit screenshot to screen" : "Show actual size");
    sizeButton.setAttribute("aria-pressed", String(actualSize));
    const trigger = active.getBoundingClientRect();
    const box = preview.getBoundingClientRect();
    // Prefer a clear side of the thumbnail; large images use the available screen.
    let left = trigger.right + 8;
    if (left + box.width > leftEdge + width - 12) left = trigger.left - box.width - 8;
    if (left < leftEdge + 12) left = leftEdge + (width - box.width) / 2;
    preview.style.left = Math.max(leftEdge + 12, Math.min(left, leftEdge + width - box.width - 12)) + "px";
    preview.style.top = Math.max(topEdge + 12, Math.min(trigger.top, topEdge + height - box.height - 12)) + "px";
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
    if (supportsPopover && preview.matches(":popover-open")) preview.hidePopover();
    preview.hidden = true;
    document.dispatchEvent(new Event("test-preview-dismiss"));
  }

  function open(link, pin = false) {
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
  document.addEventListener("details-dismiss", () => close());
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
