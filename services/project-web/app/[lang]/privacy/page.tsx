import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
};

/**
 * REPLACE THIS PAGE before deploying to real users.
 *
 * Document what personal data the app collects, the legal basis, retention
 * periods, third-party processors (Resend, Docker Hub image hosts, etc.),
 * user rights (access, deletion, portability), and how to contact the
 * data controller. GDPR / CCPA compliance depends heavily on jurisdiction
 * and deployment details.
 */
export default async function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "60px auto",
        padding: 24,
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Privacy policy</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Placeholder — replace with your actual privacy policy before deploying
        to real users. See{" "}
        <code>services/project-web/app/[lang]/privacy/page.tsx</code> in the{" "}
        <a href="https://github.com/sssemil/saassy">saassy repo</a>.
      </p>
    </main>
  );
}
