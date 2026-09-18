import { LegalHeader, LegalFooter, Section, Table } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Privacy Policy — Y-tech",
  description: "How Y-tech collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      <LegalHeader />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <p style={{ fontSize: 13, color: "#9B9B9B", marginBottom: 8 }}>
          Last updated: 18 September 2026
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1A1A", marginBottom: 8, lineHeight: 1.2 }}>
          Privacy Policy — Y-tech prototype
        </h1>

        <Section id="who-we-are" title="Who we are">
          <p>
            Y-TECH FINANCIAL TECHNOLOGIES LTD ("Y-tech", "we", "us") is the data controller for
            the personal information described here. Company registration pending, United Kingdom.
          </p>
          <p>
            Contact:{" "}
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5A623" }}>
              info@ytechfinance.com
            </a>
          </p>
        </Section>

        <Section id="what-this-covers" title="What this covers">
          <p>
            This notice covers the Y-tech early-access prototype at app.ytechfinance.com. The
            ytechfinance.com website and waiting list have a separate notice.
          </p>
          <p>
            This is a prototype. It runs on demonstration funds. No real money moves, no customer
            funds are held, and Y-tech holds no financial services authorisation. Please do not
            enter real financial information, real payment card details or sensitive personal data.
          </p>
        </Section>

        <Section id="what-we-collect" title="What we collect">
          <p>
            <strong>When you create an account:</strong> email address, password (stored hashed,
            never in readable form), name, phone number and date of birth.
          </p>
          <p>
            <strong>When you use the product:</strong> the transactions, transfers and savings
            goals you create inside Y-tech, the demonstration balances they produce, and the names
            of other Y-tech users you send demonstration transfers to.
          </p>
          <p>
            <strong>When you use the AI:</strong> the questions you ask the assistant and the
            NeuroOffice specialists, and the transaction context sent with them — see the next
            section.
          </p>
          <p>
            <strong>Automatically:</strong> IP address, browser type, pages requested and error
            logs, recorded by our hosting provider to keep the service running and secure.
          </p>
        </Section>

        <Section id="ai-in-detail" title="The AI, in detail">
          <p>
            This is the part most people want to understand, so we set it out plainly.
          </p>
          <p>
            When you ask the assistant or a specialist a question, we send that question to
            Anthropic, together with the relevant part of your Y-tech data: your demonstration
            balances, recent transactions and subscriptions, your first name, and the names of
            other Y-tech users involved in those transactions.
          </p>
          <p>
            Anthropic processes this to generate the answer and returns it to us. Under our
            commercial agreement with Anthropic, this data is not used to train their models.
            Anthropic retains inputs and outputs for a limited period for operational and safety
            purposes and then deletes them.
          </p>
          <p>
            Our legal basis for this is your consent. You give it when you first use the AI
            features. You can withdraw it at any time in your profile settings, and the rest of
            the product continues to work without the AI.
          </p>
          <p>The AI reads only your own records inside Y-tech. It is not connected to any external bank account.</p>
        </Section>

        <Section id="why-we-use" title="Why we use your data, and our legal basis">
          <Table
            rows={[
              ["What we do", "Legal basis under UK GDPR"],
              ["Create and run your account, show your balances and transactions", "Performance of a contract with you"],
              ["Generate AI answers and drafts", "Your consent"],
              ["Keep the service secure, prevent abuse, fix faults", "Our legitimate interests"],
              ["Respond to your messages and complaints", "Our legitimate interests"],
              ["Meet legal obligations", "Legal obligation"],
            ]}
          />
          <p>We do not sell your data. We do not use it for advertising.</p>
        </Section>

        <Section id="processors" title="Who processes it for us">
          <Table
            rows={[
              ["Provider", "What they do", "Where"],
              ["Supabase", "Database and authentication", "European Union (Frankfurt)"],
              ["Vercel", "Hosting and application logic", "United States"],
              ["Anthropic", "AI models behind the assistant and specialists", "United States"],
              ["Tally", "Feedback form, if you choose to use it", "European Union"],
            ]}
          />
          <p>
            Each acts on our instructions under a written data processing agreement.
          </p>
          <p>
            Where personal data leaves the United Kingdom, we rely on safeguards approved under UK
            data protection law — the UK International Data Transfer Agreement or the UK Addendum
            to the EU Standard Contractual Clauses.
          </p>
        </Section>

        <Section id="retention" title="How long we keep it">
          <p>
            Your account data is kept while your account is open. If you ask us to delete your
            account, we delete it and its transactions within 30 days. Technical logs are kept for
            up to 30 days. Prototype data may also be reset in full as the product develops — we
            will tell you before we do that.
          </p>
        </Section>

        <Section id="your-rights" title="Your rights">
          <p>
            You have the right to ask for a copy of your data, have it corrected or deleted,
            restrict or object to how we use it, receive it in a portable format, and withdraw
            consent to the AI features at any time.
          </p>
          <p>
            Email{" "}
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5A623" }}>
              info@ytechfinance.com
            </a>
            . We respond within one month, free of charge.
          </p>
        </Section>

        <Section id="security" title="Security, stated honestly">
          <p>
            We use encrypted connections, hashed passwords and row-level access controls in the
            database. But this is pre-release software built ahead of a regulated launch, and it
            has not been through an independent security audit. That is exactly why we ask you not
            to put real financial or sensitive information into it.
          </p>
        </Section>

        <Section id="complaining" title="Complaining">
          <p>
            Tell us first at{" "}
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5A623" }}>
              info@ytechfinance.com
            </a>
            . You can also complain to the Information Commissioner&apos;s Office: Wycliffe House,
            Water Lane, Wilmslow, Cheshire SK9 5AF ·{" "}
            <a href="https://ico.org.uk" target="_blank" rel="noopener" style={{ color: "#F5A623" }}>
              ico.org.uk
            </a>{" "}
            · 0303 123 1113
          </p>
        </Section>
      </main>

      <LegalFooter current="/privacy" />
    </div>
  );
}
