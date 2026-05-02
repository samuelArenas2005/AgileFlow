import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, setDoc, doc } from 'firebase/firestore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LogOut, Plus, Users, Hash } from 'lucide-react';

export function Dashboard() {
  const { user, username, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [userStoriesInput, setUserStoriesInput] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rooms'), where('adminId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'rooms'));
    return unsubscribe;
  }, [user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomTitle.trim() || !user) return;
    
    // Parse user stories
    const stories = userStoriesInput.split('\n').filter(s => s.trim()).map((s, i) => {
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
      });

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
        joinedAt: serverTimestamp()
      });
      navigate(`/room/${joinRoomId}`);
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, `rooms/${joinRoomId}/members`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
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
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Historias de Usuario (una por línea)</label>
                <textarea 
                  className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 resize-none h-full min-h-[150px]" 
                  required
                  placeholder="HU-01 Login de usuarios&#10;HU-02 Perfil de usuario&#10;Listar productos..."
                  value={userStoriesInput}
                  onChange={e => setUserStoriesInput(e.target.value)}
                />
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
                <ul className="space-y-3">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
