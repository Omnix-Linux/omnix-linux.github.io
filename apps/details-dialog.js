// Move the existing evidence into a top-layer dialog, preserving copy handlers.
(() => {
  "use strict";
  const dialog = document.getElementById("app-details");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const content = dialog.querySelector(".details-content");
  const title = dialog.querySelector("h3");
  let active = null;

  dialog.addEventListener("close", () => {
    if (!active) return;
    const { disclosure, trigger, body } = active;
    disclosure.append(body);
    disclosure.open = false;
    trigger.setAttribute("aria-expanded", "false");
    active = null;
    trigger.focus({ preventScroll: true });
  });
  dialog.querySelector(".details-close").addEventListener("click", () => dialog.close());
  let outsideStart = false;
  function outside(event) {
    const box = dialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  }
  dialog.addEventListener("pointerdown", event => { outsideStart = event.target === dialog && outside(event); });
  dialog.addEventListener("click", event => {
    if (outsideStart && event.target === dialog && outside(event)) dialog.close();
    outsideStart = false;
  });
  for (const disclosure of document.querySelectorAll(".app > .more")) {
    const trigger = disclosure.querySelector(":scope > summary");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", dialog.id);
    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("click", event => {
      event.preventDefault();
      if (dialog.open) return;
      const body = disclosure.querySelector(":scope > .more-body");
      title.textContent = disclosure.closest(".app").querySelector("h3").textContent + " — Details";
      active = { disclosure, trigger, body };
      content.append(body);
      trigger.setAttribute("aria-expanded", "true");
      dialog.showModal();
    });
  }
})();
