import type { Metadata } from "next";

import { SettingsPage } from "./_components/settings-page";

export const metadata: Metadata = {
  title: "Settings · OpenAI Scientist",
  description: "The language model your runs use.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SettingsPage />;
}
