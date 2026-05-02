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
  const [myVotes, setMyVotes] = useState<Record<string, { complexity: number, priority: string }>>({});
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  useEffect(() => {
    if (stories.length > 0 && !selectedStoryId) setSelectedStoryId(stories[0].id);
  }, [stories]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `rooms/${roomId}/phase2Votes`), (s) => {
      const v = s.docs.map(d => d.data());
      setVotes(v);
      const mVote = v.find(vote => vote.userId === user?.uid);
      if (mVote && mVote.votes) {
        setMyVotes(mVote.votes);
      } else if (Object.keys(myVotes).length === 0) {
        const initialMap: Record<string, any> = {};
        stories.forEach(story => {
          initialMap[story.id] = { complexity: 0, priority: 'W' };
        });
        setMyVotes(initialMap);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/phase2Votes`));
    return unsub;
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
        }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `rooms/${roomId}/phase2Votes`);
      }
    }
  };

  const syncConsensus = async () => {
    if (!isAdmin) return;
    const promises = stories.map(story => {
      const allStoryVotes = votes.filter(v => v.votes && v.votes[story.id]).map(v => v.votes[story.id]);
      if (allStoryVotes.length === 0) return Promise.resolve();

      const sumComplexity = allStoryVotes.reduce((acc, curr) => acc + (curr.complexity || 0), 0);
      const avgComplexity = Math.round(sumComplexity / allStoryVotes.length);
      const closestFib = FIBONACCI.reduce((prev, curr) => Math.abs(curr - avgComplexity) < Math.abs(prev - avgComplexity) ? curr : prev);

      const moscowCounts: Record<string, number> = {};
      allStoryVotes.forEach(v => {
        moscowCounts[v.priority] = (moscowCounts[v.priority] || 0) + 1;
      });
      const topPriority = Object.keys(moscowCounts).reduce((a, b) => moscowCounts[a] > moscowCounts[b] ? a : b);

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
    <div className="flex flex-col md:flex-row h-full gap-6">
      <aside className="w-full md:w-72 flex flex-col gap-4 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col max-h-56 md:max-h-full">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">User Stories ({stories.length})</h2>
          <div className="space-y-2 overflow-y-auto pr-2">
            {stories.map(s => (
              <div key={s.id} onClick={() => setSelectedStoryId(s.id)} className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedStoryId === s.id ? 'bg-indigo-50 border-indigo-100' : 'border-slate-100 opacity-60 hover:opacity-100'}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-[10px] font-bold ${selectedStoryId === s.id ? 'text-indigo-400' : 'text-slate-400'}`}>{s.id}</span>
                </div>
                <p className="text-sm font-semibold leading-tight text-slate-800">{s.title}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col gap-6">
        {selectedStoryId && story && myStoryVote ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div className="max-w-lg">
                <div>
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
              <div className="flex flex-wrap gap-4">
                {members.filter(m => m.userId !== user?.uid).map(m => {
                  const theirVote = votes.find(v => v.userId === m.userId)?.votes?.[story.id];
                  if (!theirVote || !theirVote.complexity) return (
                    <div key={m.userId} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 opacity-60">
                      <span className="text-sm font-semibold text-slate-500">{m.username}</span>
                      <span className="text-xs text-slate-400 italic">Pensando...</span>
                    </div>
                  );
                  return (
                    <div key={m.userId} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-indigo-100">
                      <span className="text-sm font-semibold text-slate-700">{m.username}</span>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{theirVote.complexity} pts / {theirVote.priority}</span>
                    </div>
                  );
                })}
              </div>
            </div>
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
