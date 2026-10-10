"""Marker LLM services with a cap on the length of each reply.

Marker's OpenRouter and OpenAI services send no output limit. When the vision model
falls into a repetition loop (it happens on signature regions), it keeps generating
until its context is full, and the keep-alive bytes OpenRouter sends during long
generations stop the read timeout from ever firing: one region could stall a
document for many minutes. Loaded by Marker from its class path (see
extraction.marker_llm_options).
"""
from marker.services.openai import OpenAIService
from marker.services.openrouter import OpenRouterService

MAX_OUTPUT_TOKENS = 4096  # a corrected table or form is far shorter; a loop stops within a minute


def _cap(client, parameter: str):
    parse = client.chat.completions.parse

    def capped_parse(*args, **kwargs):
        kwargs.setdefault(parameter, MAX_OUTPUT_TOKENS)
        return parse(*args, **kwargs)

    client.chat.completions.parse = capped_parse
    return client


class CappedOpenRouterService(OpenRouterService):
    def get_client(self):
        return _cap(super().get_client(), "max_tokens")


class CappedOpenAIService(OpenAIService):
    # OpenAI's reasoning models reject max_tokens; max_completion_tokens works for all of them
    def get_client(self):
        return _cap(super().get_client(), "max_completion_tokens")
