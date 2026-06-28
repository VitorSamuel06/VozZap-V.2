export default function PublicationSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1C1C1C] rounded-2xl border border-[#ECE5DD] dark:border-[#30363D] overflow-hidden mb-4">
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-4 skeleton rounded-full w-32" />
            <div className="h-3 skeleton rounded-full w-24" />
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 space-y-2">
        <div className="h-5 skeleton rounded-full w-3/4" />
        <div className="h-3 skeleton rounded-full w-full" />
        <div className="h-3 skeleton rounded-full w-2/3" />
      </div>
      <div className="px-4 pb-4">
        <div className="h-20 skeleton rounded-2xl" />
      </div>
      <div className="flex border-t border-[#ECE5DD] dark:border-[#30363D]">
        <div className="flex-1 h-12 skeleton opacity-30" />
        <div className="flex-1 h-12 skeleton opacity-20 ml-px" />
        <div className="flex-1 h-12 skeleton opacity-30 ml-px" />
      </div>
    </div>
  )
}
