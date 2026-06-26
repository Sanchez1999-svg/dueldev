"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user arrives via the email
    // link (the recovery token in the URL is exchanged for a session).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also handle the case where the session is already restored on load.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setMessage("Пароль должен быть минимум 6 символов");
      setOk(false);
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setOk(false);
    } else {
      setOk(true);
      setMessage("Пароль обновлён! Сейчас перенаправим…");
      setTimeout(() => router.push("/"), 1500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold tracking-tight mb-2">
            duel<span className="text-red-500">.</span>dev
          </div>
          <div className="text-gray-400 text-sm">Новый пароль</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          {!ready ? (
            <div className="text-sm text-gray-400 text-center py-4">
              Открой эту страницу по ссылке из письма для сброса пароля.
              <div className="mt-3">
                <button onClick={() => router.push("/auth")} className="text-red-400 hover:text-red-300">
                  ← Ко входу
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Новый пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="минимум 6 символов"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              {message && (
                <div className={`text-sm px-4 py-3 rounded-xl ${ok ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                  {message}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !password}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
              >
                {loading ? "Сохранение…" : "Сохранить пароль"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
