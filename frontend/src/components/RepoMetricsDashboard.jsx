import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, GitFork, Eye, Users, GitCommit, AlertCircle,
  BarChart3, Activity, TrendingUp, TrendingDown, Minus, RefreshCw, ArrowUp, ArrowDown, ArrowRight, Zap, Calendar, CalendarDays, Loader2, ChevronDown
} from "lucide-react";
import { getProjectMetrics, getProjectEventImpact } from "../api/project.api";
import AnalysisLoader from "./loading/AnalysisLoader";
import { MetricsSkeleton } from "./loading/SkeletonComponents";
import { useSimulatedProgress } from "../hooks/useSimulatedProgress";
import CustomDatePicker from "./CustomDatePicker";

// ─── Trend Icon + color ────────────────────────────────────────────────────────
const TrendIcon = ({ trend, size = 14 }) => {
  if (trend === "up") return <ArrowUp size={size} className="text-neon-green drop-shadow-[0_0_4px_rgba(74,222,128,0.8)]" />;
  if (trend === "down") return <ArrowDown size={size} className="text-neon-pink drop-shadow-[0_0_4px_rgba(255,100,150,0.8)]" />;
  return <ArrowRight size={size} className="text-text-muted" />;
};

// ─── Trend Badge (text label) ──────────────────────────────────────────────────
const TrendBadge = ({ trend }) => {
  const map = {
    up:     { label: "Trending Up",   cls: "text-neon-green drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]" },
    down:   { label: "Trending Down", cls: "text-neon-pink  drop-shadow-[0_0_6px_rgba(255,100,150,0.8)]" },
    stable: { label: "Stable",        cls: "text-text-muted" },
  };
  const { label, cls } = map[trend] || map.stable;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${cls}`}>
      <TrendIcon trend={trend} /> {label}
    </span>
  );
};

// ─── Growth Pill "+12% this month" ────────────────────────────────────────────
const GrowthLabel = ({ value }) => {
  const isPositive = value > 0;
  const isZero = value === 0;
  const colorClass = isZero
    ? "bg-white/10 text-text-muted"
    : isPositive
    ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
    : "bg-neon-pink/10 text-neon-pink border border-neon-pink/20";
  const sign = isPositive ? "+" : "";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${colorClass}`}>
      <TrendIcon trend={isZero ? "stable" : isPositive ? "up" : "down"} size={11} />
      {sign}{value}% this month
    </span>
  );
};

// ─── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, iconClass = "text-neon-purple", growth, trend }) => (
  <div className="glass-card p-5 flex flex-col gap-3 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all duration-300 group">
    <div className="flex items-center justify-between">
      <div className={`p-2.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors ${iconClass}`}>
        <Icon size={18} />
      </div>
      {trend !== undefined && <TrendBadge trend={trend} />}
    </div>
    <div>
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-white tabular-nums">{value ?? "—"}</p>
    </div>
    {growth !== undefined && <GrowthLabel value={growth} />}
  </div>
);

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon size={15} className="text-neon-purple" />
    <h3 className="text-xs font-semibold text-white uppercase tracking-widest">{title}</h3>
  </div>
);

// ─── Activity Bar ──────────────────────────────────────────────────────────────
const ActivityBar = ({ label, value, max, colorClass = "bg-neon-purple", sublabel }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline text-sm mb-1.5">
        <span className="text-text-muted font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {sublabel && <span className="text-xs text-text-muted">{sublabel}</span>}
          <span className="text-white font-bold tabular-nums">{value?.toLocaleString() ?? 0}</span>
        </div>
      </div>
      <div className="w-full bg-surface-hover rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ease-out ${colorClass}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
};

