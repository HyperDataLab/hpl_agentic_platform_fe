import type { Metadata } from "next";

import { mails } from "./_components/data";
import { MailComponent } from "./_components/mail";
import { DEFAULT_MAIL_LAYOUT } from "./_components/mail-layout-config";

export const metadata: Metadata = {
  title: "Open Source Email Client with shadcn/ui",
  description:
    "Explore an open source email client with inbox navigation, message search, reading, replying, and archiving.",
};

// A template demo, hidden from the navigation. With no server to read the saved layout, it opens with the default.
export default function Page() {
  return (
    <div className="h-dvh min-h-0 overflow-hidden">
      <MailComponent mails={mails} defaultLayout={[...DEFAULT_MAIL_LAYOUT]} />
    </div>
  );
}
