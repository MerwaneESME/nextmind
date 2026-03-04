import { NextResponse } from "next/server";
import { getSupabaseServerClient, requireAuthHeader } from "@/app/api/_utils/supabaseServer";

export async function GET(request: Request, context: { params: { lotId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const lotId = context.params.lotId;

    const { data, error } = await supabase
      .from("lot_tasks")
      .select("*")
      .eq("lot_id", lotId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? [] });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: { lotId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const lotId = context.params.lotId;
    const body = (await request.json().catch(() => null)) as any;
    if (!body || !String(body.title || "").trim()) {
      return NextResponse.json({ error: "Missing task title" }, { status: 400 });
    }

    const payload = {
      lot_id: lotId,
      title: String(body.title).trim(),
      description: body.description ? String(body.description).trim() : null,
      order_index: Number(body.order_index ?? 0) || 0,
      status: body.status ?? "todo",
      due_date: body.due_date ?? null,
    };

    const { data, error } = await supabase.from("lot_tasks").insert(payload).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ id: data?.id });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

