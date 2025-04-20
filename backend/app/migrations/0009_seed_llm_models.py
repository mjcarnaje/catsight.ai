from django.db import migrations

def create_llm_models(apps, schema_editor):
    LLMModel = apps.get_model("app", "LLMModel")
    data = [
        {
            'code': 'llama3.2:1b',
            'name': 'Llama 3.2 1B',
            'description': (
                'Llama 3.2 1B is a lightweight, multilingual large language model '
                'developed by Meta. Optimized for dialogue, summarization, '
                'and retrieval tasks, it offers fast, accurate responses suitable '
                'for edge devices and mobile applications.'
            ),
            'logo': 'https://avatars.githubusercontent.com/u/153379578?s=200&v=4',
        },
        {
            'code': 'deepseek-r1:1.5b',
            'name': 'DeepSeek R1 1.5B',
            'description': (
                'DeepSeek R1 1.5B is a distilled large language model based on '
                'the Qwen architecture. It excels in mathematical reasoning and '
                'competitive programming tasks, outperforming larger models like '
                'GPT-4o and Claude 3.5 in specific benchmarks.'
            ),
            'logo': 'https://avatars.githubusercontent.com/u/148330874?s=200&v=4',
        },
    ]

    for entry in data:
        LLMModel.objects.update_or_create(
            code=entry['code'],
            defaults={
                'name': entry['name'],
                'description': entry['description'],
                'logo': entry['logo'],
            }
        )

def delete_llm_models(apps, schema_editor):
    LLMModel = apps.get_model("app", "LLMModel")
    for code in ["llama3.2:1b", "deepseek-r1:1.5b"]:
        LLMModel.objects.filter(code=code).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0008_llmmodel_remove_user_favorite_llm_models_and_more'),
    ]

    operations = [
        migrations.RunPython(create_llm_models, delete_llm_models),
    ]