import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Exam, CallRecord, Language, MODALITIES } from '../types';
import { Clock, ShieldCheck, HeartPulse, Building, Play, Volume2 } from 'lucide-react';

// Geometric Grid Paths from example
function GeometricPaths() {
  const gridSize = 40;
  const paths = [];
  
  for (let x = 0; x < 20; x++) {
    for (let y = 0; y < 12; y++) {
      if (Math.random() > 0.7) {
        paths.push({
          id: `gp-grid-${x}-${y}`,
          d: `M${x * gridSize},${y * gridSize} L${(x + 1) * gridSize},${y * gridSize} L${(x + 1) * gridSize},${(y + 1) * gridSize} L${x * gridSize},${(y + 1) * gridSize} Z`,
          delay: Math.random() * 5,
        });
      }
    }
  }

  return (
    <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
      {paths.map((p) => (
        <motion.path
          key={p.id}
          d={p.d}
          fill="none"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1, 1, 0], opacity: [0, 0.5, 0.5, 0] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut"
          }}
        />
      ))}
    </svg>
  );
}

// Organic Flow Paths from example
function FlowPaths() {
  const flowPaths = Array.from({ length: 12 }, (_, i) => {
    const amplitude = 50 + i * 10;
    const offset = i * 60;
    
    return {
      id: `gp-flow-${i}`,
      d: `M-100,${200 + offset} Q200,${200 + offset - amplitude} 500,${200 + offset} T900,${200 + offset}`,
      strokeWidth: 1 + i * 0.3,
      delay: i * 0.8
    };
  });

  return (
    <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
      {flowPaths.map((p) => (
        <motion.path
          key={p.id}
          d={p.d}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth={p.strokeWidth}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 0.8, 0.8, 0], opacity: [0, 0.4, 0.4, 0] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut"
          }}
        />
      ))}
    </svg>
  );
}

// Neural Network Paths from example
function NeuralPaths() {
  const nodes = Array.from({ length: 40 }, (_, i) => ({
    x: 100 + (i % 8) * 120 + Math.sin(i) * 30,
    y: 80 + Math.floor(i / 8) * 110 + Math.cos(i) * 25,
    id: `gp-node-${i}`
  }));

  const connections: Array<{ id: string; d: string; delay: number }> = [];
  nodes.forEach((node, i) => {
    const nearbyNodes = nodes.filter((other, j) => {
      if (i === j) return false;
      const distance = Math.sqrt(Math.pow(node.x - other.x, 2) + Math.pow(node.y - other.y, 2));
      return distance < 130 && Math.sin(i * j) > 0.3;
    });
    
    nearbyNodes.forEach(target => {
      connections.push({
        id: `gp-conn-${i}-${target.id}`,
        d: `M${node.x},${node.y} L${target.x},${target.y}`,
        delay: Math.random() * 5
      });
    });
  });

  return (
    <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
      {connections.map((conn) => (
        <motion.path
          key={conn.id}
          d={conn.d}
          fill="none"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="0.75"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{
            duration: 7,
            repeat: Infinity,
            delay: conn.delay,
            ease: "linear"
          }}
        />
      ))}
      {nodes.map((n) => (
        <motion.circle
          key={n.id}
          cx={n.x}
          cy={n.y}
          r="3"
          fill="rgba(255, 255, 255, 0.4)"
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.5, 1, 1] }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeInOut"
          }}
        />
      ))}
    </svg>
  );
}

// Spiral Paths from example
function SpiralPaths() {
  const spirals = Array.from({ length: 4 }, (_, i) => {
    const centerX = 300 + i * 150;
    const centerY = 250;
    const radius = 60 + i * 12;
    const turns = 3;
    
    let path = `M${centerX + radius},${centerY}`;
    for (let angle = 0; angle <= turns * 360; angle += 10) {
      const radian = (angle * Math.PI) / 180;
      const currentRadius = radius * (1 - angle / (turns * 360));
      const x = centerX + currentRadius * Math.cos(radian);
      const y = centerY + currentRadius * Math.sin(radian);
      path += ` L${x},${y}`;
    }
    
    return {
      id: `gp-spiral-${i}`,
      d: path,
      delay: i * 1.5
    };
  });

  return (
    <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
      {spirals.map((spiral) => (
        <motion.path
          key={spiral.id}
          d={spiral.d}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="1.2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 0] }}
          transition={{
            duration: 12,
            repeat: Infinity,
            delay: spiral.delay,
            ease: "easeInOut"
          }}
        />
      ))}
    </svg>
  );
}

interface GeneralPageViewProps {
  lang: Language;
  exams: Exam[];
  calls: CallRecord[];
}

