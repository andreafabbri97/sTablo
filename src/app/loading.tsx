export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl skeleton" />
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-lg skeleton" />
          <div className="h-3 w-24 rounded skeleton" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card-surface h-24" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl skeleton" />
        ))}
      </div>
    </div>
  );
}
