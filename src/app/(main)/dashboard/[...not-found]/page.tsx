import { notFound } from "next/navigation";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ "not-found": ["_"] }];
}

export default function DashboardNotFound() {
  notFound();
}
