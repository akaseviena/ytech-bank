import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Y-tech",
  description: "How Y-tech collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      {/* Header */}
      <header
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #F0F0F0",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 20, color: "#1A1A1A" }}>
          Y<span style={{ color: "#F5A623" }}>-tech</span>
        </span>
        <div style={{ display: "flex", gap: 24, fontSize: 14, fontWeight: 600 }}>
          <Link href="/terms" style={{ color: "#6B6B6B", textDecoration: "none" }}>
            Terms of Service
          </Link>
          <Link href="/login" style={{ color: "#F5A623", textDecoration: "none" }}>
            Back to app
          </Link>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <p style={{ fontSize: 13, color: "#9B9B9B", marginBottom: 8 }}>
          Last updated: 24 August 2026
        </p>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: "#1A1A1A",
            marginBottom: 8,
            lineHeight: 1.2,
          }}
        >
          Privacy Policy
        </h1>
        <p style={{ fontSize: 16, color: "#6B6B6B", marginBottom: 40, lineHeight: 1.6 }}>
          This policy explains what personal data Y-tech collects, why, who we share it with,
          and what rights you have over it.
        </p>

        <Section id="who-we-are" title="1. Who we are">
          <p>
            Y-tech is a financial technology platform operated by{" "}
            <strong>[Company Name]</strong>, registered at{" "}
            <strong>[Registered Address]</strong> under registration number{" "}
            <strong>[Reg. No.]</strong> (the "Company", "we", "us").
          </p>
          <p>
            The Company is the data controller for all personal data processed under this
            policy. For any privacy-related question, contact us at{" "}
            <a href="mailto:privacy@ytechfinance.com" style={{ color: "#F5A623" }}>
              privacy@ytechfinance.com
            </a>
            .
          </p>
        </Section>

        <Section id="data-we-collect" title="2. Data we collect">
          <p>When you create and use a Y-tech account, we collect the following categories of data:</p>

          <SubHeading>Account identity data</SubHeading>
          <ul>
            <li>Email address — collected at registration via Supabase Auth</li>
            <li>First name and last name</li>
            <li>Date of birth</li>
            <li>Phone number</li>
            <li>Profile photo (optional, if you upload one)</li>
          </ul>

          <SubHeading>Account and financial data</SubHeading>
          <ul>
            <li>Y-tech account number (assigned automatically)</li>
            <li>Account balance (demonstration funds — see §1 of Terms)</li>
            <li>Transaction history: amounts, descriptions, categories, counterparty account numbers, timestamps</li>
            <li>Savings goals: name, target amount, current amount, deadline, emoji</li>
            <li>Subscription plan</li>
            <li>Card freeze status</li>
            <li>Currency preference</li>
          </ul>

          <SubHeading>AI conversation data</SubHeading>
          <ul>
            <li>
              Messages you send to the AI Assistant and NeuroOffice agents, stored in our
              database and linked to your account
            </li>
            <li>AI-generated replies, also stored per conversation</li>
          </ul>

          <SubHeading>Technical data</SubHeading>
          <ul>
            <li>
              Authentication tokens and session metadata managed by Supabase Auth
            </li>
            <li>
              Request logs retained by our hosting provider (Vercel) for a standard
              operational period
            </li>
          </ul>
        </Section>

        <Section id="how-we-use" title="3. How we use your data">
          <Table
            rows={[
              ["Purpose", "Legal basis"],
              ["Creating and managing your account", "Contract performance"],
              ["Processing transfers between Y-tech accounts", "Contract performance"],
              ["Displaying your balance and transaction history", "Contract performance"],
              ["Powering AI features (see §4)", "Contract performance / Legitimate interests"],
              ["Sending service notifications (plan changes, security)", "Contract performance"],
              ["Detecting abuse or policy violations", "Legitimate interests"],
              ["Complying with legal obligations", "Legal obligation"],
            ]}
          />
        </Section>

        <Section id="ai-and-anthropic" title="4. AI features and Anthropic">
          <p>
            The AI Assistant and NeuroOffice agents in Y-tech are powered by{" "}
            <strong>Claude</strong>, a model developed by Anthropic PBC
            ("Anthropic"), a US company.
          </p>
          <p>When you send a message to any AI feature, the following happens on our servers:</p>
          <ol>
            <li>
              Your message and the conversation history for that session are assembled.
            </li>
            <li>
              A financial context block is built from your account data — specifically your
              current balance, recent transactions (up to 20–50 entries depending on the
              feature), spending by category for the current month, and savings goals.
            </li>
            <li>
              This combined payload — conversation + financial context — is sent to
              Anthropic's API over an encrypted connection to generate a response.
            </li>
            <li>
              The response is streamed back to your device and stored in our database.
            </li>
          </ol>
          <p>
            <strong>What this means for your data:</strong> Anthropic processes the
            content of your messages and your financial context as part of each API
            call. Anthropic's API usage terms state that data sent via the API is
            not used to train their models. Anthropic's own Privacy Policy applies
            to their processing:{" "}
            <a href="https://www.anthropic.com/privacy" style={{ color: "#F5A623" }}>
              anthropic.com/privacy
            </a>
            .
          </p>
          <p>
            Conversations are stored in our database (Supabase) and are retained
            until you delete them or request account deletion.
          </p>
        </Section>

        <Section id="data-sharing" title="5. Data sharing">
          <p>
            We share your personal data only with the infrastructure providers necessary
            to operate the platform:
          </p>
          <Table
            rows={[
              ["Recipient", "What we share", "Why"],
              [
                "Supabase Inc. (USA)",
                "All account, financial, and conversation data",
                "Database storage and authentication infrastructure",
              ],
              [
                "Anthropic PBC (USA)",
                "Conversation messages + financial context",
                "AI response generation — only when you use AI features",
              ],
              [
                "Vercel Inc. (USA)",
                "Request/response metadata",
                "Application hosting and edge delivery",
              ],
            ]}
          />
          <p>
            <strong>We do not sell your personal data.</strong> We do not share your
            data with advertisers, data brokers, or any third party for their own
            marketing purposes.
          </p>
          <p>
            All recipients listed above are subject to Standard Contractual Clauses
            or equivalent mechanisms for transfers of personal data outside the EEA.
          </p>
        </Section>

        <Section id="retention" title="6. Data retention">
          <p>
            We retain your personal data for as long as your account is active. After you
            request account deletion:
          </p>
          <ul>
            <li>Account identity data is removed within 30 days.</li>
            <li>Financial data (transactions, balances) is removed within 30 days.</li>
            <li>AI conversation data is removed within 30 days.</li>
            <li>
              Anonymised, aggregated usage statistics (no personal identifiers) may be
              retained indefinitely.
            </li>
            <li>
              Request logs held by Vercel are subject to their standard retention period.
            </li>
          </ul>
        </Section>

        <Section id="gdpr-rights" title="7. Your rights under GDPR">
          <p>
            If you are located in the European Economic Area or the United Kingdom, you
            have the following rights regarding your personal data:
          </p>
          <Table
            rows={[
              ["Right", "What it means", "How to exercise it"],
              [
                "Access",
                "Receive a copy of all personal data we hold about you",
                "Email privacy@ytechfinance.com",
              ],
              [
                "Rectification",
                "Correct inaccurate data",
                "Profile settings in-app, or email us",
              ],
              [
                "Erasure",
                "Request deletion of your account and all associated data",
                "See §8 below",
              ],
              [
                "Portability",
                "Receive your data in a structured, machine-readable format (JSON)",
                "Email privacy@ytechfinance.com",
              ],
              [
                "Restriction",
                "Ask us to stop certain processing while a dispute is resolved",
                "Email privacy@ytechfinance.com",
              ],
              [
                "Objection",
                "Object to processing based on legitimate interests",
                "Email privacy@ytechfinance.com",
              ],
              [
                "Withdraw consent",
                "Not applicable — we do not rely on consent as a basis",
                "N/A",
              ],
            ]}
          />
          <p>
            We will respond to requests within 30 days. If you are unsatisfied with our
            response, you have the right to lodge a complaint with the supervisory
            authority in your country of residence.
          </p>
        </Section>

        <Section id="account-deletion" title="8. Account deletion">
          <p>
            To delete your Y-tech account and all associated data, email{" "}
            <a href="mailto:privacy@ytechfinance.com" style={{ color: "#F5A623" }}>
              privacy@ytechfinance.com
            </a>{" "}
            with the subject line <strong>"Account deletion request"</strong> from the
            email address registered to your account.
          </p>
          <p>
            We will confirm receipt within 5 business days and complete the deletion
            within 30 days.
          </p>
        </Section>

        <Section id="cookies" title="9. Cookies and local storage">
          <p>Y-tech uses the following cookies and browser storage:</p>
          <ul>
            <li>
              <strong>Authentication cookies</strong> — session tokens set by Supabase
              Auth, necessary for you to remain logged in. These expire when you log
              out or after the session timeout.
            </li>
            <li>
              <strong>No advertising cookies.</strong> We do not use any advertising,
              retargeting, or third-party analytics cookies.
            </li>
          </ul>
        </Section>

        <Section id="security" title="10. Security">
          <p>
            All data is transmitted over HTTPS/TLS. Passwords are never stored —
            authentication is handled by Supabase Auth using hashed credentials.
            Sensitive profile fields (phone number, date of birth) are accessible only
            through server-side API routes using a service-role key; they are not
            directly readable by client-side code.
          </p>
          <p>
            Y-tech is a technology demonstration platform. While we apply reasonable
            security measures, we are not a regulated financial institution and do not
            hold funds under a regulatory scheme.
          </p>
        </Section>

        <Section id="changes" title="11. Changes to this policy">
          <p>
            We may update this Privacy Policy. The "Last updated" date at the top of
            this page reflects when the current version was published. For material
            changes, we will notify registered users via in-app notification.
          </p>
        </Section>

        <Section id="contact" title="12. Contact">
          <p>
            <strong>[Company Name]</strong>
            <br />
            [Registered Address]
            <br />
            [Jurisdiction]
            <br />
            Registration number: [Reg. No.]
            <br />
            Privacy enquiries:{" "}
            <a href="mailto:privacy@ytechfinance.com" style={{ color: "#F5A623" }}>
              privacy@ytechfinance.com
            </a>
          </p>
        </Section>
      </main>

      <Footer />
    </div>
  );
}

