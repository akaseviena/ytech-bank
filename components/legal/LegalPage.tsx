import Link from "next/link";
import React from "react";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/complaints", label: "Complaints" },
];

export function LegalHeader() {
  return (
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
      <Link href="/" style={{ textDecoration: "none" }}>
        <span style={{ fontWeight: 800, fontSize: 20, color: "#1A1A1A" }}>
          Y<span style={{ color: "#F5C800" }}>-tech</span>
        </span>
      </Link>
      <Link
        href="/login"
        style={{ color: "#F5C800", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
      >
        Back to app
      </Link>
    </header>
  );
}

export function LegalFooter({ current }: { current?: string }) {
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
      <div
        style={{
          marginBottom: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 20px",
          justifyContent: "center",
        }}
      >
        {LEGAL_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              color: href === current ? "#F5C800" : "#6B6B6B",
              textDecoration: "none",
              fontWeight: href === current ? 700 : 400,
            }}
          >
            {label}
          </Link>
        ))}
      </div>
      <p>© {new Date().getFullYear()} Y-tech. All rights reserved.</p>
    </footer>
  );
}

export function Section({
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
      style={{ marginBottom: 40, paddingBottom: 40, borderBottom: "1px solid #F0F0F0" }}
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

export function Table({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, lineHeight: 1.6 }}
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
                  borderBottom: "2px solid rgba(245,200,0,0.3)",
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
