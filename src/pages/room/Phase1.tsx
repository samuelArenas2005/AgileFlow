import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, collection, onSnapshot, setDoc } from 'firebase/firestore';
import { Button } from '../../components/ui/Button';

export function Phase1({ roomId, stories, members }: { roomId: string, stories: any[], members: any[], isAdmin: boolean }) {
  const { user, username } = useAuth();
  const [votes, setVotes] = useState<any[]>([]);
  const [minStoryId, setMinStoryId] = useState('');
  const [minComplexity, setMinComplexity] = useState<number | ''>('');
  const [maxStoryId, setMaxStoryId] = useState('');
  const [maxComplexity, setMaxComplexity] = useState<number | ''>('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `rooms/${roomId}/phase1Votes`), (s) => {
      const v = s.docs.map(d => d.data());
      setVotes(v);
      const myVote = v.find(vote => vote.userId === user?.uid);
      if (myVote) {
        setMinStoryId(myVote.minStoryId);
        setMinComplexity(myVote.minComplexity);
        setMaxStoryId(myVote.maxStoryId);
        setMaxComplexity(myVote.maxComplexity);
        setSubmitted(true);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/phase1Votes`));
    return unsub;
  }, [roomId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !minStoryId || !maxStoryId || minComplexity === '' || maxComplexity === '') return;
    try {
      await setDoc(doc(db, `rooms/${roomId}/phase1Votes/${user.uid}`), {
        userId: user.uid,
        username,
        minStoryId,
        minComplexity: Number(minComplexity),
        maxStoryId,
        maxComplexity: Number(maxComplexity),
        createdAt: Date.now()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `rooms/${roomId}/phase1Votes`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Fase 1: Calibración</h2>
        <p className="text-slate-500 mb-6 text-sm">Identifica la historia más simple (Mínima) y la más compleja (Máxima) para tener referencias.</p>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Historia Mínima</h3>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Seleccionar HU</label>
              <select className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none" value={minStoryId} onChange={e => setMinStoryId(e.target.value)} required>
                <option value="">-- Elige una historia --</option>
                {stories.map(s => <option key={s.id} value={s.id}>{s.id}: {s.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Valor (ej: 1, 2, 3)</label>
              <input type="number" className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none" value={minComplexity} onChange={e => setMinComplexity(e.target.value ? Number(e.target.value) : '')} required min="0"/>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Historia Máxima</h3>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Seleccionar HU</label>
              <select className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none" value={maxStoryId} onChange={e => setMaxStoryId(e.target.value)} required>
                <option value="">-- Elige una historia --</option>
                {stories.map(s => <option key={s.id} value={s.id}>{s.id}: {s.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Valor (ej: 13, 20, 40)</label>
              <input type="number" className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none" value={maxComplexity} onChange={e => setMaxComplexity(e.target.value ? Number(e.target.value) : '')} required min="0"/>
            </div>
          </div>
          
          <div className="col-span-2 mt-4">
            <Button type="submit" className="w-full h-12 text-sm">{submitted ? 'Actualizar mi propuesta' : 'Enviar propuesta'}</Button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Votaciones del Equipo</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3 rounded-tl-md">Usuario</th>
                <th className="px-4 py-3">Mínima (HU)</th>
                <th className="px-4 py-3">Valor Mín.</th>
                <th className="px-4 py-3">Máxima (HU)</th>
                <th className="px-4 py-3 rounded-tr-md">Valor Máx.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map(m => {
                const userVote = votes.find(v => v.userId === m.userId);
                return (
                  <tr key={m.userId} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{m.username}</td>
                    {userVote ? (
                      <>
                        <td className="px-4 py-3">{userVote.minStoryId}</td>
                        <td className="px-4 py-3 font-mono">{userVote.minComplexity}</td>
                        <td className="px-4 py-3">{userVote.maxStoryId}</td>
                        <td className="px-4 py-3 font-mono">{userVote.maxComplexity}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="px-4 py-3 text-slate-400 italic">Esperando...</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
