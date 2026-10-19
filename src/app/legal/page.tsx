import Link from "next/link";

export const metadata = { title: "Terms & Privacy · Next Steps.IO" };

export default function Legal() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <Link href="/" className="btn-ghost self-start text-sm">
        ← Back
      </Link>
      <section id="terms" className="pill rim-blue p-6">
        <h1 className="mb-3 text-2xl font-extrabold">Terms (demo)</h1>
        <p>Next Steps.IO is a coaching tool for adults 18+. It isn&apos;t therapy or medical, legal or financial advice. Subscriptions start with a 1-month free trial and renew until cancelled. Final terms will be published before launch.</p>
      </section>
      <section id="privacy" className="pill rim-mint p-6">
        <h2 className="mb-3 text-2xl font-extrabold">Privacy (demo)</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>We collect only what personalizes your plan; gender is optional.</li>
          <li>Voice audio is transcribed, not stored. Clear transcripts any time.</li>
          <li>Texts only with your opt-in; reply STOP to unsubscribe.</li>
          <li>We never sell your data. Export or delete it from Settings.</li>
          <li>In this demo build, your data stays on this device.</li>
        </ul>
      </section>
    </main>
  );
}
