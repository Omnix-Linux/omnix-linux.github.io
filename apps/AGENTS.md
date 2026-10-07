# Apps page presentation policy

These rules apply to this page and its generator/template in `scripts/build_apps.py` and `scripts/apps_template.html`.

- Do not waste space. Every region must serve a clear purpose: app identity, useful information, or an interaction. Prefer content-sized layouts and compact spacing; avoid empty reserved rows, repeated headings, and oversized controls.
- Give descriptions the available width. Hover or focus opens the full compact dropdown directly, without an intermediate preview or expansion control.
- Keep Details compact with progressive evidence disclosures. Show Package source first and open by default; click/tap pins the dropdown for reading.
- Keep Details anchored to their app, at 80% of its width with right edges aligned. Opening or expanding them must not move cards or change page height. Scrolling must keep active Details open and anchored while the app remains in view. Preserve native scrolling inside the evidence and on the page.
- Verify desktop and phone layouts in Playwright, including hover transfer/re-entry, keyboard and touch access, dismissal, copy controls, and unchanged page layout.
- Regenerate `apps/index.html` from the template/generator instead of editing the generated page directly. Version changed interaction scripts so cached copies do not hide fixes.

- Keep descriptions at a consistent readable size. Use a compact app identity, subdued metadata, and flat disclosure rows with clear chevrons and 44px interaction targets. Avoid repeated “Details” headings and nested boxes around every section.
