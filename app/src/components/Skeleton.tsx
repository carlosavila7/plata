import { border } from '../theme'

/**
 * Placeholder rows rendered while a page's IndexedDB reads are still resolving.
 * Mirrors the shared list-row layout (date · label · amount) so swapping in the
 * real data doesn't shift the layout — the cold-start "reload" flash users see
 * is mostly this empty-then-fill jump. See plan: why-does-the-app reloads.
 */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${border}` }}
        >
          <span className="skeleton-bar" style={{ width: 52, height: 12, flexShrink: 0 }} />
          <span className="skeleton-bar" style={{ flex: 1, height: 12, maxWidth: 180 }} />
          <span className="skeleton-bar" style={{ width: 64, height: 14, flexShrink: 0, marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  )
}
