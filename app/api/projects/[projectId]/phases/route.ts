import { NextResponse } from "next/server";
import { getSupabaseServerClient, requireAuthHeader } from "@/app/api/_utils/supabaseServer";

export async function GET(request: Request, context: { params: { projectId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const projectId = context.params.projectId;

    const { data, error } = await supabase
      .from("phases")
      .select("id,project_id,name,description,phase_order,start_date,end_date,budget_estimated,budget_actual,status,phase_manager_id")
      .eq("project_id", projectId)
      .order("phase_order", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? [] });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  try {
    const authorization = requireAuthHeader(request);
    const supabase = getSupabaseServerClient(authorization);
    const projectId = context.params.projectId;
    const body = (await request.json().catch(() => null)) as any;
    if (!body || !String(body.name || "").trim()) {
      return NextResponse.json({ error: "Missing phase name" }, { status: 400 });
    }

    const payload = {
      project_id: projectId,
      name: String(body.name).trim(),
      description: body.description ? String(body.description).trim() : null,
      phase_order: Number(body.phase_order ?? 1) || 1,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      budget_estimated: Number(body.budget_estimated ?? 0) || 0,
      status: body.status ?? "planifiee",
      phase_manager_id: body.phase_manager_id ?? null,
    };

    const { data, error } = await supabase.from("phases").insert(payload).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ id: data?.id });
  } catch (e: any) {
    if (String(e?.message) === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