// ─── Activity Score Card ───────────────────────────────────────────────────────
const ActivityScoreCard = ({ score, commitTrend, starsGrowth, forksGrowth }) => {
  const scoreColor =
    score < 40 ? "bg-neon-pink shadow-[0_0_8px_rgba(255,100,150,0.7)]"
    : score < 70 ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.7)]"
    : "bg-neon-green shadow-[0_0_8px_rgba(74,222,128,0.7)]";

  const scoreLabel = score < 40 ? "Low Activity" : score < 70 ? "Moderate" : "Highly Active";

  return (
    <div className="glass-card p-6 border border-neon-purple/20 shadow-[0_0_24px_rgba(168,85,247,0.1)]">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Activity Score</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-white tabular-nums">{score}</span>
            <span className="text-text-muted font-medium">/ 100</span>
          </div>
          <p className="text-xs text-text-muted mt-1">{scoreLabel}</p>
        </div>
        <TrendBadge trend={commitTrend} />
      </div>

      {/* Progress bar */}
      <div className="w-full bg-surface-hover rounded-full h-3 overflow-hidden mb-5">
        <div
          className={`h-3 rounded-full transition-all duration-1000 ease-out ${scoreColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Growth summary row */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
        <div>
          <p className="text-xs text-text-muted mb-1.5">Stars Growth</p>
          <GrowthLabel value={starsGrowth} />
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1.5">Forks Growth</p>
          <GrowthLabel value={forksGrowth} />
        </div>
      </div>
    </div>
  );
};

// ─── Custom Select Dropdown ────────────────────────────────────────────────────
const CustomSelect = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-40 text-sm bg-surface/50 border border-white/10 shadow-sm rounded-lg px-3 py-2.5 text-white focus:outline-none hover:border-white/20 transition-all h-[42px]"
      >
        <span>{selectedOption.label}</span>
        <ChevronDown size={14} className={`text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-full bg-[#0B1121] border border-white/10 rounded-lg shadow-xl z-50 p-1"
          >
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded ${opt.value === value ? 'bg-neon-purple text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'} transition-colors`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const METRICS_STAGES = [
  "Fetching repository stats...",
  "Processing commit history...",
  "Calculating growth analytics...",
  "Building metrics dashboard...",
];
const METRICS_DURATIONS = [3000, 4000, 3000, 2000];

const RepoMetricsDashboard = ({ projectId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { progress, stageIndex, reset, markComplete } = useSimulatedProgress({
    stages: METRICS_STAGES,
    stageDurations: METRICS_DURATIONS,
    active: loading,
  });

  // ── Event Impact Comparison state ─────────────────────────────────────────
  const [eventDate, setEventDate] = useState("");
  const [eventRange, setEventRange] = useState("90d");
  const [eventLoading, setEventLoading] = useState(false);
  const [eventResult, setEventResult] = useState(null);
  const [eventError, setEventError] = useState(null);

  const handleEventAnalyze = async (e) => {
    e.preventDefault();
    if (!eventDate) return;
    try {
      setEventLoading(true);
      setEventError(null);
      setEventResult(null);
      const res = await getProjectEventImpact(projectId, eventDate, eventRange);
      if (!res.comparison) {
        setEventError("Not enough data around this date for a meaningful comparison.");
      } else {
        setEventResult(res.comparison);
      }
    } catch (err) {
      setEventError(err.response?.data?.error || "Failed to run event impact analysis.");
    } finally {
      setEventLoading(false);
    }
  };

  useEffect(() => { fetchMetrics(); }, [projectId]);

  const fetchMetrics = async () => {
    try {
      reset();
      setLoading(true);
      setError(null);
      const res = await getProjectMetrics(projectId);
      markComplete();
      setTimeout(() => setData(res), 300);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load metrics.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <AnalysisLoader
          variant="metrics"
          size="md"
          title="Loading Repository Metrics..."
          subtitle="Fetching stars, forks, commits, traffic, and growth analytics from GitHub."
          progress={progress}
          currentStageIndex={stageIndex}
          showProgressBar={true}
          glowEffect={true}
          animated={true}
          stages={METRICS_STAGES}
          estimatedTime="~10 sec"
        />
        <div className="mt-6 opacity-40 pointer-events-none">
          <MetricsSkeleton />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-8 border border-neon-pink/30 bg-neon-pink/5 text-center rounded-lg">
        <p className="text-neon-pink mb-4">{error}</p>
        <button
          onClick={fetchMetrics}
          className="inline-flex items-center px-4 py-2 border border-neon-pink/50 text-sm font-medium rounded-lg text-neon-pink hover:bg-neon-pink/10 transition-all"
        >
          <RefreshCw size={14} className="mr-2" /> Retry
        </button>
      </div>
    );
  }

  const { metrics = {}, trends = {}, growth = {}, partial = false } = data || {};
  const {
    stars = 0, forks = 0, watchers = 0, contributorsCount = 0,
    commitsCount = 0, issues = {}, traffic = {}
  } = metrics;
  const { starsGrowth = 0, forksGrowth = 0, commitTrend = "stable", activityScore = 0 } = trends;

  const totalIssues = (issues.open || 0) + (issues.closed || 0);
  const closeRate = totalIssues > 0 ? Math.round(((issues.closed || 0) / totalIssues) * 100) : 0;

  return (
    <motion.div
      key="metrics-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6"
    >

      {partial && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-yellow-400 text-sm">
          <span className="mt-0.5">⚠️</span>
          <span>Some metrics are unavailable — this may be a private repository or the GitHub token lacks sufficient permissions.</span>
        </div>
      )}

      {/* ── Row 1: Activity Score + Top Stats ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Score - spans full column on left */}
        <ActivityScoreCard
          score={activityScore}
          commitTrend={commitTrend}
          starsGrowth={starsGrowth}
          forksGrowth={forksGrowth}
        />

        {/* Stars + Forks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:col-span-2">
          <StatCard
            icon={Star}
            label="Stars"
            value={stars.toLocaleString()}
            iconClass="text-yellow-400"
            growth={starsGrowth}
            trend={starsGrowth > 0 ? "up" : starsGrowth < 0 ? "down" : "stable"}
          />
          <StatCard
            icon={GitFork}
            label="Forks"
            value={forks.toLocaleString()}
            iconClass="text-neon-purple"
            growth={forksGrowth}
            trend={forksGrowth > 0 ? "up" : forksGrowth < 0 ? "down" : "stable"}
          />
          <StatCard
            icon={Eye}
            label="Watchers"
            value={watchers.toLocaleString()}
            iconClass="text-sky-400"
          />
          <StatCard
            icon={Users}
            label="Contributors"
            value={contributorsCount.toLocaleString()}
            iconClass="text-neon-green"
          />
        </div>
      </div>

      {/* ── Row 2: Commits + Issues side-by-side ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Commit Activity */}
        <div className="glass-card p-6">
          <SectionHeader icon={Activity} title="Commit Activity" />
          <div className="space-y-5">
            <ActivityBar
              label="Total Commits"
              value={commitsCount}
              max={Math.max(commitsCount, 500)}
              colorClass="bg-neon-purple shadow-[0_0_8px_rgba(168,85,247,0.5)]"
            />
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <span className="text-sm text-text-muted font-medium">Trend (30 days)</span>
              <TrendBadge trend={commitTrend} />
            </div>
          </div>
        </div>

        {/* Issues */}
        <div className="glass-card p-6">
          <SectionHeader icon={AlertCircle} title="Issues" />
          <div className="space-y-4">
            <ActivityBar
              label="Open"
              value={issues.open || 0}
              max={totalIssues || 1}
              colorClass="bg-neon-pink shadow-[0_0_8px_rgba(255,100,150,0.5)]"
              sublabel={`${totalIssues > 0 ? Math.round(((issues.open||0)/totalIssues)*100) : 0}%`}
            />
            <ActivityBar
              label="Closed"
              value={issues.closed || 0}
              max={totalIssues || 1}
              colorClass="bg-neon-green shadow-[0_0_8px_rgba(74,222,128,0.5)]"
              sublabel={`${closeRate}%`}
            />
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <span className="text-sm text-text-muted font-medium">Close Rate</span>
              <span className={`text-sm font-bold ${closeRate >= 70 ? "text-neon-green" : closeRate >= 40 ? "text-yellow-400" : "text-neon-pink"}`}>
                {closeRate}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Traffic ────────────────────────────────────────────── */}
      <div className="glass-card p-6">
        <SectionHeader icon={TrendingUp} title="Traffic · Last 14 Days" />
        {traffic.views === 0 && traffic.clones === 0 ? (
          <p className="text-sm text-text-muted italic py-2">
            Traffic data requires push access to this repository.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Eye}       label="Total Views"      value={(traffic.views          || 0).toLocaleString()} iconClass="text-sky-400" />
            <StatCard icon={Users}     label="Unique Visitors"  value={(traffic.uniqueVisitors || 0).toLocaleString()} iconClass="text-neon-purple" />
            <StatCard icon={GitCommit} label="Clones"           value={(traffic.clones         || 0).toLocaleString()} iconClass="text-neon-green" />
          </div>
        )}
      </div>

      {/* ── Row 4: Growth Analytics (migrated from Trends) ─────────────── */}
      <div className="glass-card p-6">
        <SectionHeader icon={Zap} title="Growth Analytics · 30-Day Window" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

          <div className="bg-surface/40 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
            <p className="text-xs text-text-muted font-medium mb-2 uppercase tracking-wider">⭐ Star Growth Rate</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {growth.starGrowthRate !== undefined ? `${growth.starGrowthRate > 0 ? '+' : ''}${growth.starGrowthRate}%` : '—'}
            </p>
            <TrendBadge trend={growth.starTrendDirection || 'stable'} />
          </div>

          <div className="bg-surface/40 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
            <p className="text-xs text-text-muted font-medium mb-2 uppercase tracking-wider">⭐ Stars / Day (7d avg)</p>
            <p className="text-2xl font-bold text-white tabular-nums">{growth.starsMovingAvgPerDay ?? 0}</p>
            <p className="text-xs text-text-muted mt-1">{growth.totalNewStars365d ?? 0} new stars this year</p>
          </div>

          <div className="bg-surface/40 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
            <p className="text-xs text-text-muted font-medium mb-2 uppercase tracking-wider">⚡ Commit Velocity</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {growth.commitGrowthRate !== undefined ? `${growth.commitGrowthRate > 0 ? '+' : ''}${growth.commitGrowthRate}%` : '—'}
            </p>
            <TrendBadge trend={growth.commitTrendDirection || 'stable'} />
          </div>

          <div className="bg-surface/40 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
            <p className="text-xs text-text-muted font-medium mb-2 uppercase tracking-wider">📅 Avg Commits / Week</p>
            <p className="text-2xl font-bold text-white tabular-nums">{growth.avgCommitsPerWeek ?? 0}</p>
            <p className="text-xs text-text-muted mt-1">{growth.commitsMovingAvgPerDay ?? 0} commits / day (7d avg)</p>
          </div>
        </div>

        {/* Peaks */}
        {((growth.starPeaks?.length > 0) || (growth.commitPeaks?.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
            {growth.starPeaks?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">⭐ Star Activity Peaks</p>
                <div className="flex flex-wrap gap-2">
                  {growth.starPeaks.map((p, i) => (
                    <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                      {p.date} <span className="ml-1.5 opacity-70 border-l border-yellow-500/30 pl-1.5">{p.count} stars</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {growth.commitPeaks?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">⚡ Commit Activity Peaks</p>
                <div className="flex flex-wrap gap-2">
                  {growth.commitPeaks.map((p, i) => (
                    <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
                      {p.date} <span className="ml-1.5 opacity-70 border-l border-neon-purple/30 pl-1.5">{p.count} cmts</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Row 5: Event Impact Comparison (moved from Trends) ───────────── */}
      <div className="glass-card p-6">
        <SectionHeader icon={CalendarDays} title="Event Impact Analysis" />
        <p className="text-xs text-text-muted mb-4">
          Pick a pivotal date (release, launch, PR merge) and we'll bisect the timeline to compare Before vs After.
        </p>

        <form onSubmit={handleEventAnalyze} className="flex flex-col sm:flex-row gap-3 mb-6">
          <CustomDatePicker
            value={eventDate}
            onChange={setEventDate}
            placeholder="mm/dd/yyyy"
            position="top"
          />
          <CustomSelect
            value={eventRange}
            onChange={setEventRange}
            options={[
              { label: "30 Day Window", value: "30d" },
              { label: "90 Day Window", value: "90d" },
              { label: "365 Day Window", value: "365d" }
            ]}
          />
          <button
            type="submit"
            disabled={eventLoading || !eventDate}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-neon-purple/20 hover:bg-neon-purple/30 text-neon-purple border border-neon-purple/40 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {eventLoading ? <Loader2 size={14} className="mr-2 animate-spin" /> : <CalendarDays size={14} className="mr-2" />}
            {eventLoading ? 'Analyzing...' : 'Analyze Impact'}
          </button>
        </form>

        {eventError && (
          <p className="text-sm text-neon-pink mb-4">{eventError}</p>
        )}

        {eventResult ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Commits Impact */}
            <div className="bg-surface/40 rounded-xl p-5 border border-white/5 flex flex-col items-center text-center hover:border-white/10 transition-colors">
              <p className="text-[10px] uppercase font-black tracking-widest text-text-muted mb-2">Commits Impact</p>
              <span className={`text-4xl font-black mb-3 ${
                eventResult.impact.commitsChange >= 0 ? 'text-neon-green drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'text-neon-pink drop-shadow-[0_0_8px_rgba(255,100,150,0.6)]'
              }`}>
                {eventResult.impact.commitsChange > 0 ? '+' : ''}{eventResult.impact.commitsChange}%
              </span>
              <div className="text-xs font-medium text-text-muted flex justify-between w-full px-4 border-t border-white/5 pt-3">
                <span className="text-white/60">Before: <strong className="text-white">{eventResult.before.avgCommits}</strong>/day</span>
                <span className="text-white/40">→</span>
                <span className="text-white/60">After: <strong className="text-white">{eventResult.after.avgCommits}</strong>/day</span>
              </div>
            </div>

            {/* Stars Impact */}
            <div className="bg-surface/40 rounded-xl p-5 border border-white/5 flex flex-col items-center text-center hover:border-white/10 transition-colors">
              <p className="text-[10px] uppercase font-black tracking-widest text-text-muted mb-2">Stars Impact</p>
              <span className={`text-4xl font-black mb-3 ${
                eventResult.impact.starsChange >= 0 ? 'text-neon-green drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'text-neon-pink drop-shadow-[0_0_8px_rgba(255,100,150,0.6)]'
              }`}>
                {eventResult.impact.starsChange > 0 ? '+' : ''}{eventResult.impact.starsChange}%
              </span>
              <div className="text-xs font-medium text-text-muted flex justify-between w-full px-4 border-t border-white/5 pt-3">
                <span className="text-white/60">Before: <strong className="text-white">{eventResult.before.avgStarsGrowth}</strong>/day</span>
                <span className="text-white/40">→</span>
                <span className="text-white/60">After: <strong className="text-white">{eventResult.after.avgStarsGrowth}</strong>/day</span>
              </div>
            </div>
          </div>
        ) : (
          !eventLoading && !eventError && (
            <div className="flex flex-col items-center justify-center text-center py-8 bg-surface/20 border border-dashed border-white/10 rounded-xl">
              <CalendarDays size={32} className="text-white/20 mb-3" />
              <p className="text-sm font-medium text-text-muted">Select a pivotal event date above.</p>
              <p className="text-xs text-text-muted/60 mt-1">We'll automatically bisect the timeline and compare before & after trajectories.</p>
            </div>
          )
        )}
      </div>

    </motion.div>
  );
};

export default RepoMetricsDashboard;
