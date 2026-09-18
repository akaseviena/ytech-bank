import { LegalHeader, LegalFooter, Section } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Terms of Use — Y-tech",
  description: "The terms that govern your use of the Y-tech prototype.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      <LegalHeader />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <p style={{ fontSize: 13, color: "#9B9B9B", marginBottom: 8 }}>
          Last updated: 18 September 2026
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1A1A", marginBottom: 40, lineHeight: 1.2 }}>
          Terms of Use — Y-tech prototype
        </h1>

        <Section id="what-this-is" title="What this is">
          <p>
            The Y-tech prototype is early-access software provided for evaluation. It is operated
            by Y-TECH FINANCIAL TECHNOLOGIES LTD, company registration pending, United Kingdom.
          </p>
        </Section>

        <Section id="what-it-is-not" title="What it is not">
          <p>
            Y-tech holds no financial services authorisation of its own, holds no customer funds,
            takes no deposits and provides no regulated financial services.
          </p>
          <p>
            All balances and transfers in this prototype are demonstration data. No real money
            exists in the system. Nothing here is a payment service, a deposit, an investment or
            a payment account.
          </p>
          <p>
            When Y-tech launches, payment and electronic money services will be provided by a
            licensed institution under separate terms.
          </p>
        </Section>

        <Section id="your-account" title="Your account">
          <p>
            You are responsible for keeping your password safe. Tell us immediately at{" "}
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5A623" }}>
              info@ytechfinance.com
            </a>{" "}
            if you think someone else has access to your account.
          </p>
          <p>
            Do not enter real payment card numbers, real account details, identity documents or
            sensitive personal data.
          </p>
          <p>
            Do not use the prototype to store anything you cannot afford to lose. Prototype data
            may be reset as the product develops.
          </p>
        </Section>

        <Section id="the-ai" title="The AI">
          <p>
            The assistant and the NeuroOffice specialists produce drafts and explanations based on
            your Y-tech data. They are software, not professionals.
          </p>
          <p>
            Nothing they produce is legal, tax, accounting, investment or financial advice. The
            specialist named "Lawyer" is not a solicitor; the one named "Accountant" is not an
            accountant. Everything they generate is a draft for a human to review and approve. AI
            output can be wrong. Check it before you rely on it.
          </p>
          <p>The AI does not move money and cannot act on your account.</p>
        </Section>

        <Section id="acceptable-use" title="Acceptable use">
          <p>
            Do not attempt to access other users&apos; data, probe or attack the service, introduce
            malicious code, automate access without our permission, or use the prototype
            unlawfully.
          </p>
          <p>We may suspend or close an account that does any of these.</p>
        </Section>

        <Section id="availability" title="Availability">
          <p>
            This is pre-release software. It may be unavailable, may contain faults, and may
            change or be withdrawn at any time without notice. We provide it as-is, with no
            warranty.
          </p>
        </Section>

        <Section id="liability" title="Liability">
          <p>
            To the extent permitted by law, we are not liable for loss arising from your use of
            the prototype or from reliance on anything it produces, including AI output. Nothing
            here limits liability that cannot lawfully be limited, including for death or personal
            injury caused by negligence, or for fraud.
          </p>
        </Section>

        <Section id="ending-it" title="Ending it">
          <p>
            You can close your account at any time by emailing{" "}
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5A623" }}>
              info@ytechfinance.com
            </a>
            . We may end your access to the prototype at any time.
          </p>
        </Section>

        <Section id="governing-law" title="Governing law">
          <p>
            The law of England and Wales, and the courts of England and Wales. If you live
            elsewhere in the UK or in the EEA, this does not remove the protection of the
            mandatory consumer law where you live.
          </p>
          <p>
            Contact:{" "}
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5A623" }}>
              info@ytechfinance.com
            </a>
          </p>
        </Section>
      </main>

      <LegalFooter current="/terms" />
    </div>
  );
}
