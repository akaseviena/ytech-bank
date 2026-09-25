import { LegalHeader, LegalFooter, Section, Table } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Cookie Policy — Y-tech",
  description: "What Y-tech stores on your device and why.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      <LegalHeader />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <p style={{ fontSize: 13, color: "#9B9B9B", marginBottom: 8 }}>
          Last updated: 18 September 2026
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1A1A", marginBottom: 40, lineHeight: 1.2 }}>
          Cookie Policy — Y-tech prototype
        </h1>

        <Section id="what-we-store" title="What we store on your device">
          <p>Only what the product needs to work:</p>
          <Table
            rows={[
              ["What", "Why", "How long"],
              ["Session token", "Keeps you signed in between pages", "Until you sign out or it expires"],
              ["Interface preferences", "Remembers settings such as your chosen view", "Until you clear your browser data"],
            ]}
          />
          <p>
            These are strictly necessary for a service you asked for, so under UK privacy rules
            they do not require your consent. That is why you do not see a cookie banner.
          </p>
        </Section>

        <Section id="what-we-do-not-store" title="What we do not store">
          <p>
            No advertising cookies. No tracking pixels. No cross-site identifiers. No analytics
            that follow you to other websites.
          </p>
        </Section>

        <Section id="third-parties" title="Third parties">
          <p>
            If you open the feedback form, it is loaded from Tally and is subject to Tally&apos;s
            own cookie and privacy terms.
          </p>
        </Section>

        <Section id="controlling-it" title="Controlling it">
          <p>
            You can clear this data in your browser settings at any time. If you clear the session
            token you will be signed out.
          </p>
        </Section>

        <Section id="if-this-changes" title="If this changes">
          <p>
            If we add analytics or any technology that is not strictly necessary, we will update
            this page and ask for your consent before it runs.
          </p>
          <p>
            Questions:{" "}
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5C800" }}>
              info@ytechfinance.com
            </a>
          </p>
        </Section>
      </main>

      <LegalFooter current="/cookies" />
    </div>
  );
}
