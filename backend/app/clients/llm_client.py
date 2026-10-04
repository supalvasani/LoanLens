"""LLM client — OpenAI-compatible chat completions.

Configuration (all via env / pydantic Settings):
  LLM_BASE_URL          e.g. http://localhost:11434/v1  (Ollama) or
                              https://api.openai.com/v1  (OpenAI)
  LLM_API_KEY           Optional bearer token (leave blank for local Ollama)
  LLM_MODEL             Model name, e.g. "llama3.1", "qwen2.5", "gpt-4o-mini"
  LLM_TIMEOUT_SECONDS   Per-request timeout (default 60)
  LLM_MOCK              Set "true" to return a deterministic mock (tests / CI)

Behaviour:
  - Uses the OpenAI chat-completions format: POST /chat/completions
    with {"model": ..., "messages": [...], "tools": [...]}
  - Supports optional tool/function calling (passed through verbatim).
  - One automatic retry on network timeout or 5xx response.
  - If LLM_BASE_URL is unset and LLM_MOCK is not "true", raises RuntimeError
    so the route returns HTTP 503 (rather than silently returning stale text).
  - Logs model, prompt_tokens, completion_tokens, latency_ms, finish_reason
    on every real call.  Never logs raw prompt content (PII risk).
"""
from __future__ import annotations

import json
import time
from typing import Any

import httpx

from app.core.config import settings
from app.core.logger import logger

# ── Helpers ───────────────────────────────────────────────────────────────────

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def _base_url() -> str:
    """Return the normalised base URL (no trailing slash)."""
    return (settings.LLM_BASE_URL or "").rstrip("/")


def _headers() -> dict[str, str]:
    h: dict[str, str] = {"Content-Type": "application/json"}
    if settings.LLM_API_KEY:
        h["Authorization"] = f"Bearer {settings.LLM_API_KEY}"
    return h


# ── Public API ────────────────────────────────────────────────────────────────

async def call_llm(
    prompt: str,
    *,
    system: str = "",
) -> str:
    """Send a single user prompt and return the assistant text reply.

    Args:
        prompt:  The user-turn content (with injected mart context).
        system:  System instruction (persona, guardrails, format rules).

    Returns:
        The model's plain-text reply.

    Raises:
        RuntimeError: On LLM misconfiguration or call failure (caller converts
                      to HTTP 503).
    """
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    result = await _chat_completions(messages=messages, tools=None)
    return result["content"]


async def call_llm_with_tools(
    messages: list[dict[str, Any]],
    *,
    tools: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Send a multi-turn conversation (with optional tool schemas) and return
    the full assistant response dict:

        {
          "content":    str | None,          # assistant text (if any)
          "tool_calls": list[dict] | None,   # tool calls requested (if any)
          "finish_reason": str,              # "stop" | "tool_calls" | ...
        }

    Args:
        messages:  Full conversation history in OpenAI message format.
        tools:     List of tool schemas (OpenAI function-calling format).
                   Pass None or [] to skip tool calling.
    """
    return await _chat_completions(messages=messages, tools=tools or None)


# ── Internal ──────────────────────────────────────────────────────────────────

async def _chat_completions(
    *,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """Core request → one retry on timeout / 5xx → parse response."""

    # ── Mock mode (CI / tests) ────────────────────────────────────────────────
    if settings.LLM_MOCK:
        logger.info("llm_mock_response", extra={"model": settings.LLM_MODEL})
        return {
            "content": (
                "LoanBot is running in mock mode (LLM_MOCK=true). "
                "No real model is called."
            ),
            "tool_calls": None,
            "finish_reason": "stop",
        }

    # ── Config guard ──────────────────────────────────────────────────────────
    base = _base_url()
    if not base:
        logger.error(
            "llm_not_configured",
            extra={"hint": "Set LLM_BASE_URL in .env or enable LLM_MOCK=true"},
        )
        raise RuntimeError(
            "LLM_BASE_URL is not configured. "
            "Set it in .env (e.g. http://localhost:11434/v1) or set LLM_MOCK=true."
        )

    url = f"{base}/chat/completions"
    payload: dict[str, Any] = {
        "model": settings.LLM_MODEL,
        "messages": messages,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    # ── Request with one retry ────────────────────────────────────────────────
    last_exc: Exception | None = None
    for attempt in range(2):
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(
                timeout=settings.LLM_TIMEOUT_SECONDS,
                headers=_headers(),
            ) as client:
                resp = await client.post(url, content=json.dumps(payload))

            latency_ms = round((time.perf_counter() - t0) * 1000, 1)

            if resp.status_code in _RETRYABLE_STATUS and attempt == 0:
                logger.warning(
                    "llm_retrying",
                    extra={
                        "status": resp.status_code,
                        "attempt": attempt,
                        "latency_ms": latency_ms,
                    },
                )
                continue

            resp.raise_for_status()
            data = resp.json()
            return _parse_response(data, latency_ms)

        except httpx.TimeoutException as exc:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            last_exc = exc
            if attempt == 0:
                logger.warning(
                    "llm_timeout_retrying",
                    extra={"attempt": attempt, "latency_ms": latency_ms},
                )
                continue
        except httpx.HTTPStatusError as exc:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            last_exc = exc
            logger.error(
                "llm_http_error",
                extra={
                    "status": exc.response.status_code,
                    "latency_ms": latency_ms,
                },
            )
            break
        except httpx.HTTPError as exc:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            last_exc = exc
            logger.error(
                "llm_network_error",
                extra={"error": type(exc).__name__, "latency_ms": latency_ms},
            )
            break

    raise RuntimeError(f"LLM call failed after retries: {last_exc}") from last_exc


def _parse_response(data: dict[str, Any], latency_ms: float) -> dict[str, Any]:
    """Extract content / tool_calls from an OpenAI-format response dict."""
    choices = data.get("choices") or []
    choice = choices[0] if choices else {}
    message = choice.get("message") or {}
    finish_reason: str = choice.get("finish_reason", "stop") or "stop"

    content: str | None = message.get("content")
    raw_tool_calls: list[dict] | None = message.get("tool_calls")

    usage = data.get("usage") or {}
    prompt_tokens: int = usage.get("prompt_tokens", 0)
    completion_tokens: int = usage.get("completion_tokens", 0)

    logger.info(
        "llm_call_completed",
        extra={
            "model": data.get("model", settings.LLM_MODEL),
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "latency_ms": latency_ms,
            "finish_reason": finish_reason,
            # NOTE: never log `content` or `messages` — may contain PII
        },
    )

    return {
        "content": content or "",
        "tool_calls": raw_tool_calls,
        "finish_reason": finish_reason,
    }
