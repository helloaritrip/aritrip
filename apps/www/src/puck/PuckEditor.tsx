import { useEffect, useState } from "react";
import { Puck, type Data } from "@measured/puck";
import "@measured/puck/puck.css";
import { config, type Props } from "./config";

/**
 * Editor visual — corre solo en el navegador (client:only), nunca en SSR.
 * "Publicar" descarga un JSON en vez de guardarlo en un servidor: los
 * Workers de Cloudflare no tienen filesystem persistente en producción,
 * así que no hay backend real al que guardar todavía. El flujo hoy es:
 * editar acá -> descargar JSON -> guardarlo en src/content/pages/ ->
 * commitear -> el build de Astro lo renderiza como página estática.
 * Cuando haya un backend real (Firestore conectado), esto cambia a un
 * guardado automático sin tocar el resto del pipeline.
 *
 * NO está linkeada desde ninguna página pública — no tiene autenticación
 * todavía. Antes de cualquier deploy real, esta ruta necesita quedar
 * detrás de auth o fuera del build público.
 *
 * El slug se lee de ?slug= en la URL (client-side) para no necesitar
 * rutas dinámicas server-rendered, que en este entorno chocan con el bug
 * conocido de astro dev en Windows (ver apps/www/README.md).
 */
export function PuckEditor() {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSlug(params.get("slug") || "untitled");
  }, []);

  if (slug === null) return null;

  function handlePublish(data: Data<Props>) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.alert(`Downloaded ${slug}.json — save it to src/content/pages/${slug}.json and rebuild.`);
  }

  const initialData: Data<Props> = { content: [], root: { props: { title: slug } } };

  return <Puck config={config} data={initialData} onPublish={handlePublish} />;
}
