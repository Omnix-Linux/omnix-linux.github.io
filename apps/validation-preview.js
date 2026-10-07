// One contextual validation window shared by every app thumbnail.
(() => {
  "use strict";
  const preview = document.getElementById("validation-window");
  if (!preview) return;
  const supportsPopover = typeof preview.showPopover === "function";
  if (!supportsPopover) preview.removeAttribute("popover");
  const closeButton = preview.querySelector(".preview-close");
  const title = preview.querySelector("h3");
  const context = preview.querySelector(".preview-context");
  const image = preview.querySelector("img");
  const testLink = preview.querySelector(".preview-test-link");
  let active = null, pinned = false, closeTimer = 0, suppressed = null, restoringFocus = false;

  function position() {
    if (!active || preview.hidden) return;
    const trigger = active.getBoundingClientRect();
    const gap = 8, edge = 12;
    const box = preview.getBoundingClientRect();
    const viewport = window.visualViewport;
    const width = viewport ? viewport.width : innerWidth;
    const height = viewport ? viewport.height : innerHeight;
    preview.style.width = Math.min(540, width - 24) + "px";
    const leftEdge = viewport ? viewport.offsetLeft : 0;
    const topEdge = viewport ? viewport.offsetTop : 0;
    const left = Math.max(leftEdge + edge, Math.min(trigger.right - box.width, leftEdge + width - box.width - edge));
    // Prefer the side with enough room, then clamp. Do not cover the trigger.
    const below = topEdge + height - trigger.bottom - gap - edge;
    const above = trigger.top - topEdge - gap - edge;
    const onBottom = below >= box.height || below >= above;
    preview.style.maxHeight = Math.max(80, onBottom ? below : above) + "px";
    const sized = preview.getBoundingClientRect();
    const top = onBottom ? trigger.bottom + gap : trigger.top - sized.height - gap;
    preview.style.left = left + "px";
    preview.style.top = Math.max(topEdge + edge, top) + "px";
  }

  function close({ restoreFocus = false, suppress = false } = {}) {
    clearTimeout(closeTimer);
    const previous = active;
    active = null;
    pinned = false;
    if (suppress) suppressed = previous;
    if (previous) previous.setAttribute("aria-expanded", "false");
    if (supportsPopover && preview.matches(":popover-open")) preview.hidePopover();
    preview.hidden = true;
    if (restoreFocus && previous) {
      restoringFocus = true;
      previous.focus({ preventScroll: true });
      restoringFocus = false;
    }
  }

  function open(button, pin = false) {
    clearTimeout(closeTimer);
    if (!pin && (suppressed === button || (pinned && active !== button))) return;
    if (active !== button) {
      if (active) active.setAttribute("aria-expanded", "false");
      pinned = false;
    }
    active = button;
    pinned = pinned || pin;
    title.textContent = "Automated test run — " + button.dataset.appName;
    context.textContent = button.dataset.result + " · " + button.dataset.runDate;
    image.src = button.dataset.shot;
    image.alt = button.dataset.appName + " running during its automated Omnix test";
    testLink.href = button.dataset.testUrl;
    testLink.hidden = !button.dataset.testUrl;
    preview.hidden = false;
    preview.style.maxHeight = "calc(100dvh - 100px)";
    if (supportsPopover && !preview.matches(":popover-open")) preview.showPopover({ source: button });
    button.setAttribute("aria-expanded", "true");
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

  for (const button of document.querySelectorAll(".validation-preview")) {
    button.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse") open(button);
    });
    button.addEventListener("pointerleave", () => { suppressed = null; scheduleClose(); });
    button.addEventListener("focus", () => {
      if (restoringFocus) return;
      suppressed = null;
      open(button);
    });
    button.addEventListener("blur", () => { suppressed = null; scheduleClose(); });
    button.addEventListener("click", () => {
      if (active === button && pinned) close({ suppress: true });
      else {
        suppressed = null;
        open(button, true);
        closeButton.focus({ preventScroll: true });
      }
    });
  }
  preview.addEventListener("pointerenter", () => clearTimeout(closeTimer));
  preview.addEventListener("pointerleave", scheduleClose);
  preview.addEventListener("focusin", () => clearTimeout(closeTimer));
  preview.addEventListener("focusout", scheduleClose);
  closeButton.addEventListener("click", () => close({ restoreFocus: true, suppress: true }));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && active) {
      event.preventDefault();
      close({ restoreFocus: preview.contains(document.activeElement), suppress: true });
    }
  });
  document.addEventListener("pointerdown", event => {
    if (active && !preview.contains(event.target) && !active.contains(event.target)) close();
  });
  // Scrolling changes the anchor; closing avoids a floating window losing context.
  document.addEventListener("scroll", event => { if (active && !preview.contains(event.target)) close(); }, true);
  window.addEventListener("resize", () => { if (active) close(); });
  image.addEventListener("load", position);
  document.documentElement.classList.add("previews-ready");
})();
