import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card as EeshaanKolteyCard, PillBtn } from './eeshaan-koltey/ui';
import { ChangeFlash } from './ChangeFlash';
import { vFmtM, vFmtNum, vFmtPct, type ViabilitySimulationController } from '../engine/viabilityEngine';
import {
  CONTEXT_PLACEHOLDER,
  DEFAULT_OFFICE,
  DEFAULT_TARGETS,
  MAX_CONTEXT_CHARS,
  WC_WALLETS,
  WC_WALLET_KEYS,
  clampWalletRate,
  clearState,
  headroom as headroomOf,
  loadState,
  planMoves,
  peopleRate,
  peopleTotalAed,
  readWallets,
  reconcileOffice,
  roundRate,
  saveState,
  sumRates,
  type OfficeBreakdown,
  type PersonRow,
  type TargetVerdict,
  type WalletRates,
  type WcMicroState,
  type WcWalletKey,
  type WalletRead,
} from '../lib/wcMicroBudget';

/* ------------------------------------------------------------------ tokens */

const VERDICT: Record<TargetVerdict, { label: string; chip: string; dot: string }> = {
  below: { label: 'Below target', chip: 'bg-[#EFF6F1] text-[#2F5C44] border-[#CFE3D6]', dot: '#579973' },
  at: { label: 'At target', chip: 'bg-[rgba(22,24,28,0.05)] text-[#5F646B] border-[rgba(22,24,28,0.1)]', dot: '#9EA3AA' },
  above: { label: 'Above target', chip: 'bg-[#FDF6E3] text-[#7A4A0E] border-[#FBE6A4]', dot: '#F0A93B' },
};

function formatVariancePts(variancePts: number | null): string {
  if (variancePts === null || variancePts === undefined) return '—';
  if (Math.abs(variancePts) < 0.005) return '±0.00 pts';
  return `${variancePts > 0 ? '+' : '−'}${Math.abs(variancePts).toFixed(2)} pts`;
}

function VerdictChip({ verdict, gapAed, variancePts }: { verdict: TargetVerdict | null; gapAed?: number | null; variancePts?: number | null }) {
  if (!verdict) return <span className="text-[12px] text-[#9EA3AA]">—</span>;
  const tone = VERDICT[verdict];
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone.chip}`}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
        {tone.label}
      </span>
      <span className="text-[10.5px] font-medium tabular-nums text-[#5F646B]">
        {variancePts === null || variancePts === undefined ? '—' : formatVariancePts(variancePts)}
        {gapAed !== undefined && gapAed !== null && Math.abs(gapAed) >= 1000 && (
          <span className="font-normal opacity-80">
            {' '}· {gapAed > 0 ? '+' : '−'}{vFmtM(Math.abs(gapAed)).replace('AED ', '')}
          </span>
        )}
      </span>
    </span>
  );
}

/** Compact rate editor with steppers. Blocks above headroom and reports it. */
function RateInput({
  value,
  onCommit,
  ariaLabel,
  step = 0.5,
  max,
  tone = 'plain',
}: {
  value: number;
  onCommit: (next: number) => void;
  ariaLabel: string;
  step?: number;
  max?: number;
  tone?: 'plain' | 'nested';
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(roundRate(value));
  const commit = (raw: string) => {
    const parsed = Number(raw);
    onCommit(Number.isFinite(parsed) ? parsed : 0);
  };
  const bump = (delta: number) => onCommit(roundRate(Math.max(0, value + delta)));
  return (
    <div className={`eeshaan-koltey-field inline-flex items-center bg-white ${tone === 'nested' ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}>
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        onClick={() => bump(-step)}
        className="press flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-[#5F646B] hover:bg-[rgba(22,24,28,0.06)]"
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        max={max}
        aria-label={ariaLabel}
        value={shown}
        onChange={(e) => { setDraft(e.target.value); commit(e.target.value); }}
        onBlur={() => setDraft(null)}
        className="w-[52px] min-w-0 bg-transparent text-center text-[13px] font-semibold tabular-nums text-[#16181C] outline-none"
      />
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        onClick={() => bump(step)}
        className="press flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-[#5F646B] hover:bg-[rgba(22,24,28,0.06)]"
      >
        +
      </button>
    </div>
  );
}

function TargetInput({
  value,
  onCommit,
  ariaLabel,
  placeholder = '—',
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : String(value));
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-[rgba(22,24,28,0.18)] bg-[rgba(246,247,249,0.7)] px-1.5 py-0.5">
      <input
        type="number"
        inputMode="decimal"
        step={0.05}
        min={0}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={shown}
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value.trim() === '') { onCommit(null); return; }
          const parsed = Number(e.target.value);
          if (Number.isFinite(parsed)) onCommit(Math.max(0, parsed));
        }}
        onBlur={() => setDraft(null)}
        className="w-[42px] min-w-0 bg-transparent text-right text-[11.5px] font-medium tabular-nums text-[#5F646B] outline-none placeholder:text-[#9EA3AA]"
      />
      <span className="text-[10px] text-[#9EA3AA]">%</span>
    </span>
  );
}

function Profile({ read }: { read: WalletRead }) {
  return (
    <span className="inline-flex items-end gap-[2px]" title={`${read.meta.window} — indicative timing, composition only`} aria-hidden="true">
      {read.meta.profile.map((intensity, index) => (
        <span
          key={index}
          className="w-[3px] rounded-sm"
          style={{ height: `${4 + intensity * 9}px`, background: read.meta.color, opacity: 0.3 + intensity * 0.6 }}
        />
      ))}
    </span>
  );
}

