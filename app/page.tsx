"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

type Duel = {
  id: string;
  task: string;
  language: string;
  duration_minutes: number;
  stake: number;
  status: string;
  created_at: string;
  creator_id: string;
  opponent_id: string | null;
  profiles?: { username: string };
};

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState("open");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDuel, setSelectedDuel] = useState<Duel | null>(null);
  const [stake, setStake] = useState(1000);
  const [task, setTask] = useState("");
  const [language, setLanguage] = useState("Любой");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ username: string; balance: number } | null>(null);
  const [duels, setDuels] = useState<Duel[]>([]);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/auth");
      return;
    }

    setUserId(session.user.id);

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

    await loadDuels();
    setLoading(false);
  }

  async function loadDuels() {
    const { data } = await supabase
      .from("duels")
      .select("*, profiles!duels_creator_id_fkey(username)")
      .order("created_at", { ascending: false });

    if (data) setDuels(data as Duel[]);
  }

  async function refreshProfile() {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("username, balance")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  async function handlePublish() {
    if (!task.trim()) {
      setErrorMsg("Опиши задачу для дуэли");
      return;
    }
    if (!profile || profile.balance < stake) {
      setErrorMsg("Недостаточно средств на балансе");
      return;
    }

    setPublishing(true);
    setErrorMsg("");

    const { error: duelError } = await supabase.from("duels").insert({
      creator_id: userId,
      task,
      language,
      duration_minutes: duration,
      stake,
      status: "open",
    });

    if (duelError) {
      setErrorMsg(duelError.message);
      setPublishing(false);
      return;
    }

    const newBalance = profile.balance - stake;
    await supabase.from("profiles").update({ balance: newBalance }).eq("id", userId);
    setProfile({ ...profile, balance: newBalance });

    await loadDuels();
    setPublishing(false);
    setShowCreate(false);
    setTask("");
    setStake(1000);
  }

  async function handleAccept(duel: Duel) {
    if (!profile || profile.balance < duel.stake) {
      setErrorMsg("Недостаточно средств чтобы принять вызов");
      return;
    }

    setAccepting(true);
    setErrorMsg("");

    const { error: updateError } = await supabase
      .from("duels")
      .update({ opponent_id: userId, status: "live" })
      .eq("id", duel.id)
      .eq("status", "open"); // защита от двойного принятия

    if (updateError) {
      setErrorMsg(updateError.message);
      setAccepting(false);
      return;
    }

    const newBalance = profile.balance - duel.stake;
    await supabase.from("profiles").update({ balance: newBalance }).eq("id", userId);
    setProfile({ ...profile, balance: newBalance });

    await loadDuels();
    setAccepting(false);
    setSelectedDuel(null);
    setTab("live");
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

  // Экран деталей дуэли / принятия вызова
  if (selectedDuel) {
    const isMine = selectedDuel.creator_id === userId;
    const duelPrize = Math.round(selectedDuel.stake * 2 * 0.9);
    const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(selectedDuel.created_at).getTime()) / 60000));

    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-lg mx-auto px-4 py-6">
          <button onClick={() => setSelectedDuel(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
            ← Назад
          </button>

          <h1 className="text-2xl font-semibold mb-6">Детали дуэли</h1>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center text-sm font-medium">
                {selectedDuel.profiles?.username?.slice(0, 2).toUpperCase() || "??"}
              </div>
              <div>
                <div className="text-sm font-medium">{selectedDuel.profiles?.username || "Игрок"}</div>
                <div className="text-xs text-gray-500">{minutesAgo} мин назад</div>
              </div>
            </div>

            <p className="text-gray-300 mb-4">{selectedDuel.task}</p>

            <div className="flex gap-2 mb-4">
              <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-1 rounded-full">{selectedDuel.language}</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">
                {selectedDuel.duration_minutes < 60 ? `${selectedDuel.duration_minutes} мин` : selectedDuel.duration_minutes === 1440 ? "24 часа" : `${selectedDuel.duration_minutes / 60} час`}
              </span>
            </div>

            <div className="border-t border-gray-800 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Ставка каждого</span>
                <span>{selectedDuel.stake.toLocaleString("ru-RU")} ₽</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Победитель получит</span>
                <span className="text-green-400">{duelPrize.toLocaleString("ru-RU")} ₽</span>
              </div>
            </div>
          </div>

          {isMine ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-gray-400 text-sm">
              Это твоя дуэль. Жди когда кто-то примет вызов.
            </div>
          ) : selectedDuel.status === "live" ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-gray-400 text-sm">
              Дуэль уже принята другим игроком.
            </div>
          ) : (
            <>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Твой баланс</span>
                  <span>{profile?.balance.toLocaleString("ru-RU")} ₽</span>
                </div>
              </div>

              {errorMsg && (
                <div className="text-sm px-4 py-3 rounded-xl bg-red-900/50 text-red-400 mb-4">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={() => handleAccept(selectedDuel)}
                disabled={accepting}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
              >
                {accepting ? "Принятие вызова..." : `Принять вызов — ${selectedDuel.stake.toLocaleString("ru-RU")} ₽`}
              </button>
            </>
          )}
        </div>
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
                value={task}
                onChange={e => setTask(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 resize-none h-24 focus:outline-none focus:border-gray-600"
                placeholder="Например: решить Two Sum на LeetCode быстрее соперника..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Язык программирования</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-gray-600"
              >
                <option>Любой</option>
                <option>Python</option>
                <option>JavaScript</option>
                <option>Java</option>
                <option>C++</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Время на решение</label>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-gray-600"
              >
                <option value={15}>15 минут</option>
                <option value={30}>30 минут</option>
                <option value={60}>1 час</option>
                <option value={1440}>24 часа</option>
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
                <span className="text-gray-400">Твой баланс</span>
                <span>{profile?.balance.toLocaleString("ru-RU")} ₽</span>
              </div>
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

            {errorMsg && (
              <div className="text-sm px-4 py-3 rounded-xl bg-red-900/50 text-red-400">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {publishing ? "Публикация..." : `Опубликовать вызов — ${stake.toLocaleString("ru-RU")} ₽`}
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
            <div className="text-xs text-gray-500 mb-1">Банк всего</div>
            <div className="text-2xl font-semibold">{duels.reduce((sum, d) => sum + d.stake * 2, 0).toLocaleString("ru-RU")} ₽</div>
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
          {filtered.map(d => {
            const initials = d.profiles?.username?.slice(0, 2).toUpperCase() || "??";
            const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(d.created_at).getTime()) / 60000));
            const isMine = d.creator_id === userId;
            return (
              <div
                key={d.id}
                onClick={() => setSelectedDuel(d)}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-xs font-medium">{initials}</div>
                    <div>
                      <div className="text-sm font-medium">{d.profiles?.username || "Игрок"} {isMine && <span className="text-gray-500">(ты)</span>}</div>
                      <div className="text-xs text-gray-500">{minutesAgo} мин назад</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${d.status === "live" ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"}`}>
                    {d.status === "live" ? "● Live" : "Открыта"}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mb-3">{d.task}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-1 rounded-full">{d.language}</span>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Ставка {d.stake.toLocaleString("ru-RU")} ₽</div>
                    <div className="text-lg font-semibold text-green-400">{(d.stake * 2 * 0.9).toLocaleString("ru-RU")} ₽</div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-gray-600 py-12">Нет активных дуэлей. Создай первую!</div>
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
