import React from "react";
import { Check, Zap, ArrowRight, Building } from "lucide-react";
import { Link } from "react-router-dom";

const Pricing = ({ user }) => {
  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white tracking-tight">
            Simple, transparent <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">pricing</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Choose the perfect plan for your repository intelligence needs.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          
          {/* Free Plan */}
          <div className="glass-card p-8 relative flex flex-col justify-between border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
              <p className="text-slate-400 text-sm mb-6">Perfect for open-source and personal projects.</p>
              <div className="mb-6">
                <span className="text-5xl font-extrabold text-white">$0</span>
                <span className="text-slate-500 font-medium">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check size={18} className="text-blue-500 shrink-0" /><span>Up to 3 repositories</span></li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check size={18} className="text-blue-500 shrink-0" /><span>Basic AI analysis</span></li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check size={18} className="text-blue-500 shrink-0" /><span>Community support</span></li>
              </ul>
            </div>
            <button className="w-full py-3 px-4 rounded-xl font-semibold btn-ghost text-white">Get Started</button>
          </div>

          {/* Pro Plan */}
          <div className="glass-card p-8 relative flex flex-col justify-between transform md:-translate-y-4 shadow-2xl"
               style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(30,144,255,0.4)", boxShadow: "0 0 40px rgba(30,144,255,0.15)" }}>
            <div className="absolute top-0 right-0 w-full h-full bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-400 to-purple-500" />
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2"><Zap size={20} className="text-blue-400" /> Pro</h3>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full border border-blue-500/30">Most Popular</span>
              </div>
              <p className="text-slate-400 text-sm mb-6">Advanced intelligence for professional developers.</p>
              <div className="mb-6">
                <span className="text-5xl font-extrabold text-white">$29</span>
                <span className="text-slate-500 font-medium">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3 text-sm text-white"><Check size={18} className="text-blue-400 shrink-0 drop-shadow-[0_0_8px_rgba(30,144,255,0.8)]" /><span>Unlimited repositories</span></li>
                <li className="flex items-start gap-3 text-sm text-white"><Check size={18} className="text-blue-400 shrink-0 drop-shadow-[0_0_8px_rgba(30,144,255,0.8)]" /><span>Deep architecture insights</span></li>
                <li className="flex items-start gap-3 text-sm text-white"><Check size={18} className="text-blue-400 shrink-0 drop-shadow-[0_0_8px_rgba(30,144,255,0.8)]" /><span>Advanced technical debt tracking</span></li>
                <li className="flex items-start gap-3 text-sm text-white"><Check size={18} className="text-blue-400 shrink-0 drop-shadow-[0_0_8px_rgba(30,144,255,0.8)]" /><span>Priority email support</span></li>
              </ul>
            </div>
            <button className="relative z-10 w-full py-3 px-4 rounded-xl font-semibold btn-primary flex items-center justify-center gap-2 group">
              Upgrade to Pro <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="glass-card p-8 relative flex flex-col justify-between border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2"><Building size={20} className="text-purple-400" /> Enterprise</h3>
              <p className="text-slate-400 text-sm mb-6">Custom solutions for large engineering teams.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">Custom</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check size={18} className="text-purple-400 shrink-0" /><span>Everything in Pro</span></li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check size={18} className="text-purple-400 shrink-0" /><span>Self-hosted / On-premise options</span></li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check size={18} className="text-purple-400 shrink-0" /><span>Custom integrations & API access</span></li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check size={18} className="text-purple-400 shrink-0" /><span>Dedicated success manager</span></li>
              </ul>
            </div>
            <button className="w-full py-3 px-4 rounded-xl font-semibold btn-ghost text-white border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/10">Contact Sales</button>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Pricing;
