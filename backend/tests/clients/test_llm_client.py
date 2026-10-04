import json
from unittest.mock import patch

import httpx
import pytest

from app.clients.llm_client import call_llm, call_llm_with_tools
from app.core.config import settings


@pytest.mark.asyncio
async def test_llm_client_returns_tool_calls(monkeypatch):
    """Test that call_llm_with_tools accepts tools and parses tool_calls."""
    monkeypatch.setattr(settings, "LLM_MOCK", False)
    monkeypatch.setattr(settings, "LLM_BASE_URL", "http://localhost:11434/v1")
    monkeypatch.setattr(settings, "LLM_MODEL", "llama3.1")

    mock_tool_call = {
        "id": "call_123",
        "type": "function",
        "function": {
            "name": "get_credit_profile",
            "arguments": json.dumps({"applicant_id": "test-uuid"}),
        },
    }

    mock_response_data = {
        "id": "chatcmpl-1",
        "object": "chat.completion",
        "created": 123456789,
        "model": "llama3.1",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [mock_tool_call],
                },
                "finish_reason": "tool_calls",
            }
        ],
        "usage": {"prompt_tokens": 50, "completion_tokens": 20, "total_tokens": 70},
    }

    tools_schema = [
        {
            "type": "function",
            "function": {
                "name": "get_credit_profile",
                "description": "Fetch applicant credit profile",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "applicant_id": {"type": "string"},
                    },
                    "required": ["applicant_id"],
                },
            },
        }
    ]

    messages = [{"role": "user", "content": "Check credit profile for applicant"}]

    async def mock_post(url, *args, **kwargs):
        req_content = json.loads(kwargs.get("content", "{}"))
        assert "tools" in req_content
        assert req_content["tools"] == tools_schema
        assert req_content["tool_choice"] == "auto"
        assert req_content["messages"] == messages

        mock_resp = httpx.Response(
            status_code=200,
            json=mock_response_data,
            request=httpx.Request("POST", url),
        )
        return mock_resp

    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        result = await call_llm_with_tools(messages, tools=tools_schema)

    assert result["content"] == ""
    assert result["finish_reason"] == "tool_calls"
    assert result["tool_calls"] == [mock_tool_call]
    assert result["tool_calls"][0]["function"]["name"] == "get_credit_profile"


@pytest.mark.asyncio
async def test_llm_client_skips_retry_on_4xx(monkeypatch):
    """Test that 4xx client errors (e.g. 400 Bad Request, 401 Unauthorized) skip retries."""
    monkeypatch.setattr(settings, "LLM_MOCK", False)
    monkeypatch.setattr(settings, "LLM_BASE_URL", "http://localhost:11434/v1")

    call_count = 0

    async def mock_post_400(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        return httpx.Response(
            status_code=400,
            json={"error": {"message": "Bad Request: invalid schema"}},
            request=httpx.Request("POST", url),
        )

    with patch("httpx.AsyncClient.post", side_effect=mock_post_400):
        with pytest.raises(RuntimeError, match="LLM call failed"):
            await call_llm("test prompt")

    # Should only be called once, NOT retried
    assert call_count == 1


@pytest.mark.asyncio
async def test_llm_client_retries_on_5xx(monkeypatch):
    """Test that 5xx errors trigger 1 retry."""
    monkeypatch.setattr(settings, "LLM_MOCK", False)
    monkeypatch.setattr(settings, "LLM_BASE_URL", "http://localhost:11434/v1")

    call_count = 0

    async def mock_post_500(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return httpx.Response(
                status_code=500,
                json={"error": "Internal Server Error"},
                request=httpx.Request("POST", url),
            )
        return httpx.Response(
            status_code=200,
            json={
                "choices": [{"message": {"role": "assistant", "content": "Recovered!"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5},
            },
            request=httpx.Request("POST", url),
        )

    with patch("httpx.AsyncClient.post", side_effect=mock_post_500):
        reply = await call_llm("hello")

    assert call_count == 2
    assert reply == "Recovered!"


@pytest.mark.asyncio
async def test_llm_client_mock_mode(monkeypatch):
    """Test that LLM_MOCK=True returns mock response without making network calls."""
    monkeypatch.setattr(settings, "LLM_MOCK", True)

    reply = await call_llm("hello")
    assert "mock mode" in reply.lower()

    tools_reply = await call_llm_with_tools([{"role": "user", "content": "hello"}])
    assert "mock mode" in tools_reply["content"].lower()
    assert tools_reply["tool_calls"] is None
