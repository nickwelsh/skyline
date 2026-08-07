export function canonicalRoutePath(href: string, segment: string): string {
  const url = new URL(href, "https://skyline.invalid");
  const parts = url.pathname.split("/");
  const index = parts.lastIndexOf(segment);

  if (index < 0) return href;

  return `/${parts.slice(index).join("/")}${url.search}${url.hash}`;
}
