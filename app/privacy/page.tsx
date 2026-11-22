import { LegalHeader, LegalFooter, Section, Table } from "@/components/legal/LegalPage";
import {
  CONTEXT_AGENT_LABEL,
  CONTEXT_FIELD_TEXT,
  NEVER_SENT,
  NOTES_SENT,
  fieldGroups,
} from "@/lib/context-fields";
import { contextLayout } from "@/lib/context-layout";
import { ACCOUNT_DELETION_LIVE } from "@/lib/legal-flags";

export const metadata = {
  title: "Privacy Policy — Y-tech",
  description: "How Y-tech collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  const layout = contextLayout();
  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      <LegalHeader />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <p style={{ fontSize: 13, color: "#9B9B9B", marginBottom: 8 }}>
          Last updated: 22 November 2026
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1A1A", marginBottom: 8, lineHeight: 1.2 }}>
          Privacy Policy — Y-tech prototype
        </h1>

        <Section id="who-we-are" title="Who we are">
          <p>
            YTECH FINANCIAL TECHNOLOGIES LTD ("Y-tech", "we", "us") is the data controller for
            the personal information described here. Registered in England and Wales, company
            number 17497293, registered office: 128 City Road, London, United Kingdom, EC1V 2NX.
          </p>
          <p>
            Contact:{" "}
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5C800" }}>
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
            <strong>If you take the identity step in the app:</strong> the kind of document you
            choose, for example a passport. We do not store a picture of the document or a selfie.
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

        <Section id="what-others-see" title="What other Y-tech users see about you">
          <p>
            When someone sends a demonstration transfer, they choose the person to send it to from
            a list. That list shows your first name and the first letter of your surname (for
            example &quot;Anna A.&quot;), your Y-tech account reference and your profile picture if
            you have added one. To make sure a new user is not shown an empty list, it is filled up
            with other Y-tech users, so anyone who uses it repeatedly can come to see the names of
            many users. We have chosen to tell you this plainly rather than hide it.
          </p>
          <p>
            Once you and another person have exchanged a transfer, it appears in both of your
            histories, and each of you sees the other&apos;s full name next to it.
          </p>
        </Section>

        <Section id="ai-in-detail" title="The AI, in detail">
          <p>
            This is the part most people want to understand, so we set it out plainly.
          </p>
          <p>
            <strong>In short,</strong> three things go to Anthropic: what you type, the recent part of
            your conversation with that assistant, and the account figures listed below for the
            assistant you ask. We never send {NEVER_SENT.slice(0, -1).join(", ")}, or{" "}
            {NEVER_SENT[NEVER_SENT.length - 1]}.
          </p>
          <p>
            When you ask the assistant or a specialist a question, we send that question to
            Anthropic, together with a small part of your Y-tech data. How much depends on who
            you ask, and it is the same in the web app and in the mobile app:
          </p>
          {/* Rendered from lib/context-fields.ts, the table the code reads when it builds what is sent. */}
          <ul style={{ paddingLeft: 20, margin: "8px 0 16px" }}>
            {fieldGroups().map((group) => (
              <li key={group.agents.join("-")} style={{ marginBottom: 8 }}>
                <strong>{group.agents.map((a) => CONTEXT_AGENT_LABEL[a]).join(", ")}:</strong>{" "}
                {group.fields.map((f) => CONTEXT_FIELD_TEXT[f]).join("; ")}.
              </li>
            ))}
          </ul>
          <p>
            All amounts are demonstration funds. {NOTES_SENT}
          </p>
          <p>
            What you type to the assistant or a specialist is sent as you write it, together with
            the most recent part of the conversation so far (the last {layout.conversationWindow.assistant}{" "}
            messages with the assistant, the last {layout.conversationWindow.specialist} with a specialist). Do
            not type anything you would not want Anthropic to process.
          </p>
          <p>
            Anthropic processes this to generate the answer and returns it to us. Under our
            commercial agreement with Anthropic, this data is not used to train their models.
            By default Anthropic deletes inputs and outputs within 30 days of receiving them. If
            its automated safety systems flag a request as breaking its usage policy, it may keep
            that input and output for up to two years, and the safety classification scores for up
            to seven.
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
            Your account data is kept while your account is open.{" "}
            {!ACCOUNT_DELETION_LIVE &&
              "You can ask us to delete your account by emailing info@ytechfinance.com. We remove your sign-in, your name, email address, phone number and picture within one month. Transfers you have made stay in the other person's history, shown as \"Deleted user\", because they are part of that person's record too. "}
            Technical logs are kept for up to 30 days. Prototype data may also be reset in full as
            the product develops — we will tell you before we do that.
          </p>
        </Section>

        {ACCOUNT_DELETION_LIVE && (
          <Section id="deleting-your-account" title="Deleting your account">
            <p>
              You can delete your account yourself in the Y-tech app, under Settings → Delete
              account. You confirm with your PIN and do not have to contact us. It takes effect at
              once and cannot be undone.
            </p>
            <p>
              <strong>What is deleted.</strong> Your profile and everything attached to it: your
              name, email address, phone number, date of birth and account number, your
              conversations with the assistant and the specialists, your savings goals, cards and
              notifications, the record of the document kind you chose and your demo top-ups. Your profile
              picture and your sign-in are deleted too.
            </p>
            <p>
              Your plan ends immediately. Your demo funds are closed. There is no refund and there
              will be no further charges. Nothing is billed through the App Store, so there is
              nothing to cancel there.
            </p>
            <p>
              <strong>What stays.</strong> A transfer cannot be changed once it has been made, so
              the transfers you made or received stay in the books, because each is also part of
              the other person&apos;s record. On their side your name is replaced by
              &quot;Deleted user&quot;, and the automatic &quot;To &lt;your name&gt;&quot; note the
              app adds to a transfer is removed. A note you typed yourself stays with the
              transfer. Your account stays as a closed account that belongs to nobody. We also keep
              a record that an account was closed: when it was requested and finished, the plan
              it was on and the amount closed. While the deletion is carried out the record holds
              an internal number that identifies your account, so that an interrupted deletion
              can be completed; removing that number is the last step of the deletion. If that
              step fails, the number stays in the record.
            </p>
            <p>
              Deleting your account does not recall what has already left Y-tech: technical logs
              and anything Anthropic has already processed are deleted on the schedules described
              above.
            </p>
            <p>
              Deleting it in the app is the way to do it, and if you have removed the app you can
              install it again and sign in. If you do not use the app at all, email us and we will
              delete your account for you within one month.
            </p>
          </Section>
        )}

        <Section id="your-rights" title="Your rights">
          <p>
            You have the right to ask for a copy of your data, have it corrected or deleted,
            restrict or object to how we use it, receive it in a portable format, and withdraw
            consent to the AI features at any time.
          </p>
          <p>
            Email{" "}
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5C800" }}>
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
            <a href="mailto:info@ytechfinance.com" style={{ color: "#F5C800" }}>
              info@ytechfinance.com
            </a>
            . You can also complain to the Information Commissioner&apos;s Office: Wycliffe House,
            Water Lane, Wilmslow, Cheshire SK9 5AF ·{" "}
            <a href="https://ico.org.uk" target="_blank" rel="noopener" style={{ color: "#F5C800" }}>
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
