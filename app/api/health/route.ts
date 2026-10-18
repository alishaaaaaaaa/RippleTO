import { NextResponse } from "next/server";
import { aiEnabled } from "@/lib/ai/gemini";

export function GET() {
  return NextResponse.json({
    ai: aiEnabled(),
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    voice: !!process.env.ELEVENLABS_API_KEY,
  });
}
