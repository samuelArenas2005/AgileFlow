import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, collection, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Button } from '../../components/ui/Button';

const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 20, 40, 100];
const MOSCOW = [
  { val: 'M', label: 'Must' },
  { val: 'S', label: 'Should' },
  { val: 'C', label: 'Could' },
  { val: 'W', label: 'Wont' }
];

export function Phase2({ roomId, stories, members, isAdmin }: { roomId: string, stories: any[], members: any[], isAdmin: boolean }) {
  const { user, username } = useAuth();
  const [votes, setVotes] = useState<any[]>([]);
  const [phase1Votes, setPhase1Votes] = useState<any[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, { complexity: number, priority: string }>>({});
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (stories.length > 0 && !selectedStoryId) setSelectedStoryId(stories[0].id);
  }, [stories]);

  useEffect(() => {
    const unsub2 = onSnapshot(collection(db, `rooms/${roomId}/phase2Votes`), (s) => {
      const v = s.docs.map(d => d.data());
      setVotes(v);
      const mVote = v.find(vote => vote.userId === user?.uid);
      if (mVote && mVote.votes) {
        setMyVotes(mVote.votes);
        setSubmitted(!!mVote.submitted);
      } else if (Object.keys(myVotes).length === 0) {
        const initialMap: Record<string, any> = {};
        stories.forEach(story => {
          initialMap[story.id] = { complexity: null, priority: null };
        });
        setMyVotes(initialMap);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/phase2Votes`));

    const unsub1 = onSnapshot(collection(db, `rooms/${roomId}/phase1Votes`), (s) => {
      setPhase1Votes(s.docs.map(d => d.data()));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/phase1Votes`));

    return () => { unsub1(); unsub2(); };
  }, [roomId, user, stories]);

  const handleUpdateVote = async (storyId: string, field: 'complexity' | 'priority', value: any) => {
    const updated = {
      ...myVotes,
      [storyId]: {
        ...myVotes[storyId],
        [field]: value
      }
    };
    setMyVotes(updated);
    
    if (user) {
      try {
        await setDoc(doc(db, `rooms/${roomId}/phase2Votes/${user.uid}`), {
           userId: user.uid,
           username,
           votes: updated,
           createdAt: Date.now()
           // do not set submitted to true here
        }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `rooms/${roomId}/phase2Votes`);
      }
    }
  };

  const handleFinishPhase2 = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, `rooms/${roomId}/phase2Votes/${user.uid}`), {
        userId: user.uid,
        username,
        votes: myVotes,
        submitted: true,
        createdAt: Date.now()
      }, { merge: true });
    } catch(e) {
      handleFirestoreError(e, OperationType.WRITE, `rooms/${roomId}/phase2Votes`);
    }
  };

  // Compute Phase 1 Consensus
  let minConsensus = { storyId: '', complexity: 0 };
  let maxConsensus = { storyId: '', complexity: 0 };

  if (phase1Votes.length > 0) {
    const minCounts: Record<string, { count: number, sum: number}> = {};
    const maxCounts: Record<string, { count: number, sum: number}> = {};
    phase1Votes.forEach(v => {
      if (v.minStoryId) {
        minCounts[v.minStoryId] = minCounts[v.minStoryId] || { count: 0, sum: 0 };
        minCounts[v.minStoryId].count++;
        minCounts[v.minStoryId].sum += (v.minComplexity || 0);
      }
      if (v.maxStoryId) {
        maxCounts[v.maxStoryId] = maxCounts[v.maxStoryId] || { count: 0, sum: 0 };
        maxCounts[v.maxStoryId].count++;
        maxCounts[v.maxStoryId].sum += (v.maxComplexity || 0);
      }
    });

    if (Object.keys(minCounts).length > 0) {
      const bestMinId = Object.keys(minCounts).reduce((a, b) => minCounts[a].count > minCounts[b].count ? a : b);
      minConsensus = { storyId: bestMinId, complexity: Math.round(minCounts[bestMinId].sum / minCounts[bestMinId].count) };
    }
    if (Object.keys(maxCounts).length > 0) {
      const bestMaxId = Object.keys(maxCounts).reduce((a, b) => maxCounts[a].count > maxCounts[b].count ? a : b);
      maxConsensus = { storyId: bestMaxId, complexity: Math.round(maxCounts[bestMaxId].sum / maxCounts[bestMaxId].count) };
    }
  }

  const allDone = stories.length > 0 && stories.every(s => {
    const v = myVotes[s.id];
    if (!v) return false;
    if (s.id === minConsensus.storyId || s.id === maxConsensus.storyId) {
      return v.priority !== null;
    }
    return v.complexity !== null && v.priority !== null;
  });

  const syncConsensus = async () => {
    if (!isAdmin) return;
    const promises = stories.map(story => {
      const allStoryVotes = votes.filter(v => v.votes && v.votes[story.id]).map(v => v.votes[story.id]);
      if (allStoryVotes.length === 0) return Promise.resolve();

      let avgComplexity = 0;
      let topPriority = 'M';

      if (story.id === minConsensus.storyId) {
        avgComplexity = minConsensus.complexity;
      } else if (story.id === maxConsensus.storyId) {
        avgComplexity = maxConsensus.complexity;
      } else {
        const sumComplexity = allStoryVotes.reduce((acc, curr) => acc + (curr.complexity || 0), 0);
        avgComplexity = allStoryVotes.length > 0 ? Math.round(sumComplexity / allStoryVotes.length) : 0;
      }

      const closestFib = FIBONACCI.reduce((prev, curr) => Math.abs(curr - avgComplexity) < Math.abs(prev - avgComplexity) ? curr : prev);

      if (story.id !== minConsensus.storyId && story.id !== maxConsensus.storyId) {
        const moscowCounts: Record<string, number> = {};
        allStoryVotes.forEach(v => {
          moscowCounts[v.priority] = (moscowCounts[v.priority] || 0) + 1;
        });
        if (Object.keys(moscowCounts).length > 0) {
          topPriority = Object.keys(moscowCounts).reduce((a, b) => moscowCounts[a] > moscowCounts[b] ? a : b);
        }
      }

      return updateDoc(doc(db, `rooms/${roomId}/userStories/${story.id}`), {
        complexity: closestFib,
        priority: topPriority
      });
    });

    try {
      await Promise.all(promises);
      alert('Valores de consenso sincronizados.');
    } catch(e) {
       handleFirestoreError(e, OperationType.WRITE, `rooms/${roomId}/userStories`);
    }
  };

  const story = stories.find(s => s.id === selectedStoryId);
  const myStoryVote = story ? (myVotes[story.id] || { complexity: 0, priority: 'W' }) : null;

  return (
    <div className="flex flex-col md:flex-row md:h-full gap-6">
      <aside className="w-full md:w-72 flex flex-col gap-4 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:max-h-full">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">User Stories ({stories.length})</h2>
          <div className="md:overflow-y-auto pr-2 flex flex-row md:flex-col gap-2 pb-2 md:pb-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x">
            {stories.map(s => {
              const v = myVotes[s.id];
              let done = false;
              if (v) {
                if (s.id === minConsensus.storyId || s.id === maxConsensus.storyId) {
                  done = v.priority !== null;
                } else {
                  done = v.complexity !== null && v.priority !== null;
                }
              }
              return (
                <div key={s.id} onClick={() => setSelectedStoryId(s.id)} className={`p-3 min-w-[200px] md:min-w-0 border rounded-lg cursor-pointer transition-colors snap-center shrink-0 flex flex-col gap-1 ${selectedStoryId === s.id ? 'bg-indigo-50 border-indigo-100' : 'border-slate-100 opacity-60 hover:opacity-100'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${selectedStoryId === s.id ? 'text-indigo-400' : 'text-slate-400'}`}>{s.id}</span>
                      {s.id === minConsensus.storyId && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium tracking-wide">MIN</span>}
                      {s.id === maxConsensus.storyId && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium tracking-wide">MAX</span>}
                    </div>
                    {done ? (
                      <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1"></span>
                    )}
                  </div>
                  <p className="text-sm font-semibold leading-tight text-slate-800">{s.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col gap-6">
        {selectedStoryId && story && myStoryVote ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div className="max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm font-bold">{story.id}</span>
                </div>
                <h3 className="text-2xl font-bold mt-2 text-slate-900">{story.title}</h3>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed">{story.description}</p>
              </div>
              {isAdmin && <Button onClick={syncConsensus} variant="outline">Forzar Consenso Actual</Button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Fibonacci (Complejidad)</h4>
                  {story.id === minConsensus.storyId || story.id === maxConsensus.storyId ? (
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="w-10 h-10 border-2 border-slate-300 rounded flex items-center justify-center font-bold text-slate-400 bg-slate-100">
                        {story.id === minConsensus.storyId ? minConsensus.complexity : maxConsensus.complexity}
                      </span>
                      <span className="text-sm text-slate-500 italic">Fijado en la calibración</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {FIBONACCI.map(f => (
                        <button 
                          key={f}
                          onClick={() => handleUpdateVote(story.id, 'complexity', f)}
                          className={`w-10 h-10 border-2 rounded flex items-center justify-center font-bold transition-all ${myStoryVote.complexity === f ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-500 hover:border-indigo-600 hover:text-indigo-600'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Prioridad (MoSCoW)</h4>
                  <div className="flex gap-2 text-center">
                    {MOSCOW.map(m => {
                      const isSelected = myStoryVote.priority === m.val;
                      const activeClass = m.val === 'M' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                          m.val === 'S' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                          m.val === 'C' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                          'bg-indigo-50 border-indigo-200 text-indigo-700';

                      return (
                        <button 
                          key={m.val} 
                          onClick={() => handleUpdateVote(story.id, 'priority', m.val)}
                          className={`flex-1 py-2 rounded-lg border text-[10px] sm:text-xs font-bold transition-colors ${isSelected ? activeClass : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                        >
                          {m.label.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Votos del Equipo</h4>
              {!submitted ? (
                <div className="text-sm text-slate-500 italic text-center py-4 border border-dashed border-slate-200 rounded-lg">
                  Termina tus estimaciones para ver los votos del equipo.
                </div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {members.filter(m => m.userId !== user?.uid).map(m => {
                    const theirVote = votes.find(v => v.userId === m.userId)?.votes?.[story.id];
                    
                    let isThinking = true;
                    let effectiveComplexity = theirVote?.complexity;
                    let effectivePriority = theirVote?.priority;

                    if (story.id === minConsensus.storyId) {
                      effectiveComplexity = minConsensus.complexity;
                      isThinking = !effectivePriority;
                    } else if (story.id === maxConsensus.storyId) {
                      effectiveComplexity = maxConsensus.complexity;
                      isThinking = !effectivePriority;
                    } else {
                      isThinking = !theirVote || !theirVote.complexity || !theirVote.priority;
                    }

                    if (isThinking) return (
                      <div key={m.userId} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 opacity-60">
                        <span className="text-sm font-semibold text-slate-500">{m.username}</span>
                        <span className="text-xs text-slate-400 italic">Pensando...</span>
                      </div>
                    );

                    return (
                      <div key={m.userId} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-indigo-100">
                        <span className="text-sm font-semibold text-slate-700">{m.username}</span>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{effectiveComplexity} pts / {effectivePriority}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {!submitted && (
              <div className="mt-8 flex justify-end">
                <Button 
                   onClick={handleFinishPhase2} 
                   disabled={!allDone}
                   title={!allDone ? "Aún faltan historias por estimar" : ""}
                >
                   Terminar mis estimaciones
                </Button>
              </div>
            )}
          </div>
        ) : (
           <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm flex items-center justify-center text-slate-400 h-full">
             Selecciona una historia para estimar
           </div>
        )}
      </div>
    </div>
  );
}
