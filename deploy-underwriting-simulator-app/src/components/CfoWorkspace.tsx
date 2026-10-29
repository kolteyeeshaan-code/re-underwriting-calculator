import { useState } from 'react';
import type { CfoController } from '../engine/cfoEngine';
import CfoMonitor from './cfo/CfoMonitor';
import CfoUnderwriting from './cfo/CfoUnderwriting';
import { UnderlineTabs, Card } from './eeshaan-koltey/ui';
import { Calendar, ChartLine } from './eeshaan-koltey/icons';

type CfoScreen = 'inputs' | 'monitor';

export default function CfoWorkspace({ controller }: { controller: CfoController }) {
  const [screen, setScreen] = useState<CfoScreen>('inputs');

  const tabs = [
    'Screen 1: CFO Underwriting Inputs & Constraints',
    'Screen 2: Operational Ledger & Hourly Statements',
  ] as const;
  const activeTabStr = screen === 'inputs' ? tabs[0] : tabs[1];

  return (
    <div className="space-y-6">
      {/* Header bar with Eeshaan Koltey styling */}
      <Card variant="flat" className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <UnderlineTabs
          tabs={tabs}
          value={activeTabStr}
          onChange={(t) => setScreen(t === tabs[0] ? 'inputs' : 'monitor')}
          shortLabels={{ [tabs[0]]: 'Inputs', [tabs[1]]: 'Ledger' }}
          className="border-none min-w-0"
        />
        <div className="hidden sm:flex items-center gap-2 text-[12px] text-muted">
          {screen === 'inputs' ? (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber" />
              <span>Capital clock &amp; daily burn controls</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <ChartLine className="h-3.5 w-3.5 text-amber" />
              <span>HCVF Cash flow, P&amp;L, balance sheet</span>
            </span>
          )}
        </div>
      </Card>

      <div id="cfo-screen-panel">
        {screen === 'inputs' ? (
          <CfoUnderwriting controller={controller} onMonitor={() => setScreen('monitor')} />
        ) : (
          <CfoMonitor controller={controller} />
        )}
      </div>
    </div>
  );
}
