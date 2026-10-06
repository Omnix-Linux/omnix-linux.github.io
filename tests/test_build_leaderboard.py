"""Unit tests for scripts/build_leaderboard.py. Run: python3 -m unittest discover -s tests -p 'test_*.py'"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import build_leaderboard as bl  # noqa: E402


def or_model(mid, name, prompt="0.000001", completion="0.000002", ctx=128000):
    return {"id": mid, "name": name, "context_length": ctx, "pricing": {"prompt": prompt, "completion": completion},
            "top_provider": {"max_completion_tokens": 4096}, "architecture": {"modality": "text->text"}}


FIXTURE = [or_model("openai/gpt-6.1-sol", "OpenAI: GPT-6.1 Sol"),
           or_model("openai/gpt-6.1-sol:batch", "OpenAI: GPT-6.1 Sol (batch)"),
           or_model("openai/gpt-6.1-sol:free", "OpenAI: GPT-6.1 Sol (free)", "0", "0"),
           or_model("~openai/gpt-sol-latest", "OpenAI: GPT Sol Latest"),
           or_model("acme/solo-1:free", "Acme: Solo 1 (free)", "0", "0"),
           or_model("openrouter/auto", "Auto Router", "-1", "-1")] + \
          [or_model(f"filler/m-{i}", f"Filler: M {i}") for i in range(30)]


class Normalize(unittest.TestCase):
    def test_issue_examples(self):
        self.assertEqual(bl.normalize("GPT-6.1 Sol"), "gpt-6-1-sol")
        self.assertEqual(bl.normalize("openai/gpt-6.1-sol"), "gpt-6-1-sol")
        self.assertEqual(bl.normalize("openai/gpt-6.1-sol:batch"), "gpt-6-1-sol")
        self.assertEqual(bl.normalize("OpenAI: GPT-6.1 Sol (free)"), "gpt-6-1-sol")
        self.assertEqual(bl.normalize("gpt-6-1-sol"), "gpt-6-1-sol")
        self.assertEqual(bl.normalize("Claude Opus 5.5"), bl.normalize("anthropic/claude-opus-5.5"))


class Collapse(unittest.TestCase):
    def test_variants_and_aliases(self):
        rows = {r["id"]: r for r in bl.collapse_openrouter(FIXTURE)}
        self.assertNotIn("openai/gpt-6.1-sol:batch", rows)
        self.assertNotIn("~openai/gpt-sol-latest", rows)
        self.assertEqual(rows["openai/gpt-6.1-sol"]["variants"], ["openai/gpt-6.1-sol:batch", "openai/gpt-6.1-sol:free"])
        self.assertIn("acme/solo-1:free", rows)  # free-only model stays, by its routable id
        self.assertEqual(rows["openai/gpt-6.1-sol"]["in"], 1.0)
        self.assertEqual(rows["openai/gpt-6.1-sol"]["name"], "GPT-6.1 Sol")
        self.assertIsNone(rows["openrouter/auto"]["in"])


class Build(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        (self.dir / "aliases.json").write_text(json.dumps({"Weird Name": "acme/solo-1:free"}))
        self.logs = []

    def run_build(self, fetch, bb=None):
        (self.dir / "bridgebench.json").write_text(json.dumps(bb or {"models": []}))
        return bl.build(fetch=fetch, out_dir=self.dir, log=self.logs.append, fetch_bb=self.fetch_bb)

    @staticmethod
    def fetch_bb():
        raise OSError("offline")  # exercise the hand-maintained fallback

    def test_empty_bridgebench_and_stale_fallback(self):
        self.assertEqual(self.run_build(lambda: FIXTURE), 0)
        data = json.loads((self.dir / "data.json").read_text())
        self.assertFalse(data["sources"]["openrouter"]["stale"])
        self.assertTrue((self.dir / "index.html").exists())

        def boom():
            raise OSError("offline")
        self.assertEqual(self.run_build(boom), 0)
        data2 = json.loads((self.dir / "data.json").read_text())
        self.assertTrue(data2["sources"]["openrouter"]["stale"])
        self.assertEqual(data2["sources"]["openrouter"]["fetched_at"], data["sources"]["openrouter"]["fetched_at"])
        self.assertEqual(data2["openrouter_models"], data["openrouter_models"])

    def test_implausible_response_is_a_failure(self):
        self.run_build(lambda: FIXTURE)
        self.run_build(lambda: [])
        self.assertTrue(json.loads((self.dir / "data.json").read_text())["sources"]["openrouter"]["stale"])

    def test_join_rank_order_alias_and_unmatched(self):
        bb = {"models": [{"rank": 2, "name": "Weird Name", "overall": 600},
                         {"rank": 1, "name": "GPT-6.1 Sol", "slug": "gpt-6-1-sol", "overall": 700, "axes": {"speed": 5}},
                         {"rank": 3, "name": "Ghost Model", "overall": 500}]}
        self.assertEqual(self.run_build(lambda: FIXTURE, bb), 0)
        html = (self.dir / "index.html").read_text()
        blob = html.split('<script id="leaderboard-data" type="application/json">')[1].split("</script>")[0]
        rows = json.loads(blob)["rows"]
        self.assertEqual([r.get("id") for r in rows[:3]], ["openai/gpt-6.1-sol", "acme/solo-1:free", None])
        self.assertTrue(any("Ghost Model" in line for line in self.logs))


if __name__ == "__main__":
    unittest.main()


BENCHLM_PAGE = """<html><script id="__NEXT_DATA__" type="application/json">%s</script></html>""" % json.dumps({
    "props": {"pageProps": {
        "benchmark": {"version": "Sept 2026"},
        "lastUpdated": "October 5, 2026",
        "externalBenchmark": {"sourceUrl": "https://www.bridgebench.ai/leaderboard",
                              "methodologyUrl": "https://www.bridgebench.ai/blog/how-the-leaderboard-works",
                              "updatedLabel": "October 5, 2026"},
        "leaderboard": [
            {"model": "Model C", "slug": "model-c", "creator": "Z", "score": 501},
            {"model": "Model A", "slug": "model-a", "creator": "X", "score": 760},
            {"model": "Model B", "slug": "model-b", "creator": "Y", "score": 501},
            {"model": "Model D", "slug": None, "creator": "Z", "score": 450},
            {"model": "No score", "slug": "x", "creator": "Z", "score": None},
        ]}}})


class BenchLM(unittest.TestCase):
    def test_parse_orders_by_score_with_shared_tie_ranks(self):
        bb = bl.parse_benchlm(BENCHLM_PAGE)
        self.assertEqual([(m["rank"], m["name"], m["overall"]) for m in bb["models"]],
                         [(1, "Model A", 760), (2, "Model C", 501), (2, "Model B", 501), (4, "Model D", 450)])
        self.assertEqual(bb["source"], "https://www.bridgebench.ai/leaderboard")
        self.assertEqual(bb["via"], bl.BENCHLM_URL)
        self.assertEqual(bb["updated"], "October 5, 2026")

    def test_page_without_data_is_rejected(self):
        with self.assertRaises(ValueError):
            bl.parse_benchlm("<html></html>")

    def test_build_prefers_benchlm_and_records_attribution(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            (out / "bridgebench.json").write_text(json.dumps({"models": []}))
            many = dict(json.loads(BENCHLM_PAGE.split(">", 2)[2].rsplit("</script>", 1)[0]))
            rows = [{"model": f"M{i}", "slug": f"m{i}", "creator": "Z", "score": 900 - i} for i in range(6)]
            many["props"]["pageProps"]["leaderboard"] = rows
            page = '<script id="__NEXT_DATA__" type="application/json">%s</script>' % json.dumps(many)
            logs = []
            self.assertEqual(bl.build(fetch=lambda: FIXTURE, out_dir=out, log=logs.append,
                                      fetch_bb=lambda: bl.parse_benchlm(page)), 0)
            src = json.loads((out / "data.json").read_text())["sources"]["bridgebench"]
            self.assertEqual(src["count"], 6)
            self.assertEqual(src["via"], bl.BENCHLM_URL)
            self.assertFalse(src["stale"])
