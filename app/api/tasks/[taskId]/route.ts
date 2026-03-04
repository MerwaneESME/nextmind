import { NextResponse } from "next/server";
import { getSupabaseServerClient, requireAuthHeader } from "@/app/api/_utils/supabaseServer";

export async function PUT(request: Request, context: { params: { taskId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const taskId = context.params.taskId;
    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const patch: Record<string, any> = {};
    const map: Record<string, string> = {
      title: "title",
      description: "description",
      order_index: "order_index",
      status: "status",
      due_date: "due_date",
      completed_at: "completed_at",
    };
    for (const [k, dest] of Object.entries(map)) {
      if (k in body) patch[dest] = body[k];
    }

    const { error } = await supabase.from("lot_tasks").update(patch).eq("id", taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: { taskId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const taskId = context.params.taskId;
    const { error } = await supabase.from("lot_tasks").delete().eq("id", taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

