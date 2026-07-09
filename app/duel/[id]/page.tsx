"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../supabase";
import { parseUtc, translateRpcError } from "../../utils";

const CODE_MAX_LENGTH = 20000;

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

type Solution = {
  user_id: string;
  code: string;
  submitted_at: string;
};

type Message = {
  id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

export default function DuelRoom() {
  const router = useRouter();
  const params = useParams();
  const duelId = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [duel, setDuel] = useState<Duel | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<{ username: string } | null>(null);
  const [code, setCode] = useState("");
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [votes, setVotes] = useState<{ voter_id: string; voted_for: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [votingFor, setVotingFor] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const timeoutResolveAttempted = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const [runLanguage, setRunLanguage] = useState("Python");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [runOutput, setRunOutput] = useState<{
    stdout: string | null;
    stderr: string | null;
    compileOutput: string | null;
    status: string;
    time: string | null;
    memory: number | null;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [rankedResult, setRankedResult] = useState<{ passed: number; total: number; allPassed: boolean } | null>(null);
  const [problemInfo, setProblemInfo] = useState<{ ioSpec: string; totalTests: number } | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    init();

    const channel = supabase
      .channel(`duel-room-${duelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duels", filter: `id=eq.${duelId}` }, () => {
        if (userIdRef.current) loadDuel(userIdRef.current);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "solutions", filter: `duel_id=eq.${duelId}` }, () => {
        if (userIdRef.current) loadDuel(userIdRef.current);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter: `duel_id=eq.${duelId}` }, () => {
        if (userIdRef.current) loadDuel(userIdRef.current);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `duel_id=eq.${duelId}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      })
      .subscribe();

    // Fallback poll in case the realtime connection drops.
    const interval = setInterval(refreshData, 15000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!duel) return;
    const startTime = duel.started_at ? parseUtc(duel.started_at).getTime() : parseUtc(duel.created_at).getTime();
    const deadline = startTime + duel.duration_minutes * 60000;
    const tick = () => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [duel]);

  useEffect(() => {
    if (duel && duel.language !== "Any") setRunLanguage(duel.language);
  }, [duel?.language]);

  // For ranked duels, fetch the public problem details (io spec) to show.
  useEffect(() => {
    if (!duel?.problem_id) return;
    fetch("/api/problems")
      .then(r => r.json())
      .then(d => {
        const p = (d.problems || []).find((x: { id: string }) => x.id === duel.problem_id);
        if (p) setProblemInfo({ ioSpec: p.ioSpec, totalTests: p.totalTests });
      })
      .catch(() => {});
  }, [duel?.problem_id]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!duel || duel.status !== "live" || timeLeft === null || timeLeft > 0) return;
    if (timeoutResolveAttempted.current) return;
    timeoutResolveAttempted.current = true;
    supabase.rpc("resolve_duel_timeout", { p_duel_id: duelId }).then(() => refreshData());
  }, [duel, timeLeft]);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/auth");
      return;
    }
    setUserId(session.user.id);
    userIdRef.current = session.user.id;
    await loadDuel(session.user.id);
    setLoading(false);
  }

  async function loadDuel(uid: string) {
    const { data } = await supabase
      .from("duels")
      .select("*")
      .eq("id", duelId)
      .single();

    if (!data) {
      router.push("/");
      return;
    }

    setDuel(data as Duel);

    const opponentId = data.creator_id === uid ? data.opponent_id : data.creator_id;
    if (opponentId) {
      const { data: opp } = await supabase
        .from("public_profiles")
        .select("username")
        .eq("id", opponentId)
        .single();
      if (opp) setOpponentProfile(opp);
    }

    const { data: sols } = await supabase
      .from("solutions")
      .select("user_id, code, submitted_at")
      .eq("duel_id", duelId);
    if (sols) setSolutions(sols);

    const { data: vts } = await supabase
      .from("votes")
      .select("voter_id, voted_for")
      .eq("duel_id", duelId);
    if (vts) setVotes(vts);

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, sender_id, text, created_at")
      .eq("duel_id", duelId)
      .order("created_at", { ascending: true });
    if (msgs) setMessages(msgs);
  }

  async function handleSendMessage() {
    const text = chatDraft.trim();
    if (!text || !userId) return;
    setSendingChat(true);
    setChatDraft("");

    const { error } = await supabase.from("messages").insert({
      duel_id: duelId,
      sender_id: userId,
      text,
    });

    if (error) {
      setErrorMsg(translateRpcError(error.message));
      setChatDraft(text);
    }
    setSendingChat(false);
  }

  async function refreshData() {
    if (!userId) return;
    await loadDuel(userId);
  }

  async function handleRun() {
    if (!code.trim()) return;
    setRunning(true);
    setRunError("");
    setRunOutput(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setRunError("Session expired, please log in again");
      setRunning(false);
      return;
    }

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code, language: runLanguage }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunError(data.error || "Execution error");
      } else {
        setRunOutput(data);
      }
    } catch {
      setRunError("Couldn't reach the execution server");
    }

    setRunning(false);
  }

  async function handleSubmit() {
    if (!code.trim() || !userId || !duel) return;
    if (code.length > CODE_MAX_LENGTH) {
      setErrorMsg(`Solution is too long (max ${CODE_MAX_LENGTH} characters)`);
      return;
    }
    setSubmitting(true);
    setErrorMsg("");

    if (duel.problem_id) {
      // Ranked: the server judges against hidden tests and records the score.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErrorMsg("Session expired, please log in again"); setSubmitting(false); return; }
      try {
        const res = await fetch("/api/duel/submit", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ duelId, code, language: runLanguage }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error === "already submitted" ? "You've already submitted a solution" : (data.error || "Submission error"));
        } else {
          setRankedResult({ passed: data.passed, total: data.total, allPassed: data.allPassed });
          await refreshData();
        }
      } catch {
        setErrorMsg("Couldn't reach the server");
      }
      setSubmitting(false);
      return;
    }

    // Custom (voting) duel: insert the solution directly.
    const { error } = await supabase.from("solutions").insert({
      duel_id: duelId,
      user_id: userId,
      code,
    });

    if (error) {
      setErrorMsg(translateRpcError(error.message));
    } else {
      await refreshData();
    }
    setSubmitting(false);
  }

  async function handleVote(votedFor: string) {
    if (!userId) return;
    setVotingFor(true);
    setErrorMsg("");

    const { error } = await supabase.from("votes").insert({
      duel_id: duelId,
      voter_id: userId,
      voted_for: votedFor,
    });

    if (error) {
      setErrorMsg(translateRpcError(error.message));
      setVotingFor(false);
      return;
    }

    await refreshData();

    // Check whether both votes agree
    const { data: allVotes } = await supabase
      .from("votes")
      .select("voted_for")
      .eq("duel_id", duelId);

    if (allVotes && allVotes.length === 2) {
      const { error: resolveError } =
        allVotes[0].voted_for === allVotes[1].voted_for
          ? await supabase.rpc("finish_duel", { p_duel_id: duelId, p_winner_id: allVotes[0].voted_for })
          : await supabase.rpc("void_duel", { p_duel_id: duelId });

      if (resolveError) {
        setErrorMsg(translateRpcError(resolveError.message));
      }
      await refreshData();
    }

    setVotingFor(false);
  }

  async function handleAcceptChallenge() {
    setAccepting(true);
    setErrorMsg("");
    const { error } = await supabase.rpc("accept_duel", { p_duel_id: duelId });
    if (error) {
      setErrorMsg(translateRpcError(error.message));
      setAccepting(false);
      return;
    }
    if (userIdRef.current) await loadDuel(userIdRef.current);
    setAccepting(false);
  }

  const isCreator = duel?.creator_id === userId;
  const isOpponent = duel?.opponent_id === userId;
  const isParticipant = isCreator || isOpponent;
  const opponentId = isCreator ? duel?.opponent_id : duel?.creator_id;

  const mySolution = solutions.find(s => s.user_id === userId);
  const opponentSolution = solutions.find(s => s.user_id === opponentId);
  const myVote = votes.find(v => v.voter_id === userId);
  const opponentVote = votes.find(v => v.voter_id === opponentId);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Non-participant landing on a shared link to an OPEN duel → let them accept.
  if (duel && !isParticipant && duel.status === "open") {
    const prize = Math.round(duel.stake * 2 * 0.9);
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-2xl font-bold tracking-tight">duel<span className="text-red-500">.</span>dev</div>
            <div className="text-gray-400 text-sm mt-1">You've been challenged</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div>
              <span className={`text-xs px-2 py-1 rounded-full ${duel.problem_id ? "bg-yellow-900/40 text-yellow-400" : "bg-blue-900/40 text-blue-400"}`}>
                {duel.problem_id ? "🏆 Ranked" : duel.language}
              </span>
            </div>
            <p className="text-gray-200 text-sm whitespace-pre-wrap">{duel.task}</p>
            <div className="border-t border-gray-800 pt-3 space-y-2 text-sm">
              {duel.stake_type === "item" ? (
                <div className="flex justify-between"><span className="text-gray-400">At stake</span><span className="text-right">{duel.item_description}</span></div>
              ) : (
                <>
                  <div className="flex justify-between"><span className="text-gray-400">Stake</span><span>{duel.stake.toLocaleString("en-US")} DLC</span></div>
                  <div className="flex justify-between font-semibold"><span>Winner gets</span><span className="text-green-400">{prize.toLocaleString("en-US")} DLC</span></div>
                </>
              )}
            </div>
            {duel.problem_id && (
              <p className="text-xs text-gray-500">Your opponent already solved the problem. Accept the challenge and try to pass more tests.</p>
            )}
            {errorMsg && <div className="text-sm px-4 py-3 rounded-xl bg-red-900/50 text-red-400">{errorMsg}</div>}
            <button
              onClick={handleAcceptChallenge}
              disabled={accepting}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {accepting ? "Accepting..." : duel.stake_type === "item" ? "Accept challenge" : `Accept challenge — ${duel.stake.toLocaleString("en-US")} DLC`}
            </button>
            <button onClick={() => router.push("/")} className="w-full text-gray-500 hover:text-gray-300 text-sm">
              ← Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!duel || !isParticipant) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <div className="text-gray-400">You don't have access to this duel</div>
        <button onClick={() => router.push("/")} className="text-red-400 hover:text-red-300">
          ← Home
        </button>
      </div>
    );
  }

  const isTimeUp = timeLeft !== null && timeLeft <= 0;
  const bothSubmitted = !!mySolution && !!opponentSolution;
  const isRanked = !!duel.problem_id;
  const prize = Math.round(duel.stake * 2 * 0.9);

  // Finished duel screen
  if (duel.status === "finished") {
    const iWon = duel.winner_id === userId;
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-4xl mb-2">{iWon ? "🏆" : "💀"}</div>
        <h1 className="text-2xl font-semibold">{iWon ? "You won!" : "You lost"}</h1>
        {duel.stake_type === "item" ? (
          <p className="text-gray-400 text-center max-w-sm">{iWon ? `Claim: ${duel.item_description}` : `Hand over to your opponent: ${duel.item_description}`}</p>
        ) : (
          iWon && <p className="text-green-400">+{prize.toLocaleString("en-US")} DLC to your balance</p>
        )}
        <button onClick={() => router.push("/")} className="text-red-400 hover:text-red-300 mt-2">
          ← Home
        </button>
      </div>
    );
  }

  // Voided duel screen (votes didn't match — stakes refunded)
  if (duel.status === "voided") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-4xl mb-2">🤝</div>
        <h1 className="text-2xl font-semibold">Votes didn't match</h1>
        <p className="text-gray-400 text-center max-w-sm">
          You voted for different winners, so the duel was voided — stakes were refunded to both of you.
        </p>
        <button onClick={() => router.push("/")} className="text-red-400 hover:text-red-300 mt-2">
          ← Home
        </button>
      </div>
    );
  }

  // Voting screen (both submitted) — only for custom duels. Ranked duels are
  // finalized automatically on the server by score.
  if (bothSubmitted && !isRanked) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="text-xl font-semibold mb-1">Both solutions submitted</h1>
          <div className="text-sm text-gray-500 mb-4">Compare the code and vote for the winner</div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <div className="text-xs text-gray-500 mb-1">Task</div>
            <p className="text-gray-200 text-sm">{duel.task}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-sm text-gray-400 mb-2">Your solution</div>
              <pre className="bg-black border border-gray-800 rounded-xl p-4 text-sm text-green-400 overflow-auto max-h-[500px] whitespace-pre-wrap">{mySolution?.code}</pre>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-2">Opponent's solution ({opponentProfile?.username})</div>
              <pre className="bg-black border border-gray-800 rounded-xl p-4 text-sm text-blue-400 overflow-auto max-h-[500px] whitespace-pre-wrap">{opponentSolution?.code}</pre>
            </div>
          </div>

          {errorMsg && (
            <div className="text-sm px-4 py-3 rounded-xl bg-red-900/50 text-red-400 mb-4">{errorMsg}</div>
          )}

          {myVote ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-gray-400">
              You've voted. {opponentVote ? "Waiting for the result..." : "Waiting for your opponent's vote."}
            </div>
          ) : (
            <div className="max-w-md">
              <div className="text-sm text-gray-400 mb-2">Who solved it better?</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleVote(userId!)}
                  disabled={votingFor}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  I won
                </button>
                <button
                  onClick={() => handleVote(opponentId!)}
                  disabled={votingFor}
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  {opponentProfile?.username} won
                </button>
              </div>
              <div className="text-xs text-gray-600 mt-3 text-center">
                If the votes don't match, the duel is voided and stakes are refunded to both
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-6">

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            ← Leave duel
          </button>
          <div className={`text-3xl font-bold tabular-nums ${isTimeUp ? "text-red-500" : timeLeft !== null && timeLeft < 60 ? "text-yellow-500" : "text-white"}`}>
            {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          {/* Sidebar: task, status, submit */}
          <aside className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Duel in progress</h1>
              <div className="text-sm text-gray-500">
                {isRanked ? "🏆 Ranked" : duel.language} • {duel.stake_type === "item" ? `At stake: ${duel.item_description}` : `Stake ${duel.stake.toLocaleString("en-US")} DLC`}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Task</div>
              <p className="text-gray-200 text-sm whitespace-pre-wrap">{duel.task}</p>
              {isRanked && problemInfo && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Input/output format</div>
                  <pre className="text-gray-300 text-xs whitespace-pre-wrap font-sans">{problemInfo.ioSpec}</pre>
                  <div className="text-xs text-gray-600 mt-2">Judged against {problemInfo.totalTests} tests</div>
                </div>
              )}
            </div>

            {isRanked && rankedResult ? (
              <div className={`border rounded-xl p-4 text-center text-sm ${rankedResult.allPassed ? "bg-green-900/30 border-green-800 text-green-400" : "bg-yellow-900/30 border-yellow-800 text-yellow-400"}`}>
                Tests passed: <span className="font-bold">{rankedResult.passed}/{rankedResult.total}</span>
                <div className="text-xs text-gray-400 mt-1">Wait for your opponent — the winner is decided automatically by score.</div>
              </div>
            ) : isTimeUp && !mySolution ? (
              <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-center text-red-400 text-sm">
                Time's up and you didn't submit a solution. This will likely count as a loss.
              </div>
            ) : mySolution ? (
              <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 text-center text-green-400 text-sm">
                ✓ Your solution is submitted. Wait for your opponent.
              </div>
            ) : null}

            {errorMsg && (
              <div className="text-sm px-4 py-3 rounded-xl bg-red-900/50 text-red-400">{errorMsg}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">You</div>
                <div className={`text-sm font-medium ${mySolution ? "text-green-400" : "text-gray-400"}`}>
                  {mySolution ? "Done ✓" : "Coding..."}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">{opponentProfile?.username || "Opponent"}</div>
                <div className={`text-sm font-medium ${opponentSolution ? "text-green-400" : "text-gray-400"}`}>
                  {opponentSolution ? "Done ✓" : "Coding..."}
                </div>
              </div>
            </div>

            {!mySolution && (
              <button
                onClick={handleSubmit}
                disabled={submitting || !code.trim()}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
              >
                {submitting ? (isRanked ? "Judging..." : "Submitting...") : (isRanked ? "Submit for judging" : "Submit solution")}
              </button>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col">
              <div className="px-4 py-2 border-b border-gray-800 text-sm text-gray-400">Chat</div>
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 max-h-64 min-h-[160px]">
                {messages.length === 0 && (
                  <div className="text-xs text-gray-600 text-center py-4">No messages yet</div>
                )}
                {messages.map(m => (
                  <div key={m.id} className={`text-sm ${m.sender_id === userId ? "text-right" : ""}`}>
                    <span
                      className={`inline-block px-3 py-1.5 rounded-xl max-w-[85%] break-words ${
                        m.sender_id === userId ? "bg-red-600 text-white" : "bg-gray-800 text-gray-200"
                      }`}
                    >
                      {m.text}
                    </span>
                  </div>
                ))}
              </div>
              <form
                onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
                className="flex items-center gap-2 px-3 py-2 border-t border-gray-800"
              >
                <input
                  value={chatDraft}
                  onChange={e => setChatDraft(e.target.value)}
                  placeholder="Message your opponent..."
                  maxLength={2000}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
                />
                <button
                  type="submit"
                  disabled={sendingChat || !chatDraft.trim()}
                  className="text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  →
                </button>
              </form>
            </div>
          </aside>

          {/* Code editor */}
          <main>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-gray-400">Your code</span>
              <div className="flex items-center gap-3">
                <span className={code.length > CODE_MAX_LENGTH ? "text-red-400 text-xs" : "text-gray-600 text-xs"}>
                  {code.length}/{CODE_MAX_LENGTH}
                </span>
                <span className="text-xs text-gray-600">{duel.language}</span>
              </div>
            </div>

            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              disabled={!!mySolution || (isTimeUp && !mySolution)}
              maxLength={CODE_MAX_LENGTH}
              spellCheck={false}
              className="w-full h-[60vh] min-h-[420px] bg-black border border-gray-800 rounded-xl p-4 font-mono text-sm text-green-400 placeholder-gray-700 resize-none focus:outline-none focus:border-gray-600 disabled:opacity-60"
              placeholder={`// Write your solution here...\n// For example:\nfunction solve() {\n  \n}`}
            />

            {!mySolution && (
              <div className="flex items-center gap-2 mt-3">
                {duel.language === "Any" && (
                  <select
                    value={runLanguage}
                    onChange={e => setRunLanguage(e.target.value)}
                    className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
                  >
                    <option>Python</option>
                    <option>JavaScript</option>
                    <option>Java</option>
                    <option>C++</option>
                  </select>
                )}
                <button
                  onClick={handleRun}
                  disabled={running || !code.trim()}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-xl transition-colors"
                >
                  {running ? "Running..." : "▶ Run"}
                </button>
              </div>
            )}

            {runError && (
              <div className="text-sm px-4 py-3 rounded-xl bg-red-900/50 text-red-400 mt-3">{runError}</div>
            )}

            {runOutput && (
              <div className="bg-black border border-gray-800 rounded-xl p-4 mt-3 text-sm font-mono">
                <div className={`mb-2 ${runOutput.status === "Accepted" ? "text-green-400" : "text-yellow-400"}`}>
                  {runOutput.status}
                  {runOutput.time && ` · ${runOutput.time}s`}
                  {runOutput.memory && ` · ${Math.round(runOutput.memory / 1024)}MB`}
                </div>
                {runOutput.compileOutput && (
                  <pre className="text-red-400 whitespace-pre-wrap mb-2">{runOutput.compileOutput}</pre>
                )}
                {runOutput.stdout && <pre className="text-gray-200 whitespace-pre-wrap">{runOutput.stdout}</pre>}
                {runOutput.stderr && <pre className="text-red-400 whitespace-pre-wrap">{runOutput.stderr}</pre>}
                {!runOutput.stdout && !runOutput.stderr && !runOutput.compileOutput && (
                  <span className="text-gray-600">No output</span>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
