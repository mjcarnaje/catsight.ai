from app.services.extraction import marker_llm_options


def test_marker_llm_mode_uses_the_vision_model_through_openrouter(settings):
    settings.LLM_PROVIDER = "openrouter"
    settings.OPENROUTER_API_KEY = "test-key"
    settings.OCR_MODEL = "qwen/qwen3-vl-30b-a3b-instruct"
    settings.MARKER_USE_LLM = True
    options = marker_llm_options()
    assert options["use_llm"] is True
    assert options["llm_service"] == "marker.services.openrouter.OpenRouterService"
    assert options["openrouter_model"] == "qwen/qwen3-vl-30b-a3b-instruct"
    assert options["openrouter_api_key"] == "test-key"


def test_marker_llm_mode_uses_a_local_vision_model_with_ollama(settings):
    settings.LLM_PROVIDER = "ollama"
    settings.OCR_MODEL = "qwen3-vl:8b"
    settings.MARKER_USE_LLM = True
    options = marker_llm_options()
    assert options["llm_service"] == "marker.services.ollama.OllamaService"
    assert options["ollama_model"] == "qwen3-vl:8b"


def test_marker_llm_mode_is_off_without_a_vision_model_or_when_disabled(settings):
    settings.LLM_PROVIDER = "ollama"
    settings.OCR_MODEL = ""
    assert marker_llm_options() == {"use_llm": False}
    settings.LLM_PROVIDER = "openrouter"
    settings.OCR_MODEL = "qwen/qwen3-vl-30b-a3b-instruct"
    settings.MARKER_USE_LLM = False
    assert marker_llm_options() == {"use_llm": False}
