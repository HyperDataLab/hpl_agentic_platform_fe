import type { Metadata } from "next";

import { ReviewsPage } from "./_components/reviews-page";

export const metadata: Metadata = {
  title: "Review queue · OpenAI Scientist",
  description: "Findings waiting for review across all research projects.",
};

export default function Page() {
  return <ReviewsPage />;
}
