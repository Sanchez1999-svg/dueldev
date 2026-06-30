"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";
import { parseUtc, translateRpcError, formatRelativeTime } from "./utils";

type Duel = {
  id: string;
  task: string;
  language: string;
  duration_minutes: number;
  stake: number;
  status: string;
  created_at: string;
  started_at: string | null;
  creator_id: string;
  opponent_id: string | null;
  winner_id: string | null;
  problem_id: string | null;
  stake_type: "dlc" | "item";
  item_description: string | null;
};

const TASK_MAX_LENGTH = 2000;
const ITEM_DESC_MAX_LENGTH = 300;

const TASK_BANK: Record<string, Record<string, string[]>> = {
  "Алгоритмы": {
    "Легко": [
      "Two Sum — найти два числа в массиве, сумма которых равна заданному значению",
      "Перевернуть строку без использования встроенных функций",
      "Найти максимальное число в массиве без сортировки",
      "Проверить, является ли число простым",
    ],
    "Средне": [
      "Найти самую длинную подстроку без повторяющихся символов",
      "Реализовать бинарный поиск в отсортированном массиве",
      "Найти все пары чисел в массиве с заданной суммой",
      "Реверс связного списка",
    ],
    "Сложно": [
      "Реализовать LRU Cache с O(1) операциями",
      "Найти кратчайший путь в графе (алгоритм Дейкстры)",
      "Слияние k отсортированных списков",
      "Динамическое программирование: задача о рюкзаке",
    ],
  },
  "Вёрстка": {
    "Легко": [
      "Сверстать карточку товара по картинке (адаптивная)",
      "Сделать центрированную форму входа с email и паролем",
      "Сверстать навбар с логотипом и тремя пунктами меню",
      "Сделать кнопку с hover-эффектом по дизайну",
    ],
    "Средне": [
      "Сверстать адаптивную сетку из 6 карточек (responsive grid)",
      "Сделать модальное окно с затемнением фона",
      "Сверстать таб-переключатель (tabs) на чистом CSS/JS",
      "Сделать аккордеон с анимацией раскрытия",
    ],
    "Сложно": [
      "Сверстать pixel-perfect лендинг по макету за ограниченное время",
      "Сделать кастомный кастомизируемый видеоплеер",
      "Реализовать drag-and-drop список задач",
      "Сверстать сложную анимированную таймлайн-секцию",
    ],
  },
  "Строки и текст": {
    "Легко": [
      "Посчитать количество гласных в строке",
      "Проверить, является ли строка палиндромом",
      "Удалить все пробелы из строки",
      "Посчитать количество слов в предложении",
    ],
    "Средне": [
      "Найти все анаграммы слова в массиве строк",
      "Сжать строку (aaabbc → a3b2c1)",
      "Проверить, можно ли составить слово из букв другого слова",
      "Найти самый часто встречающийся символ в строке",
    ],
    "Сложно": [
      "Реализовать простой парсер шаблонов ({{name}} → значение)",
      "Написать функцию нечёткого поиска подстроки (fuzzy search)",
      "Реализовать собственный regex-движок для простых паттернов",
      "Написать алгоритм сжатия текста (упрощённый Хаффман)",
    ],
  },
};

