import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cfoFmt, cfoMillions, type CfoSimulation } from '../../engine/cfoEngine';

const chartStyle = {
  background: '#ffffff',
  border: '1px solid rgba(22,24,28,0.1)',
  borderRadius: 14,
  boxShadow: '0 8px 24px -6px rgba(22,24,28,0.12)',
  fontSize: 12,
  fontFamily: 'Outfit, sans-serif',
  color: '#16181C',
};

const axisTick = { fill: '#5F646B', fontSize: 11, fontFamily: 'Outfit, sans-serif' };
const millions = (value: number) => `${cfoFmt(value / 1_000_000, 1)}M`;

export function CfoCashChart({ sim }: { sim: CfoSimulation }) {
  return (
    <div className="h-[280px] min-w-0" aria-label="Cash trajectory over time">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={sim.history} margin={{ top: 15, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(22,24,28,0.06)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: 'rgba(22,24,28,0.1)' }}
            tickFormatter={(v) => `D${cfoFmt(Number(v))}`}
          />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={millions} width={52} />
          <Tooltip
            contentStyle={chartStyle}
            labelFormatter={(v) => `Capital Day ${cfoFmt(Number(v), 0)}`}
            formatter={(v) => [cfoMillions(Number(v)), '']}
          />
          <Area
            type="monotone"
            dataKey="escrowCash"
            name="DLD Escrow Balance"
            fill="#DDE4F8"
            fillOpacity={0.65}
            stroke="#AEBEE9"
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="treasuryCash"
            name="Operating Wallet"
            stroke="#F4C74B"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="payables"
            name="Unpaid Payables"
            stroke="#FA6C5D"
            strokeWidth={1.8}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CfoProfitChart({ sim }: { sim: CfoSimulation }) {
  const c = sim.current;
  const data = [
    { name: 'Potential PBT', value: sim.scenario.pbt, color: '#F4C74B' },
    { name: 'Realized Revenue', value: c.realizedRevenue, color: '#7BB694' },
    { name: 'Temporal Bleed', value: -c.nonHumanExpense - c.humanExpense, color: '#FA6C5D' },
    { name: 'Financing Drag', value: -c.financingExpense, color: '#F0A93B' },
    { name: 'Variance Penalty', value: -c.inventoryImpairment, color: '#E8503F' },
    { name: 'Retained P&L', value: c.retainedEarnings, color: c.retainedEarnings >= 0 ? '#579973' : '#16181C' },
  ];

  return (
    <div className="h-[260px] sm:h-[280px] min-w-0" aria-label="Profit decomposition">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 10, bottom: 22, left: 4 }}>
          <CartesianGrid stroke="rgba(22,24,28,0.06)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ ...axisTick, fontSize: 10.5 }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={54}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={millions} width={48} />
          <ReferenceLine y={0} stroke="rgba(22,24,28,0.2)" />
          <Tooltip
            contentStyle={chartStyle}
            formatter={(v) => [cfoMillions(Number(v)), 'Value']}
            cursor={{ fill: 'rgba(244,199,75,0.08)' }}
          />
          <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            {data.map((row) => (
              <Cell key={row.name} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CfoBalanceChart({ sim }: { sim: CfoSimulation }) {
  const c = sim.current;
  const data = [
    {
      name: 'Assets',
      cash: c.treasuryCash,
      escrow: Math.max(0, c.escrowCash - c.defectsPoolBalance),
      defects: c.defectsPoolBalance,
      inventory: c.landInventory + c.wipInventory - c.inventoryImpairment,
      debt: 0,
      interest: 0,
      deposits: 0,
      payables: 0,
      equity: 0,
      earnings: 0,
    },
    {
      name: 'Liabilities + Equity',
      cash: 0,
      escrow: 0,
      defects: 0,
      inventory: 0,
      debt: c.debtPrincipal,
      interest: c.financingAccrued,
      deposits: c.buyerContractLiability,
      payables: c.totalPayables,
      equity: c.paidInEquity,
      earnings: c.retainedEarnings,
    },
  ];

  const series = [
    { key: 'cash', name: 'Operating Cash', color: '#F4C74B' },
    { key: 'escrow', name: 'Escrow Liquidity', color: '#AEBEE9' },
    { key: 'defects', name: '5% Defects Lock', color: '#F0A93B' },
    { key: 'inventory', name: 'Land + WIP Inventory', color: '#7BB694' },
    { key: 'debt', name: 'Drawn Debt Principal', color: '#3A3E45' },
    { key: 'interest', name: 'Accrued Financing', color: '#FA6C5D' },
    { key: 'deposits', name: 'Buyer Deposits Held', color: '#8CA0DC' },
    { key: 'payables', name: 'Payables Due', color: '#E8503F' },
    { key: 'equity', name: 'Paid-in Equity', color: '#579973' },
    { key: 'earnings', name: 'Retained Earnings', color: c.retainedEarnings >= 0 ? '#417C5C' : '#96291D' },
  ];

  return (
    <div className="h-[270px] sm:h-[300px] min-w-0" aria-label="Balance sheet columns">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} stackOffset="sign" margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(22,24,28,0.06)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={millions} width={48} />
          <ReferenceLine y={0} stroke="rgba(22,24,28,0.2)" />
          <Tooltip
            contentStyle={chartStyle}
            formatter={(v) => [cfoMillions(Number(v)), '']}
            cursor={{ fill: 'rgba(244,199,75,0.06)' }}
          />
          {series.map((item) => (
            <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} stackId="balance" maxBarSize={76} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