export default function GeneralPageView({ lang, exams, calls }: GeneralPageViewProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format date helper
  const formatDate = () => {
    const options: any = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return time.toLocaleDateString(lang === 'FR' ? 'fr-FR' : 'en-US', options);
  };

  const formatTime = () => {
    return time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="flex-grow flex flex-col justify-center items-center bg-slate-950 animate-fade-in p-8 text-white relative overflow-hidden min-h-[500px]">
      
      {/* Deep Radial Glow Nebula */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.85)_0%,rgba(2,6,23,1)_100%)] pointer-events-none"></div>
      
      {/* Expanded giant clinical high-contrast background glowing nebulas */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] md:w-[850px] md:h-[850px] bg-emerald-500/[0.07] rounded-full blur-[160px] pointer-events-none"></div>
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] md:w-[700px] md:h-[700px] bg-sky-500/[0.06] rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] md:w-[650px] md:h-[650px] bg-teal-500/[0.05] rounded-full blur-[130px] pointer-events-none"></div>

      {/* Majestic Clock Integrated in Top-Left */}
      <div className="absolute top-6 left-6 md:top-8 md:left-8 z-20 flex flex-col items-start bg-white/[0.02] border border-white/10 px-5 py-3 rounded-2xl backdrop-blur-md shadow-lg space-y-0.5">
        <span className="text-xl md:text-2xl font-mono font-bold text-sky-400 tracking-wider">
          {formatTime()}
        </span>
        <span className="text-[9px] md:text-[10px] text-slate-400 font-bold tracking-widest block uppercase">
          {formatDate()}
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center space-y-10 text-center max-w-lg mx-auto my-auto select-none">
        
        {/* Futuristic Medical Imaging Hologram Radar Centerpiece */}
        <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center group">
          {/* Outward tech dashed orbit */}
          <div className="absolute inset-0 rounded-full border border-dashed border-sky-500/20 animate-[spin_40s_linear_infinite]" />
          
          {/* Reverse spinning inner double-ring */}
          <div className="absolute inset-4 rounded-full border border-double border-emerald-500/25 animate-[spin_25s_linear_infinite_reverse]" />
          
          {/* Soft glowing ambient backing circle */}
          <div className="absolute inset-8 rounded-full border border-white/5 bg-gradient-to-b from-sky-500/5 to-emerald-500/5 backdrop-blur-xs transition group-hover:brightness-125" />
          
          {/* 4 Corner clinical grid brackets */}
          <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-slate-700/60 transition-all duration-300 group-hover:-translate-x-1 group-hover:-translate-y-1"></div>
          <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-slate-700/60 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"></div>
          <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-slate-700/60 transition-all duration-300 group-hover:-translate-x-1 group-hover:translate-y-1"></div>
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-slate-700/60 transition-all duration-300 group-hover:translate-x-1 group-hover:translate-y-1"></div>

          {/* Central dark core and branding */}
          <div className="absolute inset-12 bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 rounded-full border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05),0_0_50px_rgba(16,185,129,0.08)] flex items-center justify-center overflow-hidden">
            {/* Spinning focal crosshair target dots */}
            <div className="absolute inset-2.5 rounded-full border border-dashed border-emerald-400/20 animate-[spin_10s_linear_infinite]" />
            
            <div className="absolute top-2 bottom-2 left-1/2 w-px bg-white/5"></div>
            <div className="absolute left-2 right-2 top-1/2 h-px bg-white/5"></div>
            
            {/* The brand itself */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="z-10 flex flex-col items-center justify-center"
            >
              <h1 className="text-4xl md:text-5xl font-sans tracking-[0.3em] font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] select-none cursor-default pr-[-0.3em]">
                KALM
              </h1>
              <span className="text-[7px] tracking-[0.55em] text-emerald-400 font-mono font-bold mt-2 uppercase select-none opacity-80">
                NETWORKED
              </span>
            </motion.div>
          </div>

          {/* Glowing linear sweeper simulating MRI/CT spatial signal detection */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/0 via-emerald-500/2.5 to-emerald-500/0 animate-[spin_8s_linear_infinite] pointer-events-none" />
        </div>

      </div>

      {/* Innovative Medical Styled Signature Footer "faits par VERA & IGOR" */}
      <div className="absolute bottom-8 text-center left-0 right-0 z-10">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 1 }}
          className="inline-flex flex-col items-center gap-1.5 p-5 rounded-2xl bg-slate-950/80 text-white border border-slate-900 backdrop-blur-xs"
        >
          <p className="text-[9px] tracking-[0.25em] text-slate-400 font-mono uppercase font-bold">
            {lang === 'FR' ? 'ARCHITECTURE LOGICIELLE CLINIQUE' : 'CLINICAL SOFTWARE ARCHITECTURE'}
          </p>
          
          <p className="text-sm font-bold text-slate-200">
            By{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-white to-sky-400 font-black tracking-widest uppercase hover:animate-pulse">
              VERA & IGOR
            </span>
          </p>

          <div className="flex items-center gap-2 mt-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="text-[10px] text-slate-400 font-mono">DOUALA HOSPITAL COCKPIT v2.6.0</span>
          </div>
        </motion.div>
      </div>

    </div>
  );
}
