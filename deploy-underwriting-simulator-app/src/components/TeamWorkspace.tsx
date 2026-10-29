import { useState, useEffect, useMemo, useId } from 'react';
import { Card, CardHead, PillBtn, RoundBtn, Badge } from './eeshaan-koltey/ui';
import { Plus, Close, Check, Search, Refresh, Calendar, ShieldCheck, Download } from './eeshaan-koltey/icons';

/* =====================================================================
 * WORKSPACE 5 — TEAM & EXECUTION
 * Lightweight mini-CRM + Dubai-specific responsibility Gantt.
 * Persists in localStorage with fallback to pristine consortium defaults.
 * ===================================================================== */

export type TeamStatus = 'Active' | 'Contracted' | 'Onboarding' | 'Mobilized';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  status: TeamStatus;
  assignedStages: number[]; // 1 to 5
  responsibilities: string[];
}

export type TaskStatus = 'Upcoming' | 'In Progress' | 'Complete';

export interface ProjectTask {
  id: string;
  stageId: number;
  stageName: string;
  title: string;
  startMonth: number;
  endMonth: number;
  complianceBadge?: 'RERA' | 'DLD' | 'Oqood' | 'Escrow' | 'BCC' | 'DLP' | 'DCD/DEWA' | 'DDA/Trakhees';
  description: string;
  assignedMemberIds: string[];
  status: TaskStatus;
}

export const DUBAI_STAGES = [
  { id: 1, name: 'Stage 1: Company Set-up', range: 'M0 – M2', color: '#579973', desc: 'SPV establishment, DED commercial licence, escrow agreements' },
  { id: 2, name: 'Stage 2: Land Acquisition', range: 'M1 – M4', color: '#7BB694', desc: 'Plot settlement, DLD title deed, boundary survey & geotech' },
  { id: 3, name: 'Stage 3: Design & Approvals', range: 'M3 – M9', color: '#F4C74B', desc: 'NSA spatial efficiency, DDA/Trakhees NOCs, DCD/DEWA, RERA registration' },
  { id: 4, name: 'Stage 4: Construction & Sales', range: 'M7 – M36', color: '#F0A93B', desc: 'RERA off-plan sales licence, Oqood portal, 20/40/60/80% build gates' },
  { id: 5, name: 'Stage 5: Handover & Post-Dev', range: 'M35 – M48', color: '#FA6C5D', desc: 'BCC clearance, snagging & conveyancing, terminal waterfall, 12M DLP lock' },
] as const;

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm-1',
    name: 'Tariq Al-Mansoor',
    role: 'Development Director',
    company: 'Al Farren Consortium',
    email: 't.almansoor@alfarren.ae',
    phone: '+971 4 388 9200',
    status: 'Active',
    assignedStages: [1, 2, 3, 4, 5],
    responsibilities: ['Overall SPV delivery', 'Land partner relations', 'IC reporting', 'Waterfall execution'],
  },
  {
    id: 'tm-2',
    name: 'Elena Rostova',
    role: 'SPV Project Director',
    company: 'Al Farren Consortium',
    email: 'e.rostova@alfarren.ae',
    phone: '+971 50 412 8831',
    status: 'Active',
    assignedStages: [1, 3, 4, 5],
    responsibilities: ['Construction schedule oversight', 'RERA off-plan clearance', 'PMC liaison', 'Milestone sign-off'],
  },
  {
    id: 'tm-3',
    name: 'Marcus Vance, RIBA',
    role: 'Principal Design Architect',
    company: 'Foster + Partners Dubai',
    email: 'm.vance@fosterandpartners.com',
    phone: '+971 4 456 1200',
    status: 'Contracted',
    assignedStages: [3, 4],
    responsibilities: ['Floorplate NSA spatial efficiency (80% hurdle)', 'Concept to IFC drawings', 'DDA aesthetic NOC'],
  },
  {
    id: 'tm-4',
    name: 'Zaid Khoury, PE',
    role: 'Lead Structural & MEP Consultant',
    company: 'WSP Middle East',
    email: 'z.khoury@wsp.com',
    phone: '+971 4 567 3300',
    status: 'Mobilized',
    assignedStages: [3, 4],
    responsibilities: ['Structural core design', 'DEWA substation load calculations', 'DCD life safety engineering'],
  },
  {
    id: 'tm-5',
    name: 'Nadia Benali, MRICS',
    role: 'Cost Consultant & Lead QS',
    company: 'Turner & Townsend',
    email: 'n.benali@turnertownsend.com',
    phone: '+971 4 234 8890',
    status: 'Active',
    assignedStages: [2, 3, 4, 5],
    responsibilities: ['Bill of Quantities (BOQ)', 'Independent engineer certifications', 'Contractor payment certificates'],
  },
  {
    id: 'tm-6',
    name: 'Rashid Al-Nuaimi',
    role: 'Legal Counsel & Escrow Specialist',
    company: 'Al Tamimi & Company',
    email: 'r.nuaimi@tamimi.com',
    phone: '+971 4 364 1000',
    status: 'Active',
    assignedStages: [1, 2, 4, 5],
    responsibilities: ['Dubai Law No. 8 compliance', 'Escrow trust agreement', 'SPA contracts & Oqood clauses'],
  },
  {
    id: 'tm-7',
    name: 'Soraya Hachem',
    role: 'Sales & Channel Marketing Director',
    company: 'Al Farren Realty Services',
    email: 's.hachem@alfarren.ae',
    phone: '+971 52 901 4455',
    status: 'Active',
    assignedStages: [4],
    responsibilities: ['Oqood buyer pre-registrations', 'Broker network distribution', 'Launch gallery activation'],
  },
  {
    id: 'tm-8',
    name: 'Hamad Bin Ghalita',
    role: 'Escrow Trustee Officer',
    company: 'Emirates NBD Capital',
    email: 'h.binghalita@emiratesnbd.com',
    phone: '+971 4 609 3000',
    status: 'Contracted',
    assignedStages: [1, 4, 5],
    responsibilities: ['DLD escrow account stewardship', 'Progress draw disbursements', 'Defects warranty ring-fencing'],
  },
];

