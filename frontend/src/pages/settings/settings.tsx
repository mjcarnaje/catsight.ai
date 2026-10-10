import { PageContainer, PageHeader } from "@/components/page-header";
import { AboutSection } from "@/components/settings/about-section";
import { AiProviderSection } from "@/components/settings/ai-provider-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { OrganizationSection } from "@/components/settings/organization-section";
import { ProfileSection } from "@/components/settings/profile-section";
import { SessionSection } from "@/components/settings/session-section";
import { UsageSection } from "@/components/settings/usage-section";
import { useOrganization } from "@/contexts/organization-context";

/** Account, organization, theme, today's demo usage, what this deployment runs on, and sign out. */
export default function SettingsPage() {
  const { isAdmin } = useOrganization();
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Settings" description="Your account and how this deployment is set up." />
      <div className="flex flex-col divide-y">
        <ProfileSection />
        <OrganizationSection />
        {isAdmin && (
          // The wrapper is the /settings#ai-provider anchor. As the section's only child it loses the
          // section's own vertical padding, so the wrapper provides it.
          <div id="ai-provider" className="py-8">
            <AiProviderSection />
          </div>
        )}
        <AppearanceSection />
        <UsageSection />
        <AboutSection />
        <SessionSection />
      </div>
    </PageContainer>
  );
}
