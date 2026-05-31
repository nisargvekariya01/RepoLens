import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Users, GitMerge, AlertCircle, TrendingUp, RefreshCw, 
  Clock, ShieldAlert, CheckCircle, Flame, ChevronDown, ChevronUp, Filter, Star
} from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getProjectActivity } from "../api/project.api";
import AnalysisLoader from "./loading/AnalysisLoader";
import { ActivitySkeleton } from "./loading/SkeletonComponents";

// ─── Reusable Components ───────────────────────────────────────────────────────

const CollapsibleCard = ({ icon: Icon, title, children, defaultOpen = true, extraHeader }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="glass-card p-6 flex flex-col transition-all border border-white/5 hover:border-white/10 group/card bg-gradient-to-b from-surface/50 to-transparent">
      <div 
        className="flex justify-between items-center cursor-pointer select-none mb-1" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-neon-purple" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-widest">{title}</h3>
          {extraHeader && <span className="ml-2">{extraHeader}</span>}
        </div>
        <div className="p-1.5 rounded-md bg-white/5 group-hover/card:bg-white/10 transition-colors">
           {isOpen ? <ChevronUp size={14} className="text-white/50" /> : <ChevronDown size={14} className="text-white/50" />}
        </div>
      </div>
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-5 flex-1 flex flex-col">
          {children}
        </div>
      )}
    </div>
  );
};

