import React, { useEffect, useState } from "react";
import { getProjectTrends } from "../api/project.api";
import ErrorBoundary from "./ErrorBoundary";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus, Activity, Star, AlertCircle, CalendarDays, GitCommit } from "lucide-react";

export default function RepoTrendsDashboard({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("30d");
  const [eventDate, setEventDate] = useState("");
  const [tempEventDate, setTempEventDate] = useState("");

  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getProjectTrends(projectId, range, eventDate || null);
        if (isMounted) setData(res);
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.data?.error || "Failed to load trend analysis."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [projectId, range, eventDate]);

  const handleEventDateSubmit = (e) => {
    e.preventDefault();
    setEventDate(tempEventDate);
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center space-x-2">
        <AlertCircle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  const { stars, commits, comparison } = data;

  const renderTrendIcon = (direction) => {
    if (direction === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (direction === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const trendColor = (direction) => {
    if (direction === "up") return "text-green-600";
    if (direction === "down") return "text-red-600";
    return "text-gray-600";
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* SECTION 1: Header & Time Range Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Activity className="h-7 w-7 mr-2 text-indigo-600" />
              Trend Analysis
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Evaluate historical growth, velocity, and trajectory.
            </p>
          </div>
          
          <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
            {["30d", "90d", "365d"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  range === r
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 3: Trend Indicators (Stats Row) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-6">
          {/* Stars Overview Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Star className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Star Growth Rate</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-2xl font-bold ${trendColor(stars.trendDirection)}`}>
                    {stars.growthRate > 0 ? "+" : ""}{stars.growthRate}%
                  </span>
                  {renderTrendIcon(stars.trendDirection)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Trailing Avg</p>
              <p className="text-lg font-bold text-gray-800">{stars.movingAverage} <span className="text-xs text-gray-500 font-normal">/ day</span></p>
            </div>
          </div>

          {/* Commits Overview Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <GitCommit className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Commit Velocity</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-2xl font-bold ${trendColor(commits.trendDirection)}`}>
                    {commits.growthRate > 0 ? "+" : ""}{commits.growthRate}%
                  </span>
                  {renderTrendIcon(commits.trendDirection)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Trailing Avg</p>
              <p className="text-lg font-bold text-gray-800">{commits.movingAverage} <span className="text-xs text-gray-500 font-normal">/ day</span></p>
            </div>
          </div>
        </div>

        {/* SECTION 2: Growth Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-md font-semibold text-gray-800 mb-6 flex items-center">
              <Star className="h-4 w-4 mr-2 text-yellow-500" />
              Stars Trajectory
            </h3>
            {(() => {
              const chartData = stars.timeline?.length > 0 ? stars.timeline : [{ count: 0, date: '' }];
              return (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorStars" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => {
                           if (!val) return '';
                           const d = new Date(val);
                           return `${d.getMonth()+1}/${d.getDate()}`;
                        }}
                        minTickGap={20}
                      />
                      <YAxis 
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        domain={[0, dataMax => Math.max(dataMax || 0, 5)]}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: '#4B5563', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}
                        itemStyle={{ color: '#EAB308', fontSize: '14px', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="linear" 
                        dataKey="count" 
                        stroke="#EAB308" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorStars)"
                        activeDot={{ r: 6, fill: "#EAB308", stroke: "#fff", strokeWidth: 2 }}
                        dot={(props) => {
                          const { cx, cy, payload, index } = props;
                          const isPeak = stars.peaks?.some(p => p.date === payload.date);
                          if (isPeak) {
                            return (
                              <circle key={`dot-${index}`} cx={cx} cy={cy} r={5} stroke="#fff" strokeWidth={2} fill="#EAB308" />
                            );
                          }
                          return null;
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-md font-semibold text-gray-800 mb-6 flex items-center">
              <GitCommit className="h-4 w-4 mr-2 text-blue-500" />
              Commit Trajectory
            </h3>
            {(() => {
              const chartData = commits.timeline?.length > 0 ? commits.timeline : [{ count: 0, date: '' }];
              return (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => {
                           if (!val) return '';
                           const d = new Date(val);
                           return `${d.getMonth()+1}/${d.getDate()}`;
                        }}
                        minTickGap={20}
                      />
                      <YAxis 
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        domain={[0, dataMax => Math.max(dataMax || 0, 5)]}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: '#4B5563', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}
                        itemStyle={{ color: '#3B82F6', fontSize: '14px', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="linear" 
                        dataKey="count" 
                        stroke="#3B82F6" 
                        strokeWidth={3} 
                        fillOpacity={1}
                        fill="url(#colorCommits)"
                        activeDot={{ r: 6, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2 }} 
                        dot={(props) => {
                          const { cx, cy, payload, index } = props;
                          const isPeak = commits.peaks?.some(p => p.date === payload.date);
                          if (isPeak) {
                            return (
                              <circle key={`dot-cmt-${index}`} cx={cx} cy={cy} r={5} stroke="#fff" strokeWidth={2} fill="#3B82F6" />
                            );
                          }
                          return null;
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </div>
        </div>

        {/* SECTION 4 & 5: Spikes & Before/After Event Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* SECTION 4: Peaks / Highlights */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-md font-semibold text-gray-800 mb-4 flex items-center">
              <Activity className="h-4 w-4 mr-2 text-indigo-500" />
              Statistical Anomalies (Peaks)
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Starred Anomalies</span>
                {stars.peaks?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {stars.peaks.map((p, i) => (
                      <span key={`s-${i}`} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">
                        {p.date} <span className="ml-1.5 opacity-70 border-l border-yellow-300 pl-1.5">{p.count} refs</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">No major star spikes detected.</p>
                )}
              </div>

              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2 mb-2 block">Commit Anomalies</span>
                {commits.peaks?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {commits.peaks.map((p, i) => (
                      <span key={`c-${i}`} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {p.date} <span className="ml-1.5 opacity-70 border-l border-blue-300 pl-1.5">{p.count} cmts</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">No major commit spikes detected.</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 5: Before / After Comparison Tool */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-md font-semibold text-gray-800 mb-4 flex items-center">
              <CalendarDays className="h-4 w-4 mr-2 text-purple-500" />
              Event Impact Comparison
            </h3>
            
            <form onSubmit={handleEventDateSubmit} className="flex flex-col sm:flex-row gap-2 mb-6 w-full">
              <input 
                type="date"
                required
                className="flex-1 text-sm border-gray-200 shadow-sm rounded-lg border px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                value={tempEventDate}
                onChange={(e) => setTempEventDate(e.target.value)}
              />
              <button 
                type="submit" 
                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-indigo-100 whitespace-nowrap"
              >
                Analyze
              </button>
            </form>

            {comparison ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-1">Commits Impact</span>
                  <span className={`text-3xl font-black ${comparison.impact.commitsChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {comparison.impact.commitsChange > 0 ? "+" : ""}{comparison.impact.commitsChange}%
                  </span>
                  <div className="text-xs font-medium text-gray-500 mt-2 flex justify-between w-full px-2">
                    <span>{comparison.before.avgCommits} (B)</span>
                    <span>→</span>
                    <span>{comparison.after.avgCommits} (A)</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-1">Stars Impact</span>
                  <span className={`text-3xl font-black ${comparison.impact.starsChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {comparison.impact.starsChange > 0 ? "+" : ""}{comparison.impact.starsChange}%
                  </span>
                   <div className="text-xs font-medium text-gray-500 mt-2 flex justify-between w-full px-2">
                    <span>{comparison.before.avgStarsGrowth} (B)</span>
                    <span>→</span>
                    <span>{comparison.after.avgStarsGrowth} (A)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                <CalendarDays className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 font-medium">Select a pivotal event date above.</p>
                <p className="text-xs text-gray-400 mt-1">We'll automatically bisect the timeline and compare before & after trajectories.</p>
              </div>
            )}
          </div>
          
        </div>

      </div>
    </ErrorBoundary>
  );
}