// ─── Reusable layout components ──────────────────────────

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        marginBottom: 40,
        paddingBottom: 40,
        borderBottom: "1px solid #F0F0F0",
      }}
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: "#1A1A1A",
          marginBottom: 16,
          scrollMarginTop: 80,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontSize: 15,
          lineHeight: 1.7,
          color: "#3A3A3A",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontWeight: 700,
        color: "#1A1A1A",
        marginTop: 8,
        marginBottom: -4,
        fontSize: 14,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </p>
  );
}

function Table({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <thead>
          <tr>
            {header.map((cell) => (
              <th
                key={cell}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  background: "#F9F6F0",
                  color: "#1A1A1A",
                  fontWeight: 700,
                  borderBottom: "2px solid rgba(245,166,35,0.3)",
                  whiteSpace: "nowrap",
                }}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #F0F0F0",
                    verticalAlign: "top",
                    color: j === 0 ? "#1A1A1A" : "#4A4A4A",
                    fontWeight: j === 0 ? 600 : 400,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid #F0F0F0",
        padding: "24px",
        textAlign: "center",
        fontSize: 13,
        color: "#9B9B9B",
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <Link href="/privacy" style={{ color: "#F5A623", marginRight: 16, textDecoration: "none", fontWeight: 600 }}>
          Privacy Policy
        </Link>
        <Link href="/terms" style={{ color: "#6B6B6B", textDecoration: "none" }}>
          Terms of Service
        </Link>
      </div>
      <p>© {new Date().getFullYear()} Y-tech. All rights reserved.</p>
    </footer>
  );
}
