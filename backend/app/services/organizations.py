"""Organizations: which one a request acts in, creating one, and tag presets.

Every request that touches data names its organization in the X-Organization
header (the slug). Without the header, the user's oldest membership is used, so
someone in a single organization never has to choose. A header naming an
organization the user doesn't belong to is refused, never silently replaced.
"""
from __future__ import annotations

from typing import Optional

from django.db import transaction
from django.utils.text import slugify

from ..constant import OrgRole
from ..models import Membership, Organization, Tag

HEADER = "HTTP_X_ORGANIZATION"

# Tags a new organization starts with. Descriptions matter: the cataloguer picks
# tags by them. "msu-iit" is the thesis deployment's list.
TAG_PRESETS: dict[str, dict[str, str]] = {
    "general": {
        "Report": "A report, study, assessment or review of findings.",
        "Contract": "An agreement, contract, memorandum of agreement or understanding.",
        "Policy": "Rules, guidelines, manuals or procedures, and amendments to them.",
        "Memo": "An internal memorandum, notice or circular that informs or instructs.",
        "Letter": "Correspondence to or from a person or another organization.",
        "Finance": "Budgets, invoices, receipts, fees, payroll and other financial records.",
        "Other": "Fits none of the other tags.",
    },
    "msu-iit": {
        "Special Order": "An order from the Chancellor's office (e.g. 'Special Order No. 01592-IIT, Series of 2023') for a specific personnel or administrative action.",
        "Board Resolution": "A resolution of the MSU Board of Regents (BOR), often an excerpt from the minutes of a BOR meeting.",
        "Memorandum": "An internal memo that informs, instructs or clarifies a decision.",
        "University Circular": "A general communication sent across the university about policies or events.",
        "Designation": "Appointing, renewing or relieving someone as director, head, coordinator or officer-in-charge.",
        "Incentive": "Cash incentives, awards or grants for publications, paper presentations or other achievements.",
        "Travel Order": "Permission or authority for faculty, staff or students to travel on official business.",
        "Charter Day": "MSU-IIT's founding anniversary: committees, activities and events.",
        "Suspension": "Suspension of classes, work or activities, or of a person or a rule.",
        "Policy": "Rules, guidelines, manuals, curricula or amendments that govern the university.",
        "Academic Calendar": "Dates of semesters, enrollment, exams, holidays and breaks.",
        "Finance": "Budgets, fees, honoraria, funds and other financial matters.",
        "Other": "Fits none of the other tags.",
    },
}
DEFAULT_PRESET = "general"


class OrganizationRequired(Exception):
    """The request can't be served in any organization; `code` tells the client why."""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.message = message
        self.code = code


def requested_slug(request) -> str:
    """The X-Organization header, if the client sent one."""
    meta = getattr(request, "META", {})
    return str(meta.get(HEADER, "")).strip()


def membership_for(user, slug: str = "") -> Optional[Membership]:
    """The user's membership in `slug`, or their oldest membership when no slug is given."""
    if not (user and user.is_authenticated):
        return None
    memberships = Membership.objects.filter(user=user).select_related("organization", "user")
    if slug:
        return memberships.filter(organization__slug=slug).first()
    return memberships.order_by("created_at", "id").first()


def resolve(request) -> Membership:
    """The membership a request acts through; raises OrganizationRequired if there is none."""
    slug = requested_slug(request)
    membership = membership_for(request.user, slug)
    if membership is not None:
        return membership
    if slug:
        raise OrganizationRequired("You're not a member of that organization.", "not_a_member")
    raise OrganizationRequired(
        "You're not in an organization yet. Ask an organization admin for an invitation.", "no_organization"
    )


def unique_slug(name: str, wanted: str = "") -> str:
    """A free slug from `wanted` (or the name): "acme", then "acme-2", "acme-3", ..."""
    base = slugify(wanted or name)[:50] or "organization"
    slug, n = base, 2
    while Organization.objects.filter(slug=slug).exists():
        slug = f"{base}-{n}"
        n += 1
    return slug


@transaction.atomic
def create_organization(name: str, slug: str = "", preset: str = DEFAULT_PRESET, admin=None) -> Organization:
    """A new organization with the preset's tags, and `admin` (a User) as its admin if given."""
    if preset not in TAG_PRESETS:
        raise ValueError(f"Unknown tag preset {preset!r}; choose {', '.join(TAG_PRESETS)}.")
    organization = Organization.objects.create(name=name.strip(), slug=unique_slug(name, slug))
    apply_preset(organization, preset)
    if admin is not None:
        Membership.objects.create(user=admin, organization=organization, role=OrgRole.ADMIN.value)
    return organization


def apply_preset(organization: Organization, preset: str) -> int:
    """Add the preset's tags the organization doesn't have yet; returns how many were added."""
    existing = set(Tag.objects.filter(organization=organization).values_list("name", flat=True))
    tags = [
        Tag(organization=organization, name=name, description=description)
        for name, description in TAG_PRESETS[preset].items()
        if name not in existing
    ]
    Tag.objects.bulk_create(tags)
    return len(tags)


def admin_count(organization: Organization) -> int:
    return Membership.objects.filter(organization=organization, role=OrgRole.ADMIN.value).count()