function AcceptedToast({ text }: { text: string }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg">
      {text}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState("open");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDuel, setSelectedDuel] = useState<Duel | null>(null);
  const [stake, setStake] = useState(1000);
  const [category, setCategory] = useState("Алгоритмы");
  const [difficulty, setDifficulty] = useState("Легко");
  const [task, setTask] = useState(TASK_BANK["Алгоритмы"]["Легко"][0]);
  const [language, setLanguage] = useState("Любой");
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState<"ranked" | "custom">("ranked");
  const [stakeType, setStakeType] = useState<"dlc" | "item">("dlc");
  const [itemDescription, setItemDescription] = useState("");
  const [problems, setProblems] = useState<{ id: string; title: string; statement: string; ioSpec: string }[]>([]);
  const [problemId, setProblemId] = useState<string>("");
  const [solveCode, setSolveCode] = useState("");
  const [solveLang, setSolveLang] = useState("Python");
  const [shareCopied, setShareCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ username: string; balance: number; wins: number; losses: number } | null>(null);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [acceptedNotice, setAcceptedNotice] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ username: string; wins: number; losses: number }[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [unreadDuelIds, setUnreadDuelIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    checkUser();

    const channel = supabase
      .channel("duels-list")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "duels" }, (payload) => {
        const oldRow = payload.old as Duel;
        const newRow = payload.new as Duel;
        if (
          oldRow.status === "open" &&
          newRow.status === "live" &&
          newRow.creator_id === userIdRef.current
        ) {
          setAcceptedNotice("Твой вызов принят! Дуэль началась.");
        }
        loadDuels();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "duels" }, () => {
        loadDuels();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as { duel_id: string; sender_id: string };
        if (msg.sender_id !== userIdRef.current) {
          setUnreadDuelIds(prev => ({ ...prev, [msg.duel_id]: true }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!acceptedNotice) return;
    const t = setTimeout(() => setAcceptedNotice(null), 6000);
    return () => clearTimeout(t);
  }, [acceptedNotice]);

  useEffect(() => {
    fetch("/api/problems")
      .then(r => r.json())
      .then(d => {
        const list = d.problems || [];
        setProblems(list);
        if (list[0]) setProblemId(list[0].id);
      })
      .catch(() => {});
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/auth");
      return;
    }

    setUserId(session.user.id);
    userIdRef.current = session.user.id;

    const { data } = await supabase
      .from("profiles")
      .select("username, balance, wins, losses")
      .eq("id", session.user.id)
      .single();

    if (data) {
      setProfile(data);
    } else {
      setProfile({ username: session.user.email?.split("@")[0] || "Игрок", balance: 0, wins: 0, losses: 0 });
    }

    await loadDuels();
    setLoading(false);
  }

  async function loadDuels() {
    const { data } = await supabase
      .from("duels")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) return;
    setDuels(data as Duel[]);

    const ids = [...new Set(data.flatMap(d => [d.creator_id, d.opponent_id]).filter((id): id is string => !!id))];
    if (ids.length > 0) {
      const { data: people } = await supabase.from("public_profiles").select("id, username").in("id", ids);
      if (people) {
        setProfilesMap(prev => ({ ...prev, ...Object.fromEntries(people.map(p => [p.id, p.username])) }));
      }
    }
  }

  async function loadLeaderboard() {
    setLeaderboardLoading(true);
    const { data } = await supabase
      .from("public_profiles")
      .select("username, wins, losses")
      .order("wins", { ascending: false })
      .limit(50);
    if (data) setLeaderboard(data);
    setLeaderboardLoading(false);
  }

  async function refreshProfile() {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("username, balance, wins, losses")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  function resetCreateForm() {
    setShowCreate(false);
    setTask(TASK_BANK[category][difficulty][0]);
    setStake(1000);
    setSolveCode("");
    setStakeType("dlc");
    setItemDescription("");
  }

  async function handlePublish() {
    const ranked = mode === "ranked";
    const itemStake = !ranked && stakeType === "item";

    if (!profile) { setErrorMsg("Профиль не загружен"); return; }
    if (!itemStake && profile.balance < stake) {
      setErrorMsg("Недостаточно средств на балансе");
      return;
    }
    if (itemStake) {
      if (!itemDescription.trim()) { setErrorMsg("Опиши, что ставишь на спор"); return; }
      if (itemDescription.length > ITEM_DESC_MAX_LENGTH) {
        setErrorMsg(`Описание предмета слишком длинное (максимум ${ITEM_DESC_MAX_LENGTH} символов)`);
        return;
      }
    }

    if (ranked) {
      // Async ranked challenge: the creator solves it now; the server judges
      // and publishes the open challenge with the locked-in score.
      const chosenProblem = problems.find(p => p.id === problemId);
      if (!chosenProblem) { setErrorMsg("Выбери задачу для рейтинговой дуэли"); return; }
      if (!solveCode.trim()) { setErrorMsg("Напиши решение задачи, чтобы бросить вызов"); return; }

      setPublishing(true);
      setErrorMsg("");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErrorMsg("Сессия истекла, перезайди"); setPublishing(false); return; }

      try {
        const res = await fetch("/api/duel/create-ranked", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ problemId, code: solveCode, language: solveLang, stake, durationMinutes: duration }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Не удалось создать вызов");
          setPublishing(false);
          return;
        }
        await refreshProfile();
        await loadDuels();
        setPublishing(false);
        resetCreateForm();
      } catch {
        setErrorMsg("Не удалось связаться с сервером");
        setPublishing(false);
      }
      return;
    }

    // Custom (voting) duel: free-text task, insert directly.
    if (!task.trim()) {
      setErrorMsg("Опиши задачу для дуэли");
      return;
    }
    if (task.length > TASK_MAX_LENGTH) {
      setErrorMsg(`Задача слишком длинная (максимум ${TASK_MAX_LENGTH} символов)`);
      return;
    }

    setPublishing(true);
    setErrorMsg("");

    const { error: duelError } = await supabase.from("duels").insert({
      creator_id: userId,
      task,
      language,
      duration_minutes: duration,
      stake: itemStake ? 0 : stake,
      status: "open",
      problem_id: null,
      stake_type: itemStake ? "item" : "dlc",
      item_description: itemStake ? itemDescription.trim() : null,
    });

    if (duelError) {
      setErrorMsg(translateRpcError(duelError.message));
      setPublishing(false);
      return;
    }

    if (!itemStake) {
      const newBalance = profile.balance - stake;
      await supabase.from("profiles").update({ balance: newBalance }).eq("id", userId);
      setProfile({ ...profile, balance: newBalance });
    }

    await loadDuels();
    setPublishing(false);
    resetCreateForm();
  }

  async function handleAccept(duel: Duel) {
    if (!profile || profile.balance < duel.stake) {
      setErrorMsg("Недостаточно средств чтобы принять вызов");
      return;
    }

    setAccepting(true);
    setErrorMsg("");

    const { error: acceptError } = await supabase.rpc("accept_duel", { p_duel_id: duel.id });

    if (acceptError) {
      setErrorMsg(translateRpcError(acceptError.message));
      setAccepting(false);
      await loadDuels();
      return;
    }

    await refreshProfile();
    await loadDuels();
    setAccepting(false);
    router.push(`/duel/${duel.id}`);
  }

  async function handleCancel(duel: Duel) {
    setCancelling(true);
    setErrorMsg("");

    const { error: cancelError } = await supabase.rpc("cancel_duel", { p_duel_id: duel.id });

    if (cancelError) {
      setErrorMsg(translateRpcError(cancelError.message));
      setCancelling(false);
      await loadDuels();
      return;
    }

    await refreshProfile();
    await loadDuels();
    setCancelling(false);
    setSelectedDuel(null);
  }

  const filtered = duels.filter(d => {
    if (tab === "open") return d.status === "open";
    if (tab === "live") return d.status === "live";
    return (d.status === "finished" || d.status === "voided") && (d.creator_id === userId || d.opponent_id === userId);
  });

  const commission = 0.1;
  const prize = Math.round(stake * 2 * (1 - commission));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  // Экран лидерборда
  if (showLeaderboard) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-xl mx-auto px-6 py-8">
          <button onClick={() => setShowLeaderboard(false)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
            ← Назад
          </button>
          <h1 className="text-2xl font-semibold mb-6">🏆 Топ игроков</h1>

          {leaderboardLoading ? (
            <div className="text-center text-gray-500 py-12">Загрузка...</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((p, i) => {
                const total = p.wins + p.losses;
                const winrate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
                const isMe = p.username === profile?.username;
                return (
                  <div
                    key={p.username + i}
                    className={`flex items-center justify-between rounded-xl p-3 border ${isMe ? "bg-red-900/20 border-red-800" : "bg-gray-900 border-gray-800"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-6 text-right">{i + 1}</span>
                      <span className="text-sm font-medium">{p.username} {isMe && <span className="text-gray-500">(ты)</span>}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="text-green-400">{p.wins}W</span>
                      <span className="text-red-400">{p.losses}L</span>
                      <span className="w-10 text-right">{winrate}%</span>
                    </div>
                  </div>
                );
              })}
              {leaderboard.length === 0 && (
                <div className="text-center text-gray-600 py-12">Пока нет данных</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Экран деталей дуэли / принятия вызова
  if (selectedDuel) {
    const isMine = selectedDuel.creator_id === userId;
    const duelPrize = Math.round(selectedDuel.stake * 2 * 0.9);

    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {acceptedNotice && <AcceptedToast text={acceptedNotice} />}
        <div className="max-w-xl mx-auto px-6 py-8">
          <button onClick={() => setSelectedDuel(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
            ← Назад
          </button>

          <h1 className="text-2xl font-semibold mb-6">Детали дуэли</h1>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center text-sm font-medium">
                {(profilesMap[selectedDuel.creator_id] || "??").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium">{profilesMap[selectedDuel.creator_id] || "Игрок"}</div>
                <div className="text-xs text-gray-500">{formatRelativeTime(selectedDuel.created_at)}</div>
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
              {selectedDuel.stake_type === "item" ? (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">На кону</span>
                  <span className="text-right">{selectedDuel.item_description}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Ставка каждого</span>
                    <span>{selectedDuel.stake.toLocaleString("ru-RU")} DLC</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Победитель получит</span>
                    <span className="text-green-400">{duelPrize.toLocaleString("ru-RU")} DLC</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {isMine ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-gray-400 text-sm">
              {selectedDuel.status === "live" ? (
                <button
                  onClick={() => {
                  setUnreadDuelIds(prev => {
                    const next = { ...prev };
                    delete next[selectedDuel.id];
                    return next;
                  });
                  router.push(`/duel/${selectedDuel.id}`);
                }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Войти в дуэль →
                </button>
              ) : (
                <div className="space-y-3">
                  <div>Это твоя дуэль. Жди когда кто-то примет вызов — или позови соперника сам.</div>
                  {errorMsg && (
                    <div className="text-sm px-4 py-3 rounded-xl bg-red-900/50 text-red-400">{errorMsg}</div>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${window.location.origin}/duel/${selectedDuel.id}`);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      } catch {
                        setErrorMsg("Не удалось скопировать ссылку");
                      }
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    {shareCopied ? "✓ Ссылка скопирована" : "🔗 Поделиться вызовом"}
                  </button>
                  <button
                    onClick={() => handleCancel(selectedDuel)}
                    disabled={cancelling}
                    className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    {cancelling ? "Отмена..." : selectedDuel.stake_type === "item" ? "Отменить вызов" : `Отменить вызов и вернуть ${selectedDuel.stake.toLocaleString("ru-RU")} DLC`}
                  </button>
                </div>
              )}
            </div>
          ) : selectedDuel.status === "live" ? (
            selectedDuel.opponent_id === userId ? (
              <button
                onClick={() => {
                  setUnreadDuelIds(prev => {
                    const next = { ...prev };
                    delete next[selectedDuel.id];
                    return next;
                  });
                  router.push(`/duel/${selectedDuel.id}`);
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Войти в дуэль →
              </button>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-gray-400 text-sm">
                Дуэль уже принята другим игроком.
              </div>
            )
          ) : (
            <>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Твой баланс</span>
                  <span>{profile?.balance.toLocaleString("ru-RU")} DLC</span>
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
                {accepting ? "Принятие вызова..." : selectedDuel.stake_type === "item" ? "Принять вызов" : `Принять вызов — ${selectedDuel.stake.toLocaleString("ru-RU")} DLC`}
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
        {acceptedNotice && <AcceptedToast text={acceptedNotice} />}
        <div className="max-w-xl mx-auto px-6 py-8">
          <button onClick={() => setShowCreate(false)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
            ← Назад
          </button>
          <h1 className="text-2xl font-semibold mb-6">Новая дуэль</h1>

          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Режим</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("ranked")}
                  className={`text-sm py-2 rounded-xl border transition-colors ${mode === "ranked" ? "bg-red-600 border-red-600 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"}`}
                >
                  🏆 Рейтинг (автопроверка)
                </button>
                <button
                  onClick={() => setMode("custom")}
                  className={`text-sm py-2 rounded-xl border transition-colors ${mode === "custom" ? "bg-red-600 border-red-600 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"}`}
                >
                  ✍️ Кастом (голосование)
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {mode === "ranked"
                  ? "Победитель определяется автоматически по числу пройденных тестов."
                  : "Свободная задача; победителя выбираете голосованием вы оба."}
              </p>
            </div>

            {mode === "ranked" && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Задача</label>
                <select
                  value={problemId}
                  onChange={e => {
                    // The code in the editor is a solution to the PREVIOUS
                    // problem; keeping it around looks like a ready answer
                    // for the new one but would just fail every test.
                    setProblemId(e.target.value);
                    setSolveCode("");
                    setErrorMsg("");
                  }}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-gray-600"
                >
                  {problems.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                {problems.find(p => p.id === problemId) && (
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    <p>{problems.find(p => p.id === problemId)!.statement}</p>
                    <pre className="whitespace-pre-wrap font-sans text-gray-600">{problems.find(p => p.id === problemId)!.ioSpec}</pre>
                  </div>
                )}
              </div>
            )}

            {mode === "ranked" && (
              <div>
                <label className="block text-sm text-gray-400 mb-2 flex items-center justify-between">
                  <span>Твоё решение (нужно решить, чтобы бросить вызов)</span>
                  <select
                    value={solveLang}
                    onChange={e => setSolveLang(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option>Python</option>
                    <option>JavaScript</option>
                    <option>Java</option>
                    <option>C++</option>
                  </select>
                </label>
                <textarea
                  value={solveCode}
                  onChange={e => setSolveCode(e.target.value)}
                  maxLength={20000}
                  spellCheck={false}
                  className="w-full h-48 bg-black border border-gray-800 rounded-xl p-3 font-mono text-sm text-green-400 placeholder-gray-700 resize-none focus:outline-none focus:border-gray-600"
                  placeholder={`# Реши задачу. Чтение из stdin, вывод в stdout.\n# Пример (Python):\nimport sys\nprint(sys.stdin.read())`}
                />
                <p className="text-xs text-gray-600 mt-1">Твой результат зафиксируется. Соперник должен будет его превзойти.</p>
              </div>
            )}

            {mode === "custom" && (<>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Категория</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.keys(TASK_BANK).map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setCategory(cat);
                      setTask(TASK_BANK[cat][difficulty][0]);
                    }}
                    className={`text-sm py-2 rounded-xl border transition-colors ${category === cat ? "bg-red-600 border-red-600 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Сложность</label>
              <div className="grid grid-cols-3 gap-2">
                {["Легко", "Средне", "Сложно"].map(diff => (
                  <button
                    key={diff}
                    onClick={() => {
                      setDifficulty(diff);
                      setTask(TASK_BANK[category][diff][0]);
                    }}
                    className={`text-sm py-2 rounded-xl border transition-colors ${
                      difficulty === diff
                        ? diff === "Легко" ? "bg-green-600 border-green-600 text-white"
                        : diff === "Средне" ? "bg-yellow-600 border-yellow-600 text-white"
                        : "bg-red-600 border-red-600 text-white"
                        : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Задача</label>
              <div className="space-y-2">
                {TASK_BANK[category][difficulty].map(t => (
                  <button
                    key={t}
                    onClick={() => setTask(t)}
                    className={`w-full text-left text-sm p-3 rounded-xl border transition-colors ${task === t ? "bg-gray-800 border-red-500 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2 flex items-center justify-between">
                <span>Или своя задача</span>
                <span className={task.length > TASK_MAX_LENGTH ? "text-red-400" : "text-gray-600"}>
                  {task.length}/{TASK_MAX_LENGTH}
                </span>
              </label>
              <textarea
                value={task}
                onChange={e => setTask(e.target.value)}
                maxLength={TASK_MAX_LENGTH}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 resize-none h-20 focus:outline-none focus:border-gray-600"
                placeholder="Можешь написать свою задачу или оставить выбранную выше..."
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
              <label className="block text-sm text-gray-400 mb-2">На кону</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setStakeType("dlc")}
                  className={`text-sm py-2 rounded-xl border transition-colors ${stakeType === "dlc" ? "bg-red-600 border-red-600 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"}`}
                >
                  💰 DLC
                </button>
                <button
                  onClick={() => setStakeType("item")}
                  className={`text-sm py-2 rounded-xl border transition-colors ${stakeType === "item" ? "bg-red-600 border-red-600 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"}`}
                >
                  📦 Предмет
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {stakeType === "item"
                  ? "Договоритесь о предмете сами — сайт только фиксирует условия и определяет победителя."
                  : "Ставка списывается с баланса при создании, победитель забирает банк."}
              </p>
            </div>

            {stakeType === "item" && (
              <div>
                <label className="block text-sm text-gray-400 mb-2 flex items-center justify-between">
                  <span>Что на кону</span>
                  <span className={itemDescription.length > ITEM_DESC_MAX_LENGTH ? "text-red-400" : "text-gray-600"}>
                    {itemDescription.length}/{ITEM_DESC_MAX_LENGTH}
                  </span>
                </label>
                <textarea
                  value={itemDescription}
                  onChange={e => setItemDescription(e.target.value)}
                  maxLength={ITEM_DESC_MAX_LENGTH}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 resize-none h-20 focus:outline-none focus:border-gray-600"
                  placeholder="Например: проигравший делает домашку победителю на этой неделе"
                />
              </div>
            )}
            </>)}

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

            {!(mode === "custom" && stakeType === "item") && (<>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Ставка: <span className="text-white font-medium">{stake.toLocaleString("ru-RU")} DLC</span>
              </label>
              <input
                type="range" min={500} max={20000} step={500} value={stake}
                onChange={e => setStake(Number(e.target.value))}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>500 DLC</span><span>20 000 DLC</span>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Твой баланс</span>
                <span>{profile?.balance.toLocaleString("ru-RU")} DLC</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Банк дуэли</span>
                <span>{(stake * 2).toLocaleString("ru-RU")} DLC</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Комиссия платформы (10%)</span>
                <span className="text-red-400">−{(stake * 2 * 0.1).toLocaleString("ru-RU")} DLC</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-gray-800 pt-2 mt-2">
                <span>Победитель получит</span>
                <span className="text-green-400">{prize.toLocaleString("ru-RU")} DLC</span>
              </div>
            </div>
            </>)}

            {mode === "custom" && stakeType === "item" && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-sm">
                <span className="text-gray-400">На кону: </span>
                <span className="text-white">{itemDescription.trim() || "не указано"}</span>
              </div>
            )}

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
              {publishing
                ? (mode === "ranked" ? "Проверка решения..." : "Публикация...")
                : mode === "custom" && stakeType === "item"
                ? "Опубликовать вызов"
                : (mode === "ranked" ? `Решить и бросить вызов — ${stake.toLocaleString("ru-RU")} DLC` : `Опубликовать вызов — ${stake.toLocaleString("ru-RU")} DLC`)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {acceptedNotice && <AcceptedToast text={acceptedNotice} />}
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="text-2xl font-bold tracking-tight">
            duel<span className="text-red-500">.</span>dev
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="hidden sm:inline text-sm text-gray-400">
              Привет, <span className="text-gray-300">{profile?.username}</span>!
            </span>
            <span className="text-xs sm:text-sm text-gray-400">
              Баланс: <span className="text-white font-medium">{profile?.balance?.toLocaleString("ru-RU") || 0} DLC</span>
            </span>
            <button
              onClick={() => { setShowLeaderboard(true); loadLeaderboard(); }}
              className="hidden sm:inline-block bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              🏆 Топ игроков
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base font-semibold px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl transition-colors shadow-lg shadow-red-600/20"
            >
              + Бросить вызов
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-medium hover:bg-blue-700 transition-colors shrink-0"
              title="Выйти"
            >
              {profile?.username?.slice(0, 2).toUpperCase() || "??"}
            </button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center">
            <div className="text-xs text-gray-500 mb-1">Победы</div>
            <div className="text-xl sm:text-2xl font-semibold text-green-400">{profile?.wins ?? 0}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center">
            <div className="text-xs text-gray-500 mb-1">Поражения</div>
            <div className="text-xl sm:text-2xl font-semibold text-red-400">{profile?.losses ?? 0}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center">
            <div className="text-xs text-gray-500 mb-1">Винрейт</div>
            <div className="text-xl sm:text-2xl font-semibold">
              {profile && profile.wins + profile.losses > 0
                ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
                : 0}
              %
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center">
            <div className="text-xs text-gray-500 mb-1">Открытых дуэлей</div>
            <div className="text-xl sm:text-2xl font-semibold">{duels.filter(d => d.status === "open").length}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center col-span-2 sm:col-span-1">
            <div className="text-xs text-gray-500 mb-1">Банк всего</div>
            <div className="text-xl sm:text-2xl font-semibold">{duels.reduce((sum, d) => sum + d.stake * 2, 0).toLocaleString("ru-RU")} DLC</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-4">
          {[["open", "Открытые"], ["live", "Идут сейчас"], ["history", "История"]].map(([key, label]) => (
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {filtered.map(d => {
            const isMine = d.creator_id === userId;

            if (tab === "history") {
              const opponentId = isMine ? d.opponent_id : d.creator_id;
              const opponentName = (opponentId ? profilesMap[opponentId] : null) || "Игрок";
              const initials = opponentName.slice(0, 2).toUpperCase();
              const dateStr = parseUtc(d.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
              const isDraw = d.status === "voided";
              const iWon = d.winner_id === userId;
              const resultLabel = isDraw ? "Ничья" : iWon ? "Победа" : "Поражение";
              const resultClass = isDraw ? "bg-gray-800 text-gray-400" : iWon ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400";
              const amount = isDraw ? d.stake : iWon ? Math.round(d.stake * 2 * 0.9) : -d.stake;

              return (
                <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-xs font-medium">{initials}</div>
                      <div>
                        <div className="text-sm font-medium">vs {opponentName}</div>
                        <div className="text-xs text-gray-500">{dateStr}</div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${resultClass}`}>{resultLabel}</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-3">{d.task}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-1 rounded-full">{d.language}</span>
                    {d.stake_type === "item" ? (
                      <div className="text-sm text-gray-400 text-right max-w-[55%] truncate" title={d.item_description || ""}>📦 {d.item_description}</div>
                    ) : (
                      <div className={`text-lg font-semibold ${amount > 0 ? "text-green-400" : amount < 0 ? "text-red-400" : "text-gray-400"}`}>
                        {amount > 0 ? "+" : ""}{amount.toLocaleString("ru-RU")} DLC
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const creatorName = profilesMap[d.creator_id] || "Игрок";
            const initials = creatorName.slice(0, 2).toUpperCase();
            return (
              <div
                key={d.id}
                onClick={() => setSelectedDuel(d)}
                className="bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-6 h-6 shrink-0 rounded-full bg-blue-900 flex items-center justify-center text-[10px] font-medium">{initials}</div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">
                        {creatorName} {isMine && <span className="text-gray-500">(ты)</span>}
                        {unreadDuelIds[d.id] && <span className="ml-1 text-yellow-400">💬</span>}
                      </div>
                      <div className="text-[10px] text-gray-500">{formatRelativeTime(d.created_at)}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${d.status === "live" ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"}`}>
                    {d.status === "live" ? "● Live" : "Открыта"}
                  </span>
                </div>
                <p className="text-xs text-gray-300 mb-2 line-clamp-2">{d.task}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${d.problem_id ? "bg-yellow-900/40 text-yellow-400" : "bg-blue-900/40 text-blue-400"}`}>
                    {d.problem_id ? "🏆 Рейтинг" : d.language}
                  </span>
                  {d.stake_type === "item" ? (
                    <div className="text-right min-w-0">
                      <div className="text-[10px] text-gray-500">На кону</div>
                      <div className="text-xs font-medium text-white truncate" title={d.item_description || ""}>📦 {d.item_description}</div>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-gray-500">{d.stake.toLocaleString("ru-RU")} DLC</div>
                      <div className="text-sm font-semibold text-green-400">{(d.stake * 2 * 0.9).toLocaleString("ru-RU")} DLC</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-gray-600 py-12">
              {tab === "history" ? "Пока нет завершённых дуэлей" : "Нет активных дуэлей. Создай первую!"}
            </div>
          )}
        </div>

        {/* Дисклеймер */}
        <div className="border-t border-gray-800 mt-4 pt-6 text-center text-xs text-gray-600">
          DLC — внутриигровая валюта без реальной денежной ценности. Дуэли носят развлекательный характер и не являются азартной игрой на деньги.
        </div>
      </div>
    </div>
  );
}
