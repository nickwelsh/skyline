const assetPrefix = "/skyline/assets/";

export function resolveFixtureAsset(pathname, assets) {
  if (!pathname.startsWith(assetPrefix)) return undefined;
  const asset = pathname.slice(assetPrefix.length);
  if (!asset || asset.split("/").some((segment) => !segment || segment === "." || segment === "..")) return undefined;
  return assets.has(asset) ? asset : undefined;
}
