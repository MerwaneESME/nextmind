import { NextResponse } from "next/server";
import { getSupabaseServerClient, requireAuthHeader } from "@/app/api/_utils/supabaseServer";

export async function GET(request: Request, context: { params: { phaseId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const phaseId = context.params.phaseId;

    const { data, error } = await supabase
      .from("lots")
      .select("*")
      .eq("phase_id", phaseId)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? [] });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: { phaseId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const phaseId = context.params.phaseId;
    const body = (await request.json().catch(() => null)) as any;
    if (!body || !String(body.name || "").trim()) {
      return NextResponse.json({ error: "Missing lot name" }, { status: 400 });
    }

    const payload = {
      phase_id: phaseId,
      name: String(body.name).trim(),
      description: body.description ? String(body.description).trim() : null,
      lot_type: body.lot_type ?? null,
      company_name: body.company_name ?? null,
      company_contact_name: body.company_contact_name ?? null,
      company_contact_email: body.company_contact_email ?? null,
      company_contact_phone: body.company_contact_phone ?? null,
      responsible_user_id: body.responsible_user_id ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      budget_estimated: Number(body.budget_estimated ?? 0) || 0,
      status: body.status ?? "planifie",
    };

    const { data, error } = await supabase.from("lots").insert(payload).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ id: data?.id });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

