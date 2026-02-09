import { NextResponse } from "next/server";
import { getSupabaseServerClient, requireAuthHeader } from "@/app/api/_utils/supabaseServer";

export async function GET(request: Request, context: { params: { phaseId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const phaseId = context.params.phaseId;

    const { data, error } = await supabase.from("phases").select("*").eq("id", phaseId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? null });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: { phaseId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const phaseId = context.params.phaseId;
    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const patch: Record<string, any> = {};
    const map: Record<string, string> = {
      name: "name",
      description: "description",
      phase_order: "phase_order",
      start_date: "start_date",
      end_date: "end_date",
      estimated_duration_days: "estimated_duration_days",
      budget_estimated: "budget_estimated",
      budget_actual: "budget_actual",
      status: "status",
      phase_manager_id: "phase_manager_id",
    };
    for (const [k, dest] of Object.entries(map)) {
      if (k in body) patch[dest] = body[k];
    }

    const { error } = await supabase.from("phases").update(patch).eq("id", phaseId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: { phaseId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const phaseId = context.params.phaseId;

    const { error } = await supabase.from("phases").delete().eq("id", phaseId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

