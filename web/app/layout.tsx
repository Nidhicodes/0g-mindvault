import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MindVault — Agent Memory Explorer",
  description: "Explore AI agent memories, identities, and storage proofs on 0G",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
