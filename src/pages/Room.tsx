import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, collection, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Phase1 } from './room/Phase1';
import { Phase2 } from './room/Phase2';
import { Phase3 } from './room/Phase3';
import { Results } from './room/Results';
import { Users, Copy, ArrowRight, ArrowLeft, Trash2 } from 'lucide-react';

export function Room() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);

  useEffect(() => {
    if (!roomId) return;
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (d) => {
      if (d.exists()) setRoom({ id: d.id, ...d.data() });
      else navigate('/'); // room deleted or not found
    }, (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`));

    const unsubMembers = onSnapshot(collection(db, `rooms/${roomId}/members`), (s) => {
      setMembers(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/members`));

    const unsubStories = onSnapshot(collection(db, `rooms/${roomId}/userStories`), (s) => {
      setStories(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/userStories`));

    return () => { unsubRoom(); unsubMembers(); unsubStories(); };
  }, [roomId, navigate]);

  if (!room) return <div className="p-8 text-center text-neutral-500">Cargando sala...</div>;

  const isAdmin = user?.uid === room.adminId;

  const handleNextPhase = async () => {
    if (!isAdmin) return;
    const nextPhase = room.phase + 1;
    await updateDoc(doc(db, 'rooms', roomId!), { phase: nextPhase });
  };

  const handleKickUser = async (memberId: string) => {
    if (!isAdmin) return;
    if (confirm(`¿Eliminar al usuario?`)) {
      await deleteDoc(doc(db, `rooms/${roomId!}/members/${memberId}`));
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(roomId || '');
    alert('ID copiado!');
  };

  const phases = ['Setup', 'Fase 1: Calibración', 'Fase 2: Estimación', 'Fase 3: Planificación', 'Resultados'];

  return (
    <div className="flex flex-col min-h-screen md:h-screen text-slate-800 bg-slate-50">
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
          <Button onClick={() => navigate('/')} variant="secondary" className="shrink-0 text-xs md:text-sm h-8 md:h-10">Volver</Button>
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
                onClick={() => isAdmin && updateDoc(doc(db, 'rooms', roomId!), { phase: step.phase })}
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
        <aside className="w-full md:w-64 flex flex-col shrink-0 gap-4 mb-8 md:mb-0">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:overflow-hidden md:flex-1 h-auto">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center shrink-0"><Users className="w-4 h-4 mr-2"/> Equipo en línea</h2>
            <div className="space-y-3 overflow-y-auto pr-2 flex-1">
              {members.map(m => (
                <div key={m.userId} className="flex items-center gap-3 group">
                  <div className="relative shrink-0">
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
