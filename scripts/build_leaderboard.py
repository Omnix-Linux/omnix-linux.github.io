#!/usr/bin/env python3
"""Build the model leaderboard snapshot and page.

Reads   leaderboard/bridgebench.json  (hand-maintained; never scraped)
        leaderboard/aliases.json      (BridgeBench name -> OpenRouter id)
Fetches https://openrouter.ai/api/v1/models (public, no API key)
Writes  leaderboard/data.json          (merged snapshot)
        leaderboard/index.html         (static page, data inlined)

Stdlib only. Run from anywhere: python3 scripts/build_leaderboard.py
If a source fails, the previous snapshot's data for it is kept and marked stale.
Exits non-zero only when both sources fail.
"""
import datetime as dt
import json
import re
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "leaderboard"
TEMPLATE = Path(__file__).resolve().parent / "leaderboard_template.html"
OPENROUTER_URL = "https://openrouter.ai/api/v1/models"
MIN_OPENROUTER_MODELS = 20  # fewer than this is treated as an implausible response


def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize(name):
    """Normalize a BridgeBench display name/slug or an OpenRouter id/name to one key.

    'GPT-6.1 Sol' -> 'gpt-6-1-sol'; 'openai/gpt-6.1-sol:batch' -> 'gpt-6-1-sol';
    'OpenAI: GPT-6.1 Sol (free)' -> 'gpt-6-1-sol'.
    """
    s = (name or "").strip()
    s = s.lstrip("~")
    s = re.sub(r":[a-z-]+$", "", s)                      # :free, :batch
    s = re.sub(r"\s*\((?:free|batch)\)\s*$", "", s, flags=re.I)
    s = re.sub(r"^[^:/]+:\s+", "", s)                     # 'Vendor: '
    s = s.rsplit("/", 1)[-1]                              # 'vendor/'
    s = s.lower()
    s = re.sub(r"[.\s_]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s


def split_variant(model_id):
    """'a/b:free' -> ('a/b', 'free'); '~a/b-latest' -> (None, 'alias'); 'a/b' -> ('a/b', None)."""
    if model_id.startswith("~"):
        return None, "alias"
    base, sep, suffix = model_id.partition(":")
    return (base, suffix) if sep else (model_id, None)


def per_million(value):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if v < 0:  # OpenRouter uses -1 for variable-priced routers
        return None
    return round(v * 1_000_000, 4)


def collapse_openrouter(raw_models):
    """Collapse :free/:batch variants into their base model and drop ~alias ids.

    A variant whose base id is absent (e.g. only 'x:free' exists) stays as its own row,
    keyed by its real routable id.
    """
    ids = {m.get("id") for m in raw_models}
    rows, variants = {}, {}
    for m in raw_models:
        mid = m.get("id") or ""
        base, suffix = split_variant(mid)
        if base is None:
            continue
        if suffix and base in ids:
            variants.setdefault(base, []).append(mid)
            continue
        pricing = m.get("pricing") or {}
        top = m.get("top_provider") or {}
        name = m.get("name") or mid
        rows[mid] = {
            "id": mid,
            "name": re.sub(r"^[^:]+:\s+", "", name),
            "provider": mid.split("/", 1)[0],
            "in": per_million(pricing.get("prompt")),
            "out": per_million(pricing.get("completion")),
            "ctx": m.get("context_length") or top.get("context_length"),
            "maxOut": top.get("max_completion_tokens"),
            "modality": (m.get("architecture") or {}).get("modality"),
        }
    for base, vs in variants.items():
        if base in rows:
            rows[base]["variants"] = sorted(vs)
    return sorted(rows.values(), key=lambda r: (r["provider"], r["name"].lower()))


def fetch_openrouter(url=OPENROUTER_URL, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "omnix-linux.github.io leaderboard builder"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.load(resp)
    models = data.get("data")
    return models


def load_json(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def validate_bridgebench(bb):
    if not isinstance(bb, dict) or not isinstance(bb.get("models"), list):
        raise ValueError("bridgebench.json must be an object with a 'models' array")
    for m in bb["models"]:
        if not isinstance(m, dict) or not m.get("name") or not isinstance(m.get("rank"), int):
            raise ValueError(f"bad BridgeBench row: {m!r}")
    return bb


def join(bb_models, or_models, aliases):
    """Return (rows, unmatched_bridgebench, unmatched_openrouter_count)."""
    by_id = {m["id"]: m for m in or_models}
    by_key = {}
    for m in or_models:
        by_key.setdefault(normalize(m["id"]), []).append(m)
    used, rows, unmatched = set(), [], []
    for b in sorted(bb_models, key=lambda b: b["rank"]):
        target = None
        alias = aliases.get(b["name"]) or aliases.get(b.get("slug") or "")
        if alias and alias in by_id:
            target = by_id[alias]
        else:
            for key in (normalize(b.get("slug") or ""), normalize(b["name"])):
                hits = [h for h in by_key.get(key, []) if h["id"] not in used]
                if len(hits) == 1:
                    target = hits[0]
                    break
        row = {"rank": b["rank"], "bbName": b["name"], "slug": b.get("slug"),
               "overall": b.get("overall"), "axes": b.get("axes") or {}}
        if target:
            used.add(target["id"])
            row.update(target)
        else:
            unmatched.append(b["name"])
            row["name"] = b["name"]
        rows.append(row)
    rest = [m for m in or_models if m["id"] not in used]
    return rows + rest, unmatched, len(rest)


def build(fetch=fetch_openrouter, out_dir=OUT_DIR, log=print):
    out_dir = Path(out_dir)
    previous = load_json(out_dir / "data.json", {}) or {}
    prev_sources = previous.get("sources", {})
    aliases = {k: v for k, v in (load_json(out_dir / "aliases.json", {}) or {}).items() if not k.startswith("_")}
    failures = 0

    # BridgeBench: hand-maintained file only.
    bb_prev = prev_sources.get("bridgebench", {})
    try:
        bb = validate_bridgebench(load_json(out_dir / "bridgebench.json", {"models": []}))
        bb_source = {"url": bb.get("source") or "https://www.bridgebench.ai/leaderboard",
                     "version": bb.get("version"), "fetched_at": bb.get("transcribed_at"),
                     "stale": False, "count": len(bb["models"])}
        bb_models = bb["models"]
    except (ValueError, json.JSONDecodeError) as exc:
        failures += 1
        log(f"warning: BridgeBench data unusable ({exc}); keeping previous snapshot")
        bb_source = dict(bb_prev, stale=True)
        bb_models = previous.get("bridgebench_models", [])

    # OpenRouter: live.
    or_prev = prev_sources.get("openrouter", {})
    try:
        raw = fetch()
        if not isinstance(raw, list) or len(raw) < MIN_OPENROUTER_MODELS:
            raise ValueError(f"implausible OpenRouter response ({len(raw or [])} models)")
        or_models = collapse_openrouter(raw)
        or_source = {"url": OPENROUTER_URL, "fetched_at": now_iso(), "stale": False, "count": len(or_models)}
    except Exception as exc:  # network, HTTP, JSON or plausibility failure
        failures += 1
        log(f"warning: OpenRouter fetch failed ({exc}); keeping previous snapshot")
        or_source = dict(or_prev, stale=True)
        or_models = previous.get("openrouter_models", [])

    if failures == 2:
        log("error: both sources failed; leaving existing output untouched")
        return 1

    rows, unmatched_bb, or_only = join(bb_models, or_models, aliases)
    for name in unmatched_bb:
        log(f"unmatched BridgeBench model: {name}  (add it to leaderboard/aliases.json)")
    if bb_models:
        log(f"{or_only} OpenRouter models have no BridgeBench score")
    stale_alias = [k for k, v in aliases.items() if v not in {m['id'] for m in or_models}]
    for k in stale_alias:
        log(f"alias target not on OpenRouter: {k} -> {aliases[k]}")

    axes = []
    for b in bb_models:
        for a in (b.get("axes") or {}):
            if a not in axes:
                axes.append(a)
    data = {
        "generated_at": now_iso(),
        "sources": {"bridgebench": bb_source, "openrouter": or_source},
        "axes": axes,
        "bridgebench_models": bb_models,
        "openrouter_models": or_models,
        "rows": rows,
    }
    # Rows are derivable, so the stored snapshot omits them to stay small.
    stored = {k: v for k, v in data.items() if k != "rows"}
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "data.json").write_text(json.dumps(stored, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    page_data = {k: v for k, v in data.items() if k not in ("bridgebench_models", "openrouter_models")}
    blob = json.dumps(page_data, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8").replace("/*__LEADERBOARD_DATA__*/null", blob)
    (out_dir / "index.html").write_text(html, encoding="utf-8")
    log(f"wrote {len(rows)} rows ({len(bb_models)} BridgeBench, {len(or_models)} OpenRouter after collapsing variants)")
    return 0


if __name__ == "__main__":
    sys.exit(build())
