from django.db import migrations
import json
import logging

logger = logging.getLogger(__name__)

def convert_favorite_models(apps, schema_editor):
    """
    Convert favorite_llm_models from CharField to JSON array in TextField
    """
    User = apps.get_model("app", "User")
    
    # Loop through all users
    for user in User.objects.all():
        try:
            # If the field already contains valid JSON, leave it alone
            if user.favorite_llm_models and user.favorite_llm_models.startswith('['):
                try:
                    # Verify it's valid JSON
                    json.loads(user.favorite_llm_models)
                    logger.info(f"User {user.id} already has valid JSON: {user.favorite_llm_models}")
                    continue
                except json.JSONDecodeError:
                    # Invalid JSON, so we'll fix it below
                    pass
            
            # If old value exists but isn't JSON, convert it to a JSON array with a single value
            if user.favorite_llm_models and not user.favorite_llm_models.startswith('['):
                value = user.favorite_llm_models.strip('"\'')
                user.favorite_llm_models = json.dumps([value])
                logger.info(f"Converted user {user.id} from '{value}' to {user.favorite_llm_models}")
                user.save()
            # If no value, set as empty array
            elif user.favorite_llm_models is None or user.favorite_llm_models == '':
                user.favorite_llm_models = json.dumps([])
                logger.info(f"Set empty array for user {user.id}")
                user.save()
        except Exception as e:
            logger.error(f"Error converting favorite_llm_models for user {user.id}: {e}")


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0004_merge_20250420_0547'),  # Updated to the latest migration
    ]

    operations = [
        migrations.RunPython(convert_favorite_models),
    ]