import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sample API',
  description: 'Testing APIs for QA',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