const StatPanel = ({ label, value, subLabel, badgeCls }) => (
  <div className="bg-surface/40 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
    <p className="text-xs text-text-muted font-medium mb-1">{label}</p>
    <div className="flex items-center gap-3">
      <span className="text-2xl font-bold text-white tabular-nums">{value ?? 0}</span>
      {subLabel && (
        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${badgeCls}`}>
          {subLabel}
        </span>
      )}
    </div>
  </div>
);

const DoraStat = ({ title, value, unit, performance }) => {
  const getBadge = (perf) => {
    if (perf === "Elite")  return "bg-neon-purple/20 text-neon-purple border-neon-purple/50 shadow-[0_0_8px_rgba(168,85,247,0.5)]";
    if (perf === "High")   return "bg-neon-green/20 text-neon-green border-neon-green/50 shadow-[0_0_8px_rgba(74,222,128,0.3)]";
    if (perf === "Medium") return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
    return "bg-neon-pink/20 text-neon-pink border-neon-pink/50";
  };

  const getProgress = (perf) => {
    if (perf === "Elite")  return "100%";
    if (perf === "High")   return "75%";
    if (perf === "Medium") return "50%";
    return "25%";
  };

  const getTrendIcon = (perf) => {
    if (perf === "Elite") return "↑";
    if (perf === "High") return "↑";
    if (perf === "Low") return "↓";
    return "→";
  };

  const safePerformance = performance || "Low";

  return (
    <div className="glass-card p-5 group flex flex-col justify-between h-full">
      <h4 className="text-xs text-text-muted font-semibold tracking-wider uppercase mb-3">{title}</h4>
      <div>
        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="text-3xl font-black text-white">{value ?? "N/A"}</span>
          {unit && <span className="text-sm font-medium text-text-muted">{unit}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded border uppercase tracking-widest ${getBadge(safePerformance)}`}>
            {getTrendIcon(safePerformance)} {safePerformance}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${getBadge(safePerformance).split(' ')[0]}`} 
            style={{ width: getProgress(safePerformance) }} 
          />
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const RepoActivityDashboard = ({ projectId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [metricFilter, setMetricFilter] = useState("all"); // "all", "commits", "issues", "prs", "dora"

  useEffect(() => {
    fetchActivity();
  }, [projectId]);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getProjectActivity(projectId, "day");
      setData(res);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load activity analytics.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <AnalysisLoader
          variant="activity"
          size="md"
          title="Analyzing Git History..."
          subtitle="Processing commits, pull requests, contributors, and DORA metrics."
          progress={0}
          showProgressBar={true}
          glowEffect={true}
          animated={true}
          stages={[
            "Fetching commit history...",
            "Analyzing contributors...",
            "Processing pull requests...",
            "Computing DORA metrics...",
            "Building activity report...",
          ]}
          estimatedTime="~15 sec"
        />
        <div className="mt-6 opacity-40 pointer-events-none">
          <ActivitySkeleton />
        </div>
      </>
    );
  }

  if (error) {
     return (
       <div className="glass-card p-8 border border-neon-pink/30 bg-neon-pink/5 text-center rounded-lg">
         <p className="text-neon-pink mb-4">{error}</p>
         <button onClick={fetchActivity} className="px-4 py-2 bg-surface hover:bg-white/5 rounded-lg text-sm border border-white/10 text-white">Retry Analysis</button>
       </div>
     );
  }

  // Ensure safety if data is null or undefined
  if (!data) return null;

  const { commits = {}, contributors = {}, prs = {}, issues = {}, dora = {}, starHistory = [] } = data;

  const renderHeatmap = () => {
    if (!commits.heatmap || commits.heatmap.length === 0) return (
      <p className="text-xs text-text-muted py-4">No heatmap data available.</p>
    );

    const getColor = (count) => {
      if (count === 0) return "bg-white/5";
      if (count < 3) return "bg-neon-purple/40 hover:bg-neon-purple/60 cursor-pointer";
      if (count < 6) return "bg-neon-purple/80 shadow-[0_0_5px_rgba(168,85,247,0.5)] cursor-pointer hover:bg-neon-purple";
      return "bg-neon-purple shadow-[0_0_12px_rgba(168,85,247,0.9)] cursor-pointer hover:bg-white";
    };

    return (
      <div className="grid grid-rows-7 grid-flow-col auto-cols-fr gap-[1px] sm:gap-[2px] w-full">
        {commits.heatmap.map((day, i) => (
          <div 
            key={`day-${i}`} 
            title={day.date ? `${day.date}: ${day.count} commits` : ""}
            className={`w-full aspect-square rounded-[1px] sm:rounded-[2px] transition-colors ${day.date ? getColor(day.count) : "opacity-0"} ${day.date ? "cursor-help" : ""}`} 
          />
        ))}
      </div>
    );
  };

  // Helper to ensure we have a data point for every day in the range
  const fillMissingDates = (dataArray, daysCount) => {
    const map = {};
    (dataArray || []).forEach(d => {
      map[d.date] = d.count;
    });

    const paddedData = [];
    const start = new Date();
    start.setDate(start.getDate() - daysCount + 1);
    
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      paddedData.push({
        date: dateStr,
        count: map[dateStr] || 0
      });
    }
    return paddedData;
  };

  const filteredCommits = fillMissingDates(commits.commitsOverTime, days);

  return (
    <motion.div
      key="activity-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6"
    >

      {/* ── Filter Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-surface/30 p-4 rounded-xl border border-white/5 gap-4">
        <div className="flex items-center gap-3">
           <Filter size={16} className="text-neon-purple" />
           <span className="text-sm font-semibold text-white tracking-widest uppercase">Dashboard Filter Settings</span>
        </div>
        
        <div className="flex flex-wrap gap-4">
           <div className="flex items-center bg-background rounded-lg border border-white/10 p-1">
              {["all", "commits", "issues", "prs", "dora"].map(m => (
                <button 
                  key={m}
                  onClick={() => setMetricFilter(m)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${metricFilter === m ? "bg-white/10 text-white shadow-sm" : "text-text-muted hover:text-white/80"}`}
                >
                  {m}
                </button>
              ))}
           </div>
           <div className="flex items-center bg-background rounded-lg border border-white/10 p-1">
              {[30, 90, 365].map(d => (
                <button 
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${days === d ? "bg-neon-purple/20 text-neon-purple" : "text-text-muted hover:text-white/80"}`}
                >
                  {d}D Range
                </button>
              ))}
           </div>
        </div>
      </div>

      {/* ── 5. DORA Metrics (Hero Header) ── */}
      {(metricFilter === "all" || metricFilter === "dora") && (
        <CollapsibleCard icon={TrendingUp} title="DORA Performance Metrics">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DoraStat 
              title="Deployment Frequency" 
              value={dora.deploymentFrequency} unit="/ day"
              performance={dora.performance?.deploymentFrequency} 
            />
            <DoraStat 
              title="Lead Time for Changes" 
              value={dora.leadTimeForChangesHours} unit="hrs"
              performance={dora.performance?.leadTime} 
            />
            <DoraStat 
              title="Change Failure Rate" 
              value={dora.changeFailureRate} unit="%"
              performance={dora.performance?.changeFailureRate} 
            />
            <DoraStat 
              title="Time to Restore Service" 
              value={dora.timeToRestoreServiceHours} unit="hrs"
              performance={dora.performance?.timeToRestore} 
            />
          </div>
        </CollapsibleCard>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column (Wider) */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* ── 1. Commit Activity ── */}
          {(metricFilter === "all" || metricFilter === "commits") && (
            <CollapsibleCard icon={Activity} title="Commit Trend Matrix" extraHeader={<span className="text-[10px] bg-neon-purple/20 text-neon-purple px-2 py-0.5 rounded-full ml-2">LAST {days} DAYS</span>}>
              {/* Context Area Chart */}
               <div className="h-48 w-full mb-6">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={filteredCommits.length > 0 ? filteredCommits : [{ count: 0, date: '' }]} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorCommitTrend" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4}/>
                         <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                     <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
                     <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, dataMax => Math.max(dataMax || 0, 5)]} />
                     <Tooltip 
                       contentStyle={{ backgroundColor: 'rgba(28, 30, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                       itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}
                       labelStyle={{ color: '#9CA3AF', fontSize: '11px', marginBottom: '2px' }}
                     />
                     <Area type="linear" dataKey="count" stroke="#A855F7" strokeWidth={3} fillOpacity={1} fill="url(#colorCommitTrend)" activeDot={{ r: 6, fill: '#A855F7', stroke: "#fff", strokeWidth: 2 }} />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>

               {/* Heatmap */}
               <div className="pt-4 border-t border-white/5">
                 <p className="text-xs text-text-muted mb-3 font-medium">Daily Contribution Heatmap (365d)</p>
                 {renderHeatmap()}
               </div>
            </CollapsibleCard>
          )}

          {/* ── Star Growth Graph (moved from Trends) ── */}
          {(metricFilter === "all" || metricFilter === "commits") && (
            <CollapsibleCard icon={Star} title="Star Growth" extraHeader={<span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full ml-2">LAST 365 DAYS</span>}>
              {(() => {
                const chartData = fillMissingDates(starHistory, 365);
                return (
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorStarGrowth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EAB308" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, dataMax => Math.max(dataMax || 0, 5)]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(28, 30, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                          itemStyle={{ color: '#EAB308', fontSize: '13px', fontWeight: 'bold' }}
                          labelStyle={{ color: '#9CA3AF', fontSize: '11px', marginBottom: '2px' }}
                          formatter={(value) => [`${value} new stars`, 'Stars']}
                        />
                        <Area type="linear" dataKey="count" stroke="#EAB308" strokeWidth={3} fillOpacity={1} fill="url(#colorStarGrowth)" activeDot={{ r: 6, fill: '#EAB308', stroke: "#fff", strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </CollapsibleCard>
          )}

          {/* ── 3. Pull Requests & 4. Issues ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* PRs */}
             {(metricFilter === "all" || metricFilter === "prs") && (
               <div className="h-full">
                 <CollapsibleCard icon={GitMerge} title="Pull Requests">
                   <div className="grid grid-cols-2 gap-3 mb-4">
                     <StatPanel label="Merged" value={prs.merged} subLabel={`${prs.mergeRate || 0}%`} badgeCls="bg-neon-purple/20 text-neon-purple" />
                     <StatPanel label="Open" value={prs.open} />
                   </div>
                   <div className="space-y-3 pt-4 mt-auto border-t border-white/5">
                     <div className="flex justify-between items-center text-sm group/row hover:bg-white/5 p-1 rounded transition-colors">
                       <div className="flex items-center text-text-muted group-hover/row:text-white transition-colors"><Clock size={14} className="mr-2 text-white/30" /> Cycle Time</div>
                       <span className={`font-bold ${(prs.avgCycleTimeHours || 0) > 72 ? 'text-yellow-500' : 'text-white'}`}>
                         {prs.avgCycleTimeHours ?? 0} hrs
                       </span>
                     </div>
                     <div className="flex justify-between items-center text-sm group/row hover:bg-white/5 p-1 rounded transition-colors">
                       <div className="flex items-center text-text-muted group-hover/row:text-white transition-colors"><ShieldAlert size={14} className="mr-2 text-white/30" /> Review Time</div>
                       <span className="font-bold text-white">{prs.avgReviewTimeHours ?? 0} hrs</span>
                     </div>
                   </div>
                 </CollapsibleCard>
               </div>
             )}

             {/* Issues */}
             {(metricFilter === "all" || metricFilter === "issues") && (
               <div className="h-full">
                 <CollapsibleCard icon={AlertCircle} title="Issues Summary">
                   <div className="grid grid-cols-2 gap-3 mb-4">
                     <StatPanel label="Open (Stale)" value={issues.open} subLabel={`${issues.stale || 0} stale`} badgeCls="bg-yellow-500/20 text-yellow-500" />
                     <StatPanel label="Closed" value={issues.closed} />
                   </div>
                   <div className="space-y-3 pt-4 mt-auto border-t border-white/5">
                     <div className="flex justify-between items-center text-sm group/row hover:bg-white/5 p-1 rounded transition-colors">
                       <div className="flex items-center text-text-muted group-hover/row:text-white transition-colors"><CheckCircle size={14} className="mr-2 text-white/30" /> Avg Close Time</div>
                       <span className="font-bold text-white">{issues.avgTimeToCloseHours ?? 0} hrs</span>
                     </div>
                     <div className="flex justify-between items-center text-sm group/row hover:bg-white/5 p-1 rounded transition-colors">
                       <div className="flex items-center text-text-muted group-hover/row:text-white transition-colors"><Flame size={14} className="mr-2 text-white/30" /> Bug / Feature Ratio</div>
                       <span className={`font-bold ${(issues.bugToFeatureRatio || 0) > 1 ? 'text-neon-pink' : 'text-neon-green'}`}>
                         {issues.bugToFeatureRatio === -1 ? 'Bug only' : (issues.bugToFeatureRatio ?? 0)}
                       </span>
                     </div>
                   </div>
                 </CollapsibleCard>
               </div>
             )}
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          
          {/* ── 2. Contributors ── */}
          {(metricFilter === "all" || metricFilter === "commits") && (
            <div className="h-full">
              <CollapsibleCard icon={Users} title="Top Contributors">
                
                <div className="mb-6 p-4 rounded-xl border border-white/10 bg-gradient-to-br from-surface to-surface/40 flex items-center justify-between hover:border-white/20 transition-all cursor-crosshair">
                  <div>
                     <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-1">Bus Factor</p>
                     <div className="flex items-center gap-2">
                       <span className={`text-3xl font-black ${contributors.riskLevel === 'high' ? 'text-neon-pink' : 'text-white'}`}>
                         {contributors.busFactor ?? 0}
                       </span>
                       <span className="text-sm font-medium text-text-muted">/ {contributors.totalContributors ?? 0}</span>
                     </div>
                  </div>
                  <div className={`px-3 py-1 font-bold text-xs rounded uppercase tracking-widest flex items-center relative group/bus ${
                    contributors.riskLevel === 'high' ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/50 animate-pulse' : 
                    contributors.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 
                    'bg-neon-green/20 text-neon-green border border-neon-green/50'
                  }`}>
                    {contributors.riskLevel === 'high' && <AlertCircle size={12} className="mr-1 inline-block" />}
                    {contributors.riskLevel ?? "Low"} Risk
                    {/* Bus factor tooltip */}
                    <div className="absolute hidden group-hover/bus:block bottom-full mb-2 bg-gray-900 border border-white/10 text-white text-[10px] w-48 right-0 p-2 rounded shadow-2xl z-50 normal-case tracking-normal font-normal">
                      Indicates project reliance on a select few contributors. High risk implies codebase knowledge is dangerously centralized.
                    </div>
                  </div>
                </div>

                <div className="space-y-2 flex-1 pt-2 border-t border-white/5">
                  {(contributors.contributors || []).slice(0, 10).map((c, i) => (
                    <div key={c.login || c.name || i} className="flex items-center justify-between group p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-hover border border-white/10 flex items-center justify-center shrink-0 overflow-hidden group-hover:border-neon-purple transition-colors">
                           {c.avatar ? (
                             <img 
                               src={c.avatar} 
                               alt={c.login || "avatar"} 
                               className="w-full h-full object-cover" 
                               onError={(e) => {
                                 e.target.style.display = 'none';
                                 e.target.parentElement.innerHTML = `<span class="text-xs font-bold text-white/50">${(c.login || c.name || "?").charAt(0).toUpperCase()}</span>`;
                               }}
                             />
                           ) : (
                             <span className="text-xs font-bold text-white/50">{(c.name || c.login || "?").charAt(0).toUpperCase()}</span>
                           )}
                        </div>
                        <div className="flex flex-col justify-center h-8">
                           <div className={`text-sm font-semibold text-white/90 group-hover:text-white leading-none tracking-tight ${!(c.additions > 0 || c.deletions > 0) ? '-translate-y-[2px]' : ''}`}>{c.login || c.name}</div>
                           {(c.additions > 0 || c.deletions > 0) && (
                             <div className="text-[10px] text-text-muted flex gap-2 mt-1.5">
                               <span className="text-neon-green">+{c.additions}</span>
                               <span className="text-neon-pink">-{c.deletions}</span>
                             </div>
                           )}
                        </div>
                      </div>
                      
                      <div className="text-right flex flex-col justify-center">
                        <div className="text-sm font-bold text-white leading-none">{c.commits ?? 0}</div>
                        <div className="text-[10px] text-text-muted uppercase mt-1 leading-none tracking-wider">Commits</div>
                      </div>
                    </div>
                  ))}
                </div>
                
              </CollapsibleCard>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RepoActivityDashboard;
