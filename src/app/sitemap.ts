import type { MetadataRoute } from "next";

import { SITE_URL } from "@/config/site-url";

// Everything else sits behind sign-in, so only the sign-in, about, contact and legal pages are worth indexing.
const PUBLIC_ROUTES = ["/auth/login", "/about", "/contact", "/privacy", "/terms"] as const;

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
  }));
}
