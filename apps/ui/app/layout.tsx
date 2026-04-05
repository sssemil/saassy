import './globals.css';

export const metadata = {
  title: 'common-saas-template',
  description: 'SaaS template'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <head />
      {children}
    </>
  );
}
