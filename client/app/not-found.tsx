export default function NotFound() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-white text-emerald-900">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">ページが見つかりません</h1>
        <p className="mt-2 text-sm text-emerald-700">
          お探しのページは存在しないか、移動された可能性があります。
        </p>
      </div>
    </div>
  );
}
