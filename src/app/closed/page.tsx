"use client";

import { useRouter } from "next/navigation";
import { Orb } from "@/components/ui";
import { setState, useAppState } from "@/lib/store";

export default function Closed() {
  const router = useRouter();
  const s = useAppState();
  const open = (nextDay: boolean) => {
    if (nextDay) setState({ lastVisit: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) });
    setState({ resumeNext: true });
    router.push("/home");
  };
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="flex flex-col items-center gap-5">
        <Orb size={120} />
        <h1 className="text-3xl font-extrabold">See you soon{s.profile.name ? `, ${s.profile.name}` : ""}.</h1>
        <p className="text-ink-soft">Next Steps is closed. Peaches will pick up right where you left off.</p>
        <button className="btn-primary" onClick={() => open(false)}>
          Open Next Steps
        </button>
        <button className="text-sm font-semibold text-ink-soft underline" onClick={() => open(true)}>
          Demo: open it on another day
        </button>
      </div>
    </main>
  );
}
