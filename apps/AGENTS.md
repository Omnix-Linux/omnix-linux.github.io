# Apps page presentation policy

These rules apply to this page and its generator/template in `scripts/build_apps.py` and `scripts/apps_template.html`.

- Do not waste space. Every region must serve a clear purpose: app identity, useful information, or an interaction. Prefer content-sized layouts and compact spacing; avoid empty reserved rows, repeated headings, and oversized controls.
- Give descriptions the available width. Expansion controls belong on a thin overlay along the bottom edge, with a double downward chevron and an accessible label, rather than a separate large button beside the text.
- Keep initial previews brief and no taller than their app card. Full evidence appears only after deliberate expansion and stays pinned for reading.
- Keep previews anchored to their app, at 80% of its width with right edges aligned. Opening or expanding them must not move cards or change page height. Unpinned previews must not obstruct normal scrolling.
- Verify desktop and phone layouts in Playwright, including hover transfer/re-entry, keyboard and touch access, dismissal, copy controls, and unchanged page layout.
- Regenerate `apps/index.html` from the template/generator instead of editing the generated page directly. Version changed interaction scripts so cached copies do not hide fixes.
