"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "./supabase";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="text-2xl font-bold tracking-tight">
          duel<span className="text-red-500">.</span>dev
        </div>
        <button
          onClick={() => router.push("/auth")}
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
        >
          Войти
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <div className="inline-block bg-red-600/10 border border-red-600/20 text-red-400 text-xs font-medium px-3 py-1 rounded-full mb-6">
          Бесплатно · 5 000 DLC на старт
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 max-w-2xl leading-tight">
          Брось вызов<br />
          <span className="text-red-500">программисту</span>
        </h1>

        <p className="text-gray-400 text-lg sm:text-xl max-w-xl mb-10 leading-relaxed">
          Решайте одну задачу на время. Кто быстрее — забирает ставку. Соревнуйся с друзьями или незнакомцами.
        </p>

        <button
          onClick={() => router.push("/auth")}
          className="bg-red-600 hover:bg-red-700 text-white text-lg font-semibold px-10 py-4 rounded-2xl transition-colors shadow-lg shadow-red-600/20 mb-4"
        >
          Начать бесплатно
        </button>
        <p className="text-gray-600 text-sm">Регистрация за 30 секунд</p>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 max-w-3xl w-full">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left">
            <div className="text-2xl mb-3">⚡</div>
            <div className="font-semibold mb-1">Дуэли на время</div>
            <div className="text-gray-400 text-sm">Решайте задачи быстрее соперника. Побеждает скорость и качество кода.</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left">
            <div className="text-2xl mb-3">🏆</div>
            <div className="font-semibold mb-1">Ставки на победу</div>
            <div className="text-gray-400 text-sm">Ставь DLC или физический предмет. Победитель забирает всё.</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left">
            <div className="text-2xl mb-3">🎯</div>
            <div className="font-semibold mb-1">Любой язык</div>
            <div className="text-gray-400 text-sm">Python, JavaScript, C++, Java — выбирай свой язык и соревнуйся.</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-700 text-xs px-6">
        DLC — внутриигровая валюта без реальной денежной ценности. Дуэли носят развлекательный характер и не являются азартной игрой на деньги.
      </footer>
    </div>
  );
}
