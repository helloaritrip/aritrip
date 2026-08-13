import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getUserSession } from "@/lib/requireUserSession";
import { corsHeaders } from "@/lib/cors";

// Con CORS — la isla de "guardar favorito" en aritrips.com/deals llama
// esto cross-origin (con cookies) para saber si mostrar el corazón o un
// link para iniciar sesión.
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const session = await getUserSession(request, env);
  const headers = corsHeaders(request.headers.get("origin"));

  if (!session) return NextResponse.json({ user: null }, { headers });
  return NextResponse.json(
    { user: { uid: session.uid, email: session.email, name: session.name, picture: session.picture } },
    { headers }
  );
}
