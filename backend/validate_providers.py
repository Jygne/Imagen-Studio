"""
Minimal validation script for OpenAI and OpenRouter providers.
Usage:
  cd /path/to/buyboxv2/backend
  source .venv/bin/activate
  python validate_providers.py --openai-key sk-... --openrouter-key sk-or-...

Checks:
  1. Syntax / import sanity for both providers
  2. OpenAI: images.edit() call with a tiny 1x1 PNG
  3. OpenRouter: chat.completions.create() call with modalities=["text","image"]
  4. Reports "code problem" vs "account/permission problem" clearly
"""
import argparse
import base64
import sys
import os

# Allow running from backend/ directory
sys.path.insert(0, os.path.dirname(__file__))


# ── Minimal 1×1 white PNG (no external deps needed) ──────────────────────────
_TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
)
TINY_PNG = base64.b64decode(_TINY_PNG_B64)


def check_imports():
    print("── Import check ──────────────────────────────────")
    try:
        from app.infrastructure.providers.openai_provider import OpenAIProvider, VALID_MODELS as OAI_MODELS, DEFAULT_MODEL as OAI_DEFAULT
        print(f"  ✓ openai_provider  models={OAI_MODELS}  default={OAI_DEFAULT}")
    except Exception as e:
        print(f"  ✗ openai_provider import FAILED: {e}")
        return False
    try:
        from app.infrastructure.providers.openrouter_provider import OpenRouterProvider, VALID_MODELS as OR_MODELS, DEFAULT_MODEL as OR_DEFAULT
        print(f"  ✓ openrouter_provider  models={OR_MODELS}  default={OR_DEFAULT}")
    except Exception as e:
        print(f"  ✗ openrouter_provider import FAILED: {e}")
        return False
    return True


def test_openai(api_key: str):
    print("\n── OpenAI generate_image() ───────────────────────")
    from app.infrastructure.providers.openai_provider import OpenAIProvider
    p = OpenAIProvider(api_key=api_key, model="gpt-image-1.5")
    try:
        result = p.generate_image(
            image_bytes=TINY_PNG,
            prompt="Make the background light blue.",
            size="1024x1024",
            quality="low",
            timeout=60,
        )
        print(f"  ✓ SUCCESS — got {len(result)} bytes of image data")
        return True
    except Exception as e:
        msg = str(e)
        if "dall-e-2" in msg or "invalid_request_error" in msg or "model" in msg.lower():
            print(f"  ✗ CODE/MODEL problem: {msg}")
        elif "auth" in msg.lower() or "401" in msg or "permission" in msg.lower() or "organization" in msg.lower():
            print(f"  ✗ ACCOUNT/AUTH problem (code is OK): {msg}")
        else:
            print(f"  ✗ UNKNOWN error: {msg}")
        return False


def test_openrouter(api_key: str):
    print("\n── OpenRouter generate_image() ───────────────────")
    from app.infrastructure.providers.openrouter_provider import OpenRouterProvider
    p = OpenRouterProvider(api_key=api_key, model="google/gemini-2.5-flash-image")
    try:
        result = p.generate_image(
            image_bytes=TINY_PNG,
            prompt="Make the background light blue. Output 1:1 square image.",
            size="1024x1024",
            quality="medium",
            timeout=120,
        )
        print(f"  ✓ SUCCESS — got {len(result)} bytes of image data")
        return True
    except Exception as e:
        msg = str(e)
        if "Could not extract image" in msg:
            print(f"  ✗ IMAGE EXTRACTION problem (request succeeded but parse failed): {msg[:300]}")
        elif "auth" in msg.lower() or "401" in msg or "key" in msg.lower():
            print(f"  ✗ ACCOUNT/AUTH problem (code is OK): {msg}")
        else:
            print(f"  ✗ ERROR: {msg[:400]}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--openai-key", default="")
    parser.add_argument("--openrouter-key", default="")
    args = parser.parse_args()

    ok = check_imports()
    if not ok:
        sys.exit(1)

    results = {}
    if args.openai_key:
        results["openai"] = test_openai(args.openai_key)
    else:
        print("\n── OpenAI skipped (no --openai-key provided) ────")

    if args.openrouter_key:
        results["openrouter"] = test_openrouter(args.openrouter_key)
    else:
        print("\n── OpenRouter skipped (no --openrouter-key provided) ──")

    print("\n── Summary ───────────────────────────────────────")
    for k, v in results.items():
        print(f"  {'✓' if v else '✗'} {k}")

    sys.exit(0 if all(results.values()) else 1)
