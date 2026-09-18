export function RouteLoading({ variant = "dashboard" }: { variant?: "dashboard" | "table" | "detail" }) {
  return (
    <div aria-busy="true" aria-live="polite" className="route-loading">
      <div className="route-loading-heading">
        <span className="skeleton-line short" />
        <span className="skeleton-line title" />
        <span className="skeleton-line copy" />
      </div>
      <div className="route-loading-grid">
        {variant === "dashboard" ? (
          <>
            <span className="skeleton-panel" /><span className="skeleton-panel" /><span className="skeleton-panel" /><span className="skeleton-panel" />
            <span className="skeleton-panel wide" />
            <span className="skeleton-panel half" /><span className="skeleton-panel half" />
          </>
        ) : variant === "table" ? (
          <>
            <span className="skeleton-panel wide" style={{ minHeight: 120 }} />
            <span className="skeleton-panel wide" style={{ minHeight: 520 }} />
          </>
        ) : (
          <>
            <span className="skeleton-panel half" /><span className="skeleton-panel half" />
            <span className="skeleton-panel wide" />
          </>
        )}
      </div>
      <span className="sr-only">正在读取售后经营数据</span>
    </div>
  )
}
