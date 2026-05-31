import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const TrendChart = ({ data }) => {
  // Format date for display
  const formattedData = (!data || data.length === 0) ? [{ health_score: 0, displayDate: '' }] : data.map(d => ({
    ...d,
    displayDate: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }));

  return (
    <div className="glass-card p-6 mt-6">
      <h3 className="text-lg font-semibold mb-6 text-white text-glow">Health Trend</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={formattedData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="displayDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              domain={[0, dataMax => Math.max(dataMax || 0, 5)]}
              dx={-10}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(28, 30, 42, 0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
            <Line 
              type="linear" 
              dataKey="health_score" 
              name="Health Score"
              stroke="#A855F7" 
              strokeWidth={4}
              activeDot={{ r: 6, strokeWidth: 0, fill: '#C084FC', style: {filter: 'drop-shadow(0px 0px 8px rgba(168,85,247,0.8))'} }}
              dot={{ r: 4, strokeWidth: 2, fill: '#1C1E2A', stroke: '#A855F7' }}
              style={{ filter: "drop-shadow(0px 4px 10px rgba(168,85,247,0.4))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;
