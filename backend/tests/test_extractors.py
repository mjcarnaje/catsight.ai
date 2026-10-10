from app.services import llm
from app.services.extraction import available_extractors, default_extractor, marker_llm_options, strip_marker_images


def test_marker_llm_mode_uses_the_organizations_vision_model_through_openrouter(settings):
    settings.MARKER_USE_LLM = True
    cfg = llm.build_settings("openrouter", "test-key", ocr_model="qwen/qwen3-vl-30b-a3b-instruct")
    options = marker_llm_options(cfg)
    assert options["use_llm"] is True
    assert options["llm_service"] == "app.services.marker_services.CappedOpenRouterService"
    assert options["openrouter_model"] == "qwen/qwen3-vl-30b-a3b-instruct"
    assert options["openrouter_api_key"] == "test-key"
    assert options["openrouter_base_url"] == settings.OPENROUTER_BASE_URL


def test_marker_llm_mode_uses_openai_with_an_openai_key(settings):
    settings.MARKER_USE_LLM = True
    cfg = llm.build_settings("openai", "sk-openai")
    options = marker_llm_options(cfg)
    assert options["llm_service"] == "app.services.marker_services.CappedOpenAIService"
    assert options["openai_api_key"] == "sk-openai"
    assert options["openai_model"] == settings.PROVIDER_DEFAULTS["openai"]["ocr_model"]
    assert options["openai_base_url"] == settings.OPENAI_BASE_URL


def test_marker_llm_mode_uses_a_local_vision_model_with_ollama(settings):
    settings.MARKER_USE_LLM = True
    options = marker_llm_options(llm.build_settings("ollama", ocr_model="qwen3-vl:8b"))
    assert options["llm_service"] == "marker.services.ollama.OllamaService"
    assert options["ollama_model"] == "qwen3-vl:8b"
    assert options["ollama_base_url"] == settings.OLLAMA_BASE_URL


def test_marker_llm_mode_is_off_without_a_vision_model_or_when_disabled(settings):
    settings.MARKER_USE_LLM = True
    assert marker_llm_options(llm.build_settings("ollama")) == {"use_llm": False}  # no default OCR model
    assert marker_llm_options(llm.build_settings("openrouter", "k", ocr_model="none")) == {"use_llm": False}
    assert marker_llm_options(None) == {"use_llm": False}
    settings.MARKER_USE_LLM = False
    assert marker_llm_options(llm.build_settings("openrouter", "k")) == {"use_llm": False}


def test_vision_extraction_needs_a_hosted_provider_with_an_ocr_model(settings):
    settings.DEFAULT_TEXT_EXTRACTOR = "vision"
    assert "vision" in available_extractors(llm.build_settings("openai", "k"))
    assert "vision" not in available_extractors(llm.build_settings("ollama"))
    assert "vision" not in available_extractors(llm.build_settings("openrouter", "k", ocr_model="none"))
    assert "vision" not in available_extractors(None)
    assert default_extractor(llm.build_settings("openrouter", "k")) == "vision"


def test_marker_image_links_are_removed():
    text = "{0}" + "-" * 48 + "\n\n![](_page_0_Picture_15.jpeg)\n\nSPECIAL ORDER\n![logo](_page_0_Figure_2.png) No. 01592-IIT"
    assert strip_marker_images(text) == "{0}" + "-" * 48 + "\n\nSPECIAL ORDER\nNo. 01592-IIT"
