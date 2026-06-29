export const buildLoginPathWithNext = (pathname: string, search = "") => {
  const currentPath = `${pathname || "/"}${search || ""}`;
  return `/login?next=${encodeURIComponent(currentPath)}`;
};

export const getSafeAuthNextPath = (search: string) => {
  const params = new URLSearchParams(search || "");
  const rawNext = params.get("next");
  const next = rawNext?.trim();

  if (!next) {
    return null;
  }

  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(next)) {
    return null;
  }

  const pathOnly = next.split("?")[0].replace(/\/+$/, "") || "/";
  if (pathOnly === "/login") {
    return null;
  }

  return next;
};
