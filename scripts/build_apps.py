#!/usr/bin/env python3
"""Build the Apps page from the app registry.

Reads   apps/registry.json        (hand/agent-maintained source of truth, schema in its _schema)
        scripts/apps_template.html
Writes  apps/index.html           (static page: cards rendered here, registry inlined as JSON)

Stdlib only. Run from anywhere: python3 scripts/build_apps.py
Exits non-zero, writing nothing, when the registry is invalid. In particular a status of
passing, known-gap or failing needs a test path and a verified_at date: a status is never
claimed without a test run behind it.
"""
import html
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
REGISTRY = REPO / "apps" / "registry.json"
OUT = REPO / "apps" / "index.html"
TEMPLATE = Path(__file__).resolve().parent / "apps_template.html"

STATUSES = ("passing", "patched", "known-gap", "failing", "untested")
TESTED_STATUSES = ("passing", "patched", "known-gap", "failing")
# Four colours, nothing else: green passing (or patched: works because Omnix carries a
# fix of its own), yellow known gap, red failing, gray unknown (no recorded run yet).
STATUS_LABELS = {"passing": "Passing", "patched": "Patched", "known-gap": "Known gap", "failing": "Failing",
                 "untested": "Unknown", None: "Unknown"}
STATUS_CLASS = {"passing": "passing", "patched": "patched", "known-gap": "known-gap", "failing": "failing",
                "untested": "unknown", None: "unknown"}
APP_FIELDS = ("id", "section", "name", "icon", "category", "kind", "description", "platforms", "workflow", "test",
              "install")
TEST_FIELDS = ("repo", "path", "check", "url")
DATE_RE = re.compile(r"^\d{4}-\d\d-\d\d(T[\d:]+Z?)?$")

# Simple generic glyphs, not official logos.
INLINE_ICONS = {
    "node": '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 4 41 14v20L24 44 7 34V14z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><text x="24" y="29.5" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="800" font-size="13" fill="currentColor">JS</text></svg>',
    "python": '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="5" y="5" width="38" height="38" rx="10" fill="none" stroke="currentColor" stroke-width="3"/><text x="24" y="29.5" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="800" font-size="13" fill="currentColor">py</text></svg>',
    "terminal": '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="5" y="8" width="38" height="32" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="m13 19 6 5-6 5M23 30h11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "grid": '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M8 8h13v13H8zM27 8h13v13H27zM8 27h13v13H8zM27 27h13v13H27z" fill="currentColor"/></svg>',
}


class RegistryError(ValueError):
    pass


def _str(obj, key, where):
    v = obj.get(key)
    if not isinstance(v, str) or not v.strip():
        raise RegistryError(f"{where}: '{key}' must be a non-empty string")
    return v


def validate_icon(icon, where):
    if icon in INLINE_ICONS:
        return
    if not icon.startswith("assets/") or ".." in icon:
        raise RegistryError(f"{where}: icon must be one of {sorted(INLINE_ICONS)} or a path under assets/")
    if not (REPO / icon).is_file():
        raise RegistryError(f"{where}: icon file {icon} does not exist")


ATTESTATIONS = ("none", "verified")


def validate_distribution(dist, where):
    if dist is None:
        return
    if not isinstance(dist, dict):
        raise RegistryError(f"{where}: distribution must be an object")
    for k in ("via", "release", "url", "license", "attestation", "checked_at"):
        _str(dist, k, f"{where}.distribution")
    if dist["attestation"] not in ATTESTATIONS:
        raise RegistryError(f"{where}: distribution.attestation must be one of {ATTESTATIONS}")
    if not DATE_RE.match(dist["checked_at"]):
        raise RegistryError(f"{where}: distribution.checked_at must be YYYY-MM-DD")
    if not dist["url"].startswith("https://"):
        raise RegistryError(f"{where}: distribution.url must be https")


def dist_html(dist, homepage=None):
    """One line saying where the app comes from and how far its artifact can be trusted."""
    if not dist:
        return ""
    parts = []
    if dist["via"] == "GitHub releases":
        parts.append(f'<a href="{e(dist["url"])}">GitHub release {e(dist["release"])}</a>')
        parts.append('<span class="dist-ok">SHA-256 checksums</span>' if dist.get("checksums")
                     else '<span class="dist-warn">No checksums</span>')
        parts.append('<span class="dist-ok">Attested</span>' if dist["attestation"] == "verified"
                     else '<span class="dist-warn">Not attested</span>')
    else:
        parts.append(f'<a href="{e(dist["url"])}">{e(dist["via"])} · {e(dist["release"])}</a>')
    parts.append(f'<span>{e(dist["license"])}</span>')
    if homepage:
        parts.append(f'<a href="{e(homepage)}">Website</a>')
    return f'<p class="dist" title="Checked {e(dist["checked_at"])}">{" · ".join(parts)}</p>'


