import './globals.css';

export const metadata = {
  title: 'Job Portal Admin · Stealth Translations Ltd',
  description: 'Secure admin dashboard for reviewing job portal voice applications.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
