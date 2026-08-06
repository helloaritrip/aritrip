import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="rounded-md border border-rule bg-surface p-4 text-sm text-muted">
        Draft — not reviewed by a lawyer. This describes the product as it exists today (MVP, no
        accounts, no stored personal data yet) and will be replaced with a reviewed version before
        real launch.
      </div>
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-ink [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_p]:text-muted [&_li]:text-muted [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
