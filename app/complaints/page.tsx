import { LegalHeader, LegalFooter, Section } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Complaints — Y-tech",
  description: "How to raise a complaint with Y-tech.",
};

export default function ComplaintsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      <LegalHeader />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <p style={{ fontSize: 13, color: "#9B9B9B", marginBottom: 8 }}>
          Last updated: 18 September 2026
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1A1A", marginBottom: 40, lineHeight: 1.2 }}>
          Complaints — Y-tech prototype
        </h1>

        <Section id="tell-us" title="Tell us">
          <p>
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5C800" }}>
              info@ytechfinance.com
            </a>
          </p>
          <p>
            Include the email address on your account and what happened. If you want a particular
            outcome, say so.
          </p>
        </Section>

        <Section id="what-we-do" title="What we do">
          <p>
            We acknowledge within 3 working days and aim to answer fully within 15 working days.
            If it will take longer, we tell you why and when to expect an answer.
          </p>
        </Section>

        <Section id="what-we-cannot-deal-with" title="What we cannot deal with">
          <p>
            Y-tech holds no financial services authorisation, holds no customer funds and processes
            no real payments. The prototype uses demonstration funds only.
          </p>
          <p>
            If your complaint concerns a real payment, card or account, it is held elsewhere and
            we cannot help — contact that provider.
          </p>
          <p>
            When Y-tech operates under a licensed partner, financial complaints will follow that
            partner&apos;s regulated procedure and eligible complainants will be able to escalate to
            the Financial Ombudsman Service. We will publish that procedure here before any
            regulated service goes live.
          </p>
        </Section>

        <Section id="data-protection-complaints" title="Data protection complaints">
          <p>
            If your complaint is about how we handle personal data and our answer does not satisfy
            you:{" "}
            <a href="https://ico.org.uk" target="_blank" rel="noopener" style={{ color: "#F5C800" }}>
              ico.org.uk
            </a>{" "}
            · 0303 123 1113
          </p>
        </Section>
      </main>

      <LegalFooter current="/complaints" />
    </div>
  );
}
