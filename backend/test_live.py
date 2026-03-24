"""
Live validation script — reads API keys directly from DB, tests real API calls.
Usage (from buyboxv2/backend/):
  source .venv/bin/activate
  python test_live.py

Tests:
  1. OpenRouter /models — check which gemini image models are listed
  2. OpenAI gpt-image-1.5 — primary model, actual images.edit() call
  3. OpenAI gpt-image-1   — compat model, actual images.edit() call
  4. OpenRouter gemini-3.1 — primary working model, generate call
  5. OpenRouter gemini-2.5-04-17 — dated variant, generate call
"""
import sys
import os
import base64

sys.path.insert(0, os.path.dirname(__file__))

# ── Tiny 1×1 white PNG for testing ───────────────────────────────────────────
_TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
)
TINY_PNG = base64.b64decode(_TINY_PNG_B64)

PROMPT = "Make the background solid light blue. Output a square image."


def get_keys():
    """Read API keys from the SQLite DB using the existing repo."""
    from app.infrastructure.db.database import SessionLocal, init_db
    from app.infrastructure.db.repositories.api_key_repo import ApiKeyRepository
    from app.domain.enums import Provider
    init_db()
    db = SessionLocal()
    try:
        repo = ApiKeyRepository(db)
        openai_key = repo.get_raw_key(Provider.OPENAI)
        openrouter_key = repo.get_raw_key(Provider.OPENROUTER)
        return openai_key, openrouter_key
    finally:
        db.close()


def section(title):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")


def check_openrouter_models(api_key: str):
    """Query OpenRouter /models and look for gemini-2.5 and gemini-3.1."""
    section("OpenRouter /models — checking gemini availability")
    import requests
    try:
        r = requests.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=15,
        )
        if r.status_code != 200:
            print(f"  ✗ HTTP {r.status_code}: {r.text[:200]}")
            return {}
        models = r.json().get("data", [])
        model_ids = {m.get("id", "") for m in models}

        targets = [
            "google/gemini-2.5-flash-image",
            "google/gemini-3.1-flash-image-preview",
        ]
        found = {}
        for t in targets:
            exists = t in model_ids
            found[t] = exists
            print(f"  {'✓' if exists else '✗'} {t}")

        # Also show any other gemini image models listed
        other = [m for m in model_ids if "gemini" in m and "image" in m and m not in targets]
        if other:
            print(f"\n  Other Gemini image models on OpenRouter:")
            for m in sorted(other):
                print(f"    · {m}")
        return found
    except Exception as e:
        print(f"  ✗ Exception: {e}")
        return {}


def test_openai(api_key: str, model: str):
    section(f"OpenAI images.edit() — model={model}")
    from app.infrastructure.providers.openai_provider import OpenAIProvider
    p = OpenAIProvider(api_key=api_key, model=model)
    print(f"  Provider resolved model: {p.model}")
    try:
        result = p.generate_image(
            image_bytes=TINY_PNG,
            prompt=PROMPT,
            size="1024x1024",
            quality="low",
            timeout=90,
        )
        print(f"  ✓ SUCCESS — {len(result)} bytes")
        return True
    except Exception as e:
        msg = str(e)
        if "invalid_request_error" in msg or "model" in msg.lower() or "dall-e" in msg:
            print(f"  ✗ MODEL/PARAM error (code issue): {msg[:400]}")
        elif "401" in msg or "auth" in msg.lower() or "permission" in msg.lower() or "billing" in msg.lower():
            print(f"  ✗ ACCOUNT/AUTH error (code OK): {msg[:400]}")
        elif "organization" in msg.lower() or "access" in msg.lower():
            print(f"  ✗ ACCOUNT PERMISSION error (code OK): {msg[:400]}")
        else:
            print(f"  ✗ UNKNOWN error: {msg[:400]}")
        return False


def test_openrouter(api_key: str, model: str):
    section(f"OpenRouter generate_image() — model={model}")
    from app.infrastructure.providers.openrouter_provider import OpenRouterProvider
    p = OpenRouterProvider(api_key=api_key, model=model)
    print(f"  Provider resolved model: {p.model}")
    try:
        result = p.generate_image(
            image_bytes=TINY_PNG,
            prompt=PROMPT,
            size="1024x1024",
            quality="medium",
            timeout=120,
        )
        print(f"  ✓ SUCCESS — {len(result)} bytes")
        return True
    except Exception as e:
        msg = str(e)
        if "Could not extract image" in msg:
            print(f"  ✗ IMAGE EXTRACTION failed (request worked, parse failed):\n    {msg[:500]}")
        elif "401" in msg or "auth" in msg.lower() or "No auth" in msg:
            print(f"  ✗ ACCOUNT/AUTH error (code OK): {msg[:400]}")
        elif "404" in msg or "not found" in msg.lower() or "no endpoints" in msg.lower():
            print(f"  ✗ MODEL NOT AVAILABLE / no endpoint (upstream issue): {msg[:400]}")
        elif "error" in msg.lower() and "generation" in msg.lower():
            print(f"  ✗ GENERATION error (model-side): {msg[:400]}")
        else:
            print(f"  ✗ UNKNOWN error: {msg[:400]}")
        return False


if __name__ == "__main__":
    print("=" * 55)
    print("  BuyBox v2 — Live Provider Validation")
    print("=" * 55)

    openai_key, openrouter_key = get_keys()

    if not openai_key:
        print("\n⚠  No OpenAI key in DB — skipping OpenAI tests")
    if not openrouter_key:
        print("\n⚠  No OpenRouter key in DB — skipping OpenRouter tests")

    results = {}

    # ── OpenRouter models check ───────────────────────────────────────────────
    if openrouter_key:
        found = check_openrouter_models(openrouter_key)
        results["openrouter_models_check"] = bool(found)

    # ── OpenAI gpt-image-1.5 (primary) ───────────────────────────────────────
    if openai_key:
        results["openai_gpt-image-1.5"] = test_openai(openai_key, "gpt-image-1.5")

    # ── OpenAI gpt-image-1 (compat) ───────────────────────────────────────────
    if openai_key:
        results["openai_gpt-image-1"] = test_openai(openai_key, "gpt-image-1")

    # ── OpenRouter Gemini 3.1 (primary working model) ─────────────────────────
    if openrouter_key:
        results["openrouter_gemini-2.5"] = test_openrouter(
            openrouter_key, "google/gemini-2.5-flash-image"
        )

    # ── OpenRouter Gemini 2.5-04-17 (dated variant) ───────────────────────────
    if openrouter_key:
        results["openrouter_gemini-3.1"] = test_openrouter(
            openrouter_key, "google/gemini-3.1-flash-image-preview"
        )

    # ── Summary ───────────────────────────────────────────────────────────────
    section("SUMMARY")
    for k, v in results.items():
        print(f"  {'✓' if v else '✗'} {k}")
    print()
