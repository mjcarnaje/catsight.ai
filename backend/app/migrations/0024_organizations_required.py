import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("app", "0023_organizations_data")]

    operations = [
        migrations.AlterField(
            model_name="document",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="documents", to="app.organization"
            ),
        ),
        migrations.AlterField(
            model_name="tag",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="tags", to="app.organization"
            ),
        ),
        migrations.AlterField(
            model_name="chat",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="chats", to="app.organization"
            ),
        ),
        migrations.AddConstraint(
            model_name="tag",
            constraint=models.UniqueConstraint(fields=("organization", "name"), name="unique_tag_name_per_org"),
        ),
    ]
