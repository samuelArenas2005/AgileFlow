import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, collection, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Phase1 } from './room/Phase1';
import { Phase2 } from './room/Phase2';
import { Phase3 } from './room/Phase3';
import { Results } from './room/Results';
import { Users, Copy, ArrowRight, ArrowLeft, Trash2, Smile, X } from 'lucide-react';
import { ReactionLayer } from '../components/ReactionLayer';

export function Room() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [phase1Votes, setPhase1Votes] = useState<any[]>([]);
  const [phase2Votes, setPhase2Votes] = useState<any[]>([]);
  const [phase3Votes, setPhase3Votes] = useState<any[]>([]);
  const [openReactionMenu, setOpenReactionMenu] = useState<string | null>(null);

  const sendReaction = async (toUserId: string, emoji: string) => {
    if (!user || !roomId) return;
    try {
      await addDoc(collection(db, `rooms/${roomId}/reactions`), {
        emoji,
        toUserId,
        fromUserId: user.uid,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('Error sending reaction:', e);
    }
  };

  useEffect(() => {
    if (!roomId || !user) return;

    let unsubRoom: any;
    let unsubMembers: any;
    let unsubStories: any;
    let unsub1: any;
    let unsub2: any;
    let unsub3: any;

    const setupListeners = () => {
      unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (d) => {
        if (d.exists()) {
          const data = d.data();
          setRoom({ id: d.id, ...data });
          
          // Save to localStorage
          const prev = JSON.parse(localStorage.getItem('joinedRooms_' + user.uid) || '[]');
          const existingIndex = prev.findIndex((r: any) => r.id === roomId);
          if (existingIndex >= 0) {
            prev[existingIndex].title = data.title;
          } else {
            prev.push({ id: roomId, title: data.title, joinedAt: Date.now() });
          }
          localStorage.setItem('joinedRooms_' + user.uid, JSON.stringify(prev));
        }
        else navigate('/'); // room deleted or not found
      }, (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`));

      unsubMembers = onSnapshot(collection(db, `rooms/${roomId}/members`), (s) => {
        setMembers(s.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/members`));

      unsubStories = onSnapshot(collection(db, `rooms/${roomId}/userStories`), (s) => {
        setStories(s.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/userStories`));

      unsub1 = onSnapshot(collection(db, `rooms/${roomId}/phase1Votes`), (s) => setPhase1Votes(s.docs.map(d => d.data())), (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/phase1Votes`));
      unsub2 = onSnapshot(collection(db, `rooms/${roomId}/phase2Votes`), (s) => setPhase2Votes(s.docs.map(d => d.data())), (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/phase2Votes`));
      unsub3 = onSnapshot(collection(db, `rooms/${roomId}/phase3Votes`), (s) => setPhase3Votes(s.docs.map(d => d.data())), (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/phase3Votes`));
    };

    setDoc(doc(db, `rooms/${roomId}/members/${user.uid}`), {
      userId: user.uid,
      username: user.displayName || user.email?.split('@')[0] || 'Desconocido',
      joinedAt: Date.now()
    }, { merge: true })
      .then(() => setupListeners())
      .catch(err => {
        console.error("Implicit join error:", err);
        setupListeners();
      });

    return () => { 
      if (unsubRoom) unsubRoom(); 
      if (unsubMembers) unsubMembers(); 
      if (unsubStories) unsubStories(); 
      if (unsub1) unsub1(); 
      if (unsub2) unsub2(); 
      if (unsub3) unsub3(); 
    };
  }, [roomId, navigate, user]);

  // Auto-kick if no longer in members list
  useEffect(() => {
    if (members.length > 0 && user && !members.some(m => m.userId === user.uid)) {
      navigate('/');
    }
  }, [members, user, navigate]);

  if (!room) return <div className="p-8 text-center text-neutral-500">Cargando sala...</div>;

  const isAdmin = user?.uid === room.adminId;

  // Filter votes to only include current members
  const activePhase1Votes = phase1Votes.filter(v => members.some(m => m.userId === v.userId));
  const activePhase2Votes = phase2Votes.filter(v => members.some(m => m.userId === v.userId));
  const activePhase3Votes = phase3Votes.filter(v => members.some(m => m.userId === v.userId));

  // Compute Phase 1 Consensus checking
  let minConsensus = { storyId: '', complexity: 0 };
  let maxConsensus = { storyId: '', complexity: 0 };

  if (activePhase1Votes.length > 0) {
    const minCounts: Record<string, { count: number, sum: number}> = {};
    const maxCounts: Record<string, { count: number, sum: number}> = {};
    activePhase1Votes.forEach(v => {
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

  const checkConsensusForPhase = (targetPhase: number) => {
    if (targetPhase <= room.phase) return true;

    if (room.phase === 1 && targetPhase === 2) {
      if (activePhase1Votes.length !== members.length || activePhase1Votes.length === 0) return false;
      let firstVote = activePhase1Votes[0];
      for (const v of activePhase1Votes) {
        if (v.minStoryId !== firstVote.minStoryId || v.minComplexity !== firstVote.minComplexity ||
            v.maxStoryId !== firstVote.maxStoryId || v.maxComplexity !== firstVote.maxComplexity) {
          return false;
        }
      }
      return true;
    }

    if (room.phase === 2 && targetPhase === 3) {
      if (activePhase2Votes.length !== members.length || activePhase2Votes.length === 0) return false;
      let isAligned = true;
      for (const story of stories) {
        let firstVote: any = null;
        for (const userVote of activePhase2Votes) {
          if (!userVote.submitted) {
            isAligned = false; 
            break;
          }
          const v = userVote.votes?.[story.id];
          if (!v || !v.priority) {
            isAligned = false;
            break;
          }
          if (story.id !== minConsensus.storyId && story.id !== maxConsensus.storyId) {
             if (!v.complexity) {
               isAligned = false;
               break;
             }
          }

          if (!firstVote) firstVote = v;
          else {
            if (firstVote.priority !== v.priority) {
               isAligned = false; break;
            }
            if (story.id !== minConsensus.storyId && story.id !== maxConsensus.storyId) {
               if (firstVote.complexity !== v.complexity) {
                 isAligned = false; break;
               }
            }
          }
        }
        if (!isAligned) break;
      }
      return isAligned;
    }

    if (room.phase === 3 && targetPhase === 4) {
      if (activePhase3Votes.length !== members.length || activePhase3Votes.length === 0) return false;
      let firstVote = activePhase3Votes[0];
      for (const v of activePhase3Votes) {
        if (v.sprintDuration !== firstVote.sprintDuration || v.commitment !== firstVote.commitment) return false;
      }
      return true;
    }

    return true;
  };

  const handlePhaseClick = async (stepPhase: number) => {
    if (!isAdmin) return;
    if (stepPhase > room.phase && !checkConsensusForPhase(stepPhase)) {
      alert("No hay consenso completo en el equipo para avanzar a esta fase.");
      return;
    }

    if (room.phase === 2 && stepPhase === 3) {
      // Auto-apply consensus
      const promises = stories.map(story => {
        let avgComplexity = 0;
        let topPriority = 'M';
        if (story.id === minConsensus.storyId) {
          avgComplexity = minConsensus.complexity;
        } else if (story.id === maxConsensus.storyId) {
          avgComplexity = maxConsensus.complexity;
        } else {
          const vote = activePhase2Votes[0]?.votes?.[story.id];
          avgComplexity = vote?.complexity || 0;
        }
        
        const moscowCounts: Record<string, number> = {};
        activePhase2Votes.forEach(v => {
           const p = v.votes?.[story.id]?.priority;
           if (p) moscowCounts[p] = (moscowCounts[p] || 0) + 1;
        });
        if (Object.keys(moscowCounts).length > 0) {
          topPriority = Object.keys(moscowCounts).reduce((a, b) => moscowCounts[a] > moscowCounts[b] ? a : b);
        }

        return updateDoc(doc(db, `rooms/${roomId}/userStories/${story.id}`), {
          complexity: avgComplexity,
          priority: topPriority
        });
      });
      Promise.all(promises).catch(console.error);
    }

    await updateDoc(doc(db, 'rooms', roomId!), { phase: stepPhase });
  }

  const handleNextPhase = async () => {
    if (!isAdmin) return;
    const nextPhase = room.phase + 1;
    if (!checkConsensusForPhase(nextPhase)) {
      alert("No hay consenso completo en el equipo para avanzar a esta fase.");
      return;
    }

    if (room.phase === 2 && nextPhase === 3) {
      // Auto-apply consensus
      const promises = stories.map(story => {
        let avgComplexity = 0;
        let topPriority = 'M';
        if (story.id === minConsensus.storyId) {
          avgComplexity = minConsensus.complexity;
        } else if (story.id === maxConsensus.storyId) {
          avgComplexity = maxConsensus.complexity;
        } else {
          // Since there is consensus, any user's vote is fine, we just take the first
          const vote = phase2Votes[0]?.votes?.[story.id];
          avgComplexity = vote?.complexity || 0;
        }
        
        const moscowCounts: Record<string, number> = {};
        phase2Votes.forEach(v => {
           const p = v.votes?.[story.id]?.priority;
           if (p) moscowCounts[p] = (moscowCounts[p] || 0) + 1;
        });
        if (Object.keys(moscowCounts).length > 0) {
          topPriority = Object.keys(moscowCounts).reduce((a, b) => moscowCounts[a] > moscowCounts[b] ? a : b);
        }

        return updateDoc(doc(db, `rooms/${roomId}/userStories/${story.id}`), {
          complexity: avgComplexity,
          priority: topPriority
        });
      });
      Promise.all(promises).catch(console.error);
    }

    await updateDoc(doc(db, 'rooms', roomId!), { phase: nextPhase });
  };

  const handleKickUser = async (memberId: string) => {
    if (!isAdmin) return;
    if (confirm(`¿Eliminar al usuario?`)) {
      await deleteDoc(doc(db, `rooms/${roomId!}/members/${memberId}`));
    }
  };

  const handleDeleteRoom = async () => {
    if (!isAdmin) return;
    if (confirm('¿Estás seguro de que quieres eliminar esta sala? Esta acción no se puede deshacer.')) {
      try {
         await deleteDoc(doc(db, 'rooms', roomId!));
      } catch (err) {
         handleFirestoreError(err, OperationType.DELETE, `rooms/${roomId!}`);
      }
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(roomId || '');
    alert('ID copiado!');
  };

  const phases = ['Setup', 'Fase 1: Calibración', 'Fase 2: Estimación', 'Fase 3: Planificación', 'Resultados'];

  return (
    <div className="flex flex-col min-h-screen md:h-screen text-slate-800 bg-slate-50 relative">
      <ReactionLayer roomId={roomId!} />
      <header className="bg-white border-b border-slate-200 p-4 shrink-0 px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shrink-0">
              <div className="w-4 h-1 bg-white rounded-full rotate-45 translate-y-0.5"></div>
              <div className="w-4 h-1 bg-white rounded-full -rotate-45 -translate-y-0.5"></div>
            </div>
            <h1 className="font-bold text-lg md:text-xl tracking-tight text-slate-900 truncate">AgileFlow <span className="text-slate-400 font-normal hidden sm:inline">/ Estimator</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-end overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg shrink-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:inline">Sala:</span>
            <span className="text-sm font-mono font-bold text-indigo-600 truncate max-w-[120px] sm:max-w-xs">{room.title}</span>
            <button onClick={copyId} className="ml-1 text-slate-400 hover:text-slate-600 shrink-0">
              <Copy className="w-4 h-4"/>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button onClick={handleDeleteRoom} variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 shrink-0 text-xs md:text-sm h-8 md:h-10">Eliminar Sala</Button>
            )}
            <Button onClick={() => navigate('/')} variant="secondary" className="shrink-0 text-xs md:text-sm h-8 md:h-10">Volver</Button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 py-4 shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="min-w-max md:min-w-0 max-w-4xl mx-auto flex items-center justify-between px-4 md:px-8 gap-4">
          {[
            { phase: 1, name: 'Calibración' },
            { phase: 2, name: 'Estimación' },
            { phase: 3, name: 'Planificación' },
            { phase: 4, name: 'Resultados' }
          ].map((step, idx, arr) => (
            <React.Fragment key={step.phase}>
              <div 
                className={`flex flex-col items-center gap-2 transition-all ${room.phase < step.phase ? 'opacity-50' : ''} ${isAdmin ? 'cursor-pointer hover:opacity-80 group' : ''}`}
                onClick={() => handlePhaseClick(step.phase)}
              >
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors shrink-0 ${room.phase === step.phase ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-slate-500 group-hover:border-indigo-400'}`}>
                  {step.phase}
                </div>
                <span className={`text-[10px] md:text-xs uppercase transition-colors whitespace-nowrap ${room.phase === step.phase ? 'font-bold text-indigo-600' : 'font-medium text-slate-500 group-hover:text-indigo-500'}`}>
                  {step.name}
                </span>
              </div>
              {idx < arr.length - 1 && <div className="flex-1 h-0.5 mx-2 md:mx-4 bg-slate-200"></div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <main className="flex-1 flex flex-col md:flex-row md:overflow-hidden p-4 md:p-6 gap-6">
        {/* Main Content Area */}
        <section className="flex-1 flex flex-col gap-6 md:overflow-y-auto w-full pb-4">
          {room.phase === 1 && <Phase1 roomId={roomId!} stories={stories} members={members} isAdmin={isAdmin} />}
          {room.phase === 2 && <Phase2 roomId={roomId!} stories={stories} members={members} isAdmin={isAdmin} />}
          {room.phase === 3 && <Phase3 roomId={roomId!} stories={stories} members={members} isAdmin={isAdmin} />}
          {room.phase === 4 && <Results roomId={roomId!} stories={stories} members={members} room={room} isAdmin={isAdmin} />}
        </section>

        {/* Sidebar */}
        <aside className="w-full md:w-80 flex flex-col shrink-0 gap-4 mb-8 md:mb-0 relative">
          
          {/* Overlay to close menu when clicking outside */}
          {openReactionMenu && (
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setOpenReactionMenu(null)}
            />
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-1 h-auto relative z-20">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center shrink-0"><Users className="w-4 h-4 mr-2"/> Equipo en línea</h2>
            <div className="space-y-3 pr-2 flex-1">
              {members.map(m => (
                <div key={m.userId} className="flex items-center gap-3 group relative">
                  
                  {/* Floating emoji menu outside the card to the left */}
                  {openReactionMenu === m.userId && (
                    <div className="absolute right-full mr-4 flex gap-1 items-center bg-white border border-slate-200 shadow-md rounded-full p-1 z-30 shrink-0">
                      {['🍅','💩','🤡','🔥','😂'].map(e => (
                        <button key={e} onClick={() => sendReaction(m.userId, e)} className="hover:scale-125 transition-transform text-lg px-1.5 py-0.5">{e}</button>
                      ))}
                      <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                      <button onClick={() => setOpenReactionMenu(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" title="Cerrar">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div id={`user-avatar-${m.userId}`} className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
                      {m.username.substring(0,2).toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {m.username}
                      {m.userId === room.adminId && <span className="ml-1 text-[10px] text-indigo-600">(Admin)</span>}
                      {m.userId === user?.uid && <span className="ml-1 text-[10px] text-slate-400">(Tú)</span>}
                    </p>
                  </div>
                  {m.userId !== user?.uid && (
                     <div className="relative flex items-center justify-end">
                       <button 
                         onClick={() => setOpenReactionMenu(m.userId)} 
                         className={`text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-all p-1.5 z-20 relative opacity-60 hover:opacity-100 ${openReactionMenu === m.userId ? 'invisible' : ''}`} 
                         title="Enviar reacción"
                       >
                         <Smile className="w-4 h-4"/>
                       </button>
                     </div>
                  )}
                  {isAdmin && m.userId !== room.adminId && (
                    <button onClick={() => handleKickUser(m.userId)} className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2 shrink-0">
              {room.phase > 1 && (
                 <Button onClick={() => updateDoc(doc(db, 'rooms', roomId!), { phase: room.phase - 1 })} variant="outline" className="flex-1 h-12 shadow-sm text-xs md:text-sm px-2">
                   <ArrowLeft className="w-4 h-4 mr-1 md:mr-2 shrink-0"/> Anterior 
                </Button>
              )}
              {room.phase < 4 && (
                <Button onClick={handleNextPhase} className="flex-1 h-12 shadow-sm text-xs md:text-sm px-2">
                  Siguiente <ArrowRight className="w-4 h-4 ml-1 md:ml-2 shrink-0"/>
                </Button>
              )}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
