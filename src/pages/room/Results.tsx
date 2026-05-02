import React, { useState, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '../../components/ui/Button';
import { Download, Edit2, GripVertical } from 'lucide-react';
import * as XLSX from 'xlsx';

export function Results({ roomId, stories, members, room, isAdmin }: { roomId: string, stories: any[], members: any[], room: any, isAdmin: boolean }) {
  
  const sprints = Array.from(new Set(stories.map(s => s.assignedSprint).filter(Boolean))).sort((a,b) => a - b);

  const getUsername = (uid: string) => members.find(m => m.userId === uid)?.username || 'N/A';

  const exportExcel = () => {
    const wsData = stories.map(s => ({
      'ID HU': s.id,
      'Título': s.title,
      'Complejidad (Puntos)': s.complexity,
      'Prioridad (MoSCoW)': s.priority,
      'Sprint Asignado': s.assignedSprint,
      'Responsable': getUsername(s.assignedUser)
    }));

    const metricsData = [
      { Métrica: 'Peso del Proyecto', Valor: stories.reduce((a, b) => a + (b.complexity || 0), 0) },
      { Métrica: 'Duración Sprint', Valor: `${room.sprintDuration} semanas` },
      { Métrica: 'Compromiso', Valor: `${room.commitment} puntos` },
      { Métrica: 'Sprints Proyectados', Valor: room.sprints }
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(wsData);
    const ws2 = XLSX.utils.json_to_sheet(metricsData);
    
    XLSX.utils.book_append_sheet(wb, ws1, "Historias de Usuario");
    XLSX.utils.book_append_sheet(wb, ws2, "Métricas");
    
    XLSX.writeFile(wb, `Planificacion_${room.title.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleUpdate = async (storyId: string, field: string, value: any) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, `rooms/${roomId}/userStories/${storyId}`), {
        [field]: value
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `rooms/${roomId}/userStories`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Plan de Sprints (Resultados)</h2>
          <p className="text-slate-500">Distribución de Historias de Usuario priorizadas y balanceadas.</p>
        </div>
        <Button onClick={exportExcel} variant="default"><Download className="w-4 h-4 mr-2"/> Exportar a Excel</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Esfuerzo Total</div>
            <div className="font-bold text-2xl text-slate-900 mt-1">{stories.reduce((a, b) => a + (b.complexity || 0), 0)} pts</div>
         </div>
         <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duración Sprint</div>
            <div className="font-bold text-2xl text-slate-900 mt-1">{room.sprintDuration} <span className="text-sm font-medium opacity-50">sem</span></div>
         </div>
         <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compromiso Equipo</div>
            <div className="font-bold text-2xl text-slate-900 mt-1">{room.commitment} <span className="text-sm font-medium opacity-50">pts/sp</span></div>
         </div>
         <div className="bg-white border border-indigo-200 p-4 rounded-xl text-center shadow-sm bg-indigo-50/50">
            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total Sprints</div>
            <div className="font-bold text-2xl text-indigo-600 mt-1">{room.sprints}</div>
         </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto w-full">
         <table className="w-full text-sm text-left min-w-[600px] whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-4 border-b border-slate-200">HU</th>
              <th className="px-6 py-4 border-b border-slate-200 text-center">Complejidad</th>
              <th className="px-6 py-4 border-b border-slate-200 text-center">MoSCoW</th>
              <th className="px-6 py-4 border-b border-slate-200">Responsable (Asignado)</th>
              <th className="px-6 py-4 border-b border-slate-200">Sprint N°</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sprints.map(sprintVal => {
              const sprintStories = stories.filter(s => s.assignedSprint === sprintVal).sort((a,b) => b.complexity - a.complexity);
              const sprintTotalPts = sprintStories.reduce((a,b) => a+b.complexity, 0);

              return (
                <React.Fragment key={`sprint-${sprintVal}`}>
                  <tr className="bg-indigo-50/30">
                    <td colSpan={5} className="px-6 py-3 font-bold text-indigo-900 border-y border-indigo-100/50">
                      Sprint {sprintVal} <span className="px-2 py-0.5 ml-2 bg-indigo-100 text-indigo-700 text-xs rounded-full">{sprintTotalPts} pts</span>
                    </td>
                  </tr>
                  {sprintStories.map(story => (
                    <tr key={story.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-900 flex items-center min-w-[200px]">
                        <GripVertical className="w-4 h-4 text-slate-300 mr-2 opacity-0 group-hover:opacity-100 cursor-move transition-opacity" />
                        <span className="text-slate-400 font-bold mr-2 text-xs">{story.id}</span> {story.title}
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-slate-600">{story.complexity}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase ${
                          story.priority === 'M' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 
                          story.priority === 'S' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                          story.priority === 'C' ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                        }`}>{story.priority}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {isAdmin ? (
                          <select 
                            className="bg-transparent border-0 border-b border-dashed border-slate-300 focus:ring-0 cursor-pointer font-medium text-indigo-600 outline-none pb-1"
                            value={story.assignedUser}
                            onChange={(e) => handleUpdate(story.id, 'assignedUser', e.target.value)}
                          >
                            {members.map(m => <option key={m.userId} value={m.userId}>{m.username}</option>)}
                          </select>
                        ) : <span className="font-medium">{getUsername(story.assignedUser)}</span>}
                      </td>
                      <td className="px-6 py-4">
                        {isAdmin ? (
                           <select 
                            className="bg-transparent border-0 border-b border-dashed border-slate-300 focus:ring-0 cursor-pointer w-16 font-medium text-indigo-600 outline-none pb-1"
                            value={story.assignedSprint}
                            onChange={(e) => handleUpdate(story.id, 'assignedSprint', Number(e.target.value))}
                          >
                            {Array.from({length: Math.max(room.sprints + 2, 10)}).map((_, i) => (
                              <option key={i+1} value={i+1}>{i+1}</option>
                            ))}
                          </select>
                        ) : <span className="font-medium text-slate-700">{story.assignedSprint}</span>}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              )
            })}
          </tbody>
         </table>
      </div>
    </div>
  );
}