function Stat({ label, value, sub, tone = 'plain' }: { label: string; value: string; sub?: string; tone?: 'plain' | 'amber' | 'dark' }) {
  const shell = tone === 'dark'
    ? 'bg-[#16181C] text-white'
    : tone === 'amber'
      ? 'bg-[#FBF7E9] border border-[#F4C74B]/50'
      : 'bg-white border border-[rgba(22,24,28,0.09)]';
  const labelCls = tone === 'dark' ? 'text-white/65' : 'text-[#5F646B]';
  const subCls = tone === 'dark' ? 'text-white/55' : 'text-[#5F646B]';
  return (
    <div className={`min-w-0 rounded-[16px] px-3 py-2.5 ${shell}`}>
      <div className={`text-[10px] font-medium uppercase tracking-wider leading-tight ${labelCls}`}>{label}</div>
      <div className="mt-1 break-words text-[16px] font-semibold tabular-nums tracking-tight">
        <ChangeFlash value={value}>{value}</ChangeFlash>
      </div>
      {sub && <div className={`mt-0.5 text-[10.5px] font-light leading-snug ${subCls}`}>{sub}</div>}
    </div>
  );
}

/* ======================================================================= */

export default function WcMicroBudgetPanel({ simulation }: { simulation: ViabilitySimulationController }) {
  const { inputs, result, wcCeilingPsfGfa, setWcWallets, restoreWcEnvelope, reset } = simulation;

  const gfa = result.maxGfa;
  const totalCost = result.totalProjectCostAed;
  // GDV straight from the engine's target tier — never recomputed here.
  const gdv = result.sensitivity.find((row) => row.id === 'target')?.baseGdv ?? result.nsa * inputs.marketCompPsf;

  const rates = useMemo<WalletRates>(
    () => WC_WALLET_KEYS.reduce((acc, key) => { acc[key] = inputs[key]; return acc; }, {} as WalletRates),
    [inputs],
  );

  const fallback = useMemo<WcMicroState>(() => ({
    ceilingPsfGfa: wcCeilingPsfGfa,
    wallets: rates,
    targets: DEFAULT_TARGETS,
    contextNote: '',
    office: DEFAULT_OFFICE,
  }), [wcCeilingPsfGfa, rates]);

  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [contextNote, setContextNote] = useState('');
  const [office, setOffice] = useState<OfficeBreakdown>(DEFAULT_OFFICE);
  const [officeOpen, setOfficeOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [officeNote, setOfficeNote] = useState<string | null>(null);
  const hydrated = useRef(false);
  const noticeTimer = useRef<number | undefined>(undefined);
  const lastParent = useRef(inputs.wcOfficeTeam);

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5200);
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  /* Restore the persisted breakdown once, then keep it in sync. */
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = loadState(fallback);
    if (!saved) return;
    setTargets(saved.targets);
    setContextNote(saved.contextNote);
    setOffice(saved.office);
    if (saved.office.mode !== 'single') setOfficeOpen(true);
    restoreWcEnvelope(saved.ceilingPsfGfa, saved.wallets);
    lastParent.current = saved.wallets.wcOfficeTeam;
  }, [fallback, restoreWcEnvelope]);

  useEffect(() => {
    if (!hydrated.current) return;
    saveState({ ceilingPsfGfa: wcCeilingPsfGfa, wallets: rates, targets, contextNote, office });
  }, [wcCeilingPsfGfa, rates, targets, contextNote, office]);

  /* The macro chips above can move Office / Team; keep the children reconciled. */
  useEffect(() => {
    if (lastParent.current === inputs.wcOfficeTeam) return;
    lastParent.current = inputs.wcOfficeTeam;
    const next = reconcileOffice(office, inputs.wcOfficeTeam, gfa);
    setOfficeNote(next.note);
    if (next.office !== office) setOffice(next.office);
  }, [inputs.wcOfficeTeam, gfa, office]);

  const allocated = sumRates(rates);
  const headroom = headroomOf(wcCeilingPsfGfa, rates);
  const reads = useMemo(
    () => readWallets({ rates, targets, gfa, gdv, totalCost }),
    [rates, targets, gfa, gdv, totalCost],
  );
  const moves = useMemo(() => planMoves(reads, gfa), [reads, gfa]);
  const wcTotalAed = allocated * gfa;
  const targetRow = result.sensitivity.find((row) => row.id === 'target');
  const margin = targetRow?.grossMarginPercent ?? 0;

  /* ---------------------------------------------------------- mutations */

  const applyRates = useCallback((next: WalletRates) => {
    setWcWallets(next);
  }, [setWcWallets]);

  const setWallet = useCallback((key: WcWalletKey, proposed: number) => {
    const { applied, blocked, requested } = clampWalletRate(key, proposed, wcCeilingPsfGfa, rates);
    if (blocked) {
      const room = headroomOf(wcCeilingPsfGfa, rates);
      flash(
        `${WC_WALLETS.find((w) => w.key === key)?.label ?? 'Line'} capped at ${applied.toFixed(2)} of ${requested.toFixed(2)} AED/GFA — only ${room.toFixed(2)} headroom left in the ${wcCeilingPsfGfa.toFixed(2)} envelope. Trim another line first.`,
      );
    } else {
      setNotice(null);
    }
    const next = { ...rates, [key]: applied };
    applyRates(next);
    if (key === 'wcOfficeTeam') lastParent.current = applied;
    return applied;
  }, [wcCeilingPsfGfa, rates, flash, applyRates]);

  const setTarget = useCallback((key: WcWalletKey, field: 'gdvPct' | 'costPct', value: number | null) => {
    setTargets((prev: WcMicroState['targets']) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: field === 'gdvPct' ? Math.max(0, value ?? 0) : value,
      },
    }));
  }, []);

  const applyMove = useCallback((from: WcWalletKey, to: WcWalletKey, rate: number) => {
    const donor = Math.max(0, rates[from]);
    const take = roundRate(Math.min(rate, donor));
    if (take <= 0) return;
    // A transfer is envelope-neutral: the ceiling is never consulted.
    applyRates({ ...rates, [from]: roundRate(donor - take), [to]: roundRate(rates[to] + take) });
    setNotice(null);
  }, [rates, applyRates]);

  const trimToTarget = useCallback((read: WalletRead) => {
    const target = Math.min(read.rate, read.rateToTarget);
    setWallet(read.meta.key, target);
  }, [setWallet]);

  const liftToTarget = useCallback((read: WalletRead) => {
    const applied = setWallet(read.meta.key, read.rateToTarget);
    if (applied < read.rateToTarget - 0.004) return;
    setNotice(null);
  }, [setWallet]);

  const resetBreakdown = useCallback(() => {
    clearState();
    setTargets(DEFAULT_TARGETS);
    setContextNote('');
    setOffice(DEFAULT_OFFICE);
    setOfficeNote(null);
    setNotice(null);
    reset();
  }, [reset]);

  /* ------------------------------------------------------ office children */

  const derivedSalaries = roundRate(peopleRate(office.people, gfa));
  const salariesRate = office.mode === 'people' ? derivedSalaries : office.salariesPsf;

  const commitOfficeParts = useCallback((rent: number, salaries: number) => {
    const safeRent = roundRate(Math.max(0, rent));
    const safeSalaries = roundRate(Math.max(0, salaries));
    const applied = setWallet('wcOfficeTeam', roundRate(safeRent + safeSalaries));
    // If the envelope clipped the parent, rent keeps priority and salaries absorb it.
    const finalRent = roundRate(Math.min(safeRent, applied));
    const finalSalaries = roundRate(Math.max(0, applied - finalRent));
    setOffice((prev) => ({ ...prev, rentPsf: finalRent, salariesPsf: finalSalaries }));
    setOfficeNote(null);
  }, [setWallet]);

  const setOfficeMode = useCallback((mode: OfficeBreakdown['mode']) => {
    setOfficeOpen(mode !== 'single');
    const parent = roundRate(inputs.wcOfficeTeam);
    if (mode === 'single') { setOffice({ ...office, mode }); setOfficeNote(null); return; }
    if (mode === 'split') {
      const total = roundRate(office.rentPsf + office.salariesPsf);
      const rent = total > 0 && parent > 0
        ? roundRate(parent * (office.rentPsf / total))
        : roundRate(Math.min(office.rentPsf, parent));
      setOffice({ ...office, mode, rentPsf: rent, salariesPsf: roundRate(Math.max(0, parent - rent)) });
      setOfficeNote(null);
      return;
    }
    const salaries = roundRate(peopleRate(office.people, gfa));
    const rent = roundRate(Math.max(0, parent - Math.min(salaries, parent)));
    setOffice({ ...office, mode, rentPsf: rent });
    setOfficeNote(salaries > parent + 0.004
      ? `Payroll roll-up (${salaries.toFixed(2)}) exceeds the Office / Team line (${parent.toFixed(2)}). Trim a role or lift the line inside headroom.`
      : null);
  }, [inputs.wcOfficeTeam, gfa, office]);

  const updatePerson = useCallback((id: string, patch: Partial<PersonRow>) => {
    const people = office.people.map((person) => (person.id === id ? { ...person, ...patch } : person));
    if (office.mode !== 'people') { setOffice({ ...office, people }); return; }
    const salaries = roundRate(peopleRate(people, gfa));
    const requested = roundRate(office.rentPsf + salaries);
    const applied = setWallet('wcOfficeTeam', requested);
    setOfficeNote(requested > applied + 0.004
      ? `Payroll roll-up (${salaries.toFixed(2)}) plus rent exceeds the envelope. Capped at ${applied.toFixed(2)} AED/GFA.`
      : null);
    setOffice({ ...office, people, rentPsf: roundRate(Math.min(office.rentPsf, applied)) });
  }, [gfa, setWallet, office]);

  const addPerson = useCallback(() => {
    const person: PersonRow = { id: `p-${Date.now().toString(36)}`, role: 'New role', count: 1, amount: 300_000 };
    const people = [...office.people, person];
    if (office.mode !== 'people') { setOffice({ ...office, people }); return; }
    const salaries = roundRate(peopleRate(people, gfa));
    const requested = roundRate(office.rentPsf + salaries);
    const applied = setWallet('wcOfficeTeam', requested);
    setOfficeNote(requested > applied + 0.004
      ? `New role pushes payroll past the envelope. Line capped at ${applied.toFixed(2)} AED/GFA — trim a role or free headroom.`
      : null);
    setOffice({ ...office, people, rentPsf: roundRate(Math.min(office.rentPsf, applied)) });
  }, [gfa, office, setWallet]);

  const removePerson = useCallback((id: string) => {
    const people = office.people.filter((person) => person.id !== id);
    if (office.mode !== 'people') { setOffice({ ...office, people }); return; }
    const salaries = roundRate(peopleRate(people, gfa));
    const applied = setWallet('wcOfficeTeam', roundRate(office.rentPsf + salaries));
    setOfficeNote(null);
    setOffice({ ...office, people, rentPsf: roundRate(Math.min(office.rentPsf, applied)) });
  }, [gfa, office, setWallet]);

  /* ------------------------------------------------------------- render */

  const usedPct = wcCeilingPsfGfa > 0 ? Math.min(100, (allocated / wcCeilingPsfGfa) * 100) : 0;
  const payrollAed = peopleTotalAed(office.people);
  const officeParent = roundRate(inputs.wcOfficeTeam);
  const childSum = roundRate(office.rentPsf + salariesRate);
  const childrenReconciled = office.mode === 'single' || Math.abs(childSum - officeParent) <= 0.02;

  const modeButton = (mode: OfficeBreakdown['mode'], label: string) => (
    <button
      key={mode}
      type="button"
      onClick={() => setOfficeMode(mode)}
      aria-pressed={office.mode === mode}
      className={`press rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors ${
        office.mode === mode ? 'bg-[#16181C] text-white' : 'bg-[rgba(22,24,28,0.05)] text-[#5F646B] hover:text-[#16181C]'
      }`}
    >
      {label}
    </button>
  );

  const officeDrilldown = (
    <div className="rounded-[16px] border border-[rgba(22,24,28,0.08)] bg-white p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#579973' }} />
          <span className="text-[12.5px] font-medium text-[#16181C]">Office / Team breakdown</span>
          <span className="text-[11px] font-light text-[#5F646B]">children must sum to {officeParent.toFixed(2)} AED/GFA</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Office breakdown mode">
          {modeButton('single', 'Single line')}
          {modeButton('split', 'Rent + Salaries')}
          {modeButton('people', 'Per-person payroll')}
        </div>
      </div>

      {office.mode === 'single' ? (
        <p className="mt-2.5 text-[11.5px] font-light text-[#5F646B]">
          Office / Team is held as one line. Switch to <b className="font-medium text-[#16181C]">Rent + Salaries</b> to split it, or
          <b className="font-medium text-[#16181C]"> Per-person payroll</b> to build salaries from named roles. The parent line and the
          envelope are unchanged by switching mode.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">Office rent · AED/GFA</div>
              <RateInput
                tone="nested"
                value={office.rentPsf}
                ariaLabel="Office rent AED per GFA"
                step={0.25}
                onCommit={(v) => commitOfficeParts(v, office.mode === 'people' ? derivedSalaries : office.salariesPsf)}
              />
              <div className="mt-1 text-[10.5px] font-light tabular-nums text-[#9EA3AA]">{vFmtM(office.rentPsf * gfa)}</div>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">
                Salaries · AED/GFA {office.mode === 'people' && <span className="normal-case tracking-normal text-[#9EA3AA]">(rolled up)</span>}
              </div>
              {office.mode === 'people' ? (
                <div className="inline-flex items-center rounded-[14px] border border-[rgba(22,24,28,0.1)] bg-[rgba(246,247,249,0.9)] px-3 py-1.5 text-[13px] font-semibold tabular-nums text-[#16181C]">
                  {derivedSalaries.toFixed(2)}
                </div>
              ) : (
                <RateInput
                  tone="nested"
                  value={office.salariesPsf}
                  ariaLabel="Salaries AED per GFA"
                  step={0.25}
                  onCommit={(v) => commitOfficeParts(office.rentPsf, v)}
                />
              )}
              <div className="mt-1 text-[10.5px] font-light tabular-nums text-[#9EA3AA]">{vFmtM(salariesRate * gfa)}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">Children / parent</div>
              <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#16181C]">
                {childSum.toFixed(2)} / {officeParent.toFixed(2)}
              </div>
              <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${
                childrenReconciled ? 'border-[#CFE3D6] bg-[#EFF6F1] text-[#2F5C44]' : 'border-[#FCD6D2] bg-[#FEECEA] text-[#96291D]'
              }`}>
                {childrenReconciled ? 'Reconciled' : 'Out of balance'}
              </span>
            </div>
          </div>

          {office.mode === 'people' && (
            <div className="mt-3 overflow-x-auto scroll-thin rounded-[14px] border border-[rgba(22,24,28,0.08)]">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.8)] text-left text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">
                    <th scope="col" className="px-3 py-2">Role</th>
                    <th scope="col" className="px-3 py-2 text-right">Count</th>
                    <th scope="col" className="px-3 py-2 text-right">AED / person</th>
                    <th scope="col" className="px-3 py-2 text-right">Total AED</th>
                    <th scope="col" className="px-3 py-2 text-right">% of payroll</th>
                    <th scope="col" className="px-3 py-2"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {office.people.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-3 text-[12px] font-light text-[#5F646B]">No roles yet — add one to build the payroll roll-up.</td></tr>
                  )}
                  {office.people.map((person) => {
                    const line = Math.max(0, person.count) * Math.max(0, person.amount);
                    return (
                      <tr key={person.id} className="border-b border-[rgba(22,24,28,0.05)] last:border-b-0">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            aria-label="Role title"
                            value={person.role}
                            onChange={(e) => updatePerson(person.id, { role: e.target.value })}
                            className="w-full min-w-[130px] rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] font-medium text-[#16181C] outline-none transition-colors hover:border-[rgba(22,24,28,0.12)] focus:border-[#F0A93B]"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`${person.role || 'Role'} headcount`}
                            value={person.count}
                            onChange={(e) => updatePerson(person.id, { count: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                            className="w-14 rounded-md border border-[rgba(22,24,28,0.12)] bg-white px-1.5 py-1 text-right text-[12.5px] font-medium tabular-nums text-[#16181C] outline-none focus:border-[#F0A93B]"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={10000}
                            aria-label={`${person.role || 'Role'} amount per person`}
                            value={person.amount}
                            onChange={(e) => updatePerson(person.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-24 rounded-md border border-[rgba(22,24,28,0.12)] bg-white px-1.5 py-1 text-right text-[12.5px] font-medium tabular-nums text-[#16181C] outline-none focus:border-[#F0A93B]"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-[12.5px] font-semibold tabular-nums text-[#16181C]">{vFmtM(line)}</td>
                        <td className="px-3 py-2 text-right text-[12px] tabular-nums text-[#5F646B]">
                          {payrollAed > 0 ? `${((line / payrollAed) * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removePerson(person.id)}
                            aria-label={`Remove ${person.role || 'role'}`}
                            className="press rounded-full px-2 py-1 text-[11px] font-medium text-[#96291D] transition-colors hover:bg-[#FEECEA]"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[rgba(246,247,249,0.9)] text-[12px] font-semibold text-[#16181C]">
                    <th scope="row" className="px-3 py-2 text-left">Payroll roll-up</th>
                    <td className="px-3 py-2 text-right tabular-nums">{office.people.reduce((t, p) => t + Math.max(0, p.count), 0)}</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right tabular-nums">{vFmtM(payrollAed)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{derivedSalaries.toFixed(2)} /GFA</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            {office.mode === 'people' ? (
              <button
                type="button"
                onClick={addPerson}
                className="press rounded-full border border-[rgba(22,24,28,0.12)] bg-white px-3 py-1 text-[11.5px] font-medium text-[#16181C] transition-colors hover:bg-[#FDF6E3]"
              >
                + Add role
              </button>
            ) : <span />}
            <span className="text-[11px] font-light text-[#5F646B]">
              Rent {vFmtM(office.rentPsf * gfa)} + Salaries {vFmtM(salariesRate * gfa)} = {vFmtM(childSum * gfa)}
              {' '}· {vFmtNum(gfa, 0)} GFA sf
            </span>
          </div>
        </>
      )}

      {officeNote && (
        <div role="status" className="mt-2.5 rounded-[12px] border border-[#FBE6A4] bg-[#FDF6E3] px-3 py-2 text-[11.5px] font-medium text-[#7A4A0E]">
          {officeNote}
        </div>
      )}
    </div>
  );


  const walletActions = (read: WalletRead) => {
    const needed = roundRate(Math.max(0, read.rateToTarget - read.rate));
    const freed = roundRate(Math.max(0, read.rate - read.rateToTarget));
    if (read.gdvVerdict === 'above') {
      return (
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => trimToTarget(read)}
            className="press rounded-full border border-[rgba(22,24,28,0.12)] bg-white px-2.5 py-1 text-[11px] font-medium text-[#16181C] transition-colors hover:bg-[#FDF6E3]"
          >
            Trim to target
          </button>
          <span className="text-[10px] font-light tabular-nums text-[#5F646B]">frees {freed.toFixed(2)} headroom</span>
        </div>
      );
    }
    if (read.gdvVerdict === 'below') {
      const canLift = headroom > 0.004;
      const partial = canLift && headroom < needed - 0.004;
      return (
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => liftToTarget(read)}
            disabled={!canLift}
            className="press rounded-full bg-[#16181C] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#24272C] disabled:cursor-not-allowed disabled:bg-[rgba(22,24,28,0.12)] disabled:text-[#5F646B]"
          >
            Lift to target
          </button>
          <span className={`text-[10px] font-light tabular-nums ${canLift ? 'text-[#5F646B]' : 'text-[#7A4A0E]'}`}>
            {canLift
              ? (partial ? `+${headroom.toFixed(2)} now · ${needed.toFixed(2)} to target` : `${needed.toFixed(2)} to target`)
              : `needs ${needed.toFixed(2)} headroom`}
          </span>
        </div>
      );
    }
    return <span className="text-[11px] font-light text-[#9EA3AA]">On target</span>;
  };

  return (
    <EeshaanKolteyCard className="min-w-0 p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(22,24,28,0.08)] pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 shrink-0 rounded-full bg-[#F4C74B]" />
            <h3 className="text-[15.5px] font-medium tracking-tight text-[#16181C] sm:text-[16px]">WC Micro-Budget</h3>
          </div>
          <p className="mt-0.5 text-[12px] font-normal text-[#5F646B] sm:text-[12.5px]">
            Composition inside the underwritten envelope. Seed your own project targets, then cut where lines run above
            them and lift below-target lines only where headroom holds. The ceiling does not move from here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[rgba(22,24,28,0.12)] bg-white px-3 py-1 text-[11.5px] font-medium tabular-nums text-[#16181C]">
            Ceiling {wcCeilingPsfGfa.toFixed(2)} AED/GFA
          </span>
          <span className={`rounded-full border px-3 py-1 text-[11.5px] font-medium tabular-nums ${headroom > 0.004 ? 'border-[#CFE3D6] bg-[#EFF6F1] text-[#2F5C44]' : 'border-[#FBE6A4] bg-[#FDF6E3] text-[#7A4A0E]'}`}>
            Headroom under WC ceiling {headroom.toFixed(2)}
          </span>
          <PillBtn tone="soft" onClick={resetBreakdown} className="px-3 py-1.5 text-[11.5px]">
            Reset breakdown
          </PillBtn>
        </div>
      </header>

      {/* Project context + seeded targets ------------------------------------ */}
      <div className="mb-3 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.6)] p-3.5">
        <label htmlFor="wc-context-note" className="block text-[11px] font-medium uppercase tracking-wider text-[#5F646B]">
          Project context <span className="font-light normal-case tracking-normal text-[#9EA3AA]">(optional · stored with your targets)</span>
        </label>
        <div className="eeshaan-koltey-field mt-1.5 flex items-center bg-white px-3 py-2">
          <input
            id="wc-context-note"
            type="text"
            value={contextNote}
            maxLength={MAX_CONTEXT_CHARS}
            placeholder={CONTEXT_PLACEHOLDER}
            aria-label="Project context: brand, location, positioning, pricing mix"
            onChange={(e) => setContextNote(e.target.value.replace(/\s+/g, ' ').slice(0, MAX_CONTEXT_CHARS))}
            className="w-full min-w-0 bg-transparent text-[12.5px] font-normal text-[#16181C] outline-none placeholder:text-[#9EA3AA]"
          />
          <span className="ml-2 shrink-0 text-[10.5px] tabular-nums text-[#9EA3AA]">{contextNote.length}/{MAX_CONTEXT_CHARS}</span>
        </div>
        <p className="mt-1.5 text-[11px] font-light leading-snug text-[#5F646B]">
          Our targets below are seeded for this project — brand, location, positioning and pricing mix — not an industry standard.
        </p>
      </div>

      {/* Envelope composition ------------------------------------------------ */}
      <div className="rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.6)] p-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#5F646B]">Envelope composition</span>
          <span className="text-[11.5px] font-normal tabular-nums text-[#5F646B]">
            {allocated.toFixed(2)} of {wcCeilingPsfGfa.toFixed(2)} AED/GFA · {usedPct.toFixed(1)}% deployed
          </span>
        </div>
        <div className="mt-2 flex h-3.5 w-full overflow-hidden rounded-full bg-[rgba(22,24,28,0.07)]">
          {reads.map((read) => {
            const width = wcCeilingPsfGfa > 0 ? (read.rate / wcCeilingPsfGfa) * 100 : 0;
            if (width <= 0) return null;
            return (
              <div
                key={read.meta.key}
                className="flex h-full items-center justify-center text-[9px] font-bold tabular-nums"
                style={{ width: `${width}%`, background: read.meta.color, color: read.meta.color === '#F4C74B' ? '#16181C' : '#FFFFFF' }}
                title={`${read.meta.label}: ${read.rate.toFixed(2)} AED/GFA (${width.toFixed(1)}% of ceiling)`}
              >
                {width >= 9 ? read.rate.toFixed(0) : ''}
              </div>
            );
          })}
          {headroom > 0.004 && (
            <div
              className="h-full"
              style={{
                width: `${(headroom / Math.max(wcCeilingPsfGfa, 0.01)) * 100}%`,
                backgroundImage: 'repeating-linear-gradient(45deg, rgba(22,24,28,0.16) 0 3px, transparent 3px 6px)',
              }}
              title={`Headroom: ${headroom.toFixed(2)} AED/GFA undeployed`}
            />
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {reads.map((read) => (
            <span key={read.meta.key} className="flex items-center gap-1.5 text-[11px] font-light text-[#5F646B]">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: read.meta.color }} />
              {read.meta.short}
              <b className="font-medium tabular-nums text-[#16181C]">{read.wcPct.toFixed(1)}%</b>
            </span>
          ))}
          {headroom > 0.004 && (
            <span className="flex items-center gap-1.5 text-[11px] font-light text-[#5F646B]">
              <span className="inline-block h-2 w-2 rounded-full border border-[rgba(22,24,28,0.25)]" />
              Headroom <b className="font-medium tabular-nums text-[#16181C]">{headroom.toFixed(2)}</b>
            </span>
          )}
        </div>
      </div>

      {/* Live macro linkage -------------------------------------------------- */}
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <Stat tone="dark" label="WC envelope" value={`${wcCeilingPsfGfa.toFixed(2)}`} sub="AED / GFA sf · fixed" />
        <Stat label="Allocated" value={`${allocated.toFixed(2)}`} sub={vFmtM(wcTotalAed)} />
        <Stat label="Headroom" value={`${headroom.toFixed(2)}`} sub={vFmtM(headroom * gfa)} tone={headroom > 0.004 ? 'amber' : 'plain'} />
        <Stat label="% of GDV" value={vFmtPct(gdv > 0 ? (wcTotalAed / gdv) * 100 : 0, 2)} sub={`GDV ${vFmtM(gdv)}`} />
        <Stat label="% of underwritten cost" value={vFmtPct(totalCost > 0 ? (wcTotalAed / totalCost) * 100 : 0, 2)} sub={`Cost ${vFmtM(totalCost)}`} />
        <Stat label="Target margin" value={vFmtPct(margin, 1)} sub="Live from sensitivity" tone="amber" />
      </div>

      {notice && (
        <div role="status" className="anim-fade mt-3 rounded-[14px] border border-[#FBE6A4] bg-[#FDF6E3] px-3.5 py-2.5 text-[11.5px] font-medium text-[#7A4A0E]">
          {notice}
        </div>
      )}

      {/* Prioritisation ------------------------------------------------------ */}
      <div className="mt-3 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-white p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#5F646B]">Prioritisation · envelope-neutral transfers</span>
          {moves.length > 1 && (
            <button
              type="button"
              onClick={() => {
                let next = { ...rates };
                for (const move of moves) {
                  const take = roundRate(Math.min(move.rate, next[move.from]));
                  next = { ...next, [move.from]: roundRate(next[move.from] - take), [move.to]: roundRate(next[move.to] + take) };
                }
                applyRates(next);
              }}
              className="press rounded-full bg-[#16181C] px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#24272C]"
            >
              Apply all {moves.length}
            </button>
          )}
        </div>
        {moves.length === 0 ? (
          <p className="mt-2 text-[12px] font-light text-[#5F646B]">
            Every line sits on its seeded GDV target. {headroom > 0.004
              ? `${headroom.toFixed(2)} AED/GFA of headroom is undeployed — it drops straight into surplus.`
              : 'The envelope is fully deployed.'}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {moves.map((move) => {
              const from = WC_WALLETS.find((w) => w.key === move.from)!;
              const to = WC_WALLETS.find((w) => w.key === move.to)!;
              return (
                <li key={move.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[rgba(246,247,249,0.8)] px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-[#16181C]">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: from.color }} />
                      {from.label}
                      <span className="text-[#9EA3AA]">→</span>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: to.color }} />
                      {to.label}
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#16181C]">
                        {move.rate.toFixed(2)} AED/GFA · {vFmtM(move.aed)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-light leading-snug text-[#5F646B]">{move.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyMove(move.from, move.to, move.rate)}
                    className="press shrink-0 rounded-full border border-[rgba(22,24,28,0.12)] bg-white px-3 py-1 text-[11.5px] font-medium text-[#16181C] transition-colors hover:bg-[#FDF6E3]"
                  >
                    Apply
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Wallet table (lg+) -------------------------------------------------- */}
      <div className="mt-3 hidden overflow-x-auto scroll-thin rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-white lg:block">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.8)] text-left text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">
              <th scope="col" className="px-4 py-2.5">Wallet</th>
              <th scope="col" className="px-3 py-2.5">AED / GFA</th>
              <th scope="col" className="px-3 py-2.5 text-right">Total AED</th>
              <th scope="col" className="px-3 py-2.5 text-right">% of WC</th>
              <th scope="col" className="px-3 py-2.5 text-right">% of GDV · Our target</th>
              <th scope="col" className="px-3 py-2.5">Variance vs our target</th>
              <th scope="col" className="px-3 py-2.5 text-right">% of cost · Our target</th>
              <th scope="col" className="px-3 py-2.5">Variance vs our target</th>
              <th scope="col" className="px-4 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {reads.map((read) => {
              const isOffice = read.meta.key === 'wcOfficeTeam';
              return (
                <Fragment key={read.meta.key}>
                  <tr className="border-b border-[rgba(22,24,28,0.05)] align-middle">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <div className="flex items-start gap-2">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: read.meta.color }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12.5px] font-medium text-[#16181C]">{read.meta.label}</span>
                            {isOffice && (
                              <button
                                type="button"
                                onClick={() => setOfficeOpen((v) => !v)}
                                aria-expanded={officeOpen}
                                className="press rounded-full border border-[rgba(22,24,28,0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[#5F646B] transition-colors hover:bg-[rgba(22,24,28,0.05)]"
                              >
                                {officeOpen ? 'Hide split' : 'Split'}
                              </button>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <Profile read={read} />
                            <span className="text-[10.5px] font-light text-[#9EA3AA]">{read.meta.window}</span>
                          </div>
                        </div>
                      </div>
                    </th>
                    <td className="px-3 py-3">
                      <RateInput value={read.rate} ariaLabel={`${read.meta.label} AED per GFA`} onCommit={(v) => setWallet(read.meta.key, v)} />
                    </td>
                    <td className="px-3 py-3 text-right text-[12.5px] font-medium tabular-nums text-[#16181C]">{vFmtM(read.totalAed)}</td>
                    <td className="px-3 py-3 text-right text-[12.5px] tabular-nums text-[#5F646B]">{read.wcPct.toFixed(1)}%</td>
                    <td className="px-3 py-3 text-right">
                      <div className="text-[12.5px] font-semibold tabular-nums text-[#16181C]">{read.gdvPct.toFixed(2)}%</div>
                      <div className="mt-1">
                        <TargetInput
                          value={read.target.gdvPct}
                          ariaLabel={`${read.meta.label} our target percent of GDV`}
                          onCommit={(v: number | null) => setTarget(read.meta.key, 'gdvPct', v)}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3"><VerdictChip verdict={read.gdvVerdict} gapAed={read.gdvGapAed} variancePts={read.gdvVariancePts} /></td>
                    <td className="px-3 py-3 text-right">
                      <div className="text-[12.5px] font-semibold tabular-nums text-[#16181C]">{read.costPct.toFixed(2)}%</div>
                      <div className="mt-1">
                        <TargetInput
                          value={read.target.costPct}
                          ariaLabel={`${read.meta.label} our target percent of underwritten cost`}
                          onCommit={(v: number | null) => setTarget(read.meta.key, 'costPct', v)}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3"><VerdictChip verdict={read.costVerdict} gapAed={read.costGapAed} variancePts={read.costVariancePts} /></td>
                    <td className="px-4 py-3">{walletActions(read)}</td>
                  </tr>
                  {isOffice && officeOpen && (
                    <tr className="border-b border-[rgba(22,24,28,0.05)]">
                      <td colSpan={9} className="bg-[rgba(246,247,249,0.55)] px-4 py-4">
                        {officeDrilldown}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[rgba(246,247,249,0.9)] text-[12.5px] font-semibold text-[#16181C]">
              <th scope="row" className="px-4 py-3 text-left">Allocated</th>
              <td className="px-3 py-3 tabular-nums">{allocated.toFixed(2)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{vFmtM(wcTotalAed)}</td>
              <td className="px-3 py-3 text-right tabular-nums">100.0%</td>
              <td className="px-3 py-3 text-right tabular-nums">{vFmtPct(gdv > 0 ? (wcTotalAed / gdv) * 100 : 0, 2)}</td>
              <td className="px-3 py-3" />
              <td className="px-3 py-3 text-right tabular-nums">{vFmtPct(totalCost > 0 ? (wcTotalAed / totalCost) * 100 : 0, 2)}</td>
              <td className="px-3 py-3" />
              <td className="px-4 py-3 text-[11.5px] font-normal text-[#5F646B]">
                Headroom under WC ceiling {headroom.toFixed(2)} AED/GFA
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Wallet cards (below lg) --------------------------------------------- */}
      <div className="mt-3 space-y-2.5 lg:hidden">
        {reads.map((read) => {
          const isOffice = read.meta.key === 'wcOfficeTeam';
          return (
            <div key={read.meta.key} className="rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-white p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: read.meta.color }} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#16181C]">{read.meta.label}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Profile read={read} />
                      <span className="text-[10.5px] font-light text-[#9EA3AA]">{read.meta.window}</span>
                    </div>
                  </div>
                </div>
                <RateInput value={read.rate} ariaLabel={`${read.meta.label} AED per GFA`} onCommit={(v) => setWallet(read.meta.key, v)} />
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11.5px]">
                <div className="rounded-[12px] bg-[rgba(246,247,249,0.8)] px-2.5 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-[#5F646B]">Total</div>
                  <div className="font-semibold tabular-nums text-[#16181C]">{vFmtM(read.totalAed)}</div>
                </div>
                <div className="rounded-[12px] bg-[rgba(246,247,249,0.8)] px-2.5 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-[#5F646B]">% of WC</div>
                  <div className="font-semibold tabular-nums text-[#16181C]">{read.wcPct.toFixed(1)}%</div>
                </div>
                <div className="rounded-[12px] bg-[rgba(246,247,249,0.8)] px-2.5 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-[#5F646B]">% of GDV · our target</div>
                  <div className="font-semibold tabular-nums text-[#16181C]">{read.gdvPct.toFixed(2)}%</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <TargetInput value={read.target.gdvPct} ariaLabel={`${read.meta.label} our target percent of GDV`} onCommit={(v: number | null) => setTarget(read.meta.key, 'gdvPct', v)} />
                    <VerdictChip verdict={read.gdvVerdict} gapAed={read.gdvGapAed} variancePts={read.gdvVariancePts} />
                  </div>
                </div>
                <div className="rounded-[12px] bg-[rgba(246,247,249,0.8)] px-2.5 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-[#5F646B]">% of cost · our target</div>
                  <div className="font-semibold tabular-nums text-[#16181C]">{read.costPct.toFixed(2)}%</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <TargetInput value={read.target.costPct} ariaLabel={`${read.meta.label} our target percent of underwritten cost`} onCommit={(v: number | null) => setTarget(read.meta.key, 'costPct', v)} />
                    <VerdictChip verdict={read.costVerdict} gapAed={read.costGapAed} variancePts={read.costVariancePts} />
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                {walletActions(read)}
                {isOffice && (
                  <button
                    type="button"
                    onClick={() => setOfficeOpen((v) => !v)}
                    aria-expanded={officeOpen}
                    className="press rounded-full border border-[rgba(22,24,28,0.12)] px-2.5 py-1 text-[11px] font-medium text-[#5F646B] transition-colors hover:bg-[rgba(22,24,28,0.05)]"
                  >
                    {officeOpen ? 'Hide split' : 'Split Office / Team'}
                  </button>
                )}
              </div>
              {isOffice && officeOpen && <div className="mt-3">{officeDrilldown}</div>}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11.5px] font-light leading-relaxed text-[#5F646B]">
        Lifts are capped at our seeded GDV target and by remaining headroom; the {wcCeilingPsfGfa.toFixed(2)} AED/GFA envelope is a hard stop.
        Every edit writes straight into the underwritten working-capital line, so total cost, breakeven and the 4-tier matrix above
        move with it. Targets are seeded for this project — not an industry standard — and the breakdown, targets and context note persist locally.
      </p>
    </EeshaanKolteyCard>
  );
}