export const INITIAL_PROJECT_TASKS: ProjectTask[] = [
  // Stage 1
  {
    id: 'task-1',
    stageId: 1,
    stageName: 'Stage 1: Company Set-up',
    title: 'SPV Corporate Inception & DED Commercial Development Licence',
    startMonth: 0,
    endMonth: 2,
    description: 'Establish offshore holding & onshore onshore project SPV for ring-fenced liability.',
    assignedMemberIds: ['tm-1', 'tm-6'],
    status: 'Complete',
  },
  {
    id: 'task-2',
    stageId: 1,
    stageName: 'Stage 1: Company Set-up',
    title: 'DLD Escrow Account Opening & Trustee Agreement Execution',
    startMonth: 0.5,
    endMonth: 2,
    complianceBadge: 'Escrow',
    description: 'Mandatory trust account opening under Dubai Law No. 8 of 2007 with approved trustee bank.',
    assignedMemberIds: ['tm-6', 'tm-8', 'tm-1'],
    status: 'Complete',
  },
  {
    id: 'task-3',
    stageId: 1,
    stageName: 'Stage 1: Company Set-up',
    title: 'UAE Corporate Tax, VAT & Legal Retainers Setup',
    startMonth: 1,
    endMonth: 2,
    description: 'FTA registration and legal advisory retainers for project lifecycle compliance.',
    assignedMemberIds: ['tm-1', 'tm-6'],
    status: 'Complete',
  },

  // Stage 2
  {
    id: 'task-4',
    stageId: 2,
    stageName: 'Stage 2: Land Acquisition',
    title: 'Plot Purchase Consideration & Seller Settlement',
    startMonth: 1,
    endMonth: 3,
    description: 'Securitised plot consideration clearance and equity draw-down allocation.',
    assignedMemberIds: ['tm-1', 'tm-5'],
    status: 'Complete',
  },
  {
    id: 'task-5',
    stageId: 2,
    stageName: 'Stage 2: Land Acquisition',
    title: 'DLD Title Deed Registration & Boundary NOC (4% Transfer Fee)',
    startMonth: 2,
    endMonth: 3.5,
    complianceBadge: 'DLD',
    description: 'Official transfer of plot title deed with Dubai Land Department and NOC clearance.',
    assignedMemberIds: ['tm-6', 'tm-1'],
    status: 'In Progress',
  },
  {
    id: 'task-6',
    stageId: 2,
    stageName: 'Stage 2: Land Acquisition',
    title: 'Geotechnical Soil Investigation & Topographical Demarcation',
    startMonth: 2.5,
    endMonth: 4,
    description: 'Sub-surface core samples, soil bearing capacity & municipality survey certificate.',
    assignedMemberIds: ['tm-4', 'tm-2'],
    status: 'In Progress',
  },

  // Stage 3
  {
    id: 'task-7',
    stageId: 3,
    stageName: 'Stage 3: Design & Approvals',
    title: 'Concept Architecture & Floorplate NSA Efficiency Hurdle (80%)',
    startMonth: 3,
    endMonth: 6,
    description: 'Optimizing sellable layout to prevent spatial efficiency cost drag across NSA footprint.',
    assignedMemberIds: ['tm-3', 'tm-1', 'tm-5'],
    status: 'In Progress',
  },
  {
    id: 'task-8',
    stageId: 3,
    stageName: 'Stage 3: Design & Approvals',
    title: 'Master Developer NOC Clearance (DDA / Trakhees Clearance)',
    startMonth: 4.5,
    endMonth: 7,
    complianceBadge: 'DDA/Trakhees',
    description: 'Planning envelope, elevations, vehicular ingress & urban design compliance clearance.',
    assignedMemberIds: ['tm-3', 'tm-2'],
    status: 'Upcoming',
  },
  {
    id: 'task-9',
    stageId: 3,
    stageName: 'Stage 3: Design & Approvals',
    title: 'Civil Defence (DCD) Life Safety & DEWA Infrastructure Approvals',
    startMonth: 5,
    endMonth: 8,
    complianceBadge: 'DCD/DEWA',
    description: 'Substation reservations, water connection NOC, fire egress and safety certifications.',
    assignedMemberIds: ['tm-4', 'tm-2'],
    status: 'Upcoming',
  },
  {
    id: 'task-10',
    stageId: 3,
    stageName: 'Stage 3: Design & Approvals',
    title: 'RERA Project Registration & Final Building Permit (BP)',
    startMonth: 6,
    endMonth: 9,
    complianceBadge: 'RERA',
    description: 'Project approval record entry, bank guarantee verification, and municipal construction permit.',
    assignedMemberIds: ['tm-2', 'tm-6', 'tm-8'],
    status: 'Upcoming',
  },

  // Stage 4
  {
    id: 'task-11',
    stageId: 4,
    stageName: 'Stage 4: Construction & Sales',
    title: 'RERA Off-Plan Sales Licence Clearance (Collections Unlocked)',
    startMonth: 7,
    endMonth: 9,
    complianceBadge: 'RERA',
    description: 'Clears the pre-sales capital chasm; permits legal marketing and off-plan buyer collections.',
    assignedMemberIds: ['tm-1', 'tm-2', 'tm-7', 'tm-6'],
    status: 'Upcoming',
  },
  {
    id: 'task-12',
    stageId: 4,
    stageName: 'Stage 4: Construction & Sales',
    title: 'Oqood Pre-Registration Portal Activation for Buyer Bookings',
    startMonth: 8,
    endMonth: 12,
    complianceBadge: 'Oqood',
    description: 'Official DLD interim registry for off-plan purchase contracts and installment tracking.',
    assignedMemberIds: ['tm-7', 'tm-6'],
    status: 'Upcoming',
  },
  {
    id: 'task-13',
    stageId: 4,
    stageName: 'Stage 4: Construction & Sales',
    title: 'Main Contractor Groundbreaking, Shoring & Piling (0%–20%)',
    startMonth: 8,
    endMonth: 15,
    description: 'Deep substructure, dewatering, secant piling, and basement foundation works.',
    assignedMemberIds: ['tm-2', 'tm-4', 'tm-5'],
    status: 'Upcoming',
  },
  {
    id: 'task-14',
    stageId: 4,
    stageName: 'Stage 4: Construction & Sales',
    title: '20% Certified Structural Core (Escrow Tranche 1 Unlocked)',
    startMonth: 14,
    endMonth: 21,
    description: 'Engineer-certified 20% milestone trigger releasing progressive escrow draw.',
    assignedMemberIds: ['tm-5', 'tm-2', 'tm-8'],
    status: 'Upcoming',
  },
  {
    id: 'task-15',
    stageId: 4,
    stageName: 'Stage 4: Construction & Sales',
    title: '40%–60% Superstructure, MEP & Facade (Escrow Tranches 2 & 3)',
    startMonth: 20,
    endMonth: 30,
    description: 'Tower concrete frame topping-out, glazing envelope, and central MEP plant installation.',
    assignedMemberIds: ['tm-2', 'tm-4', 'tm-5', 'tm-8'],
    status: 'Upcoming',
  },
  {
    id: 'task-16',
    stageId: 4,
    stageName: 'Stage 4: Construction & Sales',
    title: '80% Interior Fit-Out & Snagging (Escrow Tranche 4 Unlocked)',
    startMonth: 28,
    endMonth: 36,
    description: 'Joinery, finishes, testing/commissioning, and statutory inspections.',
    assignedMemberIds: ['tm-3', 'tm-5', 'tm-2'],
    status: 'Upcoming',
  },

  // Stage 5
  {
    id: 'task-17',
    stageId: 5,
    stageName: 'Stage 5: Handover & Post-Dev',
    title: 'Building Completion Certificate (BCC) from Dubai Municipality',
    startMonth: 35,
    endMonth: 37,
    complianceBadge: 'BCC',
    description: 'Final authority sign-off certifying building occupancy readiness and code compliance.',
    assignedMemberIds: ['tm-2', 'tm-4', 'tm-6'],
    status: 'Upcoming',
  },
  {
    id: 'task-18',
    stageId: 5,
    stageName: 'Stage 5: Handover & Post-Dev',
    title: 'Snagging, Handover & Final Unit Oqood-to-Title Deed Conveyancing',
    startMonth: 36,
    endMonth: 39,
    complianceBadge: 'DLD',
    description: 'Unit handover ceremonies, key handoff, and definitive title deed issuance to buyers.',
    assignedMemberIds: ['tm-7', 'tm-2', 'tm-6'],
    status: 'Upcoming',
  },
  {
    id: 'task-19',
    stageId: 5,
    stageName: 'Stage 5: Handover & Post-Dev',
    title: 'Terminal Waterfall Settlement (Financier -> Land -> Surplus)',
    startMonth: 36,
    endMonth: 38,
    description: 'Bottom-up priority liquidation settling debt principal, carry, land partner and surplus.',
    assignedMemberIds: ['tm-1', 'tm-5', 'tm-8'],
    status: 'Upcoming',
  },
  {
    id: 'task-20',
    stageId: 5,
    stageName: 'Stage 5: Handover & Post-Dev',
    title: '12-Month Post-Handover Defects Liability Period (DLP - 5% Lock)',
    startMonth: 36,
    endMonth: 48,
    complianceBadge: 'DLP',
    description: 'Statutory 5% holdback ring-fenced for structural warranty under Dubai Law No. 8 of 2007.',
    assignedMemberIds: ['tm-8', 'tm-6', 'tm-1'],
    status: 'Upcoming',
  },
];

