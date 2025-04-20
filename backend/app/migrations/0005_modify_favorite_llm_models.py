from django.db import migrations, models
import json

def convert_favorite_models(apps, schema_editor):
    """
    Convert favorite_llm_models from CharField to TextField and store as JSON array
    """
    User = apps.get_model("app", "User")
    
    for user in User.objects.all():
        if user.favorite_llm_models and not user.favorite_llm_models.startswith('['):
            try:
                # Convert single value to JSON array
                user.favorite_llm_models = json.dumps([user.favorite_llm_models])
                user.save()
            except Exception as e:
                print(f"Error converting favorite_llm_models for user {user.id}: {e}")
        elif user.favorite_llm_models is None or user.favorite_llm_models == '':
            user.favorite_llm_models = json.dumps([])
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0004_merge_20250420_0547'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='favorite_llm_models',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.RunPython(convert_favorite_models),
    ] 