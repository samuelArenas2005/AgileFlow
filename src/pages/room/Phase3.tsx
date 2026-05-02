import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, collection, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Button } from '../../components/ui/Button';

export function Phase3({ roomId, stories, members, isAdmin }: { roomId: string, stories: any[], members: any[], isAdmin: boolean }) {
  const { user, username } = useAuth();
  const [votes, setVotes] = useState<any[]>([]);
  const [sprintDuration, setSprintDuration] = useState<number | ''>('');
  const [commitment, setCommitment] = useState<number | ''>('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `rooms/${roomId}/phase3Votes`), (s) => {
      const v = s.docs.map(d => d.data());
      setVotes(v);
      const myVote = v.find(vote => vote.userId === user?.uid);
      if (myVote) {
        setSprintDuration(myVote.sprintDuration);
        setCommitment(myVote.commitment);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/phase3Votes`));
    return unsub;
  }, [roomId, user]);

  const totalWeight = stories.reduce((sum, s) => sum + (s.complexity || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || sprintDuration === '' || commitment === '') return;
    try {
      await setDoc(doc(db, `rooms/${roomId}/phase3Votes/${user.uid}`), {
        userId: user.uid,
        username,
        sprintDuration: Number(sprintDuration),
        commitment: Number(commitment),
        createdAt: Date.now()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `rooms/${roomId}/phase3Votes`);
    }
  };

  const handleFinalize = async () => {
    if (!isAdmin) return;
    if (votes.length === 0) return alert('No hay votos de planificación.');
    const avgDuration = Math.round(votes.reduce((sum, v) => sum + v.sprintDuration, 0) / votes.length);
    const avgCommitment = Math.round(votes.reduce((sum, v) => sum + v.commitment, 0) / votes.length);

    // Distribution algorithm
    const priorityScore: Record<string, number> = { 'M': 1, 'S': 2, 'C': 3, 'W': 4 };
    
    // Sort stories by Priority then Complexity (Descending)
    const sortedStories = [...stories].sort((a, b) => {
      const pDiff = (priorityScore[a.priority] || 4) - (priorityScore[b.priority] || 4);
      if (pDiff !== 0) return pDiff;
      return (b.complexity || 0) - (a.complexity || 0);
    });

    let currentSprint = 1;
    let currentSprintPoints = 0;
    
    const userIds = members.map(m => m.userId);
    const userPoints: Record<string, number> = {};
    userIds.forEach(uid => userPoints[uid] = 0);

    const storyUpdates = sortedStories.map((story) => {
      // Find user with min points
      let assignedUser = userIds[0];
      for (const uid of userIds) {
        if (userPoints[uid] < userPoints[assignedUser]) assignedUser = uid;
      }

      if (currentSprintPoints + (story.complexity || 0) > avgCommitment) {
        currentSprint++;
        currentSprintPoints = 0;
      }
      
      const newSettings = {
        assignedSprint: currentSprint,
        assignedUser: assignedUser
      };

      currentSprintPoints += (story.complexity || 0);
      userPoints[assignedUser] += (story.complexity || 0);

      return updateDoc(doc(db, `rooms/${roomId}/userStories/${story.id}`), newSettings);
    });

    try {
      await Promise.all(storyUpdates);
      await updateDoc(doc(db, 'rooms', roomId), {
        sprintDuration: avgDuration,
        commitment: avgCommitment,
        sprints: currentSprint,
        phase: 4 // move to Results
      });
    } catch(e) {
      handleFirestoreError(e, OperationType.WRITE, `rooms/${roomId}`);
    }
  };

  const currentSprintsEstimation = votes.length > 0 && commitment !== '' && commitment > 0 
    ? (totalWeight / Number(commitment)).toFixed(2)
    : '...';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
         <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Fase 3: Planificación de Sprints</h2>
            <p className="text-slate-500 text-sm">Definan el marco de trabajo y el compromiso de equipo.</p>
         </div>
         <div className="bg-indigo-50 text-indigo-900 px-6 py-4 rounded-lg text-center min-w-[200px] border border-indigo-100">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-indigo-400">Peso Total Proyecto</div>
            <div className="text-4xl font-light">{totalWeight} <span className="text-xl font-normal opacity-70 italic">pts</span></div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Tu Propuesta</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Duración del Sprint (semanas)</label>
              <input type="number" className="w-full h-10 rounded-md border border-slate-200 px-3 focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 outline-none" value={sprintDuration} onChange={e => setSprintDuration(e.target.value ? Number(e.target.value) : '')} required min="1"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Compromiso (pts por sprint)</label>
              <input type="number" className="w-full h-10 rounded-md border border-slate-200 px-3 focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 outline-none" value={commitment} onChange={e => setCommitment(e.target.value ? Number(e.target.value) : '')} required min="1"/>
            </div>
          </div>

          <div className="pt-6 mt-auto">
            <Button type="submit" className="w-full h-12">Enviar Propuesta</Button>
          </div>
        </form>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Votaciones del Equipo</h3>
          <ul className="space-y-3 mb-6">
            {members.map(m => {
              const v = votes.find(vote => vote.userId === m.userId);
              return (
                <li key={m.userId} className="flex justify-between items-center text-sm p-2 rounded-lg border border-slate-100 bg-slate-50">
                  <span className="font-semibold text-slate-800">{m.username}</span>
                  {v ? (
                    <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded">
                      {v.sprintDuration} sem / {v.commitment} pts
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Esperando...</span>
                  )}
                </li>
              )
            })}
          </ul>

          {isAdmin && (
            <div className="mt-auto border-t border-slate-100 pt-6">
               <p className="text-xs text-slate-500 mb-4 leading-relaxed">Cierra esta fase para calcular y distribuir automáticamente las Historias de Usuario.</p>
               <Button onClick={handleFinalize} className="w-full h-12 shadow-sm">Finalizar Planificación</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
