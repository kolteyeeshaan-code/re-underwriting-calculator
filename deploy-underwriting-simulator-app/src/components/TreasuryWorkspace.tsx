import { useState } from 'react';
import type { TreasurySimulationController } from '../engine/treasuryEngine';
import ControlPanel from './ControlPanel';
import Dashboard from './Dashboard';
import { UnderlineTabs, Card } from './eeshaan-koltey/ui';
import { ChartLine, Gear } from './eeshaan-koltey/icons';

type Tab = 'control' | 'dashboard';

export default function TreasuryWorkspace({
  simulation,
}: {
  simulation?: TreasurySimulationController;
}) {
  const [tab, setTab] = useState<Tab>('control');

  // Use passed simulation from App or instantiate local
  const simController = simulation;
  if (!simController) {
    return null;
  }

  const { inputs, micro, simulationData, updateParameter, updateMicro, resetMicro, reset } = simController;

  const tabs = ['Screen 1: Control Panel (Inputs)', 'Screen 2: Exec Committee Dashboard'] as const;
  const activeTabStr = tab === 'control' ? tabs[0] : tabs[1];

  return (
    <div className="space-y-6">
      {/* Eeshaan Koltey Underline Tabs Bar */}
      <Card variant="flat" className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <UnderlineTabs
          tabs={tabs}
          value={activeTabStr}
          onChange={(t) => setTab(t === tabs[0] ? 'control' : 'dashboard')}
          shortLabels={{ [tabs[0]]: 'Inputs', [tabs[1]]: 'Dashboard' }}
          className="border-none min-w-0"
        />
        <div className="hidden sm:flex items-center gap-2 text-[12px] text-muted">
          {tab === 'control' ? (
            <span className="inline-flex items-center gap-1.5">
              <Gear className="h-3.5 w-3.5 text-amber" />
              <span>Interactive underwriting parameters</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <ChartLine className="h-3.5 w-3.5 text-amber" />
              <span>Dual-Sankey capital flow &amp; priority ladder</span>
            </span>
          )}
        </div>
      </Card>

      {tab === 'control' ? (
        <ControlPanel
          inputs={inputs}
          micro={micro}
          sim={simulationData}
          update={updateParameter}
          updateMicro={updateMicro}
          resetMicro={resetMicro}
          reset={reset}
          onNext={() => setTab('dashboard')}
        />
      ) : (
        <Dashboard sim={simulationData} inputs={inputs} />
      )}
    </div>
  );
}
