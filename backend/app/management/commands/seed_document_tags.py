from django.core.management.base import BaseCommand
from django.db import transaction
from app.models import User, Tag

class Command(BaseCommand):
    help = 'Seed document tags'

    tags_data = [
        {
            "type": "Designation",
            "description": "Official appointments or assignments to positions within the organization."
        },
        {
            "type": "Policy",
            "description": "Formal guidelines and rules governing institutional operations and conduct."
        },
        {
            "type": "Incentive",
            "description": "Rewards or benefits provided to motivate performance or achievement."
        },
        {
            "type": "Travel Order",
            "description": "Official authorization for university-related travel, usually for staff or faculty."
        },
        {
            "type": "Charter Day",
            "description": "Documents related to the founding celebration or anniversary of the institution."
        },
        {
            "type": "Suspension",
            "description": "Temporary prohibition or interruption of activities, services, or academic sessions."
        },
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
            "type": "Financial Reports",
            "description": "Documents detailing the university's financial activities, budgets, expenditures, and audits."
        },
        {
            "type": "Meeting Minutes",
            "description": "Official written records of discussions, decisions, and actions from formal meetings."
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