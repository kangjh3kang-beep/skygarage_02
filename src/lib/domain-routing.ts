export function appUrl(configuredOrigin?: string) {
  // Switch only after the custom domain and TLS are verified in deployment.
  return configuredOrigin === "https://skygarage.app"
    ? "https://skygarage.app/app"
    : "/app";
}
export function domainDestination(
  hostname: string,
  path: string,
  configuredOrigin?: string,
): string | null {
  if (configuredOrigin === 'https://skygarage.app' &&
      (hostname === 'skygarage.net' || hostname === 'www.skygarage.net') &&
      (path === '/app' || path.startsWith('/app/'))) {
    return `https://skygarage.app${path}`;
  }
  if (hostname !== "skygarage.app" && hostname !== "www.skygarage.app")
    return null;
  if (path === "/" || path === "") return "/app";
  if (path === "/admin" || path.startsWith("/admin/"))
    return `https://www.skygarage.net${path}`;
  return null;
}
