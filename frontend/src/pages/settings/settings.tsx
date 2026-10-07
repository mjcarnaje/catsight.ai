import { PageContainer, PageHeader } from "@/components/page-header";
import { AboutSection } from "@/components/settings/about-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { ProfileSection } from "@/components/settings/profile-section";
import { SessionSection } from "@/components/settings/session-section";
import { UsageSection } from "@/components/settings/usage-section";

/** Account, theme, today's demo usage, what this deployment runs on, and sign out. */
export default function SettingsPage() {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Settings" description="Your account and how this deployment is set up." />
      <div className="flex flex-col divide-y">
        <ProfileSection />
        <AppearanceSection />
        <UsageSection />
        <AboutSection />
        <SessionSection />
      </div>
    </PageContainer>
  );
}
