"""LLM client abstraction.

Wraps an OpenAI-compatible HTTP endpoint (local Ollama, vLLM, etc.).
All configuration comes from environment variables.
Every call is logged with: prompt tokens, completion tokens, latency_ms.
Falls back to a mock response when LLM_ENDPOINT is not set (dev mode).
"""
from __future__ import annotations

import os
import time
from typing import Any

import httpx

from app.core.logger import logger

# ── Config from env ───────────────────────────────────────────────────────────
LLM_ENDPOINT = os.getenv("LLM_ENDPOINT", "")          # e.g. http://localhost:11434/api/generate
LLM_MODEL    = os.getenv("LLM_MODEL", "llama3")
LLM_TIMEOUT  = int(os.getenv("LLM_TIMEOUT_SECONDS", "30"))


async def call_llm(prompt: str, *, system: str = "") -> str:
    """Send a prompt to the configured LLM endpoint and return the text response.

    Args:
        prompt:  The user prompt (with injected mart context).
        system:  Optional system instruction (role persona, format rules).

    Returns:
        The model's plain-text reply.

    Raises:
        RuntimeError: If the LLM call fails (caller should convert to HTTPException).
    """
    if not LLM_ENDPOINT:
        # Dev/demo mode — return a deterministic mock so CI never requires a GPU
        logger.warning("llm_endpoint_not_configured", extra={"model": LLM_MODEL})
        return (
            "LoanBot is running in demo mode (LLM_ENDPOINT not configured). "
            "Configure LLM_ENDPOINT in .env to enable live responses."
        )

    t0 = time.perf_counter()
    payload: dict[str, Any] = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system

    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            response = await client.post(LLM_ENDPOINT, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        logger.error(
            "llm_call_failed",
            extra={"endpoint": LLM_ENDPOINT, "error": str(exc)},
        )
        raise RuntimeError(f"LLM endpoint error: {exc}") from exc

    latency_ms = round((time.perf_counter() - t0) * 1000, 1)

    # Ollama /api/generate format — adapt if using OpenAI-compatible endpoint
    text: str = data.get("response", data.get("choices", [{}])[0].get("text", ""))

    # Estimate token counts (Ollama provides them; OpenAI provides prompt/completion tokens)
    prompt_tokens = data.get("prompt_eval_count", len(prompt.split()))
    completion_tokens = data.get("eval_count", len(text.split()))

    logger.info(
        "llm_call_completed",
        extra={
            "model": LLM_MODEL,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "latency_ms": latency_ms,
        },
    )
    return text
