"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { parseUtc, translateRpcError, formatRelativeTime } from "../utils";

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
  "Algorithms": {
    "Easy": [
      "Two Sum — find two numbers in an array that add up to a target value",
      "Reverse a string without using built-in functions",
      "Find the largest number in an array without sorting",
      "Check whether a number is prime",
    ],
    "Medium": [
      "Find the longest substring without repeating characters",
      "Implement binary search on a sorted array",
      "Find all pairs of numbers in an array with a given sum",
      "Reverse a linked list",
    ],
    "Hard": [
      "Implement an LRU Cache with O(1) operations",
      "Find the shortest path in a graph (Dijkstra's algorithm)",
      "Merge k sorted lists",
      "Dynamic programming: the knapsack problem",
    ],
  },
  "Front-end": {
    "Easy": [
      "Build a responsive product card from an image",
      "Build a centered login form with email and password",
      "Build a navbar with a logo and three menu items",
      "Build a button with a hover effect to match a design",
    ],
    "Medium": [
      "Build a responsive grid of 6 cards",
      "Build a modal window with a dimmed background",
      "Build a tab switcher in pure CSS/JS",
      "Build an accordion with an expand animation",
    ],
    "Hard": [
      "Build a pixel-perfect landing page from a mockup against the clock",
      "Build a custom, customizable video player",
      "Build a drag-and-drop task list",
      "Build a complex animated timeline section",
    ],
  },
  "Strings & text": {
    "Easy": [
      "Count the number of vowels in a string",
      "Check whether a string is a palindrome",
      "Remove all spaces from a string",
      "Count the number of words in a sentence",
    ],
    "Medium": [
      "Find all anagrams of a word in an array of strings",
      "Compress a string (aaabbc → a3b2c1)",
      "Check whether one word can be formed from the letters of another",
      "Find the most frequent character in a string",
    ],
    "Hard": [
      "Build a simple template parser ({{name}} → value)",
      "Write a fuzzy substring search function",
      "Build your own regex engine for simple patterns",
      "Write a text compression algorithm (simplified Huffman)",
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
  const [category, setCategory] = useState("Algorithms");
  const [difficulty, setDifficulty] = useState("Easy");
  const [task, setTask] = useState(TASK_BANK["Algorithms"]["Easy"][0]);
  const [language, setLanguage] = useState("Any");
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
          setAcceptedNotice("Your challenge was accepted! The duel has started.");
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
      router.push("/");
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
      setProfile({ username: session.user.email?.split("@")[0] || "Player", balance: 0, wins: 0, losses: 0 });
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

    if (!profile) { setErrorMsg("Profile not loaded"); return; }
    if (!itemStake && profile.balance < stake) {
      setErrorMsg("Not enough balance");
      return;
    }
    if (itemStake) {
      if (!itemDescription.trim()) { setErrorMsg("Describe what you're staking"); return; }
      if (itemDescription.length > ITEM_DESC_MAX_LENGTH) {
        setErrorMsg(`Item description is too long (max ${ITEM_DESC_MAX_LENGTH} characters)`);
        return;
      }
    }

    if (ranked) {
      // Async ranked challenge: the creator solves it now; the server judges
      // and publishes the open challenge with the locked-in score.
      const chosenProblem = problems.find(p => p.id === problemId);
      if (!chosenProblem) { setErrorMsg("Pick a problem for the ranked duel"); return; }
      if (!solveCode.trim()) { setErrorMsg("Write a solution to throw down the challenge"); return; }

      setPublishing(true);
      setErrorMsg("");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErrorMsg("Session expired, please log in again"); setPublishing(false); return; }

      try {
        const res = await fetch("/api/duel/create-ranked", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ problemId, code: solveCode, language: solveLang, stake, durationMinutes: duration }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Couldn't create the challenge");
          setPublishing(false);
          return;
        }
        await refreshProfile();
        await loadDuels();
        setPublishing(false);
        resetCreateForm();
      } catch {
        setErrorMsg("Couldn't reach the server");
        setPublishing(false);
      }
      return;
    }

    // Custom (voting) duel: free-text task, insert directly.
    if (!task.trim()) {
      setErrorMsg("Describe the task for the duel");
      return;
    }
    if (task.length > TASK_MAX_LENGTH) {
      setErrorMsg(`Task is too long (max ${TASK_MAX_LENGTH} characters)`);
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
      setErrorMsg("Not enough balance to accept the challenge");
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
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <div className="text-2xl font-bold tracking-tight">
          duel<span className="text-red-500 animate-pulse">.</span>dev
        </div>
        <div className="text-xs text-gray-600">Loading…</div>
      </div>
    );
  }

  // Leaderboard screen
  if (showLeaderboard) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-xl mx-auto px-6 py-8">
          <button onClick={() => setShowLeaderboard(false)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
            ← Back
          </button>
          <h1 className="text-2xl font-semibold mb-6">🏆 Top players</h1>

          {leaderboardLoading ? (
            <div className="text-center text-gray-500 py-12">Loading...</div>
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
                      <span className="text-sm font-medium">{p.username} {isMe && <span className="text-gray-500">(you)</span>}</span>
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
                <div className="text-center text-gray-600 py-12">No data yet</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Duel details / accept challenge screen
  if (selectedDuel) {
    const isMine = selectedDuel.creator_id === userId;
    const duelPrize = Math.round(selectedDuel.stake * 2 * 0.9);

    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {acceptedNotice && <AcceptedToast text={acceptedNotice} />}
        <div className="max-w-xl mx-auto px-6 py-8">
          <button onClick={() => setSelectedDuel(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
            ← Back
          </button>

          <h1 className="text-2xl font-semibold mb-6">Duel details</h1>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center text-sm font-medium">
                {(profilesMap[selectedDuel.creator_id] || "??").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium">{profilesMap[selectedDuel.creator_id] || "Player"}</div>
                <div className="text-xs text-gray-500">{formatRelativeTime(selectedDuel.created_at)}</div>
              </div>
            </div>

            <p className="text-gray-300 mb-4">{selectedDuel.task}</p>

            <div className="flex gap-2 mb-4">
              <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-1 rounded-full">{selectedDuel.language}</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">
                {selectedDuel.duration_minutes < 60 ? `${selectedDuel.duration_minutes} min` : selectedDuel.duration_minutes === 1440 ? "24 hours" : `${selectedDuel.duration_minutes / 60} h`}
              </span>
            </div>

            <div className="border-t border-gray-800 pt-3 space-y-2">
              {selectedDuel.stake_type === "item" ? (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">At stake</span>
                  <span className="text-right">{selectedDuel.item_description}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Each stakes</span>
                    <span>{selectedDuel.stake.toLocaleString("en-US")} DLC</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Winner gets</span>
                    <span className="text-green-400">{duelPrize.toLocaleString("en-US")} DLC</span>
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
                  Enter the duel →
                </button>
              ) : (
                <div className="space-y-3">
                  <div>This is your duel. Wait for someone to accept — or invite an opponent yourself.</div>
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
                        setErrorMsg("Couldn't copy the link");
                      }
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    {shareCopied ? "✓ Link copied" : "🔗 Share challenge"}
                  </button>
                  <button
                    onClick={() => handleCancel(selectedDuel)}
                    disabled={cancelling}
                    className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    {cancelling ? "Cancelling..." : selectedDuel.stake_type === "item" ? "Cancel challenge" : `Cancel challenge and refund ${selectedDuel.stake.toLocaleString("en-US")} DLC`}
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
                Enter the duel →
              </button>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-gray-400 text-sm">
                This duel was already accepted by another player.
              </div>
            )
          ) : (
            <>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Your balance</span>
                  <span>{profile?.balance.toLocaleString("en-US")} DLC</span>
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
                {accepting ? "Accepting..." : selectedDuel.stake_type === "item" ? "Accept challenge" : `Accept challenge — ${selectedDuel.stake.toLocaleString("en-US")} DLC`}
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
            ← Back
          </button>
          <h1 className="text-2xl font-semibold mb-6">New duel</h1>

          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("ranked")}
                  className={`text-sm py-2 rounded-xl border transition-colors ${mode === "ranked" ? "bg-red-600 border-red-600 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"}`}
                >
                  🏆 Ranked (auto-judged)
                </button>
                <button
                  onClick={() => setMode("custom")}
                  className={`text-sm py-2 rounded-xl border transition-colors ${mode === "custom" ? "bg-red-600 border-red-600 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"}`}
                >
                  ✍️ Custom (voting)
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {mode === "ranked"
                  ? "The winner is decided automatically by the number of tests passed."
                  : "Free-form task; you both pick the winner by voting."}
              </p>
            </div>

            {mode === "ranked" && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Problem</label>
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
                  <span>Your solution (solve it to throw down the challenge)</span>
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
                  placeholder={`# Solve the problem. Read from stdin, write to stdout.\n# Example (Python):\nimport sys\nprint(sys.stdin.read())`}
                />
                <p className="text-xs text-gray-600 mt-1">Your score gets locked in. Your opponent will have to beat it.</p>
              </div>
            )}

            {mode === "custom" && (<>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Category</label>
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
              <label className="block text-sm text-gray-400 mb-2">Difficulty</label>
              <div className="grid grid-cols-3 gap-2">
                {["Easy", "Medium", "Hard"].map(diff => (
                  <button
                    key={diff}
                    onClick={() => {
                      setDifficulty(diff);
                      setTask(TASK_BANK[category][diff][0]);
                    }}
                    className={`text-sm py-2 rounded-xl border transition-colors ${
                      difficulty === diff
                        ? diff === "Easy" ? "bg-green-600 border-green-600 text-white"
                        : diff === "Medium" ? "bg-yellow-600 border-yellow-600 text-white"
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
              <label className="block text-sm text-gray-400 mb-2">Task</label>
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
                <span>Or write your own</span>
                <span className={task.length > TASK_MAX_LENGTH ? "text-red-400" : "text-gray-600"}>
                  {task.length}/{TASK_MAX_LENGTH}
                </span>
              </label>
              <textarea
                value={task}
                onChange={e => setTask(e.target.value)}
                maxLength={TASK_MAX_LENGTH}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 resize-none h-20 focus:outline-none focus:border-gray-600"
                placeholder="Write your own task or keep the one selected above..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Programming language</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-gray-600"
              >
                <option>Any</option>
                <option>Python</option>
                <option>JavaScript</option>
                <option>Java</option>
                <option>C++</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">At stake</label>
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
                  📦 Item
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {stakeType === "item"
                  ? "Arrange the item between yourselves — the site only records the terms and decides the winner."
                  : "The stake is deducted from your balance when you create the duel; the winner takes the pot."}
              </p>
            </div>

            {stakeType === "item" && (
              <div>
                <label className="block text-sm text-gray-400 mb-2 flex items-center justify-between">
                  <span>What's at stake</span>
                  <span className={itemDescription.length > ITEM_DESC_MAX_LENGTH ? "text-red-400" : "text-gray-600"}>
                    {itemDescription.length}/{ITEM_DESC_MAX_LENGTH}
                  </span>
                </label>
                <textarea
                  value={itemDescription}
                  onChange={e => setItemDescription(e.target.value)}
                  maxLength={ITEM_DESC_MAX_LENGTH}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 resize-none h-20 focus:outline-none focus:border-gray-600"
                  placeholder="e.g. the loser does the winner's homework this week"
                />
              </div>
            )}
            </>)}

            <div>
              <label className="block text-sm text-gray-400 mb-2">Time to solve</label>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-gray-600"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={1440}>24 hours</option>
              </select>
            </div>

            {!(mode === "custom" && stakeType === "item") && (<>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Stake: <span className="text-white font-medium">{stake.toLocaleString("en-US")} DLC</span>
              </label>
              <input
                type="range" min={500} max={20000} step={500} value={stake}
                onChange={e => setStake(Number(e.target.value))}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>500 DLC</span><span>20,000 DLC</span>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Your balance</span>
                <span>{profile?.balance.toLocaleString("en-US")} DLC</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Duel pot</span>
                <span>{(stake * 2).toLocaleString("en-US")} DLC</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Platform fee (10%)</span>
                <span className="text-red-400">−{(stake * 2 * 0.1).toLocaleString("en-US")} DLC</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-gray-800 pt-2 mt-2">
                <span>Winner gets</span>
                <span className="text-green-400">{prize.toLocaleString("en-US")} DLC</span>
              </div>
            </div>
            </>)}

            {mode === "custom" && stakeType === "item" && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-sm">
                <span className="text-gray-400">At stake: </span>
                <span className="text-white">{itemDescription.trim() || "not specified"}</span>
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
                ? (mode === "ranked" ? "Judging solution..." : "Publishing...")
                : mode === "custom" && stakeType === "item"
                ? "Publish challenge"
                : (mode === "ranked" ? `Solve & challenge — ${stake.toLocaleString("en-US")} DLC` : `Publish challenge — ${stake.toLocaleString("en-US")} DLC`)}
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
              Hi, <span className="text-gray-300">{profile?.username}</span>!
            </span>
            <span className="text-xs sm:text-sm text-gray-400">
              Balance: <span className="text-white font-medium">{profile?.balance?.toLocaleString("en-US") || 0} DLC</span>
            </span>
            <button
              onClick={() => { setShowLeaderboard(true); loadLeaderboard(); }}
              className="hidden sm:inline-block bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              🏆 Top players
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base font-semibold px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl transition-colors shadow-lg shadow-red-600/20"
            >
              + New duel
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-medium hover:bg-blue-700 transition-colors shrink-0"
              title="Log out"
            >
              {profile?.username?.slice(0, 2).toUpperCase() || "??"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center">
            <div className="text-xs text-gray-500 mb-1">Wins</div>
            <div className="text-xl sm:text-2xl font-semibold text-green-400">{profile?.wins ?? 0}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center">
            <div className="text-xs text-gray-500 mb-1">Losses</div>
            <div className="text-xl sm:text-2xl font-semibold text-red-400">{profile?.losses ?? 0}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center">
            <div className="text-xs text-gray-500 mb-1">Win rate</div>
            <div className="text-xl sm:text-2xl font-semibold">
              {profile && profile.wins + profile.losses > 0
                ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
                : 0}
              %
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center">
            <div className="text-xs text-gray-500 mb-1">Open duels</div>
            <div className="text-xl sm:text-2xl font-semibold">{duels.filter(d => d.status === "open").length}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center col-span-2 sm:col-span-1">
            <div className="text-xs text-gray-500 mb-1">Total pot</div>
            <div className="text-xl sm:text-2xl font-semibold">{duels.reduce((sum, d) => sum + d.stake * 2, 0).toLocaleString("en-US")} DLC</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-4">
          {[["open", "Open"], ["live", "Live now"], ["history", "History"]].map(([key, label]) => (
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
              const opponentName = (opponentId ? profilesMap[opponentId] : null) || "Player";
              const initials = opponentName.slice(0, 2).toUpperCase();
              const dateStr = parseUtc(d.created_at).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
              const isDraw = d.status === "voided";
              const iWon = d.winner_id === userId;
              const resultLabel = isDraw ? "Draw" : iWon ? "Win" : "Loss";
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
                        {amount > 0 ? "+" : ""}{amount.toLocaleString("en-US")} DLC
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const creatorName = profilesMap[d.creator_id] || "Player";
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
                        {creatorName} {isMine && <span className="text-gray-500">(you)</span>}
                        {unreadDuelIds[d.id] && <span className="ml-1 text-yellow-400">💬</span>}
                      </div>
                      <div className="text-[10px] text-gray-500">{formatRelativeTime(d.created_at)}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${d.status === "live" ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"}`}>
                    {d.status === "live" ? "● Live" : "Open"}
                  </span>
                </div>
                <p className="text-xs text-gray-300 mb-2 line-clamp-2">{d.task}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${d.problem_id ? "bg-yellow-900/40 text-yellow-400" : "bg-blue-900/40 text-blue-400"}`}>
                    {d.problem_id ? "🏆 Ranked" : d.language}
                  </span>
                  {d.stake_type === "item" ? (
                    <div className="text-right min-w-0">
                      <div className="text-[10px] text-gray-500">At stake</div>
                      <div className="text-xs font-medium text-white truncate" title={d.item_description || ""}>📦 {d.item_description}</div>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-gray-500">{d.stake.toLocaleString("en-US")} DLC</div>
                      <div className="text-sm font-semibold text-green-400">{(d.stake * 2 * 0.9).toLocaleString("en-US")} DLC</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-gray-600 py-12">
              {tab === "history" ? "No finished duels yet" : "No active duels. Create the first one!"}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="border-t border-gray-800 mt-4 pt-6 text-center text-xs text-gray-600">
          DLC is an in-game virtual currency with no real monetary value. Duels are for entertainment and are not gambling for money.
        </div>
      </div>
    </div>
  );
}
