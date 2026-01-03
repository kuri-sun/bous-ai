"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessions } from "./sessions-context";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { sessions } = useSessions();

  const activeId = useMemo(() => {
    if (!pathname) {
      return null;
    }
    const parts = pathname.split("/");
    if (parts[1] === "sessions" && parts[2]) {
      return parts[2];
    }
    return null;
  }, [pathname]);

  return (
    <aside className="h-full overflow-y-auto border-r border-emerald-100">
      <div className="px-3 py-3">
        <button
          type="button"
          onClick={() => router.push("/sessions/create")}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-left text-sm font-semibold text-white hover:bg-emerald-700"
        >
          マニュアルを作成
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="px-3 py-2 text-xs text-emerald-700">
          セッションがまだありません。
        </p>
      ) : (
        sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => router.push(`/sessions/${session.id}`)}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 ${
              activeId === session.id ? "bg-emerald-50" : ""
            }`}
          >
            <p className="font-semibold text-emerald-900">
              {session.id.slice(0, 8)}
            </p>
            <p className="mt-1 text-emerald-700">
              状態: {session.status ?? "step1"}
            </p>
            {session.pdf_url ? (
              <span className="mt-2 inline-flex text-emerald-800 underline">
                PDF
              </span>
            ) : null}
          </button>
        ))
      )}
    </aside>
  );
}
