import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, setDoc, doc, getDoc } from 'firebase/firestore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LogOut, Plus, Users, Hash, X } from 'lucide-react';

export function Dashboard() {
  const { user, username, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<any[]>([]);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [userStoriesInputs, setUserStoriesInputs] = useState<string[]>(['', '', '', '', '']);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rooms'), where('adminId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRooms(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'rooms'));

    const stored = localStorage.getItem('joinedRooms_' + user.uid);
    if (stored) {
      const parsedRooms = JSON.parse(stored);
      setJoinedRooms(parsedRooms);
      
      // Verify which joined rooms still exist
      Promise.all(
        parsedRooms.map(async (r: any) => {
          try {
            const snap = await getDoc(doc(db, 'rooms', r.id));
            if (!snap.exists()) return null;
            return { ...r, title: snap.data().title || r.title };
          } catch (e) {
            return r; // keep if there's a permission/network error just in case
          }
        })
      ).then(results => {
        const validRooms = results.filter(r => r !== null);
        // Only update if something was actually removed or titles updated
        setJoinedRooms(validRooms);
        localStorage.setItem('joinedRooms_' + user.uid, JSON.stringify(validRooms));
      });
    }

    return unsubscribe;
  }, [user]);

  const handleAddInput = () => {
    setUserStoriesInputs([...userStoriesInputs, '']);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomTitle.trim() || !user) return;
    
    // Parse user stories
    const stories = userStoriesInputs
      .map(s => s.trim())
      .filter(s => s)
      .map((s, i) => {
        // simple match HU-XX format or create one
        const match = s.match(/^(HU-\d+):?\s*(.*)$/i);
        if (match) {
          return { id: match[1].toUpperCase(), title: match[2].trim() || 'Sin título', description: '' };
        }
        return { id: `HU-${(i+1).toString().padStart(2, '0')}`, title: s.trim(), description: '' };
      });

    if (stories.length === 0) {
      alert('Debes ingresar al menos una Historia de Usuario');
      return;
    }

    setCreating(true);
    try {
      const roomRef = await addDoc(collection(db, 'rooms'), {
        title: newRoomTitle,
        adminId: user.uid,
        phase: 1, // Start at phase 1
        createdAt: Date.now(),
        status: 'active'
      });
      
      // Admin joins automatically
      await setDoc(doc(db, `rooms/${roomRef.id}/members/${user.uid}`), {
        userId: user.uid,
        username,
        joinedAt: Date.now()
      }, { merge: true });

      // Add stories
      const promises = stories.map(story => 
        setDoc(doc(db, `rooms/${roomRef.id}/userStories/${story.id}`), {
          id: story.id,
          title: story.title,
          description: story.description,
          assignedSprint: 0,
          complexity: 0,
          priority: ''
        })
      );
      await Promise.all(promises);

      navigate(`/room/${roomRef.id}`);
    } catch (e) {
      console.error(e);
      alert('Error creando sala');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim() || !user) return;
    try {
      await setDoc(doc(db, `rooms/${joinRoomId}/members/${user.uid}`), {
        userId: user.uid,
        username,
        joinedAt: Date.now()
      }, { merge: true });
      navigate(`/room/${joinRoomId}`);
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, `rooms/${joinRoomId}/members`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8 md:space-y-12">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mis Salas</h1>
            <p className="text-slate-500 mt-1">Conectado como <span className="font-semibold text-slate-800">{username}</span></p>
          </div>
          <Button variant="outline" onClick={logout} className="self-start sm:self-auto"><LogOut className="w-4 h-4 mr-2"/> Salir</Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create Room */}
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center"><Plus className="w-4 h-4 mr-2" />Nueva Sala de Estimación</h2>
            <form onSubmit={handleCreateRoom} className="space-y-6 flex-1 flex flex-col">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Título de la Sala</label>
                <Input value={newRoomTitle} onChange={e => setNewRoomTitle(e.target.value)} required placeholder="Ej. Sprint 4 Planning" className="h-10 border-slate-200 focus-visible:ring-indigo-600" />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Historias de Usuario (máx. 50 caracteres c/u)</label>
                <div className="space-y-3 mb-3 flex-1 overflow-y-auto max-h-[300px] pt-1 pb-1 pl-1 -mt-1 -mb-1 -ml-1 pr-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                  {userStoriesInputs.map((val, idx) => (
                    <div key={idx} className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          value={val}
                          onChange={e => {
                            const newInputs = [...userStoriesInputs];
                            newInputs[idx] = e.target.value;
                            setUserStoriesInputs(newInputs);
                          }}
                          maxLength={50}
                          placeholder={`Ej. HU-0${idx + 1} Login de usuarios`}
                          className="h-10 border-slate-200 focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0 pr-12 transition-shadow"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 pointer-events-none">
                          {val.length}/50
                        </span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (userStoriesInputs.length > 1) {
                            setUserStoriesInputs(userStoriesInputs.filter((_, i) => i !== idx));
                          } else {
                            setUserStoriesInputs(['']);
                          }
                        }}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-1.5 rounded-full hover:bg-rose-50 shrink-0"
                        title="Eliminar Historia"
                      >
                        <X className="w-5 h-5"/>
                      </button>
                    </div>
                  ))}
                </div>
                <Button 
                  type="button" 
                  onClick={handleAddInput} 
                  variant="outline" 
                  className="w-full flex items-center justify-center border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-colors h-10"
                >
                  <Plus className="w-4 h-4 mr-2" /> Añadir Historia
                </Button>
              </div>
              <div className="pt-2 mt-auto">
                 <Button type="submit" className="w-full h-12" disabled={creating}>{creating ? 'Creando...' : 'Crear Sala'}</Button>
              </div>
            </form>
          </div>

          {/* Join Room */}
          <div className="space-y-8 flex flex-col">
             <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center"><Hash className="w-4 h-4 mr-2" />Unirse a Sala</h2>
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">ID de la Sala</label>
                  <Input value={joinRoomId} onChange={e => setJoinRoomId(e.target.value)} required placeholder="Ingresa el ID de la sala" className="h-10 border-slate-200 focus-visible:ring-indigo-600" />
                </div>
                <div className="pt-2">
                   <Button type="submit" variant="secondary" className="w-full h-12">Unirse</Button>
                </div>
              </form>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center"><Users className="w-4 h-4 mr-2" />Salas Creadas por mi</h2>
              {rooms.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm italic">No has creado ninguna sala aún.</div>
              ) : (
                <ul className="space-y-3 mb-6">
                  {rooms.map(room => (
                    <li key={room.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 group hover:border-indigo-100 transition-colors">
                      <div>
                        <p className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">{room.title}</p>
                        <p className="text-xs text-slate-400 font-mono mt-1">ID: {room.id}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/room/${room.id}`)}>Entrar</Button>
                    </li>
                  ))}
                </ul>
              )}

              {joinedRooms.length > 0 && (
                <>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-6 mb-6 flex items-center"><Hash className="w-4 h-4 mr-2" />Salas Recientes (Unidas)</h2>
                  <ul className="space-y-3">
                    {joinedRooms.filter(r => !rooms.find(cr => cr.id === r.id)).map(room => (
                      <li key={room.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 group hover:border-indigo-100 transition-colors">
                        <div>
                          <p className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">{room.title || 'Sala'}</p>
                          <p className="text-xs text-slate-400 font-mono mt-1">ID: {room.id}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/room/${room.id}`)}>Entrar</Button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
