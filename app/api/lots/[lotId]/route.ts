import { NextResponse } from "next/server";
import { getSupabaseServerClient, requireAuthHeader } from "@/app/api/_utils/supabaseServer";

export async function GET(request: Request, context: { params: { lotId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const lotId = context.params.lotId;

    const { data, error } = await supabase.from("lots").select("*").eq("id", lotId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? null });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: { lotId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const lotId = context.params.lotId;
    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const patch: Record<string, any> = {};
    const map: Record<string, string> = {
      name: "name",
      description: "description",
      lot_type: "lot_type",
      company_name: "company_name",
      company_contact_name: "company_contact_name",
      company_contact_email: "company_contact_email",
      company_contact_phone: "company_contact_phone",
      responsible_user_id: "responsible_user_id",
      start_date: "start_date",
      end_date: "end_date",
      estimated_duration_days: "estimated_duration_days",
      actual_duration_days: "actual_duration_days",
      delay_days: "delay_days",
      budget_estimated: "budget_estimated",
      budget_actual: "budget_actual",
      status: "status",
      progress_percentage: "progress_percentage",
    };
    for (const [k, dest] of Object.entries(map)) {
      if (k in body) patch[dest] = body[k];
    }

    const { error } = await supabase.from("lots").update(patch).eq("id", lotId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: { lotId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const lotId = context.params.lotId;

    const { error } = await supabase.from("lots").delete().eq("id", lotId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