const STORAGE_KEY_MEMBERS = 'alfarren_team_members_v1';
const STORAGE_KEY_TASKS = 'alfarren_project_tasks_v1';

export default function TeamWorkspace() {
  // --- Persistent State ---
  const [members, setMembers] = useState<TeamMember[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MEMBERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_TEAM_MEMBERS;
  });

  const [tasks, setTasks] = useState<ProjectTask[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TASKS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_PROJECT_TASKS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
    } catch {
      // ignore
    }
  }, [members]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  // --- Filtering & View Modes ---
  const [activeTab, setActiveTab] = useState<'gantt' | 'crm' | 'matrix'>('gantt');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // --- Modal State for Team Member CRUD ---
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  // Form field state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<TeamStatus>('Active');
  const [formStages, setFormStages] = useState<number[]>([1, 2]);
  const [formResp, setFormResp] = useState('');

  const modalNameId = useId();
  const modalRoleId = useId();
  const modalCompanyId = useId();
  const modalEmailId = useId();
  const modalPhoneId = useId();
  const modalStatusId = useId();
  const modalRespId = useId();

  const handleOpenAddMember = () => {
    setEditingMember(null);
    setFormName('');
    setFormRole('');
    setFormCompany('Al Farren Consortium');
    setFormEmail('');
    setFormPhone('+971 ');
    setFormStatus('Active');
    setFormStages([1, 2, 3]);
    setFormResp('');
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setFormName(member.name);
    setFormRole(member.role);
    setFormCompany(member.company);
    setFormEmail(member.email);
    setFormPhone(member.phone);
    setFormStatus(member.status);
    setFormStages(member.assignedStages);
    setFormResp(member.responsibilities.join(', '));
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRole.trim()) return;

    const parsedResp = formResp
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingMember) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? {
                ...m,
                name: formName.trim(),
                role: formRole.trim(),
                company: formCompany.trim() || 'Independent',
                email: formEmail.trim(),
                phone: formPhone.trim(),
                status: formStatus,
                assignedStages: formStages,
                responsibilities: parsedResp,
              }
            : m
        )
      );
    } else {
      const newMember: TeamMember = {
        id: `tm-${Date.now()}`,
        name: formName.trim(),
        role: formRole.trim(),
        company: formCompany.trim() || 'Independent',
        email: formEmail.trim(),
        phone: formPhone.trim(),
        status: formStatus,
        assignedStages: formStages,
        responsibilities: parsedResp,
      };
      setMembers((prev) => [...prev, newMember]);
    }

    setIsMemberModalOpen(false);
  };

  const handleDeleteMember = (id: string) => {
    if (confirm('Are you sure you want to remove this team member? Any active stage assignments will be cleared.')) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          assignedMemberIds: t.assignedMemberIds.filter((mid) => mid !== id),
        }))
      );
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Reset entire team roster and task assignments back to the official Al Farren Consortium benchmark?')) {
      setMembers(INITIAL_TEAM_MEMBERS);
      setTasks(INITIAL_PROJECT_TASKS);
    }
  };

  const handleToggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const next: TaskStatus = t.status === 'Complete' ? 'Upcoming' : t.status === 'Upcoming' ? 'In Progress' : 'Complete';
        return { ...t, status: next };
      })
    );
  };

  const handleToggleMemberAssignment = (taskId: string, memberId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const isAssigned = t.assignedMemberIds.includes(memberId);
        return {
          ...t,
          assignedMemberIds: isAssigned
            ? t.assignedMemberIds.filter((id) => id !== memberId)
            : [...t.assignedMemberIds, memberId],
        };
      })
    );
  };

  // --- Filtering Computations ---
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.company.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStage = stageFilter === 'all' || m.assignedStages.includes(stageFilter);
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      return matchesSearch && matchesStage && matchesStatus;
    });
  }, [members, searchQuery, stageFilter, statusFilter]);

  const filteredTasks = useMemo(() => {
    if (stageFilter === 'all') return tasks;
    return tasks.filter((t) => t.stageId === stageFilter);
  }, [tasks, stageFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalMembers = members.length;
    const activeMembers = members.filter((m) => m.status === 'Active' || m.status === 'Mobilized').length;
    const completedTasks = tasks.filter((t) => t.status === 'Complete').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'In Progress').length;
    const complianceMilestones = tasks.filter((t) => t.complianceBadge).length;
    return { totalMembers, activeMembers, completedTasks, inProgressTasks, totalTasks: tasks.length, complianceMilestones };
  }, [members, tasks]);

  // Export Roster as CSV
  const handleExportRoster = () => {
    const csvRows = [
      ['Name', 'Role', 'Company', 'Email', 'Phone', 'Status', 'Assigned Stages', 'Responsibilities'],
      ...members.map((m) => [
        `"${m.name}"`,
        `"${m.role}"`,
        `"${m.company}"`,
        `"${m.email}"`,
        `"${m.phone}"`,
        `"${m.status}"`,
        `"${m.assignedStages.map((s) => `Stage ${s}`).join('; ')}"`,
        `"${m.responsibilities.join('; ')}"`,
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `al_farren_consortium_team_roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* -------------------- Top Masthead -------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber text-ink text-[12px] font-bold">
              5
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Execution Governance &amp; Responsibility Matrix
            </span>
          </div>
          <h2 className="mt-1 text-[22px] sm:text-[28px] font-light leading-tight tracking-[-0.02em] text-[#16181C]">
            Team &amp; Execution Roadmap
          </h2>
          <p className="mt-0.5 text-[12.5px] sm:text-[13px] font-normal text-[#5F646B] max-w-2xl leading-relaxed">
            Consortium leadership mini-CRM, Dubai statutory compliance milestone tracking (RERA, DLD, Oqood, Escrow), and live responsibility Gantt across 48 calendar months.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <PillBtn tone="soft" icon={<Refresh />} onClick={handleResetDefaults}>
            Reset Consortium Defaults
          </PillBtn>
          <PillBtn tone="soft" icon={<Download />} onClick={handleExportRoster}>
            Export Roster (CSV)
          </PillBtn>
          <PillBtn tone="amber" icon={<Plus />} onClick={handleOpenAddMember}>
            Add Team Member
          </PillBtn>
        </div>
      </div>

      {/* -------------------- Summary KPI Strip -------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card variant="cream" className="p-4 sm:p-5">
          <div className="text-[10.5px] sm:text-[11px] font-normal uppercase tracking-wider text-[#7A4A0E]">
            Consortium Leadership
          </div>
          <div className="mt-1 text-[22px] sm:text-[26px] font-light tracking-tight tabular-nums text-ink">
            {stats.totalMembers} <span className="text-[13px] font-normal text-muted">professionals</span>
          </div>
          <div className="mt-0.5 text-[11.5px] font-normal text-[#5F646B]">
            {stats.activeMembers} active / mobilized
          </div>
        </Card>

        <Card variant="plain" className="p-4 sm:p-5">
          <div className="text-[10.5px] sm:text-[11px] font-normal uppercase tracking-wider text-muted">
            Dubai Roadmap Progress
          </div>
          <div className="mt-1 text-[22px] sm:text-[26px] font-light tracking-tight tabular-nums text-ink">
            {stats.completedTasks} <span className="text-[13px] font-normal text-muted">/ {stats.totalTasks} gates</span>
          </div>
          <div className="mt-0.5 text-[11.5px] font-normal text-[#2F5C44]">
            {stats.inProgressTasks} currently underway
          </div>
        </Card>

        <Card variant="plain" className="p-4 sm:p-5">
          <div className="text-[10.5px] sm:text-[11px] font-normal uppercase tracking-wider text-muted">
            Statutory Gates
          </div>
          <div className="mt-1 text-[22px] sm:text-[26px] font-light tracking-tight tabular-nums text-ink">
            {stats.complianceMilestones} <span className="text-[13px] font-normal text-muted">clearances</span>
          </div>
          <div className="mt-0.5 text-[11.5px] font-normal text-muted">
            RERA, DLD, Oqood, BCC, DLP
          </div>
        </Card>

        <Card variant="plain" className="p-4 sm:p-5">
          <div className="text-[10.5px] sm:text-[11px] font-normal uppercase tracking-wider text-muted">
            Project Lifecycle
          </div>
          <div className="mt-1 text-[22px] sm:text-[26px] font-light tracking-tight tabular-nums text-ink">
            48 <span className="text-[13px] font-normal text-muted">months</span>
          </div>
          <div className="mt-0.5 text-[11.5px] font-normal text-muted">
            36M build + 12M DLP warranty
          </div>
        </Card>
      </div>

      {/* -------------------- Sub-Navigation Tabs -------------------- */}
      <Card variant="flat" className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('gantt')}
            className={`press inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium transition-colors ${
              activeTab === 'gantt' ? 'bg-ink text-white' : 'bg-white/60 text-ink-2 hover:bg-white'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Dubai Stage Map Gantt</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('crm')}
            className={`press inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium transition-colors ${
              activeTab === 'crm' ? 'bg-ink text-white' : 'bg-white/60 text-ink-2 hover:bg-white'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Team Roster ({members.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`press inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium transition-colors ${
              activeTab === 'matrix' ? 'bg-ink text-white' : 'bg-white/60 text-ink-2 hover:bg-white'
            }`}
          >
            <span>Workload Allocation Matrix</span>
          </button>
        </div>

        {/* Search & Quick Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="eeshaan-koltey-field flex items-center px-3 py-1.5 bg-white w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-muted mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, role, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-[12.5px] font-normal text-ink outline-none placeholder:text-muted"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="text-muted hover:text-ink">
                <Close className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* -------------------- TAB 1: DUBAI STAGE GANTT -------------------- */}
      {activeTab === 'gantt' && (
        <div className="space-y-6">
          {/* Stage Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-medium text-muted mr-1">Filter Stage:</span>
            <button
              type="button"
              onClick={() => setStageFilter('all')}
              className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors ${
                stageFilter === 'all'
                  ? 'bg-ink text-white'
                  : 'bg-white border border-[rgba(22,24,28,0.08)] text-ink-2 hover:bg-white/90'
              }`}
            >
              All Stages (M0–M48)
            </button>
            {DUBAI_STAGES.map((stg) => (
              <button
                key={stg.id}
                type="button"
                onClick={() => setStageFilter(stg.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors ${
                  stageFilter === stg.id
                    ? 'bg-ink text-white'
                    : 'bg-white border border-[rgba(22,24,28,0.08)] text-ink-2 hover:bg-white/90'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: stg.color }} />
                <span>{stg.name}</span>
                <span className="text-[10px] opacity-60">({stg.range})</span>
              </button>
            ))}
          </div>

          {/* Interactive Gantt View */}
          <Card variant="plain" className="p-4 sm:p-6 overflow-hidden">
            <CardHead
              title="Dubai Real Estate Development Stage Map (M0 – M48)"
              sub="Click task status to toggle (Upcoming → In Progress → Complete) or click team chips to modify execution responsibility."
              right={
                <div className="flex items-center gap-2 text-[11.5px] text-muted">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#7BB694]" /> Complete
                  <span className="inline-block h-2 w-2 rounded-full bg-amber ml-2" /> In Progress
                  <span className="inline-block h-2 w-2 rounded-full bg-faint ml-2" /> Upcoming
                </div>
              }
            />

            {/* Gantt Timeline Viewport */}
            <div className="mt-5 overflow-x-auto scroll-thin pb-2">
              <div className="min-w-[880px]">
                {/* Timeline Month Header (48 Months) */}
                <div className="grid grid-cols-[280px_1fr_120px] items-center gap-3 border-b border-[rgba(22,24,28,0.08)] pb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted">
                  <div>Task / Statutory Milestones</div>
                  <div className="relative h-6">
                    {[0, 6, 12, 18, 24, 30, 36, 42, 48].map((month) => (
                      <div
                        key={month}
                        className="absolute top-0 -translate-x-1/2 text-center"
                        style={{ left: `${(month / 48) * 100}%` }}
                      >
                        <span className="text-[10.5px] font-semibold text-ink">M{month}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-right">Execution Team</div>
                </div>

                {/* Stages and Tasks */}
                <div className="divide-y divide-[rgba(22,24,28,0.05)] mt-1">
                  {filteredTasks.map((task) => {
                    const stage = DUBAI_STAGES.find((s) => s.id === task.stageId) || DUBAI_STAGES[0];
                    const leftPct = (task.startMonth / 48) * 100;
                    const widthPct = Math.max(3, ((task.endMonth - task.startMonth) / 48) * 100);
                    const assignedMembers = members.filter((m) => task.assignedMemberIds.includes(m.id));

                    return (
                      <div
                        key={task.id}
                        className="grid grid-cols-[280px_1fr_120px] items-center gap-3 py-3 hover:bg-[rgba(246,247,249,0.5)] transition-colors rounded-xl px-2"
                      >
                        {/* Task Title & Details */}
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleTaskStatus(task.id)}
                              title="Click to toggle status"
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-colors ${
                                task.status === 'Complete'
                                  ? 'bg-[#2F5C44] text-white'
                                  : task.status === 'In Progress'
                                  ? 'bg-amber text-ink'
                                  : 'border border-[rgba(22,24,28,0.2)] text-transparent hover:border-ink'
                              }`}
                            >
                              {task.status === 'Complete' ? <Check className="h-2.5 w-2.5" /> : task.status === 'In Progress' ? '•' : ''}
                            </button>
                            <span className="text-[12.5px] font-medium text-ink truncate leading-snug">
                              {task.title}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-[10.5px]">
                            <span className="text-muted font-light">M{task.startMonth}–M{task.endMonth}</span>
                            {task.complianceBadge && (
                              <span className="rounded bg-[#FDF6E3] px-1.5 py-0.2 text-[9.5px] font-semibold text-[#7A4A0E] border border-[#FBE6A4]">
                                {task.complianceBadge}
                              </span>
                            )}
                            <span className="text-muted truncate">({task.stageName.split(':')[0]})</span>
                          </div>
                        </div>

                        {/* Gantt Bar Track */}
                        <div className="relative h-7 rounded-lg bg-[rgba(22,24,28,0.03)] border border-[rgba(22,24,28,0.05)] overflow-hidden">
                          {/* Quarter Guidelines */}
                          {[12, 24, 36].map((m) => (
                            <div
                              key={m}
                              className="absolute top-0 bottom-0 w-px border-r border-dashed border-[rgba(22,24,28,0.08)] pointer-events-none"
                              style={{ left: `${(m / 48) * 100}%` }}
                            />
                          ))}

                          {/* Task Bar */}
                          <div
                            className={`absolute inset-y-1 rounded-md transition-all duration-300 flex items-center px-2 shadow-xs cursor-pointer ${
                              task.status === 'Complete'
                                ? 'opacity-90'
                                : task.status === 'In Progress'
                                ? 'opacity-100 ring-1 ring-white/60'
                                : 'opacity-60'
                            }`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              background: stage.color,
                            }}
                            onClick={() => setAssigningTaskId(task.id)}
                            title={`${task.title} (M${task.startMonth}-M${task.endMonth}) - Click to assign team members`}
                          >
                            <span className="truncate text-[9.5px] font-bold text-white drop-shadow-xs">
                              {task.title}
                            </span>
                          </div>
                        </div>

                        {/* Assigned Team Avatars */}
                        <div className="flex items-center justify-end gap-1 overflow-hidden">
                          {assignedMembers.length > 0 ? (
                            <div className="flex items-center -space-x-1.5 overflow-hidden">
                              {assignedMembers.slice(0, 3).map((m) => {
                                const initials = m.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2);
                                return (
                                  <span
                                    key={m.id}
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-white text-[9px] font-bold border-2 border-white shadow-xs"
                                    title={`${m.name} (${m.role})`}
                                  >
                                    {initials}
                                  </span>
                                );
                              })}
                              {assignedMembers.length > 3 && (
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber text-ink text-[9px] font-bold border-2 border-white shadow-xs">
                                  +{assignedMembers.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAssigningTaskId(task.id)}
                              className="text-[10.5px] font-medium text-amber hover:underline"
                            >
                              + Assign
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* -------------------- TAB 2: TEAM CRM ROSTER -------------------- */}
      {activeTab === 'crm' && (
        <div className="space-y-5">
          {/* Status and Stage Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-medium text-muted mr-1">Status:</span>
              {['all', 'Active', 'Contracted', 'Mobilized', 'Onboarding'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-ink text-white'
                      : 'bg-white border border-[rgba(22,24,28,0.08)] text-ink-2 hover:bg-white/90'
                  }`}
                >
                  {st === 'all' ? 'All Statuses' : st}
                </button>
              ))}
            </div>

            <div className="text-[12px] text-muted">
              Showing <b className="text-ink font-semibold">{filteredMembers.length}</b> of {members.length} consortium members
            </div>
          </div>

          {/* Members Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member) => {
              const initials = member.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2);

              const memberTaskCount = tasks.filter((t) => t.assignedMemberIds.includes(member.id)).length;

              return (
                <Card key={member.id} variant="plain" className="p-5 flex flex-col justify-between">
                  <div>
                    {/* Header: Avatar, Name, Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white text-[12px] font-bold shadow-sm">
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-[14.5px] font-semibold text-ink leading-tight truncate">
                            {member.name}
                          </h4>
                          <p className="text-[12px] font-medium text-amber-deep truncate mt-0.5">
                            {member.role}
                          </p>
                        </div>
                      </div>

                      <Badge
                        tone={
                          member.status === 'Active'
                            ? 'mint'
                            : member.status === 'Contracted'
                            ? 'amber'
                            : member.status === 'Mobilized'
                            ? 'neutral'
                            : 'coral'
                        }
                        dot
                      >
                        {member.status}
                      </Badge>
                    </div>

                    {/* Company and Contacts */}
                    <div className="mt-3.5 space-y-1 text-[11.5px] border-t border-[rgba(22,24,28,0.06)] pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Entity / Firm:</span>
                        <span className="font-medium text-ink truncate max-w-[180px]">{member.company}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Direct Email:</span>
                        <a href={`mailto:${member.email}`} className="font-normal text-ink hover:underline truncate max-w-[180px]">
                          {member.email}
                        </a>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Phone:</span>
                        <span className="font-medium text-ink">{member.phone}</span>
                      </div>
                    </div>

                    {/* Assigned Stages Badges */}
                    <div className="mt-3">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                        Assigned Development Stages
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {member.assignedStages.map((s) => {
                          const stg = DUBAI_STAGES.find((d) => d.id === s);
                          return (
                            <span
                              key={s}
                              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-2xs"
                              style={{ background: stg?.color || '#16181C' }}
                            >
                              S{s}: {stg?.name.split(':')[1]?.trim() || `Stage ${s}`}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Core Responsibilities */}
                    {member.responsibilities.length > 0 && (
                      <div className="mt-3.5">
                        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted mb-1">
                          Core Responsibilities
                        </div>
                        <ul className="space-y-1">
                          {member.responsibilities.map((resp, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[11px] text-[#5F646B] leading-snug">
                              <span className="text-amber mt-0.5">•</span>
                              <span>{resp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-5 pt-3 border-t border-[rgba(22,24,28,0.06)] flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted">
                      {memberTaskCount} active tasks led
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMember(member)}
                        className="text-[11.5px] font-medium text-ink-2 hover:text-ink hover:underline"
                      >
                        Edit
                      </button>
                      <span className="text-muted">·</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(member.id)}
                        className="text-[11.5px] font-medium text-[#96291D] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------- TAB 3: WORKLOAD ALLOCATION MATRIX -------------------- */}
      {activeTab === 'matrix' && (
        <Card variant="plain" className="p-4 sm:p-6 overflow-hidden">
          <CardHead
            title="Consortium Responsibility &amp; Workload Matrix"
            sub="Mapping leadership accountability across all five Dubai project stages."
          />

          <div className="mt-4 overflow-x-auto scroll-thin">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[rgba(246,247,249,0.8)] border-b border-[rgba(22,24,28,0.08)] text-[11px] font-medium uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Team Member &amp; Role</th>
                  <th className="px-3 py-3">Entity</th>
                  {DUBAI_STAGES.map((s) => (
                    <th key={s.id} className="px-2 py-3 text-center">
                      <span className="block">{s.name.split(':')[0]}</span>
                      <span className="text-[9.5px] font-light text-muted lowercase">({s.range})</span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right">Active Gates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(22,24,28,0.05)] text-[12.5px]">
                {members.map((m) => {
                  const tasksForMember = tasks.filter((t) => t.assignedMemberIds.includes(m.id));
                  return (
                    <tr key={m.id} className="hover:bg-[rgba(246,247,249,0.5)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{m.name}</div>
                        <div className="text-[11px] font-normal text-muted">{m.role}</div>
                      </td>
                      <td className="px-3 py-3 text-[#5F646B]">{m.company}</td>

                      {/* Stages S1 to S5 */}
                      {[1, 2, 3, 4, 5].map((stgNum) => {
                        const isAssigned = m.assignedStages.includes(stgNum);
                        const stageTasks = tasksForMember.filter((t) => t.stageId === stgNum);
                        return (
                          <td key={stgNum} className="px-2 py-3 text-center">
                            {isAssigned ? (
                              <span
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white text-[10px] font-bold shadow-2xs"
                                style={{ background: DUBAI_STAGES[stgNum - 1].color }}
                                title={`${m.name} active in Stage ${stgNum} (${stageTasks.length} tasks)`}
                              >
                                {stageTasks.length || '✓'}
                              </span>
                            ) : (
                              <span className="text-muted/30">—</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink">
                        {tasksForMember.length} tasks
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* -------------------- Task Assignment Popover / Modal -------------------- */}
      {assigningTaskId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 backdrop-blur-md bg-[rgba(22,24,28,0.32)] sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="anim-pop flex w-full max-w-lg flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl border border-white">
            <header className="flex items-start justify-between border-b border-[rgba(22,24,28,0.06)] px-5 py-4 bg-[rgba(246,247,249,0.7)]">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-amber-deep">Task Responsibility</span>
                <h3 className="text-[16px] font-semibold text-ink mt-0.5">
                  {tasks.find((t) => t.id === assigningTaskId)?.title}
                </h3>
              </div>
              <RoundBtn
                icon={<Close />}
                label="Close"
                size={34}
                tone="soft"
                onClick={() => setAssigningTaskId(null)}
              />
            </header>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto scroll-thin">
              <p className="text-[12px] text-muted">
                Select which consortium team members are directly accountable for this milestone:
              </p>

              <div className="space-y-2">
                {members.map((m) => {
                  const currentTask = tasks.find((t) => t.id === assigningTaskId);
                  const isAssigned = currentTask?.assignedMemberIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isAssigned
                          ? 'border-amber bg-[#FDF6E3]/60'
                          : 'border-[rgba(22,24,28,0.08)] bg-white hover:bg-[rgba(246,247,249,0.5)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => handleToggleMemberAssignment(assigningTaskId, m.id)}
                          className="h-4 w-4 accent-amber rounded"
                        />
                        <div>
                          <div className="text-[13px] font-semibold text-ink">{m.name}</div>
                          <div className="text-[11.5px] text-muted">{m.role} · {m.company}</div>
                        </div>
                      </div>
                      <Badge tone={m.status === 'Active' ? 'mint' : 'neutral'}>{m.status}</Badge>
                    </label>
                  );
                })}
              </div>
            </div>

            <footer className="flex justify-end p-4 border-t border-[rgba(22,24,28,0.06)] bg-white">
              <PillBtn tone="dark" onClick={() => setAssigningTaskId(null)}>
                Done
              </PillBtn>
            </footer>
          </div>
        </div>
      )}

      {/* -------------------- Add / Edit Member Modal -------------------- */}
      {isMemberModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 backdrop-blur-md bg-[rgba(22,24,28,0.32)] sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="anim-pop flex w-full max-w-xl flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl border border-white max-h-[90vh]">
            <header className="flex items-start justify-between border-b border-[rgba(22,24,28,0.06)] px-6 py-4 bg-[rgba(246,247,249,0.7)]">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-deep">
                  Consortium Mini-CRM
                </span>
                <h3 className="text-[18px] font-semibold text-ink mt-0.5">
                  {editingMember ? 'Edit Consortium Member' : 'Add New Consortium Member'}
                </h3>
              </div>
              <RoundBtn
                icon={<Close />}
                label="Close"
                size={36}
                tone="soft"
                onClick={() => setIsMemberModalOpen(false)}
              />
            </header>

            <form onSubmit={handleSaveMember} className="p-6 space-y-4 overflow-y-auto scroll-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={modalNameId} className="block text-[12px] font-medium text-ink mb-1.5">
                    Full Name *
                  </label>
                  <input
                    id={modalNameId}
                    type="text"
                    required
                    placeholder="e.g. Tariq Al-Mansoor"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="eeshaan-koltey-field w-full px-3 py-2 text-[13px] outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={modalRoleId} className="block text-[12px] font-medium text-ink mb-1.5">
                    Project Role / Title *
                  </label>
                  <input
                    id={modalRoleId}
                    type="text"
                    required
                    placeholder="e.g. Lead Structural Engineer"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="eeshaan-koltey-field w-full px-3 py-2 text-[13px] outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={modalCompanyId} className="block text-[12px] font-medium text-ink mb-1.5">
                    Company / Entity *
                  </label>
                  <input
                    id={modalCompanyId}
                    type="text"
                    required
                    placeholder="e.g. Al Farren Consortium / WSP"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="eeshaan-koltey-field w-full px-3 py-2 text-[13px] outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={modalStatusId} className="block text-[12px] font-medium text-ink mb-1.5">
                    Deployment Status
                  </label>
                  <select
                    id={modalStatusId}
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TeamStatus)}
                    className="eeshaan-koltey-field w-full px-3 py-2 text-[13px] outline-none bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Contracted">Contracted</option>
                    <option value="Mobilized">Mobilized</option>
                    <option value="Onboarding">Onboarding</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={modalEmailId} className="block text-[12px] font-medium text-ink mb-1.5">
                    Email Address
                  </label>
                  <input
                    id={modalEmailId}
                    type="email"
                    placeholder="contact@entity.ae"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="eeshaan-koltey-field w-full px-3 py-2 text-[13px] outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={modalPhoneId} className="block text-[12px] font-medium text-ink mb-1.5">
                    Phone Number
                  </label>
                  <input
                    id={modalPhoneId}
                    type="text"
                    placeholder="+971 4 ..."
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="eeshaan-koltey-field w-full px-3 py-2 text-[13px] outline-none"
                  />
                </div>
              </div>

              {/* Development Stages Assignment */}
              <div className="pt-2">
                <label className="block text-[12px] font-medium text-ink mb-2">
                  Assigned Development Stages
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DUBAI_STAGES.map((stg) => {
                    const isChecked = formStages.includes(stg.id);
                    return (
                      <label
                        key={stg.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-[12px] cursor-pointer transition-colors ${
                          isChecked ? 'border-amber bg-[#FDF6E3]' : 'border-[rgba(22,24,28,0.08)] bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormStages((prev) => [...prev, stg.id].sort());
                            } else {
                              setFormStages((prev) => prev.filter((id) => id !== stg.id));
                            }
                          }}
                          className="h-4 w-4 accent-amber rounded"
                        />
                        <span className="h-2 w-2 rounded-full" style={{ background: stg.color }} />
                        <span className="font-medium text-ink">{stg.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Key Responsibilities */}
              <div>
                <label htmlFor={modalRespId} className="block text-[12px] font-medium text-ink mb-1.5">
                  Core Responsibilities (comma-separated)
                </label>
                <textarea
                  id={modalRespId}
                  rows={2}
                  placeholder="e.g. Land partner negotiations, RERA off-plan clearance, BOQ certification"
                  value={formResp}
                  onChange={(e) => setFormResp(e.target.value)}
                  className="eeshaan-koltey-field w-full px-3 py-2 text-[12.5px] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[rgba(22,24,28,0.06)]">
                <PillBtn tone="soft" onClick={() => setIsMemberModalOpen(false)}>
                  Cancel
                </PillBtn>
                <PillBtn tone="amber" onClick={() => {}}>
                  {editingMember ? 'Save Changes' : 'Add to Consortium'}
                </PillBtn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
