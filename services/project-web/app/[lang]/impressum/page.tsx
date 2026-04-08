import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum / Legal notice",
};

/**
 * REPLACE THIS PAGE before deploying to real users.
 *
 * In jurisdictions like Germany (§ 5 TMG), a legally compliant Impressum
 * is mandatory for most commercial websites. Fill in the operator's legal
 * name, address, contact information, representative, registry data,
 * VAT ID, and content-responsibility details as required by local law.
 */
export default async function ImpressumPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "60px auto",
        padding: 24,
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>
        Impressum / Legal notice
      </h1>
      <p style={{ color: "var(--text-muted)" }}>
        Placeholder — replace with your operator's legal notice before deploying
        to real users. See{" "}
        <code>services/project-web/app/[lang]/impressum/page.tsx</code> in the{" "}
        <a href="https://github.com/sssemil/saassy">saassy repo</a>.
      </p>
    </main>
  );
}
