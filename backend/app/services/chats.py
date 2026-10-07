"""Chat persistence helpers around the LangGraph checkpoint of each chat."""
from __future__ import annotations

import logging
from typing import Any, Optional

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, RemoveMessage, ToolMessage

from ..models import Chat
from .agent import get_agent, get_checkpointer, merge_sources, text_of

logger = logging.getLogger(__name__)


def config_for(chat: Chat, **configurable: Any) -> dict:
    return {"configurable": {"thread_id": chat.thread_id, **configurable}}


def saved_messages(chat: Chat) -> list[AnyMessage]:
    state = get_agent().get_state(config_for(chat))
    return list(state.values.get("messages", [])) if state and state.values else []


def serialize_user(message: HumanMessage) -> dict[str, Any]:
    return {"id": message.id, "role": "user", "content": text_of(message)}


def serialize_answer(message: AIMessage, turn: list[AnyMessage]) -> dict[str, Any]:
    """An answer with the searches that led to it and their numbered sources."""
    return {
        "id": message.id,
        "role": "assistant",
        "content": text_of(message),
        "searches": [
            call["args"].get("query", "")
            for m in turn if isinstance(m, AIMessage)
            for call in m.tool_calls
        ],
        "sources": merge_sources([m for m in turn if isinstance(m, ToolMessage)]),
    }


def serialize_conversation(messages: list[AnyMessage]) -> list[dict[str, Any]]:
    """Questions and answers for the UI; search steps fold into the answer they fed."""
    conversation: list[dict[str, Any]] = []
    turn: list[AnyMessage] = []
    for message in messages:
        if isinstance(message, HumanMessage):
            conversation.append(serialize_user(message))
            turn = []
        elif isinstance(message, AIMessage) and not message.tool_calls:
            conversation.append(serialize_answer(message, turn))
            turn = []
        else:
            turn.append(message)
    return conversation


def truncate_from(chat: Chat, message_id: str) -> Optional[str]:
    """Delete a question and everything after it; returns that question's text.

    Used to regenerate an answer (re-ask the same question) and to edit a question.
    """
    messages = saved_messages(chat)
    index = next((i for i, m in enumerate(messages) if m.id == message_id), None)
    if index is None or not isinstance(messages[index], HumanMessage):
        return None
    get_agent().update_state(
        config_for(chat),
        {"messages": [RemoveMessage(id=m.id) for m in messages[index:]]},
        as_node="assistant",
    )
    return text_of(messages[index])


def delete_chat(chat: Chat) -> None:
    """Delete the chat and its LangGraph checkpoints."""
    try:
        get_checkpointer().delete_thread(chat.thread_id)
    except Exception:
        logger.warning(f"Couldn't delete checkpoints of chat {chat.id}", exc_info=True)
    chat.delete()
