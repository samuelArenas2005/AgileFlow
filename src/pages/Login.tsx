import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { User, LogIn } from 'lucide-react';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    
    try {
      setLoading(true);
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('auth/operation-not-allowed')) {
        alert('Error: Debe habilitar la autenticación por Correo/Contraseña en la consola de Firebase.');
      } else if (err.message && err.message.includes('auth/wrong-password')) {
        alert('Contraseña incorrecta.');
      } else {
        alert('Error al iniciar sesión: ' + (err.message || 'Error desconocido'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="mb-10 flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
          <div className="w-6 h-1.5 bg-white rounded-full rotate-45 translate-y-1"></div>
          <div className="w-6 h-1.5 bg-white rounded-full -rotate-45 -translate-y-1"></div>
        </div>
        <h1 className="font-bold text-3xl tracking-tight text-slate-900">AgileFlow <span className="text-slate-400 font-normal">/ Estimator</span></h1>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Iniciar Sesión</h2>
          <p className="text-sm text-slate-500 text-center mt-2 leading-relaxed">
            Ingresa tu usuario y contraseña para acceder a tus salas de estimación.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Username</label>
            <Input
              type="text"
              placeholder="Ej. maria_dev"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="text-center font-bold text-lg h-12 border-slate-200 focus-visible:ring-indigo-600 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Contraseña</label>
            <Input
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="text-center font-bold text-lg h-12 border-slate-200 focus-visible:ring-indigo-600 rounded-xl"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 text-sm font-bold rounded-xl"
            disabled={loading || !username.trim() || !password.trim()}
          >
            {loading ? 'Ingresando...' : 'Entrar a AgileFlow'}
          </Button>
        </form>
      </div>
    </div>
  );
}
