from django.db import migrations

tags_data = [
    {
        "type": "Special Orders",
        "description": "Official instructions or mandates issued for specific administrative or personnel actions."
    },
    {
        "type": "Memorandums",
        "description": "Internal communication used to inform, instruct, or clarify policies and decisions."
    },
    {
        "type": "University Circulars",
        "description": "General communications sent to a wide audience within the university, often regarding policies or events."
    },
    {
        "type": "Academic Calendars",
        "description": "Schedules outlining key academic dates such as semester start/end, holidays, and exam periods."
    },
    {
        "type": "Board Resolutions",
        "description": "Formal decisions or actions approved by the university's board or governing body."
    },
    {
        "type": "University Announcements",
        "description": "Public or internal statements regarding major updates, achievements, or institutional news."
    },
    {
        "type": "Student Policies",
        "description": "Guidelines and rules specifically governing student behavior, rights, and responsibilities."
    },
    {
        "type": "Faculty Directives",
        "description": "Instructions or policies directed at academic staff regarding teaching, conduct, or administrative tasks."
    },
    {
        "type": "Administrative Notices",
        "description": "General notifications related to operational or procedural matters within the university."
    },
    {
        "type": "Campus Bulletins",
        "description": "Informal or brief announcements about events, updates, or general information for the campus community."
    },
    {
        "type": "Travel Orders",
        "description": "Official authorization for university-related travel, usually for staff or faculty."
    },
    {
        "type": "Research Publications",
        "description": "Academic output including journal articles, papers, or reports authored by university researchers."
    },
    {
        "type": "Financial Reports",
        "description": "Documents detailing the university's financial activities, budgets, expenditures, and audits."
    },
    {
        "type": "Meeting Minutes",
        "description": "Official written records of discussions, decisions, and actions from formal meetings."
    },
    {
        "type": "Accreditation Reports",
        "description": "Documentation submitted to or received from accrediting bodies assessing institutional quality and compliance."
    },
    {
        "type": "Grant Agreements",
        "description": "Contracts outlining terms and conditions for receiving and managing research or project funding."
    },
    {
        "type": "Campus Events",
        "description": "Notices or details about upcoming academic, cultural, or community events hosted by the university."
    },
    {
        "type": "Other",
        "description": "Documents that do not fit any of the above categories; requires further classification or human review."
    }
]

def seed_tags(apps, schema_editor):
    User = apps.get_model('app', 'User')
    Tag = apps.get_model('app', 'Tag')
    
    admin_user = User.objects.first()

    if admin_user:
        # Create tags using the admin user as author
        for tag_data in tags_data:
            Tag.objects.get_or_create(
                name=tag_data['type'],
                defaults={
                    'description': tag_data['description'],
                    'author': admin_user
                }
            )

def reverse_seed_tags(apps, schema_editor):
    Tag = apps.get_model('app', 'Tag')
    
    # Remove tags that match our list
    for tag_data in tags_data:
        Tag.objects.filter(name=tag_data['type']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0014_tag'),
    ]

    operations = [
        migrations.RunPython(seed_tags, reverse_seed_tags),
    ] 