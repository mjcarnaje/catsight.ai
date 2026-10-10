"""Set an organization's name or AI provider from the command line (as the super admin would).

    python manage.py configure_organization default --name "MSU-IIT"
    OPENROUTER_API_KEY=... python manage.py configure_organization default \\
        --provider openrouter --api-key-env OPENROUTER_API_KEY [--if-unconfigured] [--check]

The key is read from the named environment variable, never from the command line,
so it doesn't end up in shell history or process lists. Models keep the provider's
defaults; admins can change them in Settings → AI provider. If the documents were
embedded by another model, nothing changes unless --reindex re-queues them.
"""
import os

from django.core.management.base import BaseCommand, CommandError

from app.constant import DocumentStatus, Provider
from app.models import Document, Organization
from app.services import llm, secrets
from app.tasks import tasks

PROVIDERS = [p.value for p in Provider] + ["none"]


class Command(BaseCommand):
    help = "Rename an organization or set its AI provider and key."

    def add_arguments(self, parser):
        parser.add_argument("slug", help="The organization's slug")
        parser.add_argument("--name", help="A new name")
        parser.add_argument("--provider", choices=PROVIDERS, help="openrouter, openai, ollama, or none (read-only)")
        parser.add_argument("--api-key-env", help="Environment variable holding the key (openrouter, openai)")
        parser.add_argument("--allow-ollama", action="store_true", help="Let the organization use this server's Ollama")
        parser.add_argument("--if-unconfigured", action="store_true", help="Leave a provider that is already set alone")
        parser.add_argument("--check", action="store_true", help="Prove the key with one embedding and one tiny chat call")
        parser.add_argument("--reindex", action="store_true", help="Re-embed documents made by another embedding model")

    def handle(self, slug, name, provider, api_key_env, allow_ollama, if_unconfigured, check, reindex, **options):
        organization = Organization.objects.filter(slug=slug).first()
        if organization is None:
            raise CommandError(f"No organization with the slug {slug!r}")

        if name is not None:
            name = name.strip()
            if not 1 <= len(name) <= 200:
                raise CommandError("The name must be 1 to 200 characters.")
            organization.name = name
            organization.save(update_fields=["name", "updated_at"])
            self.stdout.write(f"Renamed {slug} to {name}.")
        if allow_ollama and not organization.ollama_allowed:
            organization.ollama_allowed = True
            organization.save(update_fields=["ollama_allowed", "updated_at"])
            self.stdout.write(f"{organization.name} may use this server's Ollama.")

        if provider is None:
            return
        if if_unconfigured and organization.ai_provider:
            self.stdout.write(f"{organization.name} already uses {organization.ai_provider}; left as it is.")
            return
        if provider == "none":
            organization.ai_provider, organization.ai_api_key, organization.ai_api_key_last4 = "", "", ""
            organization.save(update_fields=["ai_provider", "ai_api_key", "ai_api_key_last4", "updated_at"])
            self.stdout.write(self.style.SUCCESS(f"{organization.name} has no AI provider now (read-only)."))
            return

        key = ""
        if provider == Provider.OLLAMA.value:
            if not organization.ollama_allowed:
                raise CommandError("This organization may not use Ollama; add --allow-ollama.")
        else:
            if not api_key_env:
                raise CommandError(f"{provider} needs a key: pass --api-key-env with the variable that holds it.")
            key = os.environ.get(api_key_env, "").strip()
            if not key:
                raise CommandError(f"The environment variable {api_key_env} is empty or not set.")

        models = {field: getattr(organization, field) for field in
                  ("chat_model", "fast_model", "ocr_model", "embedding_model", "reranker_model")}
        cfg = llm.build_settings(provider, key, **models)
        if check:
            try:
                llm.check(cfg)
            except Exception as e:  # the provider's own message, without the key
                message = str(e).replace(key, "[redacted]") if key else str(e)
                raise CommandError(f"The provider check failed: {message}")

        stale = Document.objects.filter(
            organization=organization, status=DocumentStatus.READY.value, is_failed=False, chunk_count__gt=0,
        ).exclude(embedding_model=cfg.embedding_signature)
        if stale.exists() and not reindex:
            raise CommandError(
                f"{stale.count()} documents were embedded by another model than {cfg.embedding_signature}; "
                "pass --reindex to re-embed them with this provider (it spends the organization's credit)."
            )

        organization.ai_provider = provider
        organization.ai_api_key = secrets.encrypt(key) if key else ""
        organization.ai_api_key_last4 = key[-4:] if len(key) >= 8 else ""
        organization.save(update_fields=["ai_provider", "ai_api_key", "ai_api_key_last4", "updated_at"])
        self.stdout.write(self.style.SUCCESS(f"{organization.name} now uses {provider}."))
        if stale.exists():
            documents = list(stale)
            for document in documents:
                tasks.reprocess(document, DocumentStatus.INDEXING)
            self.stdout.write(f"Re-embedding {len(documents)} documents.")
