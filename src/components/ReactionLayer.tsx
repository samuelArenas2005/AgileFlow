import React, { useEffect, useState, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

export function ReactionLayer({ roomId }: { roomId: string }) {
  const [reactions, setReactions] = useState<any[]>([]);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, `rooms/${roomId}/reactions`),
      where('timestamp', '>', mountTime.current)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          data.id = change.doc.id;
          setReactions(prev => [...prev, data]);
          
          setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== data.id));
          }, 2500);
        }
      });
    });
    return unsub;
  }, [roomId]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {reactions.map(r => (
          <ReactionParticle key={r.id} reaction={r} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ReactionParticleProps {
  reaction: any;
  key?: React.Key;
}

function ReactionParticle({ reaction }: ReactionParticleProps) {
  const [target, setTarget] = useState<{ x: number, y: number } | null>(null);
  const [start, setStart] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    const el = document.getElementById(`user-avatar-${reaction.toUserId}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTarget({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    } else {
      setTarget({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, [reaction]);

  useEffect(() => {
    if (target) {
      setStart({
        x: target.x + (Math.random() > 0.5 ? 200 : -200) * Math.random(),
        y: -100
      });
    }
  }, [target]);

  if (!target || !start) return null;

  return (
    <motion.div
      initial={{ x: start.x, y: start.y, scale: 0.5, opacity: 0, rotate: 0 }}
      animate={{ 
         x: target.x, 
         y: target.y, 
         scale: [0.5, 1.2, 1], 
         opacity: [0, 1, 1], 
         rotate: (target.x > start.x ? 1 : -1) * 360 
      }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ 
        y: { type: "spring", stiffness: 300, damping: 10, mass: 1 },
        x: { type: "spring", stiffness: 50, damping: 20 },
        scale: { duration: 0.8 },
        rotate: { duration: 0.8 },
        opacity: { duration: 0.2 }
      }}
      className="absolute text-3xl drop-shadow-md"
      style={{ marginLeft: '-0.75rem', marginTop: '-0.75rem' }}
    >
      {reaction.emoji}
    </motion.div>
  );
}
