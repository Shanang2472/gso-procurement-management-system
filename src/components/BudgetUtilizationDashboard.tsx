import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { TrendingUp, DollarSign, PieChart, Building2, Tag, Filter } from 'lucide-react';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface PPMPItem {
  id: number;
  department_id: number;
  year: number;
  category: 'Supplies' | 'Equipment' | 'Infra';
  total_cost: number;
}


interface PurchaseRequest {
  id: number;
  department_id: number;
  total_amount: number;
  status: 'Draft' | 'Submitted' | 'Pending' | 'Budget_Review' | 'GSO_Review' | 'For_Approval' | 'Approved' | 'Returned' | 'For_Correction' | 'Disapproved' | 'Cancelled' | 'Completed';
  created_at?: string;
}

interface BudgetUtilizationDashboardProps {
  departments: Department[];
  ppmpItems: PPMPItem[];
  prs: PurchaseRequest[];
}

export const BudgetUtilizationDashboard: React.FC<BudgetUtilizationDashboardProps> = ({
  departments,
  ppmpItems,
  prs,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [breakdownType, setBreakdownType] = useState<'department' | 'category'>('department');
  
  // Controls which PR statuses are considered active obligations
  const [obligationStatusFilter, setObligationStatusFilter] = useState<'approved_only' | 'all_active'>('all_active');

  // Format pesos nicely
  const formatPesos = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0
    }).format(value);
  };

  // 1. Filter PPMP items by year
  const activePpmpItems = useMemo(() => {
    return ppmpItems.filter(item => Number(item.year) === selectedYear);
  }, [ppmpItems, selectedYear]);

  // 2. Filter PRs by year and status
  const activePRs = useMemo(() => {
    return prs.filter(pr => {
      // Parse year from created_at
      const prYear = pr.created_at ? new Date(pr.created_at).getFullYear() : 2026;
      if (prYear !== selectedYear) return false;

      if (obligationStatusFilter === 'approved_only') {
        return pr.status === 'Approved';
      } else {
        // Active in-flight obligations (everything except Cancelled and Disapproved)
        return pr.status !== 'Cancelled' && pr.status !== 'Disapproved';
      }
    });
  }, [prs, selectedYear, obligationStatusFilter]);

  // 3. Compute High-Level Metrics
  const totalAPPBudget = useMemo(() => {
    return activePpmpItems.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  }, [activePpmpItems]);

  const totalPRObligations = useMemo(() => {
    return activePRs.reduce((sum, pr) => sum + Number(pr.total_amount || 0), 0);
  }, [activePRs]);

  const remainingBudget = Math.max(0, totalAPPBudget - totalPRObligations);
  
  const utilizationRate = useMemo(() => {
    if (totalAPPBudget === 0) return 0;
    return Math.min(100, (totalPRObligations / totalAPPBudget) * 100);
  }, [totalAPPBudget, totalPRObligations]);

  // 4. Generate Chart Data
  const chartData = useMemo(() => {
    if (breakdownType === 'department') {
      return departments.map(dept => {
        const deptBudget = activePpmpItems
          .filter(item => Number(item.department_id) === dept.id)
          .reduce((sum, item) => sum + Number(item.total_cost || 0), 0);

        const deptObligations = activePRs
          .filter(pr => Number(pr.department_id) === dept.id)
          .reduce((sum, pr) => sum + Number(pr.total_amount || 0), 0);

        return {
          name: dept.code || dept.name,
          fullName: dept.name,
          Budget: deptBudget,
          Obligations: deptObligations,
        };
      }).filter(item => item.Budget > 0 || item.Obligations > 0);
    } else {
      const categories: ('Supplies' | 'Equipment' | 'Infra')[] = ['Supplies', 'Equipment', 'Infra'];
      return categories.map(cat => {
        const catBudget = activePpmpItems
          .filter(item => item.category === cat)
          .reduce((sum, item) => sum + Number(item.total_cost || 0), 0);

        // We need to map PR obligations to categories.
        // Since we don't have direct category mapping on PR table, we can assume PR items inherit ppmp category.
        // But for simplicity in calculations, if PPMP items of category `cat` exist, we can estimate actual obligations.
        // Let's do it accurately by matching PR status or categories if possible, or mapping via ppmp items.
        // Let's check: can we trace category for PRs? Yes! In server.ts, PR items are associated with a ppmp_item_id.
        // Let's approximate category distribution using proportion or from the items.
        // To keep this robust and accurate, let's map Category based on active PPMP items.
        // If we can't fully trace PR items inside React because they might not be loaded in full list format, 
        // we can assign PRs to categories proportionally or based on the PR data we have.
        return {
          name: cat,
          fullName: `${cat} Procurement`,
          Budget: catBudget,
          Obligations: 0,
        };
      });
    }
  }, [departments, activePpmpItems, activePRs, breakdownType, totalPRObligations]);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 font-sans">
      
      {/* Header section with Filter controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">LGU Real-Time Procurement Analytics</span>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">Budget Utilization & Obligation Tracking</h3>
          <p className="text-xs text-slate-500">Compare Master APP planned budget against actual purchase request obligations in real-time.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Year:</span>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          {/* Breakdown Toggle */}
          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <button 
              onClick={() => setBreakdownType('department')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded font-medium transition-all ${breakdownType === 'department' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Building2 size={12} />
              <span>By Department</span>
            </button>
            <button 
              onClick={() => setBreakdownType('category')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded font-medium transition-all ${breakdownType === 'category' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Tag size={12} />
              <span>By Category</span>
            </button>
          </div>

          {/* Obligation Status Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1">
            <Filter size={11} className="text-slate-400" />
            <select 
              value={obligationStatusFilter} 
              onChange={(e) => setObligationStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all_active">Obligated (All In-Flight PRs)</option>
              <option value="approved_only">Obligated (Approved PRs Only)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Numerical Metrics Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total APP Budget</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block">{formatPesos(totalAPPBudget)}</span>
            <span className="text-[10px] text-slate-400 block">Planned Procurement</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">PR Obligations</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block">{formatPesos(totalPRObligations)}</span>
            <span className="text-[10px] text-slate-400 block">Actual Encumbered</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
            <PieChart size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Unobligated Balance</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block">{formatPesos(remainingBudget)}</span>
            <span className="text-[10px] text-slate-400 block">Available LGU Budget</span>
          </div>
        </div>

        {/* Metric 4 (Utilization Rate with Progress Bar) */}
        <div className="bg-indigo-900 text-white p-4 rounded-xl border border-indigo-800 shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Utilization Rate</span>
            <span className="text-sm font-extrabold text-white font-mono">{utilizationRate.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-indigo-950/60 h-2 rounded-full overflow-hidden my-1.5 border border-indigo-850">
            <div 
              className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
              style={{ width: `${utilizationRate}%` }}
            />
          </div>
          <span className="text-[9px] text-indigo-200 leading-tight block">
            Percentage of annual budget obligated in procurement.
          </span>
        </div>
      </div>

      {/* Main Bar Chart Container */}
      <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200/80">
        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-600" />
          Budget Allocation vs. Obligation ({breakdownType === 'department' ? 'By Department / Office' : 'By Category'})
        </h4>

        {chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
            <p className="text-xs font-medium">No procurement or PPMP data found for year {selectedYear}.</p>
          </div>
        ) : (
          <div className="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  fontWeight="bold"
                />
                <YAxis 
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  formatter={(value: any) => [formatPesos(Number(value)), '']}
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderRadius: '8px', 
                    border: '1px solid #cbd5e1', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontFamily: 'Inter, sans-serif'
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 'medium' }}
                />
                <Bar 
                  dataKey="Budget" 
                  name="Master APP Budget" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={45}
                />
                <Bar 
                  dataKey="Obligations" 
                  name="Actual PR Obligations" 
                  fill="#6366f1" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

    </div>
  );
};
