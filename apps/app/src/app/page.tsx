import { Button } from "@travel-package-builder/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="text-sm uppercase tracking-wide text-muted">Sprint 0 — esqueleto</p>
      <h1 className="text-3xl font-semibold text-ink">Travel Package Builder</h1>
      <p className="max-w-md text-muted">
        El formulario de búsqueda llega en Sprint 2. Esta página confirma que
        el monorepo, packages/ui y los tokens claro/oscuro funcionan.
      </p>
      <Button>Botón compartido desde packages/ui</Button>
    </main>
  );
}
