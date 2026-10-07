"""Create or update the super admin from ADMIN_EMAIL / ADMIN_PASSWORD (idempotent)."""
import os

from django.core.management.base import BaseCommand, CommandError

from app.constant import UserRole
from app.models import User


class Command(BaseCommand):
    help = "Create or update the super admin from ADMIN_EMAIL and ADMIN_PASSWORD."

    def handle(self, **options):
        email = os.getenv("ADMIN_EMAIL", "").strip().lower()
        password = os.getenv("ADMIN_PASSWORD", "")
        if not email or not password:
            raise CommandError("Set ADMIN_EMAIL and ADMIN_PASSWORD")
        user, created = User.objects.get_or_create(email=email, defaults={"username": email})
        user.role = UserRole.SUPER_ADMIN.value
        user.is_staff = user.is_superuser = True
        user.first_name = user.first_name or os.getenv("ADMIN_FIRST_NAME", "Admin")
        user.last_name = user.last_name or os.getenv("ADMIN_LAST_NAME", "")
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} super admin {email}"))
