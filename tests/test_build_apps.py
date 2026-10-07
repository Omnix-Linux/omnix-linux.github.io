"""Unit tests for scripts/build_apps.py. Run: python3 -m unittest discover -s tests -p 'test_*.py'"""
import copy
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import build_apps as ba  # noqa: E402

REGISTRY = json.loads(ba.REGISTRY.read_text(encoding="utf-8"))
SECTIONS = [{"id": "demo", "title": "Demo things", "blurb": "Demos."},
            {"id": "empty", "title": "Nothing here", "blurb": "No apps."},
            {"id": "other", "title": "Other things", "blurb": "Others."}]


def app(**over):
    a = {"id": "demo", "section": "demo", "name": "Demo", "icon": "node", "category": "Runtime", "kind": "Prebuilt binary",
         "description": "A demo.", "platforms": ["x86_64-linux"], "workflow": ["run it"],
         "test": {"repo": "Omnix-Linux/Omnix", "path": "tests/fhs.nix", "check": "checks.x86_64-linux.fhs",
                  "url": "https://github.com/Omnix-Linux/Omnix/blob/main/tests/fhs.nix"},
         "install": {"label": "Download", "snippet": "curl …"}, "verification": None}
    a.update(over)
    return a


def ver(status, **over):
    v = {"status": status, "verified_at": "2026-10-01", "commit": "abc123", "notes": None, "log_excerpt": None}
    v.update(over)
    return v


class Validate(unittest.TestCase):
    def test_committed_registry_is_valid(self):
        ba.validate(copy.deepcopy(REGISTRY))

    def test_recorded_results_cite_their_test_run(self):
        # A status is only recorded from a real run: it names the tested repo
        # commit and quotes the test log.
        for a in REGISTRY["apps"]:
            v = a["verification"]
            if v is None:
                continue
            self.assertRegex(v["commit"], r"^Omnix-Linux/[A-Za-z-]+@[0-9a-f]{7,}$", a["id"])
            self.assertIn("test script finished", v["log_excerpt"], a["id"])
            self.assertEqual(a["test"]["repo"], v["commit"].split("@")[0], a["id"])
        for c in REGISTRY["candidates"]:
            self.assertNotIn("verification", c)
            self.assertNotIn("test", c)

    def test_all_four_statuses_accepted(self):
        for s in ba.STATUSES:
            ba.validate({"sections": SECTIONS, "apps": [app(verification=ver(s))]})

    def test_unknown_status_refused(self):
        for s in ("ok", "PASSING", "flaky", "", None):
            with self.assertRaises(ba.RegistryError):
                ba.validate({"sections": SECTIONS, "apps": [app(verification=ver(s))]})

    def test_tested_status_needs_test_path(self):
        for s in ba.TESTED_STATUSES:
            with self.assertRaises(ba.RegistryError):
                ba.validate({"sections": SECTIONS, "apps": [app(test=None, verification=ver(s))]})
            bad = app(verification=ver(s))
            bad["test"]["path"] = ""
            with self.assertRaises(ba.RegistryError):
                ba.validate({"sections": SECTIONS, "apps": [bad]})

    def test_tested_status_needs_verified_at(self):
        for s in ba.TESTED_STATUSES:
            for va in (None, "", "yesterday"):
                with self.assertRaises(ba.RegistryError):
                    ba.validate({"sections": SECTIONS, "apps": [app(verification=ver(s, verified_at=va))]})

    def test_untested_needs_no_test(self):
        ba.validate({"sections": SECTIONS, "apps": [app(test=None, verification={"status": "untested"})]})

    def test_missing_field_and_duplicate_id(self):
        a = app(); del a["install"]
        with self.assertRaises(ba.RegistryError):
            ba.validate({"sections": SECTIONS, "apps": [a]})
        with self.assertRaises(ba.RegistryError):
            ba.validate({"sections": SECTIONS, "apps": [app(), app()]})

    def test_icon_must_exist(self):
        ba.validate({"sections": SECTIONS, "apps": [app(icon="assets/project-icons/atrium.png")]})
        for icon in ("assets/nope.png", "/etc/passwd", "assets/../index.html", "logo"):
            with self.assertRaises(ba.RegistryError):
                ba.validate({"sections": SECTIONS, "apps": [app(icon=icon)]})

    def test_candidates_carry_no_status(self):
        c = {"id": "x", "section": "demo", "name": "X", "icon": "grid", "category": "C", "description": "d", "status": "passing"}
        with self.assertRaises(ba.RegistryError):
            ba.validate({"sections": SECTIONS, "apps": [], "candidates": [c]})


