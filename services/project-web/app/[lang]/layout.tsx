import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "saassy",
  description: "saassy",
};

export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "de" }];
}

export default async function LangLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
