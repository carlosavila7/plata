// Categories, subcategories and payment types are stored snake_case (see
// CLAUDE.md); this turns a stored value into a display label without a
// per-value dictionary.
export function humanizeSlug(slug: string): string {
  const [first, ...rest] = slug.split('_')
  if (!first) return slug
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ')
}
