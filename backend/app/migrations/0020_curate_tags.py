"""One tag list that matches the corpus: document types plus topics.

The seed migration (0015) and the old seed command disagreed (plural vs singular,
different topics). Tags get descriptions because the summarizer picks tags by them.
"""
from django.db import migrations

TAGS = {
    # Document types
    "Special Order": "An order from the Chancellor's office (e.g. 'Special Order No. 01592-IIT, Series of 2023') for a specific personnel or administrative action.",
    "Board Resolution": "A resolution of the MSU Board of Regents (BOR), often an excerpt from the minutes of a BOR meeting.",
    "Memorandum": "An internal memo that informs, instructs or clarifies a decision.",
    "University Circular": "A general communication sent across the university about policies or events.",
    # Topics
    "Designation": "Appointing, renewing or relieving someone as director, head, coordinator or officer-in-charge.",
    "Incentive": "Cash incentives, awards or grants for publications, paper presentations or other achievements.",
    "Travel Order": "Permission or authority for faculty, staff or students to travel on official business.",
    "Charter Day": "MSU-IIT's founding anniversary: committees, activities and events.",
    "Suspension": "Suspension of classes, work or activities, or of a person or a rule.",
    "Policy": "Rules, guidelines, manuals, curricula or amendments that govern the university.",
    "Academic Calendar": "Dates of semesters, enrollment, exams, holidays and breaks.",
    "Finance": "Budgets, fees, honoraria, funds and other financial matters.",
    "Other": "Fits none of the other tags.",
}

RENAMES = {
    "Special Orders": "Special Order",
    "Board Resolutions": "Board Resolution",
    "Memorandums": "Memorandum",
    "University Circulars": "University Circular",
    "Travel Orders": "Travel Order",
    "Academic Calendars": "Academic Calendar",
    "Financial Reports": "Finance",
}


def curate(apps, schema_editor):
    Tag = apps.get_model("app", "Tag")
    for old, new in RENAMES.items():
        if Tag.objects.filter(name=old).exists() and not Tag.objects.filter(name=new).exists():
            Tag.objects.filter(name=old).update(name=new)
    for name, description in TAGS.items():
        Tag.objects.update_or_create(name=name, defaults={"description": description})
    # Drop seeded tags outside the list, unless someone already used them
    Tag.objects.exclude(name__in=TAGS).filter(documents__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [("app", "0019_catsight_v2")]
    operations = [migrations.RunPython(curate, migrations.RunPython.noop)]
