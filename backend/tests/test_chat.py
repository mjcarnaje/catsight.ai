"""The chat agent and its SSE API, driven by a scripted model (no LLM calls)."""
import json
from functools import lru_cache
from typing import Any

import pytest
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langgraph.checkpoint.memory import InMemorySaver

from app.constant import DocumentStatus
from app.models import Chat, Document, UsageEvent
from app.services import agent, chats, indexing, llm
from app.services.extraction import Page, join_pages
from app.views import chat as chat_views


class ScriptedModel(BaseChatModel):
    """Replies with the next scripted message, whatever it's asked."""

    script: Any  # shared queue; a `list` field would be copied per instance by pydantic

    @property
    def _llm_type(self) -> str:
        return "scripted"

    def bind_tools(self, tools, **kwargs):
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        return ChatResult(generations=[ChatGeneration(message=self.script.pop(0))])


def search_call(query: str, call_id: str = "call-1") -> AIMessage:
    return AIMessage("", tool_calls=[{"name": "search_documents", "args": {"query": query}, "id": call_id}])


@pytest.fixture
def script(monkeypatch):
    """Queue of replies shared by every model the agent builds."""
    replies: list = []
    monkeypatch.setattr(llm, "get_chat_model", lambda *a, **k: ScriptedModel(script=replies))
    monkeypatch.setattr(llm, "get_fast_model", lambda *a, **k: ScriptedModel(script=replies))
    graph = lru_cache(maxsize=1)(lambda: agent.build_graph(InMemorySaver()))
    monkeypatch.setattr(chat_views, "get_agent", graph)
    monkeypatch.setattr(chats, "get_agent", graph)
    return replies


@pytest.fixture
def library(admin):
    document = Document.objects.create(
        title="Renewal of the Designation of the MICeL Director", reference_number="Special Order No. 01176-IIT, s. 2022",
        year=2022, uploaded_by=admin, status=DocumentStatus.READY.value, file="x.pdf",
    )
    indexing.index_document(document, join_pages([Page(1, "Prof. A is designated Director of the MSU-IIT Center for eLearning (MICeL).")]))
    return document


def events(response) -> list[tuple[str, dict]]:
    body = b"".join(response.streaming_content).decode()
    parsed = []
    for block in body.strip().split("\n\n"):
        name, data = block.split("\n", 1)
        parsed.append((name.removeprefix("event: "), json.loads(data.removeprefix("data: "))))
    return parsed


def ask(client, **body):
    return client.post("/api/chats/stream/", body, format="json")


# The search tool runs on LangGraph's worker thread with its own database connection,
# so these tests commit their data instead of using a rolled-back transaction.
chat_db = pytest.mark.django_db(transaction=True)


@chat_db
def test_answer_streams_search_sources_answer_and_title(api, admin, library, script):
    script += [search_call("MICeL director"), AIMessage("Prof. A directs MICeL [1]."), AIMessage("MICeL Director Designation")]
    stream = events(ask(api(admin), question="Who is the director of MICeL?"))

    names = [name for name, _ in stream]
    assert names == ["start", "search", "sources", "answer", "title", "done"]
    data = dict(stream)
    assert data["search"] == {"query": "MICeL director"}
    assert [(s["n"], s["id"]) for s in data["sources"]["sources"]] == [(1, library.id)]
    answer = data["answer"]["message"]
    assert answer["content"] == "Prof. A directs MICeL [1]."
    assert answer["searches"] == ["MICeL director"] and answer["sources"][0]["passages"]

    chat = Chat.objects.get(pk=data["start"]["chat"]["id"])
    assert chat.title == data["title"]["title"] == "MICeL Director Designation"
    assert UsageEvent.objects.filter(user=admin, kind="message").count() == 1


@chat_db
def test_history_folds_searches_into_answers_and_regenerate_replaces_the_turn(api, admin, library, script):
    client = api(admin)
    script += [search_call("MICeL"), AIMessage("First answer [1]."), AIMessage("Title")]
    start = dict(events(ask(client, question="Who directs MICeL?")))["start"]
    chat_id, question_id = start["chat"]["id"], start["question"]["id"]

    history = client.get(f"/api/chats/{chat_id}/messages/").json()["messages"]
    assert [(m["role"], m["content"]) for m in history] == [("user", "Who directs MICeL?"), ("assistant", "First answer [1].")]
    assert history[1]["sources"][0]["n"] == 1

    script += [AIMessage("Second answer.")]
    regenerated = dict(events(ask(client, chat_id=chat_id, replace_from=question_id)))
    assert regenerated["start"]["question"]["content"] == "Who directs MICeL?"
    history = client.get(f"/api/chats/{chat_id}/messages/").json()["messages"]
    assert [(m["role"], m["content"]) for m in history] == [("user", "Who directs MICeL?"), ("assistant", "Second answer.")]


@chat_db
def test_citation_numbers_carry_across_searches_in_one_answer(api, admin, library, script):
    other = Document.objects.create(title="Travel Order", uploaded_by=admin, status="ready", file="y.pdf")
    indexing.index_document(other, join_pages([Page(1, "Travel to Zamboanga for MICeL training.")]))
    script += [search_call("MICeL director", "c1"), search_call("MICeL training travel", "c2"), AIMessage("Done [1][2]."), AIMessage("T")]
    data = dict(events(ask(api(admin), question="Tell me about MICeL")))
    numbers = {s["id"]: s["n"] for s in data["answer"]["message"]["sources"]}
    assert numbers[library.id] == 1 and numbers[other.id] == 2


@chat_db
def test_chats_are_private_and_limits_return_429(api, admin, member, library, script, settings):
    script += [AIMessage("Hi!"), AIMessage("Greeting")]
    chat_id = dict(events(ask(api(admin), question="Hello")))["start"]["chat"]["id"]
    assert api(member).get(f"/api/chats/{chat_id}/messages/").status_code == 404
    assert ask(api(member), chat_id=chat_id, question="Mine now?").status_code == 404

    settings.DEMO_MODE = True
    settings.DEMO_DAILY_MESSAGES = 0  # 0 disables the limit
    UsageEvent.objects.create(user=member, kind="message")
    settings.DEMO_DAILY_MESSAGES = 1
    response = ask(api(member), question="One more?")
    assert response.status_code == 429 and response.json()["code"] == "message_limit"


@pytest.mark.django_db
def test_deleting_a_chat_removes_its_checkpoints(api, admin, monkeypatch):
    deleted = []

    class Saver:
        def delete_thread(self, thread_id):
            deleted.append(thread_id)

    monkeypatch.setattr(chats, "get_checkpointer", lambda: Saver())
    chat = Chat.objects.create(user=admin)
    assert api(admin).delete(f"/api/chats/{chat.id}/").status_code == 204
    assert deleted == [chat.thread_id] and not Chat.objects.exists()


def test_sse_frames_survive_newlines_and_quotes():
    frame = chat_views.sse("token", {"text": 'line one\n"quoted"'})
    assert frame.count("\n\n") == 1 and json.loads(frame.split("data: ", 1)[1]) == {"text": 'line one\n"quoted"'}


@chat_db
def test_a_failed_answer_is_not_charged(api, guest, script, settings, monkeypatch):
    settings.DEMO_MODE = True

    def broken(*args, **kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(llm, "get_chat_model", broken)
    stream = events(ask(api(guest), question="Anything?"))
    assert [name for name, _ in stream][-2:] == ["error", "done"]
    assert not UsageEvent.objects.filter(user=guest, kind="message").exists()
