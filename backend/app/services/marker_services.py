"""Marker LLM service with a cap on the length of each reply.

Marker's OpenRouter service sends no max_tokens. When the vision model falls into a
repetition loop (it happens on signature regions), it keeps generating until its
context is full, and the keep-alive bytes OpenRouter sends during long generations
stop the read timeout from ever firing: one region could stall a document for many
minutes. Loaded by Marker from its class path (see extraction.marker_llm_options).
"""
from marker.services.openrouter import OpenRouterService

MAX_OUTPUT_TOKENS = 4096  # a corrected table or form is far shorter; a loop stops within a minute


class CappedOpenRouterService(OpenRouterService):
    def get_client(self):
        client = super().get_client()
        parse = client.chat.completions.parse

        def capped_parse(*args, **kwargs):
            kwargs.setdefault("max_tokens", MAX_OUTPUT_TOKENS)
            return parse(*args, **kwargs)

        client.chat.completions.parse = capped_parse
        return client
