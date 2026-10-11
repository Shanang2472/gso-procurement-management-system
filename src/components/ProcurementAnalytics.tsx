import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  BarChart3, 
  PieChart as PieIcon, 
  Clock, 
  Sparkles, 
  Building2, 
  Briefcase, 
  FileText,
  Percent
} from 'lucide-react';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface PurchaseRequest {
  id: number;
  pr_no: string;
  department_id: number;
  total_amount: number;
  status: string;
  created_at?: string;
  mode_of_procurement?: string | null;
}

interface PurchaseOrder {
  id: number;
  po_no: string;
  pr_id: number;
  po_date: string;
  mode_of_procurement: string;
  created_at: string;
  status: string;
}

interface ProcurementAnalyticsProps {
  departments: Department[];
  prs: PurchaseRequest[];
  pos: PurchaseOrder[];
}

export const ProcurementAnalytics: React.FC<ProcurementAnalyticsProps> = ({
  departments,
  prs,
  pos,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [activeChartSection, setActiveChartSection] = useState<'trends' | 'departments' | 'modes'>('trends');

  // Helper: Format Pesos nicely
  const formatPesos = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Helper: Get department code/name by ID
  const getDeptInfo = (deptId: number) => {
    const dept = departments.find(d => Number(d.id) === Number(deptId));
    return {
      code: dept?.code || 'UNK',
      name: dept?.name || 'Unknown Office'
    };
  };

  // Filter PRs & POs by selected year
  const activePRsForYear = useMemo(() => {
    return prs.filter(pr => {
      const prYear = pr.created_at ? new Date(pr.created_at).getFullYear() : 2026;
      return prYear === selectedYear;
    });
  }, [prs, selectedYear]);

  const activePOsForYear = useMemo(() => {
    return pos.filter(po => {
      const poYear = po.created_at ? new Date(po.created_at).getFullYear() : 
                     po.po_date ? new Date(po.po_date).getFullYear() : 2026;
      return poYear === selectedYear;
    });
  }, [pos, selectedYear]);

  // Map POs with their associated PRs to calculate exact department spending
  const enrichedPOs = useMemo(() => {
    return activePOsForYear.map(po => {
      const matchingPR = prs.find(p => Number(p.id) === Number(po.pr_id));
      const amount = matchingPR?.total_amount || 0;
      const deptId = matchingPR?.department_id || 0;
      return {
        ...po,
        amount,
        department_id: deptId,
      };
    });
  }, [activePOsForYear, prs]);

  // 1. Core LGU Performance Metrics
  const totalSpend = useMemo(() => {
    return enrichedPOs
      .filter(po => po.status !== 'Cancelled')
      .reduce((sum, po) => sum + Number(po.amount || 0), 0);
  }, [enrichedPOs]);

  const activeRequisitionsValue = useMemo(() => {
    // PRs that are in review or approved but do not yet have a purchase order generated
    const prsWithPo = new Set(pos.map(po => Number(po.pr_id)));
    return activePRsForYear
      .filter(pr => !prsWithPo.has(Number(pr.id)) && pr.status !== 'Cancelled' && pr.status !== 'Disapproved')
      .reduce((sum, pr) => sum + Number(pr.total_amount || 0), 0);
  }, [activePRsForYear, pos]);

  const publicBiddingRatio = useMemo(() => {
    const totalPoSpend = enrichedPOs.filter(po => po.status !== 'Cancelled').reduce((sum, po) => sum + Number(po.amount || 0), 0);
    if (totalPoSpend === 0) return 0;

    const biddingSpend = enrichedPOs
      .filter(po => po.status !== 'Cancelled' && (po.mode_of_procurement?.toLowerCase().includes('bidding') || false))
      .reduce((sum, po) => sum + Number(po.amount || 0), 0);

    return (biddingSpend / totalPoSpend) * 100;
  }, [enrichedPOs]);

  // Average Procurement Lead Time (PR Created At -> PO Created At in Days)
  const averageLeadTime = useMemo(() => {
    const validPairs = enrichedPOs
      .map(po => {
        const matchingPR = prs.find(p => Number(p.id) === Number(po.pr_id));
        if (!matchingPR || !matchingPR.created_at || !po.created_at) return null;
        
        const prTime = new Date(matchingPR.created_at).getTime();
        const poTime = new Date(po.created_at).getTime();
        const differenceDays = (poTime - prTime) / (1000 * 60 * 60 * 24);
        
        return differenceDays >= 0 ? differenceDays : null;
      })
      .filter((val): val is number => val !== null);

    if (validPairs.length === 0) return 0;
    return Math.round(validPairs.reduce((sum, val) => sum + val, 0) / validPairs.length * 10) / 10;
  }, [enrichedPOs, prs]);

  // 2. Spending Trends over Time (Monthly Accumulation/Breakdown)
  const monthlyTrendsData = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    const monthlySum = Array(12).fill(0);
    const prMonthlySum = Array(12).fill(0);

    enrichedPOs.forEach(po => {
      if (po.status === 'Cancelled') return;
      const date = po.created_at ? new Date(po.created_at) : (po.po_date ? new Date(po.po_date) : null);
      if (date) {
        const m = date.getMonth();
        if (m >= 0 && m < 12) {
          monthlySum[m] += Number(po.amount || 0);
        }
      }
    });

    activePRsForYear.forEach(pr => {
      if (pr.status === 'Cancelled' || pr.status === 'Disapproved') return;
      const date = pr.created_at ? new Date(pr.created_at) : null;
      if (date) {
        const m = date.getMonth();
        if (m >= 0 && m < 12) {
          prMonthlySum[m] += Number(pr.total_amount || 0);
        }
      }
    });

    let cumulativePo = 0;
    return months.map((month, idx) => {
      cumulativePo += monthlySum[idx];
      return {
        month,
        'Monthly Spend (POs)': monthlySum[idx],
        'Cumulative Spend': cumulativePo,
        'PR Requisitions': prMonthlySum[idx],
      };
    });
  }, [enrichedPOs, activePRsForYear]);

  // 3. Spending by Department Chart Data
  const departmentSpendingData = useMemo(() => {
    return departments.map(dept => {
      const deptPOAmount = enrichedPOs
        .filter(po => po.status !== 'Cancelled' && Number(po.department_id) === Number(dept.id))
        .reduce((sum, po) => sum + Number(po.amount || 0), 0);

      const deptPRAmount = activePRsForYear
        .filter(pr => pr.status !== 'Cancelled' && pr.status !== 'Disapproved' && Number(pr.department_id) === Number(dept.id))
        .reduce((sum, pr) => sum + Number(pr.total_amount || 0), 0);

      return {
        name: dept.code || dept.name,
        fullName: dept.name,
        'Actual Spent (PO)': deptPOAmount,
        'Requested (PR)': deptPRAmount,
      };
    }).sort((a, b) => b['Actual Spent (PO)'] - a['Actual Spent (PO)']);
  }, [departments, enrichedPOs, activePRsForYear]);

  // 4. Spending by Mode of Procurement Chart Data
  const modeSpendingData = useMemo(() => {
    const modeMap: { [key: string]: number } = {};
    
    enrichedPOs.forEach(po => {
      if (po.status === 'Cancelled') return;
      const mode = po.mode_of_procurement || 'Small Value Procurement';
      modeMap[mode] = (modeMap[mode] || 0) + Number(po.amount || 0);
    });

    return Object.entries(modeMap).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [enrichedPOs]);

  // Colors for Pie Chart slices
  const COLORS = ['#3b82f6', '#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  // Strategic Executive Insights Engine
  const executiveInsights = useMemo(() => {
    const insights: string[] = [];

    // Spender Insight
    if (departmentSpendingData.length > 0 && departmentSpendingData[0]['Actual Spent (PO)'] > 0) {
      const topSpender = departmentSpendingData[0];
      insights.push(`The TOP SPENDING office is the ${topSpender.fullName} (${topSpender.name}) with actual PO commitments totaling ${formatPesos(topSpender['Actual Spent (PO)'])}.`);
    } else {
      insights.push('Procurement spending accounts are currently evenly distributed across LGU departments.');
    }

    // Public Bidding Insight
    if (publicBiddingRatio > 35) {
      insights.push(`LGU transparency index is HIGH with ${publicBiddingRatio.toFixed(1)}% of total procurement funds processed via competitive Public Bidding, showing supreme compliance with GPRA (RA 9184) standards.`);
    } else {
      insights.push(`Only ${publicBiddingRatio.toFixed(1)}% of total funds are processed via Public Bidding. Alternative methods like Small Value Procurement (SVP) currently dominate. We recommend consolidating repeating office requisitions into larger bulk bidding packages.`);
    }

    // Lead Time Insight
    if (averageLeadTime <= 15) {
      insights.push(`Procurement lead efficiency is EXCELLENT. Requisitions are converted to PO contracts in an average of ${averageLeadTime} days, vastly outperforming the statutory limits.`);
    } else {
      insights.push(`Requisitions take an average of ${averageLeadTime} days to convert to signed contracts. Consider streamlining GSO officer and BAC Secretariat audit reviews.`);
    }

    // Unreleased Obligation Insight
    if (activeRequisitionsValue > 1000000) {
      insights.push(`There is currently ${formatPesos(activeRequisitionsValue)} in active, unreleased Purchase Requisitions waiting to be processed into official Awards or PO contracts. High workload is expected in the upcoming BAC cycle.`);
    } else {
      insights.push(`Requisition pipeline is highly balanced. Outstanding, unawarded PR requisitions total only ${formatPesos(activeRequisitionsValue)}.`);
    }

    return insights;
  }, [departmentSpendingData, publicBiddingRatio, averageLeadTime, activeRequisitionsValue]);

  return (
    <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-200/80 space-y-6 font-sans">
      
      {/* Title & Control Row */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200/60 pb-5">
        <div>
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">LGU Procurement Dashboard</span>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">Procurement Spending Analytics</h3>
          <p className="text-xs text-slate-500">Analyze real-time procurement expenditure channels, lead times, and RA 9184 alternative-mode transparency logs.</p>
        </div>

        {/* Year Filter Control */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Fiscal Year:</span>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>
      </div>

      {/* Core Executive KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <DollarSign size={22} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">Total Actual Spent (POs)</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block truncate">{formatPesos(totalSpend)}</span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <TrendingUp size={10} />
              <span>Signed & Active Contracts</span>
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <FileText size={22} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">In-Flight Requisitions</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block truncate">{formatPesos(activeRequisitionsValue)}</span>
            <span className="text-[10px] text-slate-400 block truncate">PRs Pending Award</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <Percent size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">Public Bidding Share</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block truncate">{publicBiddingRatio.toFixed(1)}%</span>
            <span className="text-[10px] text-slate-400 block truncate">GPRA Transparency Index</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-800 text-indigo-400 rounded-lg shrink-0">
            <Clock size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Avg. Cycle Lead Time</span>
            <span className="text-base font-extrabold text-white font-mono block truncate">{averageLeadTime} Days</span>
            <span className="text-[10px] text-emerald-400 font-medium block truncate">Compliance limit: 30 days</span>
          </div>
        </div>

      </div>

      {/* Main Charts Selection & Segment Display */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
        
        {/* Navigation Selector Tabs inside Analytics */}
        <div className="flex border-b border-slate-100 pb-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button 
              onClick={() => setActiveChartSection('trends')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs rounded-md font-bold transition-all ${activeChartSection === 'trends' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <TrendingUp size={13} />
              <span>Spending over Time</span>
            </button>
            <button 
              onClick={() => setActiveChartSection('departments')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs rounded-md font-bold transition-all ${activeChartSection === 'departments' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Building2 size={13} />
              <span>By LGU Departments</span>
            </button>
            <button 
              onClick={() => setActiveChartSection('modes')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs rounded-md font-bold transition-all ${activeChartSection === 'modes' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Briefcase size={13} />
              <span>By Procurement Modes</span>
            </button>
          </div>
        </div>

        {/* Chart Viewport */}
        <div className="h-80 w-full text-xs">
          {activeChartSection === 'trends' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyTrendsData}
                margin={{ top: 10, right: 15, left: 20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748b" 
                  tickLine={false} 
                  axisLine={false}
                  fontWeight="bold"
                  fontSize={10}
                />
                <YAxis 
                  stroke="#64748b" 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}
                  fontWeight="medium"
                  fontSize={10}
                />
                <Tooltip 
                  formatter={(value: any) => [formatPesos(Number(value)), '']}
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderRadius: '8px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                  }}
                />
                <Legend iconType="circle" iconSize={8} />
                <Area 
                  type="monotone" 
                  dataKey="Monthly Spend (POs)" 
                  stroke="#4f46e5" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSpend)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="PR Requisitions" 
                  stroke="#3b82f6" 
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={1} 
                  fill="url(#colorPR)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {activeChartSection === 'departments' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departmentSpendingData.filter(d => d['Actual Spent (PO)'] > 0 || d['Requested (PR)'] > 0)}
                margin={{ top: 10, right: 15, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  tickLine={false} 
                  axisLine={false}
                  fontWeight="bold"
                  fontSize={10}
                />
                <YAxis 
                  stroke="#64748b" 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}
                  fontWeight="medium"
                  fontSize={10}
                />
                <Tooltip 
                  formatter={(value: any) => [formatPesos(Number(value)), '']}
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderRadius: '8px', 
                    border: '1px solid #e2e8f0', 
                  }}
                />
                <Legend iconType="circle" iconSize={8} />
                <Bar 
                  dataKey="Actual Spent (PO)" 
                  fill="#4f46e5" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={30}
                />
                <Bar 
                  dataKey="Requested (PR)" 
                  fill="#93c5fd" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          )}

          {activeChartSection === 'modes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 h-full items-center">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modeSpendingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {modeSpendingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [formatPesos(Number(value)), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Custom Legend list for Pie */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-4 text-xs font-medium">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Spending Breakdown</h4>
                {modeSpendingData.map((entry, idx) => {
                  const total = modeSpendingData.reduce((sum, item) => sum + item.value, 0);
                  const percentage = total > 0 ? (entry.value / total) * 100 : 0;
                  return (
                    <div key={entry.name} className="flex items-center justify-between border-b border-slate-50 pb-1.5 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="text-slate-700 truncate max-w-44 block">{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-900 font-mono font-bold block">{formatPesos(entry.value)}</span>
                        <span className="text-[9px] text-slate-400 font-mono block">{percentage.toFixed(1)}% of total</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Strategic Executive Insights Panel */}
      <div className="bg-slate-900 rounded-xl p-5 text-white border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-indigo-400">
          <Sparkles size={18} className="fill-indigo-400/20" />
          <h4 className="text-xs font-bold uppercase tracking-wider">Executive Procurement Insights</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {executiveInsights.map((insight, idx) => (
            <div key={idx} className="bg-slate-800/40 border border-slate-800 p-3 rounded-lg flex items-start gap-3 text-xs leading-relaxed text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
              <p>{insight}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
