import React from 'react';

const AuroraBackground = () => (
  <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    <div className="aurora-bg"></div>
    {/* Particles */}
    {[...Array(20)].map((_, i) => (
      <div 
        key={i} 
        className="particle"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${Math.random() * 4 + 2}px`,
          height: `${Math.random() * 4 + 2}px`,
          animationDuration: `${Math.random() * 10 + 10}s`,
          animationDelay: `${Math.random() * 5}s`
        }}
      />
    ))}
    {/* Soft glows */}
    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 blur-[150px] rounded-full mix-blend-screen" />
    <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/20 blur-[150px] rounded-full mix-blend-screen" />
  </div>
);

export default AuroraBackground;
