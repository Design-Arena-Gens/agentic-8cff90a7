export const metadata = {
  title: "NGO Attendance Manager",
  description: "Session-wise attendance manager for NGOs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
