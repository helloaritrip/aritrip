import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { writeFirestoreDocument } from "@/lib/firestore";

const VALID_EVENT_NAMES = ["search_performed", "recommendation_shown", "recommendation_clicked"] as const;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name } = body;
  if (typeof name !== "string" || !VALID_EVENT_NAMES.includes(name as (typeof VALID_EVENT_NAMES)[number])) {
    return NextResponse.json({ error: "Invalid event name" }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;

  // Sin credenciales configuradas (ej. entorno local sin .dev.vars), no
  // rompemos la búsqueda del usuario por un evento de analytics — solo
  // no se persiste. Igual que el placeholder anterior, honesto en vez de
  // fingir.
  if (!clientEmail || !privateKey) {
    return NextResponse.json({ tracked: false, reason: "not_configured" });
  }

  try {
    await writeFirestoreDocument(
      "events",
      { ...body, createdAt: new Date() },
      { clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }
    );
    return NextResponse.json({ tracked: true });
  } catch (err) {
    console.error("[track] Firestore write failed", err);
    // Best-effort: un fallo de analytics no debe verse como error al usuario.
    return NextResponse.json({ tracked: false, reason: "write_failed" });
  }
}
