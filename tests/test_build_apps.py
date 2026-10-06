"""Unit tests for scripts/build_apps.py. Run: python3 -m unittest discover -s tests -p 'test_*.py'"""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import build_apps as ba  # noqa: E402

REGISTRY = json.loads(ba.REGISTRY.read_text(encoding="utf-8"))


def app(**over):
    a = {"id": "demo", "name": "Demo", "icon": "node", "category": "Runtime", "kind": "Prebuilt binary",
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
            ba.validate({"apps": [app(verification=ver(s))]})

    def test_unknown_status_refused(self):
        for s in ("ok", "PASSING", "flaky", "", None):
            with self.assertRaises(ba.RegistryError):
                ba.validate({"apps": [app(verification=ver(s))]})

    def test_tested_status_needs_test_path(self):
        for s in ba.TESTED_STATUSES:
            with self.assertRaises(ba.RegistryError):
                ba.validate({"apps": [app(test=None, verification=ver(s))]})
            bad = app(verification=ver(s))
            bad["test"]["path"] = ""
            with self.assertRaises(ba.RegistryError):
                ba.validate({"apps": [bad]})

    def test_tested_status_needs_verified_at(self):
        for s in ba.TESTED_STATUSES:
            for va in (None, "", "yesterday"):
                with self.assertRaises(ba.RegistryError):
                    ba.validate({"apps": [app(verification=ver(s, verified_at=va))]})

    def test_untested_needs_no_test(self):
        ba.validate({"apps": [app(test=None, verification={"status": "untested"})]})

    def test_missing_field_and_duplicate_id(self):
        a = app(); del a["install"]
        with self.assertRaises(ba.RegistryError):
            ba.validate({"apps": [a]})
        with self.assertRaises(ba.RegistryError):
            ba.validate({"apps": [app(), app()]})

    def test_icon_must_exist(self):
        ba.validate({"apps": [app(icon="assets/project-icons/atrium.png")]})
        for icon in ("assets/nope.png", "/etc/passwd", "assets/../index.html", "logo"):
            with self.assertRaises(ba.RegistryError):
                ba.validate({"apps": [app(icon=icon)]})

    def test_candidates_carry_no_status(self):
        c = {"id": "x", "name": "X", "icon": "grid", "category": "C", "description": "d", "status": "passing"}
        with self.assertRaises(ba.RegistryError):
            ba.validate({"apps": [], "candidates": [c]})


class Render(unittest.TestCase):
    def render(self, reg):
        return ba.render(ba.validate(reg), ba.TEMPLATE.read_text(encoding="utf-8"))

    def test_null_verification_shows_awaiting(self):
        page = self.render({"apps": [app()]})
        self.assertIn("badge-awaiting", page)
        self.assertIn("Awaiting verification", page)
        self.assertNotIn('class="badge badge-passing">Passing</span> on', page)

    def test_passing_shows_date_commit_and_test_link(self):
        page = self.render({"apps": [app(verification=ver("passing", commit="0123456789abcdef"))]})
        self.assertIn("2026-10-01", page)
        self.assertIn("<code>0123456789ab</code>", page)
        self.assertIn("https://github.com/Omnix-Linux/Omnix/blob/main/tests/fhs.nix", page)

    def test_escapes_and_inlines_data(self):
        page = self.render({"apps": [app(description="<script>x</script>", workflow=["a </script> b"])]})
        self.assertIn("&lt;script&gt;x&lt;/script&gt;", page)
        self.assertNotIn("<script>x</script>", page)
        self.assertNotIn("/*__APPS_DATA__*/", page)
        blob = page.split('<script id="apps-data" type="application/json">', 1)[1].split("</script>", 1)[0]
        self.assertEqual(json.loads(blob)["apps"][0]["workflow"], ["a </script> b"])

    def test_build_refuses_invalid_registry_and_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            reg, out = Path(d) / "r.json", Path(d) / "index.html"
            reg.write_text(json.dumps({"apps": [app(verification=ver("passing", verified_at=None))]}))
            self.assertEqual(ba.build(registry=reg, out=out, log=lambda *_: None), 1)
            self.assertFalse(out.exists())
            reg.write_text(json.dumps({"apps": [app()]}))
            self.assertEqual(ba.build(registry=reg, out=out, log=lambda *_: None), 0)
            self.assertIn("Demo", out.read_text())

    def test_committed_page_is_current(self):
        page = ba.render(ba.validate(copy.deepcopy(REGISTRY)), ba.TEMPLATE.read_text(encoding="utf-8"))
        self.assertEqual(page, ba.OUT.read_text(encoding="utf-8"), "run python3 scripts/build_apps.py")


if __name__ == "__main__":
    unittest.main()