class Render(unittest.TestCase):
    def render(self, reg):
        return ba.render(ba.validate(reg), ba.TEMPLATE.read_text(encoding="utf-8"))

    def test_null_verification_shows_gray_unknown(self):
        page = self.render({"sections": SECTIONS, "apps": [app()]})
        self.assertIn('class="app status-unknown"', page)
        self.assertIn('<span>Unknown</span>', page)
        self.assertNotIn('class="badge badge-passing">Passing</span> on', page)

    def test_passing_shows_date_commit_and_test_link(self):
        page = self.render({"sections": SECTIONS, "apps": [app(verification=ver("passing", commit="0123456789abcdef"))]})
        self.assertIn("2026-10-01", page)
        self.assertIn("<code>0123456789abcdef</code>", page)
        self.assertIn("https://github.com/Omnix-Linux/Omnix/blob/main/tests/fhs.nix", page)

    def test_app_count_only_claims_recorded_test_results(self):
        entries = [app(id="verified", verification=ver("passing")), app(id="pending", verification=None)]
        page = self.render({"sections": SECTIONS, "apps": entries})
        self.assertIn("1 app tested", page)
        self.assertNotIn("2 apps tested", page)

    def test_escapes_and_inlines_data(self):
        page = self.render({"sections": SECTIONS, "apps": [app(description="<script>x</script>", workflow=["a </script> b"])]})
        self.assertIn("&lt;script&gt;x&lt;/script&gt;", page)
        self.assertNotIn("<script>x</script>", page)
        self.assertNotIn("/*__APPS_DATA__*/", page)
        blob = page.split('<script id="apps-data" type="application/json">', 1)[1].split("</script>", 1)[0]
        self.assertEqual(json.loads(blob)["apps"][0]["workflow"], ["a </script> b"])

    def test_test_run_image_is_inside_details_and_identifies_the_automated_run(self):
        a = app(screenshot="assets/app-shots/filmcraft.webp", verification=ver("passing"))
        card = ba.render_app(a)
        self.assertIn('class="validation-shot"', card)
        self.assertLess(card.index('class="more-body"'), card.index('class="validation-shot"'))
        self.assertIn('Test run', card)
        self.assertIn('automated test run', card)
        self.assertIn('2026-10-01', card)
        self.assertNotIn('<details class="screenshots">', card)

    def test_issue_8_important_information_precedes_closed_evidence_accordions(self):
        card = ba.render_app(app(verification=ver("passing")))
        self.assertIn('<span>Passing</span>', card)
        self.assertIn('<details class="evidence-fold">', card)
        self.assertLess(card.index('class="app-desc"'), card.index('class="evidence-fold"'))
        for label in ('Install', 'Verified workflow', 'Validation details', 'Package source'):
            self.assertIn(label, card)
        self.assertEqual(card.count('class="evidence-fold" open'), 1)
        self.assertLess(card.index('<summary>Package source</summary>'), card.index('<summary>Install</summary>'))
        self.assertNotIn('class="validation-preview"', card)

    def test_build_refuses_invalid_registry_and_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            reg, out = Path(d) / "r.json", Path(d) / "index.html"
            reg.write_text(json.dumps({"sections": SECTIONS, "apps": [app(verification=ver("passing", verified_at=None))]}))
            self.assertEqual(ba.build(registry=reg, out=out, log=lambda *_: None), 1)
            self.assertFalse(out.exists())
            reg.write_text(json.dumps({"sections": SECTIONS, "apps": [app()]}))
            self.assertEqual(ba.build(registry=reg, out=out, log=lambda *_: None), 0)
            self.assertIn("Demo", out.read_text())

    def test_committed_page_is_current(self):
        page = ba.render(ba.validate(copy.deepcopy(REGISTRY)), ba.TEMPLATE.read_text(encoding="utf-8"))
        self.assertEqual(page, ba.OUT.read_text(encoding="utf-8"), "run python3 scripts/build_apps.py")



class Distribution(unittest.TestCase):
    def cand(self, **dist):
        base = {"via": "GitHub releases", "repo": "o/r", "release": "v1", "artifact": "r-1.AppImage",
                "url": "https://github.com/o/r/releases/tag/v1", "license": "Apache-2.0",
                "checksums": "SHA256SUMS.txt", "attestation": "none", "checked_at": "2026-10-06"}
        base.update(dist)
        return {"sections": SECTIONS, "apps": [], "candidates": [{"id": "c", "section": "demo", "name": "C", "icon": "grid", "category": "x",
                                            "description": "y", "distribution": base}]}

    def test_valid_distribution(self):
        ba.validate(self.cand())

    def test_attestation_must_be_known_value(self):
        with self.assertRaises(ba.RegistryError):
            ba.validate(self.cand(attestation="probably"))

    def test_url_must_be_https(self):
        with self.assertRaises(ba.RegistryError):
            ba.validate(self.cand(url="http://example.com"))

    def test_line_says_not_attested_unless_verified(self):
        html = ba.dist_html(self.cand()["candidates"][0]["distribution"])
        self.assertIn("Not attested", html)
        self.assertIn("SHA-256 checksums", html)
        self.assertNotIn(">Attested<", html)

    def test_committed_registry_marks_nothing_attested(self):
        # Checked 2026-10-06: GitHub's attestations API had none for these artifacts.
        for c in REGISTRY["candidates"] + REGISTRY["apps"]:
            dist = c.get("distribution")
            if dist:
                self.assertEqual(dist["attestation"], "none", c["id"])


