import type { ReactNode } from 'react';
import { Modal } from './MicroMatrix';

function FormulaBlock({ id, children }: { id: string; children: string }) {
  return (
    <pre data-formula-id={id} className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border-l-[3px] border-[#f6ce52] bg-[#f6ce52]/8 px-4 py-4 font-sans text-[12px] font-semibold leading-[1.9] tabular-nums text-[#f6ce52] sm:text-[13px]">
      {children}
    </pre>
  );
}

function MethodSection({ letter, workspace, title, children }: {
  letter: string;
  workspace: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={`methodology-workspace-${workspace}`} data-methodology-workspace={workspace}
      className="scroll-mt-6 border-t border-[#f6ce52]/20 px-4 py-5 first:border-t-0 sm:px-8 sm:py-7">
      <header className="mb-4 sm:mb-5 flex items-start gap-3">
        <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border border-[#f6ce52]/35 bg-[#f6ce52]/10 text-xs font-bold text-[#f6ce52]">{letter}</span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#f6ce52]">Workspace {workspace}</div>
          <h3 className="mt-1 text-[15px] sm:text-[16px] font-semibold tracking-tight text-slate-100">{title}</h3>
        </div>
      </header>
      <div className="max-w-[85ch] space-y-4 sm:space-y-5 text-[12.5px] leading-[1.85] sm:leading-[1.9] text-slate-300 sm:text-sm">{children}</div>
    </section>
  );
}

function DefinitionTitle({ children }: { children: ReactNode }) {
  return <h4 className="text-[13px] font-semibold leading-relaxed text-slate-100">{children}</h4>;
}

export default function MethodologyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} size="wide" closeLabel="Close Framework" badge="Platform Methodology"
      title="Institutional Underwriting & High-Frequency Capital Velocity Methodology"
      subtitle="Plain-English analogies, operational definitions and explicit formula syntax for readers and AI parsers."
      footerLeft={<span>Model assumptions, not legal advice. All financial amounts are in AED.</span>}>
      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Methodology sections" className="glass-card rounded-2xl p-4 text-slate-100 lg:sticky lg:top-0">
          <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#f6ce52]">Framework index</div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 lg:grid-cols-1 lg:gap-0">
            <a href="#methodology-workspace-1" className="rounded-lg border border-white/10 lg:rounded-none lg:border-x-0 lg:border-b-0 px-3 py-2 lg:px-0 lg:py-3 text-xs font-medium leading-relaxed text-slate-200 hover:text-[#f6ce52] transition-colors">A / Spatial leverage &amp; pro-rata</a>
            <a href="#methodology-workspace-2" className="rounded-lg border border-white/10 lg:rounded-none lg:border-x-0 lg:border-b-0 px-3 py-2 lg:px-0 lg:py-3 text-xs font-medium leading-relaxed text-slate-200 hover:text-[#f6ce52] transition-colors">B / Escrow protection &amp; tiers</a>
            <a href="#methodology-workspace-3" className="rounded-lg border border-white/10 lg:rounded-none lg:border-x-0 lg:border-b-0 px-3 py-2 lg:px-0 lg:py-3 text-xs font-medium leading-relaxed text-slate-200 hover:text-[#f6ce52] transition-colors">C / Capital clock &amp; recycling</a>
          </div>
          <p className="mt-3 border-t border-[#f6ce52]/20 pt-3 text-[11px] leading-relaxed text-slate-400">Read the analogy first, then the formula. Variables and model boundaries are explicitly identified below.</p>
        </nav>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#f6ce52]/20 bg-[#0b1220]/90 font-sans">
          <MethodSection letter="A" workspace={1} title="The Spatial Leverage Engine">
            <p>Physical plot parameters and FAR determine your absolute maximum physical volume under construction. The Structural Efficiency Filter converts this physical Gross Floor Area (GFA) footprint into the economic footprint of Net Sellable Area (NSA). Think of GFA as the total concrete size of the building box; NSA is the portion you can actually sell to buyers. You cannot sell elevator shafts, hallways, or structural columns. The Structural Efficiency Ratio (E) represents the percentage of your building that actually generates money. Because E functions as a mathematical divisor across every per-square-foot cost allocation, a single point of design inefficiency instantly inflates your entire cost base across the sellable layout.</p>
            <DefinitionTitle>• Formulaic Definition for AI Parsers:</DefinitionTitle>
            <FormulaBlock id="spatial-leverage">{`GFA = Plot Area x Permissible FAR
Net Sellable Area (NSA) = GFA x (NSA Efficiency Pct / 100)`}</FormulaBlock>
            <p>• Pro-Rata Scaling Framework: Parent aggregate overrides are never stored as independent static numbers; they represent the live sum of itemised micro-matrices. Adjusting a parent macro aggregate parameter triggers an automatic downward pro-rata reallocation loop across its child variables based on their current relative weights, executing an iterative largest-remainder integer pass to absorb truncation remainders and guarantee zero arithmetic drift:</p>
            <FormulaBlock id="pro-rata-allocation">{'child_i = newTotal x (child_i / sum(children))'}</FormulaBlock>
          </MethodSection>

          <MethodSection letter="B" workspace={2} title="The Regulatory Escrow Guardrails">
            <p>In Dubai, under Escrow Account Law (Law No. 8 of 2007), developers are legally blocked from taking a buyer's off-plan cash collection and spending it freely on corporate overheads. All money must enter a regulated DLD Escrow Account managed by an independent agent. To protect the project lifecycle, this capital pool is split into three ring-fenced structural tiers:</p>
            <p>• Tier 1 - Active Project Retention (Adjustable, default 10%): This cash is withheld from monthly progress-linked contractor construction draws and remains trapped inside the escrow network until the building is certified as complete.</p>
            <p>• Tier 2 - Post-Handover Defects Liability Pool (Non-negotiable 5% fixed by law): Locked securely inside the escrow account for exactly 12 months following unit registration. It functions as a defects liability warranty against structural, finishing, or MEP issues. Under Law No. 8, if a buyer reports structural cracks or electrical failures and the developer ignores the complaint, RERA has full legal authority to bypass the developer and release these funds directly to a third-party contractor to execute the repairs.</p>
            <p>• operating Pool - Milestone-Unlocked Operating Capital (Remaining 85%): Released to the developer's operating wallet strictly upon engineer-certified construction progress stages at the 20%, 40%, 60%, and 80% gates.</p>
            <DefinitionTitle>• Formulaic Definition for AI Parsers:</DefinitionTitle>
            <FormulaBlock id="escrow-holdbacks">{`Retention Pool = GDV x (Retention Pct / 100)
Defects Pool = GDV x (DEFECTS_LIABILITY_PCT / 100); where DEFECTS_LIABILITY_PCT = 5
Unlocked Operating Capital = GDV - Retention Pool - Defects Pool`}</FormulaBlock>
          </MethodSection>

          <MethodSection letter="C" workspace={3} title="The SPV CFO Capital Clock & Recycling Engine">
            <p>Time is a real-world financial expense. Your Seeded Working Capital Cushion (AED 75 PSF on GFA / AED 93.75 PSF on NSA) represents a fixed, finite pool of equity cash injected on Day 1 to absorb corporate expenses like office rent, salary retainers, tech SaaS subscriptions, and compliance fees. The Operational Law of Temporal Decay (theta) establishes that your corporate overhead loading (c) per square foot escalates with every hour the project remains incomplete, long before ground is broken.</p>
            <DefinitionTitle>• Formulaic Definition for AI Parsers:</DefinitionTitle>
            <FormulaBlock id="temporal-decay">{`Daily Burn Rate (R) = X (Daily Non-Human Operating Bleed) + Y (Daily Human Capital Salaries)
Overhead Cost Loading (c) = (R x Timeline Days Elapsed (T)) / Net Sellable Area (nsa)`}</FormulaBlock>
            <p>• The Pre-Sales Capital Chasm: Because the Capital Clock begins ticking on Day Zero of company setup, but buyer installment rows are legally blockaded at absolute zero until the target RERA Off-Plan Sales License date is cleared, the pre-construction period runs a pure equity deficit valley. The SPV cash balance drains linearly to fund early compliance loops without inventing fictitious escrow collections:</p>
            <FormulaBlock id="pre-sales-blocker">{'Buyer Inflows(t) = 0 for all t < LicenseTriggerDay'}</FormulaBlock>
            <p>• Escrow-to-Debt Capital Swipe: The moment your license activates and sales flow in, the engine optimizes your capital structure. Instead of letting buyer cash sit idle while bank debt compounds at a 15% ARR interest clock all the way to handover, the engine models a mid-lifecycle sweep. Unlocked progress milestones are swiped to instantly reimburse outstanding bank principal:</p>
            <FormulaBlock id="escrow-recycling">{`Swipe = min(Available Escrow, FinancingAccrued + DebtPrincipal)
Interest = Interest - min(Interest, Swipe); then Principal = Principal - residual`}</FormulaBlock>
            <p>Because interest compounds strictly on the live outstanding drawn principal balance, this capital swipe flattens your interest carry curve, directly rescuing net project surplus.</p>
            <p>• Terminal Settlement Waterfall: On handover day, all remaining project cash resolves down a strict legal priority stack to clear financier principal first, financier accrued return second, land partner core capital returns third, the 5% defects warranty isolation fourth, with any remaining free cash settling into Unallocated Net Developer Cash Surplus:</p>
            <FormulaBlock id="terminal-waterfall">{'Terminal Stack = GDV -> DebtPrincipal -> FinancingAccrued -> LandEquity -> DefectsPool -> DeveloperSurplus'}</FormulaBlock>
          </MethodSection>

          <section className="border-t border-[#f6ce52]/20 bg-[#f6ce52]/5 px-5 py-6 sm:px-8" aria-label="Implementation and legal scope notes">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f6ce52]">Implementation & scope notes</h3>
            <div className="mt-3 space-y-3 text-[11px] leading-relaxed text-slate-300">
              <p>The framework text above records the requested modeling assumptions. The 10% retention is adjustable; 85% operating capital and AED 93.75 / NSA PSF apply only at the default 10% retention and 80% efficiency. Pro-rata allocation operates in monetary minor units and retains the exact aggregate residual.</p>
              <p>The CFO cushion is normally earmarked within developer cash. With zero developer equity, a separate Day-0 debt draw funds it and increases effective facility exposure; it is not counted as invented equity or an additional expense. The date/hour cut-off includes fractional days. Actual cash payments and unpaid obligations remain separate from accrued burn; the meter is not a bank balance.</p>
              <p>At the default 15% ARR over three years, non-land funded costs compound by 1.520875×. Because the facility also bridges recoverable VAT, its all-in repayment multiple is different; the live dashboard computes both rather than treating accrued interest as Day-1 cash.</p>
              <p>The 5% defects reserve is funded as receipts arrive and excluded from swipes and payouts. Repayment does not reverse recognized interest expense. Terminal developer surplus remains an SPV asset; the ledger does not assume automatic dividends.</p>
              <p>Escrow release, lending repayment eligibility and defects claims require confirmation with the escrow agent, DLD/RERA and qualified UAE counsel. The simulations are illustrative management models, not legal determinations or investment recommendations. Construction is modeled linearly; the CFO warranty horizon uses 365 days. VAT and corporate tax are outside Workspace 3.</p>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}