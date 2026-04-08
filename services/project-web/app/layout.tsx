import "./globals.css";
import { cookies } from "next/headers";
import ImpersonationBanner from "../components/ImpersonationBanner";

export const metadata = {
  title: "saassy",
  description: "saassy",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const impersonating = cookieStore.get("impersonating")?.value || null;

  return (
    <html lang="en">
      <body>
        {impersonating && <ImpersonationBanner email={impersonating} />}
        {children}
      </body>
    </html>
  );
}