class Screenshots(unittest.TestCase):
    def test_screenshot_requires_a_recorded_run(self):
        a = app(screenshot="assets/app-shots/filmcraft.webp")
        with self.assertRaises(ba.RegistryError):
            ba.validate({"sections": SECTIONS, "apps": [a]})

    def test_screenshot_must_exist(self):
        a = app(screenshot="assets/app-shots/missing.webp", verification=ver("passing"))
        with self.assertRaises(ba.RegistryError):
            ba.validate({"sections": SECTIONS, "apps": [a]})

    def test_committed_screenshots_belong_to_verified_apps(self):
        for a in REGISTRY["apps"]:
            if a.get("screenshot"):
                self.assertIsNotNone(a["verification"], a["id"])
                self.assertTrue(a["screenshot"].startswith("assets/app-shots/"), a["id"])


class Sections(unittest.TestCase):
    def render(self, reg):
        return ba.render(ba.validate(reg), ba.TEMPLATE.read_text(encoding="utf-8"))

    def test_section_ids_are_validated(self):
        for bad in (None, "", "nope", "Demo"):
            with self.assertRaises(ba.RegistryError):
                ba.validate({"sections": SECTIONS, "apps": [app(section=bad)]})
        a = app(); del a["section"]
        with self.assertRaises(ba.RegistryError):
            ba.validate({"sections": SECTIONS, "apps": [a]})
        c = {"id": "x", "section": "nope", "name": "X", "icon": "grid", "category": "C", "description": "d"}
        with self.assertRaises(ba.RegistryError):
            ba.validate({"sections": SECTIONS, "apps": [], "candidates": [c]})

    def test_sections_list_is_required_and_well_formed(self):
        for secs in (None, [], [{"id": "demo", "title": "T"}], SECTIONS + [SECTIONS[0]], [{"id": "Bad Id", "title": "T", "blurb": "b"}]):
            with self.assertRaises(ba.RegistryError):
                ba.validate({"sections": secs, "apps": [app()]})

    def test_sections_render_in_registry_order_and_empty_ones_are_skipped(self):
        page = self.render({"sections": SECTIONS, "apps": [app(id="b", section="other"), app(id="a")]})
        self.assertLess(page.index('id="section-demo"'), page.index('id="section-other"'))
        self.assertLess(page.index('href="#section-demo"'), page.index('href="#section-other"'))
        self.assertNotIn("section-empty", page)
        self.assertNotIn("Nothing here", page.split('<script id="apps-data"', 1)[0])
        self.assertEqual(page.count('<div class="sec">'), 2)

    def test_summary_counts(self):
        apps = [app(id="a", verification=ver("passing")), app(id="b", verification=ver("passing")),
                app(id="c", verification=ver("known-gap")), app(id="d")]
        self.assertEqual(ba.section_summary(apps, []), "4 apps · 2 passing · 1 known gap · 1 unknown")
        self.assertEqual(ba.section_summary(apps[:1], []), "1 app · 1 passing")
        page = self.render({"sections": SECTIONS, "apps": apps})
        self.assertIn('<span class="sec-summary">4 apps · 2 passing · 1 known gap · 1 unknown</span>', page)
        self.assertIn('href="#section-demo">Demo things <span class="chip-n">4</span>', page)

    def test_candidates_render_in_their_section_as_unknown(self):
        c = {"id": "x", "section": "other", "name": "X", "icon": "grid", "category": "C", "description": "d"}
        page = self.render({"sections": SECTIONS, "apps": [app()], "candidates": [c]})
        other = page[page.index('id="section-other"'):]
        self.assertIn('<li class="app status-unknown cand" id="x">', other)
        self.assertIn('<span class="sec-summary">1 app · 1 unknown</span>', other)

    def test_committed_page_lists_every_app_exactly_once_in_its_section(self):
        page = ba.OUT.read_text(encoding="utf-8")
        blocks = {s["id"]: page.split(f'id="section-{s["id"]}"', 1)[1].split("</section>", 1)[0]
                  for s, _, _ in ba.grouped_sections(REGISTRY)}
        for a in REGISTRY["apps"]:
            self.assertEqual(len(re.findall(rf'<article class="app status-[a-z-]+" id="{re.escape(a["id"])}"', page)), 1, a["id"])
            self.assertIn(f'id="{a["id"]}"', blocks[a["section"]], a["id"])
        self.assertEqual(sum(len(a) + len(c) for _, a, c in ba.grouped_sections(REGISTRY)),
                         len(REGISTRY["apps"]) + len(REGISTRY["candidates"]))


if __name__ == "__main__":
    unittest.main()
