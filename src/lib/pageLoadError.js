export function isPageAssetError(error) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading (?:CSS )?chunk .+ failed|Unable to preload CSS|error loading dynamically imported module/i.test(String(error?.message || ''))
}
