/* Deadlines retain their remainder, avoiding the extra skipped display frame
 * caused by resetting a 30fps deadline to each 60Hz RAF timestamp. */
(function (root) {
  function nextDeadline(now, deadline, interval) {
    if (deadline === null) return now + interval;
    return deadline + Math.max(1, Math.floor((now - deadline) / interval) + 1) * interval;
  }
  function blend(clock, previous, current) {
    if (current <= previous) return 1;
    return Math.max(0, Math.min(1, (clock - current) / (current - previous)));
  }
  var api = { nextDeadline: nextDeadline, blend: blend };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ShaderTiming = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
