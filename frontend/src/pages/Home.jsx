import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Pricing from './Pricing';
import { 
  ArrowRight, BrainCircuit, Activity, LineChart, 
  SearchCode, GitBranch, Layers, Zap, Check, 
  ShieldCheck, ArrowUpRight, Code, Database, Server, MessageSquare,
  PlayCircle, RefreshCcw, Star, Quote, ChevronRight
} from 'lucide-react';
import GithubIcon from '../components/GithubIcon';

const HeroSection = ({ user, loading }) => {
  return (
    <section className="relative min-h-[calc(100vh-80px)] flex items-center justify-center pt-12 pb-24 z-10">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 w-full grid lg:grid-cols-2 gap-16 items-center">
        
        {/* Left Content */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-left"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 glass border-blue-500/30">
            <span className="text-sm font-medium text-blue-300">✨ AI Repository Intelligence Platform</span>
          </div>
          
          <h1 className="text-6xl lg:text-[88px] font-extrabold tracking-tight mb-8 leading-[1.05]">
            Understand <br/>
            Your Repository's <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500">Past, Present & Future</span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-10 max-w-xl leading-relaxed">
            Analyze architecture evolution, technical debt, commit trends, team productivity and repository health using advanced AI agents.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            {loading ? (
              <div className="h-14 w-48 rounded-xl glass shimmer-text flex items-center justify-center font-medium">Loading...</div>
            ) : user ? (
              <Link to="/dashboard" className="btn-primary h-14 px-8 rounded-xl text-lg flex items-center justify-center gap-2 group shadow-[0_0_30px_rgba(30,144,255,0.4)]">
                Go to Dashboard
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <Link to="/register" className="btn-primary h-14 px-8 rounded-xl text-lg flex items-center justify-center gap-2 group shadow-[0_0_30px_rgba(30,144,255,0.4)]">
                Analyze Repository
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
            
            <a href="#demo" className="btn-ghost h-14 px-8 rounded-xl text-lg font-semibold flex items-center justify-center gap-2 hover:bg-white/5 transition-all border-white/10 hover:border-white/20">
              <PlayCircle size={20} /> Watch Demo
            </a>
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10">
              <GithubIcon size={20} className="text-white" />
            </div>
            <span><strong className="text-white">Seamless GitHub Integration</strong> to analyze repositories instantly</span>
          </div>
        </motion.div>

        {/* Right Visual: Floating AI Dashboard */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative w-full h-[600px] hidden lg:block"
        >
          {/* Main Dashboard Card */}
          <div className="absolute inset-0 right-0 top-10 float-animation glass-card border-white/10 shadow-2xl p-6 rounded-2xl flex flex-col pointer-events-none" style={{ background: "rgba(10, 15, 30, 0.8)", backdropFilter: "blur(40px)" }}>
            
            {/* Mock Header */}
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Layers size={20} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-white font-bold">auth-service-v2</div>
                  <div className="text-xs text-slate-400">acmecorp / auth-service</div>
                </div>
              </div>
              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                Health: 96/100
              </div>
            </div>

            {/* Mock Content */}
            <div className="grid grid-cols-2 gap-4 flex-grow">
               <div className="glass p-4 rounded-xl border border-white/5">
                 <div className="text-xs text-slate-400 mb-2">Technical Debt</div>
                 <div className="text-2xl font-bold text-emerald-400">Low</div>
                 <div className="mt-4 space-y-2">
                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-[90%]"></div></div>
                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500 w-[85%]"></div></div>
                 </div>
               </div>

               <div className="glass p-4 rounded-xl border border-white/5 relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
                 <div className="text-xs font-bold text-purple-400 flex items-center gap-2 mb-3"><Zap size={14} /> AI Insights</div>
                 <ul className="space-y-3">
                   <li className="text-xs text-slate-300 flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0" /> Dependency risk detected</li>
                   <li className="text-xs text-slate-300 flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0" /> Refactoring opportunity</li>
                   <li className="text-xs text-slate-300 flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1 shrink-0" /> Architecture drift warning</li>
                 </ul>
               </div>

               <div className="col-span-2 glass p-4 rounded-xl border border-white/5 h-32 flex items-end gap-2">
                 {/* Mock Chart */}
                 {[40, 60, 45, 80, 50, 90, 70, 85, 65, 95, 80, 100].map((h, i) => (
                   <div key={i} className="flex-1 bg-blue-500/20 hover:bg-blue-400/40 transition-colors rounded-t-sm" style={{ height: `${h}%` }}></div>
                 ))}
               </div>
            </div>
          </div>

          {/* Floating Micro Cards */}
          <div className="absolute -left-10 top-32 glass p-4 rounded-xl border border-blue-500/30 glow-blue-sm float-animation pointer-events-none z-20 flex items-center gap-3" style={{ animationDelay: '1s' }}>
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"><Activity size={16} className="text-blue-400" /></div>
            <span className="text-sm font-bold text-white">+15% Maintainability</span>
          </div>

          <div className="absolute -right-8 top-1/2 glass p-4 rounded-xl border border-purple-500/30 glow-purple float-animation pointer-events-none z-20 flex items-center gap-3" style={{ animationDelay: '2s' }}>
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center pulse-ring-animation relative"><BrainCircuit size={16} className="text-purple-400" /></div>
            <span className="text-sm font-bold text-white">AI Summary Ready</span>
          </div>

          <div className="absolute left-10 bottom-10 glass p-4 rounded-xl border border-emerald-500/30 glow-green float-animation pointer-events-none z-20 flex items-center gap-3" style={{ animationDelay: '0.5s' }}>
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center"><Check size={16} className="text-emerald-400" /></div>
            <span className="text-sm font-bold text-white">12 Issues Resolved</span>
          </div>
          
        </motion.div>
      </div>
    </section>
  );
};

const TrustSection = () => (
  <section className="py-10 border-y border-white/5 relative z-10 bg-black/20">
    <div className="max-w-[1280px] mx-auto px-4 text-center">
      <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-8">Integrated Seamlessly With</p>
      <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
        <div className="flex items-center gap-2"><GithubIcon size={32} /> <span className="font-bold text-2xl">GitHub</span></div>
      </div>
    </div>
  </section>
);

const HowItWorksSection = () => (
  <section id="how-it-works" className="py-32 relative z-10">
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">How it works</h2>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">From code to insights in three simple steps.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 relative">
        <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/40 to-blue-500/0" />
        
        {[
          { step: 1, title: "Connect Repository", desc: "Securely link your GitHub account and select any repository." },
          { step: 2, title: "AI Analysis", desc: "Our RAG engine clones, parses, and comprehends your entire codebase." },
          { step: 3, title: "Get Actionable Insights", desc: "Explore health metrics, architecture graphs, and ask questions." }
        ].map((item, i) => (
          <div key={i} className="relative z-10 text-center group">
            <div className="w-24 h-24 mx-auto bg-[#0a0f1e] border border-white/10 rounded-2xl flex items-center justify-center text-3xl font-black text-white/20 mb-8 group-hover:border-blue-500/50 group-hover:text-blue-400 group-hover:-translate-y-2 transition-all duration-300 shadow-xl">
              0{item.step}
            </div>
            <h3 className="text-xl font-bold text-white mb-4">{item.title}</h3>
            <p className="text-slate-400">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const FeaturesBento = () => {
  return (
    <section id="features" className="py-32 relative z-10 bg-black/20 border-y border-white/5">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-20 text-center md:text-left">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 text-glow">scale confidently</span></h2>
          <p className="text-lg text-slate-400 max-w-2xl">Powerful tools built for engineering teams to maintain code quality, onboard developers faster, and prevent technical debt.</p>
        </div>

        <div className="bento-grid">
          {/* Row 1 */}
          <div className="bento-item col-span-12 md:col-span-8 group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
            <Layers size={32} className="text-blue-400 mb-6" />
            <h3 className="text-2xl font-bold text-white mb-3">Repository Evolution</h3>
            <p className="text-slate-400 max-w-md">Track how your architecture and codebase health has changed over time with historical snapshots and trend lines.</p>
          </div>
          
          <div className="bento-item col-span-12 md:col-span-4 group">
             <div className="absolute bottom-0 left-0 w-full h-full bg-purple-500/10 blur-[60px] rounded-full pointer-events-none" />
             <BrainCircuit size={32} className="text-purple-400 mb-6" />
             <h3 className="text-xl font-bold text-white mb-3">AI Code Insights</h3>
             <p className="text-slate-400">Deep code comprehension using advanced RAG models.</p>
          </div>

          {/* Row 2 */}
          <div className="bento-item col-span-12 md:col-span-4 group">
            <Activity size={32} className="text-emerald-400 mb-6" />
            <h3 className="text-xl font-bold text-white mb-3">Code Quality Metrics</h3>
            <p className="text-slate-400">Instantly spot code smells, maintainability issues, and hidden risks.</p>
          </div>

          <div className="bento-item col-span-12 md:col-span-4 group">
            <Zap size={32} className="text-amber-400 mb-6" />
            <h3 className="text-xl font-bold text-white mb-3">Repository Activity</h3>
            <p className="text-slate-400">Track commit velocity, recent changes, and contributor activity trends.</p>
          </div>

          <div className="bento-item col-span-12 md:col-span-4 group">
            <SearchCode size={32} className="text-pink-400 mb-6" />
            <h3 className="text-xl font-bold text-white mb-3">Repository Tree</h3>
            <p className="text-slate-400">Explore codebase structure to identify complex and critical files.</p>
          </div>

          {/* Row 3 */}
          <div className="bento-item col-span-12 md:col-span-12 group flex flex-col md:flex-row items-center gap-8 border-blue-500/20">
             <div className="md:w-1/2">
                <LineChart size={32} className="text-blue-400 mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">Historical Trend Analysis</h3>
                <p className="text-slate-400">Visualize lines of code, file distributions, and commit activity in beautiful interactive dashboards to predict future maintenance needs.</p>
             </div>
             <div className="md:w-1/2 w-full h-48 glass rounded-xl border border-white/10 flex items-end gap-2 p-4">
                {[30, 40, 35, 50, 45, 60, 55, 70, 65, 80, 85, 90].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm opacity-80" style={{ height: `${h}%` }}></div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const LiveAIShowcase = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % 4);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-32 relative z-10 overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-5xl font-bold mb-16">Live AI Analysis Showcase</h2>
        
        <div className="max-w-4xl mx-auto glass-card border border-white/10 p-2 md:p-8 rounded-3xl relative shadow-2xl">
          {/* Mac window dots */}
          <div className="flex gap-2 mb-6 px-4 pt-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </div>

          <div className="bg-[#050816] rounded-2xl p-6 md:p-10 border border-white/5 text-left h-[400px] flex flex-col justify-center relative overflow-hidden">
            
            {step === 0 && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-center">
                 <SearchCode size={48} className="text-slate-500 mb-6" />
                 <div className="text-xl font-bold text-white mb-2">Repository Selected: auth-service</div>
                 <div className="text-slate-400">Initiating cloning and parsing...</div>
               </motion.div>
            )}

            {step === 1 && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-center">
                 <RefreshCcw size={48} className="text-blue-500 mb-6 animate-spin" />
                 <div className="text-xl font-bold text-blue-400 mb-2">AI Thinking...</div>
                 <div className="text-slate-400 typing-cursor">Analyzing dependency trees and security patterns</div>
                 <div className="w-64 h-2 bg-white/5 rounded-full mt-8 overflow-hidden">
                   <div className="h-full bg-blue-500 w-1/2 animate-pulse rounded-full"></div>
                 </div>
               </motion.div>
            )}

            {(step === 2 || step === 3) && (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col justify-center">
                 <div className="text-emerald-400 font-bold mb-8 flex items-center gap-2 text-lg"><Check size={24} /> Analysis Complete</div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass p-6 rounded-xl border border-white/10 shadow-lg">
                      <div className="text-sm font-bold text-white mb-3 flex items-center gap-2"><ShieldCheck size={18} className="text-amber-400"/> Security Insight</div>
                      <p className="text-sm text-slate-400 leading-relaxed">Found outdated JWT parsing library in <code className="bg-white/10 px-1 rounded">src/utils/auth.js</code>. Recommend updating to v9.0.0 to prevent token spoofing.</p>
                    </div>
                    <div className="glass p-6 rounded-xl border border-white/10 shadow-lg">
                      <div className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Zap size={18} className="text-blue-400"/> Architecture</div>
                      <p className="text-sm text-slate-400 leading-relaxed">Monolithic user-service detected. Consider extracting email notifications to a separate worker queue to improve login latency.</p>
                    </div>
                 </div>
               </motion.div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
};


const FinalCTA = ({ user }) => (
  <section className="py-40 relative z-10 overflow-hidden">
    {/* Glow Orb Background */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/20 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />
    
    <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
      <h2 className="text-5xl md:text-6xl font-extrabold mb-8 text-white tracking-tight">
        Ready to Understand Your Repository?
      </h2>
      <p className="text-xl text-slate-400 mb-12">
        Join forward-thinking engineering teams using RepoLens to understand, document, and scale their codebases.
      </p>
      
      {user ? (
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-3 h-16 px-10 rounded-full text-lg font-bold shadow-[0_0_40px_rgba(30,144,255,0.4)]">
          Go to Dashboard <ArrowUpRight size={20} />
        </Link>
      ) : (
        <Link to="/register" className="btn-primary inline-flex items-center gap-3 h-16 px-10 rounded-full text-lg font-bold shadow-[0_0_40px_rgba(30,144,255,0.4)]">
          Analyze Repository Now <ArrowRight size={20} />
        </Link>
      )}
    </div>
  </section>
);

export default function Home({ user, loading }) {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return (
    <div className="relative overflow-x-hidden bg-transparent">
      <HeroSection user={user} loading={loading} />
      <TrustSection />
      <HowItWorksSection />
      <FeaturesBento />
      <LiveAIShowcase />
      <Pricing user={user} />
      <FinalCTA user={user} />
    </div>
  );
}
