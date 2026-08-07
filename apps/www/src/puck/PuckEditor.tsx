import { useEffect, useState } from "react";
import { Puck, type Data } from "@measured/puck";
import "@measured/puck/puck.css";
import { config, type Props } from "./config";

type PageMeta = {
  title: string;
  description: string;
  country: string;
  city: string;
  continent: string;
  language: string;
  status: "draft" | "published";
  template: string;
};

const EMPTY_META: PageMeta = {
  title: "",
  description: "",
  country: "",
  city: "",
  continent: "",
  language: "en",
  status: "draft",
  template: "custom",
};

/**
 * Editor visual — corre solo en el navegador (client:only). Guarda de
 * verdad en Firestore (colección `pages`, vía /api/admin/pages/[slug])
 * desde 2026-08-07 — antes "Publicar" descargaba un .json que había que
 * ubicar a mano en el repo y redeployar. También corrige un bug real: el
 * editor nunca cargaba el contenido de una página existente, siempre
 * arrancaba en blanco sin importar el slug.
 *
 * El slug se lee de ?slug= en la URL (client-side) para no necesitar
 * rutas dinámicas server-rendered, que en este entorno chocan con el bug
 * conocido de astro dev en Windows (ver apps/www/README.md).
 */
export function PuckEditor() {
  const [slug, setSlug] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Data<Props> | null>(null);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_META);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("slug") || "untitled";
    setSlug(s);

    fetch(`/api/admin/pages/${encodeURIComponent(s)}`)
      .then((res) => (res.ok ? res.json() : res.status === 404 ? null : Promise.reject()))
      .then((doc) => {
        if (doc) {
          setInitialData(doc.content as Data<Props>);
          setMeta({
            title: doc.title ?? s,
            description: doc.description ?? "",
            country: doc.country ?? "",
            city: doc.city ?? "",
            continent: doc.continent ?? "",
            language: doc.language ?? "en",
            status: doc.status === "published" ? "published" : "draft",
            template: doc.template ?? "custom",
          });
        } else {
          setInitialData({ content: [], root: { props: { title: s } } });
          setMeta({ ...EMPTY_META, title: s });
        }
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading" || !slug) return <p style={{ padding: 24, fontFamily: "sans-serif" }}>Loading…</p>;
  if (status === "error") return <p style={{ padding: 24, fontFamily: "sans-serif" }}>Couldn&apos;t load this page.</p>;

  async function handlePublish(data: Data<Props>) {
    setSaveMessage("Saving…");
    const title = (data.root.props?.title as string | undefined) || meta.title || slug;
    const res = await fetch(`/api/admin/pages/${encodeURIComponent(slug!)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, title, content: data }),
    });
    setSaveMessage(res.ok ? `Saved — live at /p/${slug}` : "Failed to save.");
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "8px 16px",
          borderBottom: "1px solid #dce6f2",
          fontFamily: "sans-serif",
          fontSize: 13,
        }}
      >
        <label>
          Status:{" "}
          <select value={meta.status} onChange={(e) => setMeta((m) => ({ ...m, status: e.target.value as PageMeta["status"] }))}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label>
          Description: <input value={meta.description} onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))} />
        </label>
        <label>
          Country: <input value={meta.country} onChange={(e) => setMeta((m) => ({ ...m, country: e.target.value }))} />
        </label>
        <label>
          City: <input value={meta.city} onChange={(e) => setMeta((m) => ({ ...m, city: e.target.value }))} />
        </label>
        <label>
          Continent: <input value={meta.continent} onChange={(e) => setMeta((m) => ({ ...m, continent: e.target.value }))} />
        </label>
        <span>{saveMessage}</span>
      </div>
      <Puck config={config} data={initialData!} onPublish={handlePublish} />
    </div>
  );
}
