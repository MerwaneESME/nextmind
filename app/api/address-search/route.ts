import { NextRequest, NextResponse } from "next/server";

const API_URL = "https://api-adresse.data.gouv.fr/search/";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  const limit = request.nextUrl.searchParams.get("limit") ?? "6";

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ features: [] });
  }

  try {
    const params = new URLSearchParams({ q: q.trim(), limit });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${API_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "NextMind/1.0 (https://nextmind.fr)",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Address search error:", error);
    return NextResponse.json({ features: [] });
  }
}
