"""Readable messages for failures shown in the UI (details stay in the logs)."""
import httpx
import openai

from .extraction import ExtractorUnavailable
from .llm import AINotConfigured


def describe_error(error: Exception) -> str:
    if isinstance(error, (AINotConfigured, ExtractorUnavailable, ValueError)):
        return str(error)
    if isinstance(error, openai.AuthenticationError):
        return "The AI provider rejected the API key. An organization admin can update it in Settings."
    if getattr(error, "status_code", None) == 402:
        return "The AI provider's credit limit was reached. Try again later."
    if isinstance(error, openai.RateLimitError):
        return "The AI provider is rate-limiting requests. Retry in a minute."
    if isinstance(error, (openai.APIConnectionError, openai.APITimeoutError, httpx.TransportError)):
        return "Couldn't reach the AI provider. Retry when the connection is back."
    if isinstance(error, openai.APIError):
        return f"The AI provider returned an error: {error.message}"[:500]
    return f"Unexpected error ({error.__class__.__name__}). The details are in the server logs."