def validate_sections(sections):
    """The fixed, ordered list of page sections. Returns their ids."""
    if not isinstance(sections, list) or not sections:
        raise RegistryError("registry needs a non-empty 'sections' array")
    ids = []
    for i, s in enumerate(sections):
        where = f"sections[{i}]"
        if not isinstance(s, dict):
            raise RegistryError(f"{where}: must be an object")
        sid = _str(s, "id", where)
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", sid):
            raise RegistryError(f"{where}: id must be kebab-case")
        if sid in ids:
            raise RegistryError(f"{where}: duplicate section id {sid}")
        _str(s, "title", where)
        _str(s, "blurb", where)
        ids.append(sid)
    return ids


def validate_section_ref(entry, section_ids, where):
    sid = entry.get("section")
    if sid not in section_ids:
        raise RegistryError(f"{where}: section {sid!r} is not one of {', '.join(section_ids)}")


def status_of(app):
    v = app.get("verification")
    return v["status"] if v else None


def validate(reg):
    """Raise RegistryError on any schema problem; return the registry unchanged."""
    if not isinstance(reg, dict) or not isinstance(reg.get("apps"), list):
        raise RegistryError("registry must be an object with an 'apps' array")
    section_ids = validate_sections(reg.get("sections"))
    seen = set()
    for i, app in enumerate(reg["apps"]):
        where = f"apps[{i}]"
        if not isinstance(app, dict):
            raise RegistryError(f"{where}: must be an object")
        for k in APP_FIELDS:
            if k not in app:
                raise RegistryError(f"{where}: missing '{k}'")
        aid = _str(app, "id", where)
        where = f"app '{aid}'"
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", aid):
            raise RegistryError(f"{where}: id must be kebab-case")
        if aid in seen:
            raise RegistryError(f"{where}: duplicate id")
        seen.add(aid)
        for k in ("name", "icon", "category", "kind", "description"):
            _str(app, k, where)
        validate_section_ref(app, section_ids, where)
        validate_icon(app["icon"], where)
        validate_distribution(app.get("distribution"), where)
        if app.get("homepage") is not None and not str(app["homepage"]).startswith("https://"):
            raise RegistryError(f"{where}: homepage must be https")
        shot = app.get("screenshot")
        if shot is not None:
            if not isinstance(shot, str) or not shot.startswith("assets/") or ".." in shot or not (REPO / shot).is_file():
                raise RegistryError(f"{where}: screenshot must be an existing file under assets/")
            if not app.get("verification"):
                raise RegistryError(f"{where}: a screenshot comes from a test run, so it needs a recorded verification")
        for k in ("platforms", "workflow"):
            if not isinstance(app[k], list) or not all(isinstance(s, str) and s for s in app[k]):
                raise RegistryError(f"{where}: '{k}' must be a list of strings")
        test = app["test"]
        if test is not None:
            if not isinstance(test, dict):
                raise RegistryError(f"{where}: 'test' must be an object or null")
            for k in TEST_FIELDS:
                _str(test, k, f"{where} test")
            if not test["url"].startswith("https://github.com/"):
                raise RegistryError(f"{where}: test.url must link to the test on GitHub")
        inst = app["install"]
        if not isinstance(inst, dict):
            raise RegistryError(f"{where}: 'install' must be an object")
        _str(inst, "label", f"{where} install")
        _str(inst, "snippet", f"{where} install")
        gaps = app.get("known_gaps", [])
        if not isinstance(gaps, list) or not all(isinstance(g, str) for g in gaps):
            raise RegistryError(f"{where}: 'known_gaps' must be a list of strings")
        ver = app.get("verification")
        if ver is None:
            continue
        if not isinstance(ver, dict):
            raise RegistryError(f"{where}: 'verification' must be an object or null")
        status = ver.get("status")
        if status not in STATUSES:
            raise RegistryError(f"{where}: status {status!r} is not one of {', '.join(STATUSES)}")
        if status in TESTED_STATUSES:
            if not test or not test.get("path"):
                raise RegistryError(f"{where}: status '{status}' needs a test with a path")
            va = ver.get("verified_at")
            if not isinstance(va, str) or not DATE_RE.match(va):
                raise RegistryError(f"{where}: status '{status}' needs verified_at (YYYY-MM-DD)")
        for k in ("commit", "notes", "log_excerpt"):
            if ver.get(k) is not None and not isinstance(ver[k], str):
                raise RegistryError(f"{where}: verification.{k} must be a string or null")
    for i, c in enumerate(reg.get("candidates", [])):
        where = f"candidates[{i}]"
        for k in ("id", "name", "icon", "category", "description"):
            _str(c, k, where)
        validate_section_ref(c, section_ids, where)
        validate_icon(c["icon"], where)
        validate_distribution(c.get("distribution"), where)
        if c.get("homepage") is not None and not str(c["homepage"]).startswith("https://"):
            raise RegistryError(f"{where}: homepage must be https")
        if c["id"] in seen:
            raise RegistryError(f"{where}: duplicate id {c['id']}")
        seen.add(c["id"])
        if c.get("verification") or c.get("status"):
            raise RegistryError(f"{where}: candidates are untested and carry no status")
    return reg


