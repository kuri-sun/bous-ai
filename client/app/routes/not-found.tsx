export default function NotFoundPage() {
  return (
    <section className="flex h-full items-center justify-center bg-white text-gray-900">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">ページが見つかりません</h1>
        <p className="mt-2 text-sm text-gray-700">
          お探しのページは存在しないか、移動された可能性があります。
        </p>
      </div>
    </section>
  );
}
