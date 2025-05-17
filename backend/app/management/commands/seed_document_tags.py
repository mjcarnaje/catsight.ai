from django.core.management.base import BaseCommand
from django.db import transaction
from app.models import User, Tag

class Command(BaseCommand):
    help = 'Seed document tags'

    # Tag data copied from migration
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

    def handle(self, *args, **options):
        with transaction.atomic():
            # Get the first user in the database
            admin_user = User.objects.first()
            
            if not admin_user:
                self.stdout.write(self.style.ERROR('No users found in the database. Please create a user first.'))
                return
            
            created_count = 0
            existing_count = 0
            
            # Create tags using the first user as author
            for tag_data in self.tags_data:
                tag, created = Tag.objects.get_or_create(
                    name=tag_data['type'],
                    defaults={
                        'description': tag_data['description'],
                        'author': admin_user
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    existing_count += 1
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully seeded tags. Created: {created_count}, Already existed: {existing_count}'
                )
            ) 