import { redirect } from "next/navigation";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ userId: "_" }];
}

export default function Page() {
  redirect("/admin/users");
}
