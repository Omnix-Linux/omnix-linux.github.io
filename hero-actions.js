/* Scroll the hero hint at half speed; preserve child entrance animations. */
afterFirstPaint(function () {
  var hero = document.getElementById("top");
  var actions = hero && hero.querySelector(".hero-actions");
  if (!actions) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var top = 0, height = 1, frame = 0, previous = null;
  function update() {
    frame = 0;
    var distance = Math.max(0, Math.min(height, window.scrollY - top));
    var progress = distance / height;
    var translation = reduce.matches ? 0 : distance * .5;
    var key = progress + ":" + translation;
    if (key === previous) return;
    previous = key;
    actions.style.transform = "translateY(" + translation + "px)";
    actions.style.opacity = String(1 - progress);
    actions.style.visibility = progress === 1 ? "hidden" : "visible";
    actions.inert = progress === 1;
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  function measure() {
    // Cache geometry on layout changes, never read element bounds while scrolling.
    var box = hero.getBoundingClientRect();
    top = box.top + window.scrollY;
    height = Math.max(1, box.height);
    schedule();
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure);
  window.addEventListener("pageshow", measure);
  reduce.addEventListener("change", schedule);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(measure).observe(hero);
  measure();
});
