"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

const duels = [
  { id: 1, author: "Maxim K.", initials: "МК", task: "Two Sum — кто быстрее решит", stake: 2000, status: "open", time: "30 мин", lang: "Python / JS" },
  { id: 2, author: "Daria S.", initials: "ДС", task: "Реверс связного списка", stake: 500, status: "open", time: "15 мин", lang: "Любой" },
  { id: 3, author: "Igor P.", initials: "ИП", task: "Binary Search Tree — вставка", stake: 5000, status: "live", time: "осталось 12 мин", lang: "Java / C++" },
  { id: 4, author: "Anna V.", initials: "АВ", task: "Fibonacci за O(n)", stake: 1000, status: "open", time: "20 мин", lang: "Любой" },
];

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState("open");
  const [showCreate, setShowCreate] = useState(false);
  const [stake, setStake] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ username: string; balance: number } | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/auth");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("username, balance")
      .eq("id", session.user.id)
      .single();

    if (data) {
      setProfile(data);
    } else {
      setProfile({ username: session.user.email?.split("@")[0] || "Игрок", balance: 0 });
    }
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const filtered = duels.filter(d =>
    tab === "open" ? d.status === "open" : d.status === "live"
  );

  const commission = 0.1;
  const prize = Math.round(stake * 2 * (1 - commission));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (showCreate) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-lg mx-auto px-4 py-6">
          <button onClick={() => setShowCreate(false)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
            ← Назад
          </button>
          <h1 className="text-2xl font-semibold mb-6">Новая дуэль</h1>

          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Задача</label>
              <textarea
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 resize-none h-24 focus:outline-none focus:border-gray-600"
                placeholder="Например: решить Two Sum на LeetCode быстрее соперника..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Язык программирования</label>
              <select className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-gray-600">
                <option>Любой</option>
                <option>Python</option>
                <option>JavaScript</option>
                <option>Java</option>
                <option>C++</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Время на решение</label>
              <select className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-gray-600">
                <option>15 минут</option>
                <option>30 минут</option>
                <option>1 час</option>
                <option>24 часа</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Ставка: <span className="text-white font-medium">{stake.toLocaleString("ru-RU")} ₽</span>
              </label>
              <input
                type="range" min={500} max={20000} step={500} value={stake}
                onChange={e => setStake(Number(e.target.value))}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>500 ₽</span><span>20 000 ₽</span>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Банк дуэли</span>
                <span>{(stake * 2).toLocaleString("ru-RU")} ₽</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Комиссия платформы (10%)</span>
                <span className="text-red-400">−{(stake * 2 * 0.1).toLocaleString("ru-RU")} ₽</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-gray-800 pt-2 mt-2">
                <span>Победитель получит</span>
                <span className="text-green-400">{prize.toLocaleString("ru-RU")} ₽</span>
              </div>
            </div>

            <button
              onClick={() => setShowCreate(false)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Опубликовать вызов — {stake.toLocaleString("ru-RU")} ₽
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-2xl font-bold tracking-tight">
            duel<span className="text-red-500">.</span>dev
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              Баланс: <span className="text-white font-medium">{profile?.balance?.toLocaleString("ru-RU") || 0} ₽</span>
            </span>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-medium hover:bg-blue-700 transition-colors"
              title="Выйти"
            >
              {profile?.username?.slice(0, 2).toUpperCase() || "??"}
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          Привет, <span className="text-gray-300">{profile?.username}</span>!
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Открытых дуэлей</div>
            <div className="text-2xl font-semibold">{duels.filter(d => d.status === "open").length}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Банк сегодня</div>
            <div className="text-2xl font-semibold">47 000 ₽</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-4">
          {[["open", "Открытые"], ["live", "Идут сейчас"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-red-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}
            >
              {label}
              {key === "live" && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block animate-pulse"></span>}
            </button>
          ))}
        </div>

        {/* Duel cards */}
        <div className="space-y-3 mb-6">
          {filtered.map(d => (
            <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-xs font-medium">{d.initials}</div>
                  <div>
                    <div className="text-sm font-medium">{d.author}</div>
                    <div className="text-xs text-gray-500">{d.time}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${d.status === "live" ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"}`}>
                  {d.status === "live" ? "● Live" : "Открыта"}
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-3">{d.task}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-1 rounded-full">{d.lang}</span>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Ставка {d.stake.toLocaleString("ru-RU")} ₽</div>
                  <div className="text-lg font-semibold text-green-400">{(d.stake * 2 * 0.9).toLocaleString("ru-RU")} ₽</div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-gray-600 py-12">Нет активных дуэлей</div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => setShowCreate(true)}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl transition-colors"
        >
          + Бросить вызов
        </button>
      </div>
    </div>
  );
}
