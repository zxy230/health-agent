from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any


AGENT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGENT_ROOT))

from app.agents import HealthAgentRuntime
from app.llm import OpenAICompatibleLLMClient, StructuredLLMResult
from app.models import PostMessageRequest, ToolResponse
from app.trace_logger import TraceLogger


class FakeStore:
    def __init__(self) -> None:
        self.tool_logs: list[dict[str, Any]] = []

    async def list_messages(self, thread_id: str, authorization: str | None = None) -> list[dict[str, Any]]:
        return [{"role": "user", "content": f"message {index}", "created_at": str(index)} for index in range(15)]

    async def get_thread(self, thread_id: str, authorization: str | None = None) -> dict[str, Any]:
        return {"id": thread_id, "summary": "用户想减脂，同时膝盖不舒服。"}

    async def create_tool_invocation(
        self,
        tool_name: str,
        status: str,
        request_data: dict[str, Any],
        response_data: dict[str, Any],
        authorization: str | None = None,
    ) -> None:
        self.tool_logs.append(
            {
                "tool_name": tool_name,
                "status": status,
                "request_data": request_data,
                "response_data": response_data,
            }
        )


class FakeTools:
    async def get_memory_summary(self, authorization: str | None = None) -> ToolResponse:
        return ToolResponse(ok=True, data={"memories": []}, human_readable="Loaded memories.", source="backend")

    async def invoke(self, tool_name: str, **kwargs: Any) -> ToolResponse:
        if tool_name == "get_memory_summary":
            return await self.get_memory_summary(kwargs.get("authorization"))
        return ToolResponse(
            ok=False,
            data={"tool_name": tool_name},
            human_readable="Tool failed in test.",
            source="test",
            error_code="test_failure",
        )


class FakeLLM:
    def __init__(self, enabled: bool = True, data: dict[str, Any] | None = None, ok: bool = True) -> None:
        self.enabled = enabled
        self.data = data or {}
        self.ok = ok
        self.prompts: list[str] = []

    def is_enabled(self) -> bool:
        return self.enabled

    def generate_structured_with_metadata(self, system_prompt: str, user_prompt: str) -> StructuredLLMResult:
        self.prompts.append(user_prompt)
        return StructuredLLMResult(
            ok=self.ok,
            data=self.data,
            model_id="test-model",
            base_url="test-url",
            latency_ms=1,
            error_code=None if self.ok else "test_error",
            error_message=None if self.ok else "failed",
            fallback_used=not self.ok,
        )


class BadJsonMessage:
    content = "not json"


class BadJsonChoice:
    message = BadJsonMessage()


class BadJsonCompletions:
    @staticmethod
    def create(**kwargs: Any) -> Any:
        return type("Response", (), {"choices": [BadJsonChoice()]})()


class BadJsonClient:
    chat = type("Chat", (), {"completions": BadJsonCompletions()})()


def make_runtime(llm: FakeLLM | OpenAICompatibleLLMClient) -> HealthAgentRuntime:
    return HealthAgentRuntime(FakeStore(), FakeTools(), TraceLogger(), llm)  # type: ignore[arg-type]


class RemediationP0P2Tests(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_llm_uses_degraded_keyword_intent(self) -> None:
        runtime = make_runtime(FakeLLM(enabled=False))
        intent, metadata, degraded_reason = await runtime._classify_intent(
            PostMessageRequest(text="帮我看看今天怎么练"),
            {"recent_messages": []},
        )

        self.assertEqual(degraded_reason, "llm_disabled")
        self.assertIsNone(metadata)
        self.assertIn(intent["intent"], {"daily_guidance", "health_answer"})

    async def test_intent_classifier_uses_recent_context(self) -> None:
        llm = FakeLLM(
            data={
                "intent": "plan_adjust",
                "confidence": 0.91,
                "referenced_context": ["previous_plan"],
                "missing_fields": [],
                "risk_flags": [],
                "should_clarify": False,
                "clarifying_question": "",
                "write_domain": "plan",
            }
        )
        runtime = make_runtime(llm)
        context = await runtime._load_conversation_context("thread-1", "按刚才那个改轻一点", None)
        intent, metadata, degraded_reason = await runtime._classify_intent(PostMessageRequest(text="按刚才那个改轻一点"), context)

        self.assertIsNone(degraded_reason)
        self.assertTrue(metadata.ok if metadata else False)
        self.assertEqual(intent["intent"], "plan_adjust")
        self.assertIn("message 14", llm.prompts[-1])
        self.assertNotIn("message 0", llm.prompts[-1])

    async def test_low_confidence_classifier_clarifies(self) -> None:
        runtime = make_runtime(FakeLLM(data={"intent": "unclear", "confidence": 0.2}))
        intent, _, _ = await runtime._classify_intent(PostMessageRequest(text="那个呢"), {"recent_messages": []})

        self.assertTrue(intent["should_clarify"])
        self.assertTrue(intent["clarifying_question"])

    async def test_planner_filters_non_whitelisted_tools(self) -> None:
        runtime = make_runtime(FakeLLM())
        planner = runtime._normalize_planner_decision(
            {
                "action": "answer",
                "tools": [
                    {"name": "delete_database", "arguments": {}, "purpose": "bad"},
                    {"name": "get_memory_summary", "arguments": {}, "purpose": "good"},
                ],
            },
            {"action": "answer", "tools": [], "risk_level": "low"},
        )

        self.assertEqual([tool["name"] for tool in planner["tools"]], ["get_memory_summary"])

    async def test_virtual_proposal_tool_generates_proposals_without_execution(self) -> None:
        store = FakeStore()
        runtime = HealthAgentRuntime(store, FakeTools(), TraceLogger(), FakeLLM())  # type: ignore[arg-type]
        observations, tool_events, proposals, warnings = await runtime._execute_planner_tools(
            "thread-1",
            "run-1",
            PostMessageRequest(text="记住我不喜欢跑步"),
            {
                "tools": [
                    {
                        "name": "create_action_proposal",
                        "arguments": {"write_domain": "memory"},
                        "purpose": "memory proposal",
                    }
                ],
                "write_domain": "memory",
            },
            None,
        )

        self.assertEqual(warnings, [])
        self.assertEqual(len(proposals), 1)
        self.assertEqual(proposals[0]["actionType"], "create_coaching_memory")
        self.assertTrue(any(event.tool_name == "create_action_proposal" for event in tool_events))
        self.assertTrue(store.tool_logs)
        self.assertTrue(any(item["tool"] == "create_action_proposal" for item in observations))


class LLMClientMetadataTests(unittest.TestCase):
    def test_structured_metadata_reports_json_parse_failure(self) -> None:
        client = OpenAICompatibleLLMClient()
        client._enabled = True
        client._client = BadJsonClient()

        result = client.generate_structured_with_metadata("Return JSON.", "Return JSON.")

        self.assertFalse(result.ok)
        self.assertEqual(result.error_code, "json_parse_error")
        self.assertTrue(result.fallback_used)


if __name__ == "__main__":
    unittest.main()
