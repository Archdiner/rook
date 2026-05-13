export default function AppLoading() {
  return (
    <div className="p-8 max-w-5xl mx-auto sans-text animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="h-3 w-16 bg-black/[0.06] rounded mb-2" />
          <div className="h-8 w-48 bg-black/[0.06] rounded" />
        </div>
        <div className="h-10 w-32 bg-black/[0.06] rounded" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white border border-black/[0.05] rounded-2xl p-6">
            <div className="h-3 w-24 bg-black/[0.06] rounded mb-3" />
            <div className="h-10 w-12 bg-black/[0.06] rounded mb-2" />
            <div className="h-3 w-20 bg-black/[0.06] rounded" />
          </div>
        ))}
      </div>

      {/* Finding card skeleton */}
      <div className="bg-white border border-black/[0.05] rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="h-6 w-3/4 bg-black/[0.06] rounded" />
          <div className="h-5 w-16 bg-black/[0.06] rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-black/[0.06] rounded" />
          <div className="h-3 w-5/6 bg-black/[0.06] rounded" />
        </div>
      </div>
    </div>
  );
}
