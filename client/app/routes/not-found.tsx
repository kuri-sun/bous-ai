import { CenteredPageState } from "../components/ui/CenteredPageState";

export default function NotFoundPage() {
  return (
    <CenteredPageState
      title="ページが見つかりません"
      description="お探しのページは存在しないか、移動された可能性があります。"
    />
  );
}