e = html.escape


def icon_html(icon, name):
    if icon in INLINE_ICONS:
        return f'<span class="app-icon app-icon-svg">{INLINE_ICONS[icon]}</span>'
    return f'<img class="app-icon" src="../{e(icon)}" alt="" width="48" height="48" loading="lazy" decoding="async">'


def badge_html(status):
    return f'<span class="badge badge-{STATUS_CLASS[status]}">{e(STATUS_LABELS[status])}</span>'


def shot_html(app):
    shot = app.get("screenshot")
    if not shot:
        return ""
    return (f'<a class="validation-shot" href="../{e(shot)}" '
            f'aria-label="View automated test run screenshot for {e(app["name"])}">'
            f'<img src="../{e(shot)}" alt="{e(app["name"])} running during its automated Omnix test" '
            f'width="88" height="56" loading="lazy" decoding="async">'
            f'<span>Test run ↗</span></a>')


def render_app(app):
    status = status_of(app)
    ver = app.get("verification") or {}
    test = app["test"]
    steps = "".join(f"<li><code>{e(s)}</code></li>" for s in app["workflow"])
    workflow_html = (f'      <details class="evidence-fold"><summary>Verified workflow</summary><ol class="steps">{steps}</ol></details>'
                     if steps else "")
    gaps = "".join(f'<p class="gap"><strong>Documented gap</strong>{e(g)}</p>' for g in app.get("known_gaps", []))
    if test:
        test_line = (f'<a href="{e(test["url"])}">{e(test["repo"])}/{e(test["path"])}</a>'
                     f'<code class="check">nix build github:{e(test["repo"])}#{e(test["check"])}</code>')
    else:
        test_line = "<span>No test yet</span>"
    if status and ver.get("verified_at"):
        summary = (f'<span class="validation-result">{e(STATUS_LABELS[status])}</span>'
                   f'<span class="validation-date">Tested <time datetime="{e(ver["verified_at"])}">'
                   f'{e(ver["verified_at"][:10])}</time></span>')
        last = f'{badge_html(status)} on {e(ver["verified_at"])}'
        if ver.get("commit"):
            last += f'<span class="notes">Revision: <code>{e(ver["commit"])}</code></span>'
        if ver.get("notes"):
            last += f'<span class="notes">{e(ver["notes"])}</span>'
        if ver.get("log_excerpt"):
            last += f'<details class="run-log"><summary>Test log</summary><pre class="log">{e(ver["log_excerpt"])}</pre></details>'
    else:
        summary = "Not yet validated"
        last = "Not run for this page yet. The status appears once a maintainer or agent runs the test and records the result."
    shot = app.get("screenshot")
    shot_link = (f'<p class="validation-caption">Automated test run in an Omnix virtual machine. '
                 f'<a href="../{e(shot)}">View the recorded screenshot</a>.</p>') if shot else ""
    distribution = dist_html(app.get("distribution"), app.get("homepage")) or '<p class="app-desc">No package source recorded.</p>'
    snippet_id = f"snip-{app['id']}"
    return f'''<article class="app status-{STATUS_CLASS[status]}" id="{e(app["id"])}">
  <header class="app-head">
    {icon_html(app["icon"], app["name"])}
    <div class="app-title"><h3>{e(app["name"])}</h3><p class="app-cat">{e(app["category"])}</p></div>
  </header>
  <details class="more">
    <summary class="badge badge-{STATUS_CLASS[status]}" aria-label="{e(STATUS_LABELS[status])} — Details for {e(app['name'])}"><span>{e(STATUS_LABELS[status])}</span></summary>
    <div class="more-body">
      <div class="details-overview"><div>
      <p class="app-desc">{e(app["description"])}</p>
{gaps}
      <p class="validation-summary">{summary}<span>{e(", ".join(app["platforms"]))}</span></p>
      </div>{shot_html(app)}</div>
      <details class="evidence-fold" open>
        <summary>Package source</summary>
        {distribution}
      </details>
      <details class="evidence-fold">
        <summary>Install</summary>
        <div class="snip">
          <div class="snip-head"><span>{e(app["install"]["label"])}</span><button class="copy" type="button" data-copy="{snippet_id}">Copy</button></div>
          <pre id="{snippet_id}">{e(app["install"]["snippet"])}</pre>
        </div>
      </details>
{workflow_html}
      <details class="evidence-fold">
        <summary>Validation details</summary>
        <dl class="evidence">
          <div><dt>Test</dt><dd>{test_line}</dd></div>
          <div><dt>Last run</dt><dd>{last}</dd></div>
        </dl>
{shot_link}
      </details>
    </div>
  </details>
</article>'''


