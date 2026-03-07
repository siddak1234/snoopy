import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawEmail = body?.email;
    const password = body?.password;
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : undefined;

    const email = normalizeEmail(rawEmail);
    if (!email) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }
    if (typeof password !== "string" || password.length === 0) {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: fullName ? { data: { full_name: fullName } } : undefined,
    });

    if (error) {
      const code = error.code ?? error.message;
      if (code === "user_already_registered" || code.includes("already registered")) {
        console.warn("AUTH_SIGNUP_DUPLICATE", { email: `${email.slice(0, 3)}***` });
        return NextResponse.json(
          { error: "An account with this email already exists. Try logging in." },
          { status: 409 }
        );
      }
      if (code.includes("confirm") || code === "signup_requires_confirm") {
        console.log("AUTH_SIGNUP_CONFIRM_REQUIRED", { email: `${email.slice(0, 3)}***` });
        return NextResponse.json(
          { error: "Please check your email to confirm your account before signing in." },
          { status: 200 }
        );
      }
      console.error("AUTH_SIGNUP_FAIL", { email: `${email.slice(0, 3)}***`, message: error.message });
      return NextResponse.json(
        { error: error.message || "Sign up failed. Please try again." },
        { status: 400 }
      );
    }

    console.log("AUTH_SIGNUP_OK", {
      email: `${email.slice(0, 3)}***`,
      hasSession: Boolean(data.session),
    });
    return NextResponse.json({ ok: true, requiresConfirmation: !data.session });
  } catch (err) {
    console.error("AUTH_SIGNUP_ERROR", (err as Error).message);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
