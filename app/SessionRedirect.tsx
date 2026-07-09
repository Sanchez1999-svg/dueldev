"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

// Invisible helper: if the visitor already has a session, send them to the
// dashboard. Runs only after JS loads, so it never blocks the (server-
// rendered) landing content from showing.
export default function SessionRedirect() {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });
  }, [router]);
  return null;
}
