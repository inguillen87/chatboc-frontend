import { TENANT_PLACEHOLDER_SLUGS, TENANT_ROUTE_PREFIXES } from "@/constants/tenant";

const decodePathSegment = (segment?: string | null) => {
  if (!segment) return "";
  try {
    return decodeURIComponent(segment).trim().toLowerCase();
  } catch {
    return segment.trim().toLowerCase();
  }
};

export const isPublicPlatformSurfacePath = (pathname?: string | null) => {
  if (!pathname || pathname === "/") return true;

  const [firstSegment] = pathname.split("/").filter(Boolean);
  const first = decodePathSegment(firstSegment);
  if (!first) return true;

  if (TENANT_ROUTE_PREFIXES.includes(first as (typeof TENANT_ROUTE_PREFIXES)[number])) {
    return false;
  }

  return TENANT_PLACEHOLDER_SLUGS.has(first);
};
