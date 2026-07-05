"use client";
import { useState } from "react";
import { supabase } from "../supabase";

type Mode = "login" | "signup" | "forgot";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setMessage("");
    setOk(false);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else window.location.href = "/dashboard";
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) setMessage(error.message);
      else { setOk(true); setMessage("Проверь почту — мы отправили письмо для подтверждения!"); }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) setMessage(error.message);
      else { setOk(true); setMessage("Если такой аккаунт есть — мы отправили письмо со ссылкой для сброса пароля."); }
    }
    setLoading(false);
  };

  const subtitle =
    mode === "login" ? "Войди чтобы начать дуэль"
    : mode === "signup" ? "Создай аккаунт бесплатно"
    : "Восстановление пароля";

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="text-3xl font-bold tracking-tight mb-2">
            duel<span className="text-red-500">.</span>dev
          </div>
          <div className="text-gray-400 text-sm">{subtitle}</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">

          {mode === "signup" && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Имя пользователя</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="например: codekiller99"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="твой@email.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="минимум 6 символов"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
          )}

          {mode === "login" && (
            <div className="text-right">
              <button
                onClick={() => { setMode("forgot"); setMessage(""); setOk(false); }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Забыли пароль?
              </button>
            </div>
          )}

          {message && (
            <div className={`text-sm px-4 py-3 rounded-xl ${ok ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
              {message}
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {loading ? "Загрузка..."
              : mode === "login" ? "Войти"
              : mode === "signup" ? "Создать аккаунт"
              : "Отправить ссылку"}
          </button>

          <div className="text-center text-sm text-gray-500">
            {mode === "forgot" ? (
              <button
                onClick={() => { setMode("login"); setMessage(""); setOk(false); }}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                ← Назад ко входу
              </button>
            ) : (
              <>
                {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
                <button
                  onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); setOk(false); }}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  {mode === "login" ? "Зарегистрироваться" : "Войти"}
                </button>
              </>
            )}
          </div>
        </div>

        {mode === "signup" && (
          <p className="text-center text-xs text-gray-600 mt-4 px-4">
            Регистрируясь, ты соглашаешься с тем, что DLC — внутриигровая валюта без реальной денежной ценности.
          </p>
        )}
      </div>
    </div>
  );
}
