import './globals.css';

export const metadata = {
  title: 'Weather Dashboard',
  description: 'A modern weather dashboard built with Next.js.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}