def render_candidate(c):
    return f'''<li class="app status-unknown cand" id="{e(c["id"])}">
  <header class="app-head">
    {icon_html(c["icon"], c["name"])}
    <div class="app-title"><h3>{e(c["name"])}</h3><p class="app-cat">{e(c["category"])}</p></div>
    {badge_html(None)}
  </header>
  <p class="app-desc">{e(c["description"])}</p>
  {dist_html(c.get("distribution"), c.get("homepage"))}
</li>'''


def plural(n, word):
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def section_summary(apps, cands):
    """'7 apps · 6 passing · 1 known gap': the count, then each status in the legend's order."""
    entries = apps + cands
    counts = {}
    for a in apps:
        counts[status_of(a) or "untested"] = counts.get(status_of(a) or "untested", 0) + 1
    if cands:
        counts["untested"] = counts.get("untested", 0) + len(cands)
    parts = [plural(len(entries), "app")]
    for s in STATUSES:
        if counts.get(s):
            parts.append(f"{counts[s]} {STATUS_LABELS[s].lower()}")
    return " · ".join(parts)


def grouped_sections(reg):
    """[(section, apps, candidates)] in registry order, skipping sections with nothing in them."""
    out = []
    for s in reg["sections"]:
        apps = [a for a in reg["apps"] if a["section"] == s["id"]]
        cands = [c for c in reg.get("candidates", []) if c["section"] == s["id"]]
        if apps or cands:
            out.append((s, apps, cands))
    return out


def render_section(section, apps, cands, number=1):
    sid = e(section["id"])
    cards = "\n".join(render_app(a) for a in apps)
    cand_html = ""
    if cands:
        items = "\n".join(render_candidate(c) for c in cands)
        cand_html = f'''
        <p class="cands-note">No test has run for these yet, so their status is unknown.</p>
        <ul class="cands">
{items}
        </ul>'''
    grid = f'''
        <div class="apps">
{cards}
        </div>''' if apps else ""
    return f'''      <section class="app-section" id="section-{sid}" aria-labelledby="section-{sid}-title">
        <div class="sec">
          <div class="sec-heading">
            <span class="sec-head">
              <span class="eyebrow">Section {number:02d}</span>
              <h3 class="sec-title" id="section-{sid}-title">{e(section["title"])}</h3>
              <span class="sec-blurb">{e(section["blurb"])}</span>
              <span class="sec-summary">{e(section_summary(apps, cands))}</span>
            </span>
          </div>{grid}{cand_html}
        </div>
      </section>'''


def render_index(groups):
    chips = "\n".join(
        f'        <li><a class="chip" href="#section-{e(s["id"])}">{e(s["title"])} <span class="chip-n">{len(a) + len(c)}</span></a></li>'
        for s, a, c in groups)
    return f'''      <nav class="sec-index" aria-label="App sections">
        <ul>
{chips}
        </ul>
      </nav>'''


def render(reg, template):
    apps = reg["apps"]
    count = plural(sum(status_of(app) in TESTED_STATUSES for app in apps), "app")
    blob = json.dumps({k: v for k, v in reg.items() if k != "_schema"}, separators=(",", ":"),
                      ensure_ascii=False).replace("</", "<\\/")
    groups = grouped_sections(reg)
    out = template
    for key, val in {
        "<!--__APP_COUNT__-->": e(count),
        "<!--__SECTION_INDEX__-->": render_index(groups),
        "<!--__APP_SECTIONS__-->": "\n".join(render_section(*g, number=i) for i, g in enumerate(groups, 1)),
        "/*__APPS_DATA__*/null": blob,
    }.items():
        if key not in out:
            raise RegistryError(f"template is missing placeholder {key}")
        out = out.replace(key, val)
    return out


def build(registry=REGISTRY, out=OUT, template=TEMPLATE, log=print):
    try:
        reg = validate(json.loads(Path(registry).read_text(encoding="utf-8")))
        page = render(reg, Path(template).read_text(encoding="utf-8"))
    except (RegistryError, json.JSONDecodeError) as exc:
        log(f"error: {exc}")
        return 1
    Path(out).write_text(page, encoding="utf-8")
    counts = {}
    for a in reg["apps"]:
        counts[STATUS_LABELS[status_of(a)]] = counts.get(STATUS_LABELS[status_of(a)], 0) + 1
    log(f"wrote {out} ({len(reg['apps'])} apps: {counts}; {len(reg.get('candidates', []))} candidates)")
    return 0


if __name__ == "__main__":
    sys.exit(build())
