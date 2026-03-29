import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, UploadCloud, CheckCircle2, IndianRupee, Briefcase, Home, GraduationCap, TrendingUp, ShieldCheck, AlertCircle, X, FileText, Lock, Info, Loader2, AlertTriangle, ChevronDown, ChevronUp, Zap, User, Landmark, Heart } from 'lucide-react';
import { useState, useRef, useCallback, type Dispatch, type SetStateAction, type DragEvent, type ChangeEvent } from 'react';
import { cn } from '../lib/utils';
import type { UserProfile, UploadedDocument } from '../App';

interface OnboardingProps {
  step: number;
  nextStep: () => void;
  prevStep: () => void;
  profile: UserProfile;
  setProfile: Dispatch<SetStateAction<UserProfile>>;
  uploadedDocs: UploadedDocument[];
  setUploadedDocs: Dispatch<SetStateAction<UploadedDocument[]>>;
}

// ───────── helpers ─────────
function parseIndianNumber(str: string): number {
  return parseInt(str.replace(/[^0-9]/g, '')) || 0;
}

function formatIndianNumber(n: number): string {
  if (!n) return '';
  return new Intl.NumberFormat('en-IN').format(n);
}

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

// ───────── validation ─────────
interface ValidationError {
  field: string;
  message: string;
}

function validateStep1(profile: UserProfile): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!profile.age || profile.age < 18) errors.push({ field: 'age', message: 'Age must be between 18 and 80' });
  if (profile.age > 80) errors.push({ field: 'age', message: 'Age must be between 18 and 80' });
  if (!profile.city.trim()) errors.push({ field: 'city', message: 'City is required' });
  if (!profile.income || profile.income < 100000) errors.push({ field: 'income', message: 'Annual income must be at least ₹1,00,000' });
  if (profile.income > 500000000) errors.push({ field: 'income', message: 'Please enter a realistic income figure' });
  return errors;
}

function validateStep2(investments: { type: string; value: number }[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const inv of investments) {
    if (inv.value < 0) errors.push({ field: inv.type, message: `${inv.type} value cannot be negative` });
    if (inv.value > 1000000000) errors.push({ field: inv.type, message: `${inv.type} value seems too high — please double-check` });
  }
  return errors;
}

// ───────── preset personas ─────────
interface Persona {
  id: string;
  label: string;
  tagline: string;
  icon: typeof GraduationCap;
  color: string; // tailwind accent
  profile: Partial<UserProfile>;
  investments: Record<string, number>; // type → value
  goals: string[];
}

const PERSONAS: Persona[] = [
  {
    id: 'student',
    label: 'Student / Intern',
    tagline: '22 · Bengaluru · 4.5L',
    icon: GraduationCap,
    color: 'teal',
    profile: {
      age: 22, city: 'Bengaluru', income: 450000,
      retireAge: 45, targetMonthlyExpense: 30000, monthlySipCurrent: 5000,
      declaredLifeCover: 0, section80C: 0, section80CCD1B: 0, section80D: 0,
      rentPaid: 12000, homeLoanInterest: 0,
    },
    investments: { 'Mutual Funds': 50000, 'Stocks': 25000 },
    goals: ['wealth', 'tax'],
  },
  {
    id: 'young_pro',
    label: 'Young Professional',
    tagline: '28 · Mumbai · 18L',
    icon: Briefcase,
    color: 'blue',
    profile: {
      age: 28, city: 'Mumbai', income: 1800000,
      retireAge: 50, targetMonthlyExpense: 75000, monthlySipCurrent: 25000,
      declaredLifeCover: 5000000, section80C: 150000, section80CCD1B: 50000, section80D: 25000,
      rentPaid: 30000, homeLoanInterest: 0,
    },
    investments: { 'Mutual Funds': 800000, 'PPF': 300000, 'NPS': 200000, 'Stocks': 150000, 'EPF': 250000 },
    goals: ['retire', 'home', 'wealth', 'tax'],
  },
  {
    id: 'mid_career',
    label: 'Mid-Career',
    tagline: '35 · Delhi · 32L',
    icon: TrendingUp,
    color: 'gold',
    profile: {
      age: 35, city: 'Delhi', income: 3200000,
      retireAge: 50, targetMonthlyExpense: 125000, monthlySipCurrent: 50000,
      declaredLifeCover: 10000000, section80C: 150000, section80CCD1B: 50000, section80D: 50000,
      rentPaid: 0, homeLoanInterest: 200000,
    },
    investments: { 'Mutual Funds': 2500000, 'PPF': 800000, 'NPS': 500000, 'Fixed Deposits': 1000000, 'Stocks': 600000, 'EPF': 900000, 'Real Estate': 5000000, 'Gold': 300000 },
    goals: ['retire', 'child', 'wealth', 'tax'],
  },
  {
    id: 'senior',
    label: 'Senior Executive',
    tagline: '48 · Pune · 55L',
    icon: Landmark,
    color: 'purple',
    profile: {
      age: 48, city: 'Pune', income: 5500000,
      retireAge: 55, targetMonthlyExpense: 200000, monthlySipCurrent: 100000,
      declaredLifeCover: 20000000, section80C: 150000, section80CCD1B: 50000, section80D: 75000,
      rentPaid: 0, homeLoanInterest: 0,
    },
    investments: { 'Mutual Funds': 8000000, 'PPF': 1500000, 'NPS': 1000000, 'Fixed Deposits': 3000000, 'Stocks': 2000000, 'EPF': 3000000, 'Real Estate': 15000000, 'Gold': 1000000 },
    goals: ['retire', 'child', 'tax'],
  },
  {
    id: 'retiree',
    label: 'Near-Retirement',
    tagline: '58 · Chennai · 25L',
    icon: Heart,
    color: 'orange',
    profile: {
      age: 58, city: 'Chennai', income: 2500000,
      retireAge: 60, targetMonthlyExpense: 100000, monthlySipCurrent: 30000,
      declaredLifeCover: 15000000, section80C: 150000, section80CCD1B: 50000, section80D: 100000,
      rentPaid: 0, homeLoanInterest: 0,
    },
    investments: { 'Mutual Funds': 5000000, 'PPF': 2000000, 'NPS': 1500000, 'Fixed Deposits': 5000000, 'EPF': 4000000, 'Gold': 500000 },
    goals: ['retire', 'wealth', 'tax'],
  },
];

// ───────── component ─────────
export function Onboarding({ step, nextStep, prevStep, profile, setProfile, uploadedDocs, setUploadedDocs }: OnboardingProps) {
  const [goals, setGoals] = useState<string[]>(profile.goals);
  const [selectedInvestments, setSelectedInvestments] = useState<Record<string, boolean>>({});
  const [investmentValues, setInvestmentValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPassword, setUploadPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showDocHelp, setShowDocHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePersona, setActivePersona] = useState<string | null>(null);

  const getError = (field: string) => errors.find(e => e.field === field)?.message;

  // ── Apply a preset persona across all steps ──
  const applyPersona = (persona: Persona) => {
    const isDeselect = activePersona === persona.id;
    setActivePersona(isDeselect ? null : persona.id);
    if (isDeselect) return; // just deselect, keep current values

    // Step 1: profile fields
    setProfile(p => ({ ...p, ...persona.profile }));
    setErrors([]);

    // Step 2: investments
    const invMap: Record<string, boolean> = {};
    const valMap: Record<string, string> = {};
    for (const [type, value] of Object.entries(persona.investments)) {
      invMap[type] = true;
      valMap[type] = formatIndianNumber(value);
    }
    setSelectedInvestments(invMap);
    setInvestmentValues(valMap);

    // Step 3: goals
    setGoals(persona.goals);
    setProfile(p => ({ ...p, goals: persona.goals }));
  };

  // ── Step 1: validate & auto-detect metro ──
  const handleStep1Continue = () => {
    const errs = validateStep1(profile);
    setErrors(errs);
    if (errs.length === 0) {
      const metroCities = ['mumbai', 'delhi', 'bengaluru', 'bangalore', 'kolkata', 'chennai', 'hyderabad', 'pune', 'new delhi', 'ncr', 'gurgaon', 'gurugram', 'noida'];
      const isMetro = metroCities.some(c => profile.city.toLowerCase().includes(c));
      // Estimate base salary as ~83% of income (income = base + HRA roughly)
      const estimatedBase = Math.round(profile.income * 0.833);
      const estimatedHra = profile.income - estimatedBase;
      setProfile(p => ({
        ...p,
        isMetro,
        baseSalary: estimatedBase,
        hraReceived: estimatedHra,
        // Default target monthly expense: ~50% of monthly income
        targetMonthlyExpense: p.targetMonthlyExpense || Math.round(profile.income / 24),
      }));
      nextStep();
    }
  };

  // ── Step 2: investments ──
  const toggleInvestment = (type: string) => {
    setSelectedInvestments(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const updateInvestmentValue = (type: string, value: string) => {
    setInvestmentValues(prev => ({ ...prev, [type]: value }));
  };

  const handleInvestmentContinue = () => {
    const investments = Object.entries(selectedInvestments)
      .filter(([_, selected]) => selected)
      .map(([type]) => ({
        type,
        value: parseIndianNumber(investmentValues[type] || '0')
      }));
    const errs = validateStep2(investments);
    setErrors(errs);
    if (errs.length > 0) return;

    // Derive default 80C from PPF + ELSS holdings
    const ppfVal = investments.find(i => i.type === 'PPF')?.value || 0;
    const npsVal = investments.find(i => i.type === 'NPS')?.value || 0;
    setProfile(p => ({
      ...p,
      investments,
      section80C: Math.min(ppfVal > 0 ? 150000 : 0, 150000), // If they have PPF, assume maxed 80C
      section80CCD1B: npsVal > 0 ? 50000 : 0,
    }));
    nextStep();
  };

  // ── Step 3: goals ──
  const toggleGoal = (goal: string) => {
    setGoals((prev) => {
      const updated = prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal];
      setProfile(p => ({ ...p, goals: updated }));
      return updated;
    });
  };

  // ── Step 4: file upload (multi-document) ──
  const DOCUMENT_TYPES = [
    { id: 'cams', label: 'CAMS / KFintech Statement', module: 'Portfolio X-Ray', desc: 'Your consolidated mutual fund account statement (PDF from CAMS or KFintech). Contains NAVs, units, transactions.', formats: 'PDF' },
    { id: 'form16', label: 'Form 16', module: 'Tax Wizard', desc: 'Annual tax certificate from your employer (Part A + Part B). Contains salary breakup, TDS, deductions.', formats: 'PDF' },
    { id: 'bankstmt', label: 'Bank Statement', module: 'FIRE Roadmap', desc: 'Recent 6-12 month bank statement showing expenses, SIP debits, and income credits.', formats: 'PDF, CSV' },
    { id: 'demat', label: 'Demat Holding Statement', module: 'Portfolio X-Ray', desc: 'NSDL/CDSL holding statement for equity and bond holdings outside mutual funds.', formats: 'PDF' },
    { id: 'insurance', label: 'Insurance Policy Summary', module: 'FIRE Roadmap', desc: 'Life/health insurance policy documents showing sum assured and premiums.', formats: 'PDF' },
  ];

  function detectDocType(file: File): string {
    const name = file.name.toLowerCase();
    if (name.includes('cams') || name.includes('kfintech') || name.includes('cas')) return 'cams';
    if (name.includes('form16') || name.includes('form-16') || name.includes('form 16')) return 'form16';
    if (name.includes('bank') || name.includes('statement')) return 'bankstmt';
    if (name.includes('demat') || name.includes('nsdl') || name.includes('cdsl')) return 'demat';
    if (name.includes('insurance') || name.includes('policy')) return 'insurance';
    return 'cams'; // default
  }

  // Map frontend docType to backend DocumentType (only parsable types)
  function mapToBackendType(docType: string): 'cas' | 'form16' | 'payslip' | null {
    if (docType === 'cams') return 'cas';
    if (docType === 'form16') return 'form16';
    if (docType === 'payslip') return 'payslip';
    return null; // bankstmt, demat, insurance not yet supported
  }

  const [expandedPreviews, setExpandedPreviews] = useState<Record<number, boolean>>({});

  const parseDocument = useCallback(async (index: number) => {
    const doc = uploadedDocs[index];
    if (!doc) return;
    const backendType = mapToBackendType(doc.docType);
    if (!backendType) return; // unsupported type

    // Set uploading status
    setUploadedDocs(prev => prev.map((d, i) => i === index ? { ...d, parseStatus: 'uploading' as const, parseError: undefined } : d));

    try {
      const formData = new FormData();
      formData.append('file', doc.file);
      formData.append('type', backendType);

      setUploadedDocs(prev => prev.map((d, i) => i === index ? { ...d, parseStatus: 'parsing' as const } : d));

      const res = await fetch('/api/v2/parse-document', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const parsed = await res.json();
      setUploadedDocs(prev => prev.map((d, i) => i === index ? { ...d, parseStatus: 'done' as const, parsedData: parsed } : d));
    } catch (err) {
      setUploadedDocs(prev => prev.map((d, i) => i === index ? {
        ...d,
        parseStatus: 'error' as const,
        parseError: err instanceof Error ? err.message : 'Parsing failed',
      } : d));
    }
  }, [uploadedDocs, setUploadedDocs]);

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        processFile(files[i]);
      }
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        processFile(files[i]);
      }
    }
  };

  const processFile = (file: File) => {
    const validTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.csv')) {
      setErrors([{ field: 'file', message: 'Please upload a PDF or CSV file (CAMS, KFintech, Form 16, or bank statement)' }]);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrors([{ field: 'file', message: 'File is too large. Maximum size is 25MB.' }]);
      return;
    }
    setErrors([]);
    const docType = detectDocType(file);
    setUploadedDocs(prev => [...prev, { file, docType }]);
    setUploadedFile(file); // Keep legacy compat
    setShowPasswordInput(true);
  };

  const removeUploadedFile = (index: number) => {
    setUploadedDocs(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
        setUploadedFile(null);
        setShowPasswordInput(false);
      }
      return updated;
    });
  };

  const updateDocType = (index: number, newType: string) => {
    setUploadedDocs(prev => prev.map((item, i) => i === index ? { ...item, docType: newType } : item));
  };

  const handleUploadContinue = async () => {
    // Find parsable docs that haven't been parsed yet
    const parsableIndices = uploadedDocs
      .map((doc, i) => ({ doc, i }))
      .filter(({ doc }) => mapToBackendType(doc.docType) !== null && doc.parseStatus !== 'done');

    if (parsableIndices.length > 0) {
      // Parse all parsable docs in parallel
      await Promise.all(parsableIndices.map(({ i }) => parseDocument(i)));
    }

    nextStep();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-3xl mx-auto w-full">
      {step > 0 && step < 5 && (
        <div className="absolute top-8 left-0 right-0 flex justify-center gap-2 px-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 max-w-16 rounded-full transition-all duration-500",
                step >= i ? "bg-gold-500" : "bg-navy-800"
              )}
            />
          ))}
        </div>
      )}

      {/* ═══════════ STEP 0: Hero ═══════════ */}
      {step === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="text-center space-y-8"
        >
          <div className="space-y-4 relative">
            <motion.div
              className="absolute inset-0 -z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gold-500/10 rounded-full blur-2xl animate-pulse" />
            </motion.div>
            <motion.h1
              className="text-6xl md:text-8xl font-extrabold tracking-tight text-white"
              initial={{ letterSpacing: '0.2em', opacity: 0 }}
              animate={{ letterSpacing: '-0.02em', opacity: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            >
              ArthaGPT
            </motion.h1>
            <motion.p
              className="text-xl md:text-2xl text-slate-400 font-light"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              Your money. Finally understood.
            </motion.p>
            <motion.p
              className="text-sm text-slate-600 max-w-md mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.8 }}
            >
              AI-powered financial planning — FIRE roadmap, portfolio X-ray, and tax optimisation. Free for every Indian.
            </motion.p>
          </div>
          <motion.button
            onClick={nextStep}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 }}
            className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-medium text-navy-950 bg-gold-500 rounded-full hover:bg-gold-400 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(212,175,55,0.3)]"
          >
            Start my financial review
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>
      )}

      {/* ═══════════ STEP 1: About You ═══════════ */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="w-full space-y-8"
        >
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-white">About you</h2>
            <p className="text-slate-400">Let's start with the basics.</p>
          </div>

          {/* ── Quick-fill persona chips ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold-500" />
              <span className="text-sm font-medium text-gold-500">Quick fill — pick a profile</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PERSONAS.map((persona) => {
                const Icon = persona.icon;
                const isActive = activePersona === persona.id;
                return (
                  <button
                    key={persona.id}
                    onClick={() => applyPersona(persona)}
                    className={cn(
                      "relative p-3 rounded-xl border text-left transition-all duration-200 group",
                      isActive
                        ? "border-gold-500 bg-gold-500/10 shadow-[0_0_20px_rgba(212,175,55,0.15)]"
                        : "border-navy-700 bg-navy-900/80 hover:border-gold-500/40 hover:bg-navy-800/80"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-gold-500" : "text-slate-400 group-hover:text-slate-300")} />
                      <span className={cn("text-xs font-semibold truncate", isActive ? "text-white" : "text-slate-300")}>{persona.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{persona.tagline}</p>
                    {isActive && (
                      <motion.div
                        layoutId="persona-ring"
                        className="absolute inset-0 rounded-xl border-2 border-gold-500 pointer-events-none"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {activePersona && (
              <p className="text-[10px] text-slate-600 text-center">Fields pre-filled — edit any value below. Investments and goals also set.</p>
            )}
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Age</label>
              <input
                type="number"
                placeholder="e.g. 34"
                min={18}
                max={80}
                value={profile.age || ''}
                onChange={(e) => {
                  setErrors(prev => prev.filter(er => er.field !== 'age'));
                  setProfile(p => ({ ...p, age: clamp(parseInt(e.target.value) || 0, 0, 100) }));
                }}
                className={cn(
                  "w-full bg-navy-900 border rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/50",
                  getError('age') ? "border-coral-500" : "border-navy-700"
                )}
              />
              {getError('age') && <p className="text-xs text-coral-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{getError('age')}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">City</label>
              <input
                type="text"
                placeholder="e.g. Bengaluru"
                value={profile.city}
                onChange={(e) => {
                  setErrors(prev => prev.filter(er => er.field !== 'city'));
                  setProfile(p => ({ ...p, city: e.target.value }));
                }}
                className={cn(
                  "w-full bg-navy-900 border rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/50",
                  getError('city') ? "border-coral-500" : "border-navy-700"
                )}
              />
              {getError('city') && <p className="text-xs text-coral-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{getError('city')}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Annual Income (CTC / Gross — ₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. 24,00,000"
                  value={profile.income ? formatIndianNumber(profile.income) : ''}
                  onChange={(e) => {
                    setErrors(prev => prev.filter(er => er.field !== 'income'));
                    setProfile(p => ({ ...p, income: parseIndianNumber(e.target.value) }));
                  }}
                  className={cn(
                    "w-full bg-navy-900 border rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/50",
                    getError('income') ? "border-coral-500" : "border-navy-700"
                  )}
                />
              </div>
              {getError('income') && <p className="text-xs text-coral-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{getError('income')}</p>}
            </div>
          </div>

          {errors.length > 0 && (
            <div className="p-3 rounded-lg bg-coral-500/10 border border-coral-500/30">
              <p className="text-sm text-coral-400">Please fix the errors above to continue.</p>
            </div>
          )}

          <button onClick={handleStep1Continue} className="w-full py-4 bg-white text-navy-950 rounded-xl font-medium hover:bg-slate-100 transition-colors">
            Continue
          </button>
          <button onClick={prevStep} className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        </motion.div>
      )}

      {/* ═══════════ STEP 2: Investments ═══════════ */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="w-full space-y-8"
        >
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-white">Your investments</h2>
            <p className="text-slate-400">Select what you hold and enter approximate values.</p>
          </div>

          {activePersona && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gold-500/5 border border-gold-500/20">
              <Zap className="w-4 h-4 text-gold-500 shrink-0" />
              <p className="text-xs text-slate-400">Pre-filled from <span className="text-gold-500 font-medium">{PERSONAS.find(p => p.id === activePersona)?.label}</span> profile. Edit or continue.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {['Mutual Funds', 'PPF', 'NPS', 'Fixed Deposits', 'Stocks', 'EPF', 'Real Estate', 'Gold'].map((item) => {
              const isSelected = selectedInvestments[item];
              const err = getError(item);
              return (
                <div key={item} onClick={() => toggleInvestment(item)} className={cn(
                  "p-4 rounded-xl border cursor-pointer transition-colors group",
                  isSelected ? "border-gold-500/50 bg-gold-500/5" : "border-navy-700 bg-navy-900 hover:border-gold-500/30",
                  err ? "border-coral-500" : ""
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-200">{item}</span>
                    <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                      isSelected ? "border-gold-500 bg-gold-500" : "border-slate-600 group-hover:border-gold-500"
                    )}>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-navy-950" />}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="border-t border-navy-700 pt-2 mt-2">
                      <div className="relative">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                        <input
                          type="text"
                          placeholder="Value"
                          value={investmentValues[item] || ''}
                          onChange={(e) => { e.stopPropagation(); updateInvestmentValue(item, e.target.value); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none pl-4"
                        />
                      </div>
                    </div>
                  )}
                  {err && <p className="text-[10px] text-coral-500 mt-1">{err}</p>}
                </div>
              );
            })}
          </div>

          <button onClick={handleInvestmentContinue} className="w-full py-4 bg-white text-navy-950 rounded-xl font-medium hover:bg-slate-100 transition-colors">
            Continue
          </button>
          <div className="flex gap-3">
            <button onClick={prevStep} className="flex-1 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <button onClick={() => { setProfile(p => ({ ...p, investments: [] })); nextStep(); }} className="flex-1 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors">
              I don't have investments yet — skip
            </button>
          </div>
        </motion.div>
      )}

      {/* ═══════════ STEP 3: Goals ═══════════ */}
      {step === 3 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="w-full space-y-8"
        >
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-white">Your goals</h2>
            <p className="text-slate-400">Select all that apply. We'll customise your plan.</p>
          </div>

          {activePersona && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gold-500/5 border border-gold-500/20">
              <Zap className="w-4 h-4 text-gold-500 shrink-0" />
              <p className="text-xs text-slate-400">Goals and retirement details pre-filled from <span className="text-gold-500 font-medium">{PERSONAS.find(p => p.id === activePersona)?.label}</span>. Edit or continue.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'retire', label: 'Retire Early', icon: Briefcase },
              { id: 'child', label: "Child's Education", icon: GraduationCap },
              { id: 'home', label: 'Buy a Home', icon: Home },
              { id: 'wealth', label: 'Wealth Building', icon: TrendingUp },
              { id: 'tax', label: 'Tax Optimisation', icon: ShieldCheck },
            ].map((goal) => {
              const isSelected = goals.includes(goal.id);
              const Icon = goal.icon;
              return (
                <div
                  key={goal.id}
                  onClick={() => toggleGoal(goal.id)}
                  className={cn(
                    "relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col items-center text-center gap-3",
                    isSelected ? "border-gold-500 bg-gold-500/10" : "border-navy-700 bg-navy-900 hover:border-slate-500"
                  )}
                >
                  {isSelected && (
                    <motion.div layoutId="ring" className="absolute inset-0 rounded-2xl border-2 border-gold-500" />
                  )}
                  <Icon className={cn("w-8 h-8", isSelected ? "text-gold-500" : "text-slate-400")} />
                  <span className={cn("font-medium", isSelected ? "text-white" : "text-slate-300")}>{goal.label}</span>
                </div>
              );
            })}
          </div>

          {goals.length === 0 && (
            <p className="text-sm text-slate-500 text-center">Select at least one goal, or skip to see all modules.</p>
          )}

          {/* ── FIRE / Retirement Inputs ── */}
          <div className="space-y-4 p-6 rounded-2xl bg-navy-900/50 border border-navy-800">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Retirement & Lifestyle Details</h3>
            <p className="text-xs text-slate-500">These power the Monte Carlo simulation and insurance gap analysis.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Target Retirement Age</label>
                <input
                  type="number"
                  min={profile.age + 1 || 30}
                  max={80}
                  placeholder="e.g. 50"
                  value={profile.retireAge || ''}
                  onChange={(e) => setProfile(p => ({ ...p, retireAge: clamp(parseInt(e.target.value) || 0, 0, 85) }))}
                  className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-gold-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Monthly Expense in Retirement (₹)</label>
                <input
                  type="text"
                  placeholder="e.g. 1,00,000"
                  value={profile.targetMonthlyExpense ? formatIndianNumber(profile.targetMonthlyExpense) : ''}
                  onChange={(e) => setProfile(p => ({ ...p, targetMonthlyExpense: parseIndianNumber(e.target.value) }))}
                  className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-gold-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Current Monthly SIP (₹)</label>
                <input
                  type="text"
                  placeholder="e.g. 25,000"
                  value={profile.monthlySipCurrent ? formatIndianNumber(profile.monthlySipCurrent) : ''}
                  onChange={(e) => setProfile(p => ({ ...p, monthlySipCurrent: parseIndianNumber(e.target.value) }))}
                  className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-gold-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Life Insurance Cover (₹)</label>
                <input
                  type="text"
                  placeholder="e.g. 1,00,00,000"
                  value={profile.declaredLifeCover ? formatIndianNumber(profile.declaredLifeCover) : ''}
                  onChange={(e) => setProfile(p => ({ ...p, declaredLifeCover: parseIndianNumber(e.target.value) }))}
                  className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-gold-500/50"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-600">Leave any field blank to use smart defaults (e.g. monthly expense = 50% of take-home).</p>
            {profile.retireAge > 0 && profile.age > 0 && profile.retireAge <= profile.age && (
              <p className="text-xs text-coral-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Retirement age must be greater than your current age ({profile.age}).</p>
            )}
            {profile.retireAge > 0 && profile.age > 0 && profile.retireAge > profile.age && (
              <p className="text-[10px] text-teal-500 mt-1">
                🎯 {profile.retireAge - profile.age} years to FIRE — {profile.targetMonthlyExpense > 0 ? `targeting ₹${formatIndianNumber(profile.targetMonthlyExpense)}/mo` : "we\u2019ll estimate your expenses"}
              </p>
            )}
          </div>

          <button
            onClick={() => {
              if (goals.length === 0) {
                setProfile(p => ({ ...p, goals: ['retire', 'tax', 'wealth'] }));
              }
              nextStep();
            }}
            className="w-full py-4 bg-white text-navy-950 rounded-xl font-medium hover:bg-slate-100 transition-colors"
          >
            {goals.length > 0 ? 'Continue' : 'Show me everything'}
          </button>
          <button onClick={prevStep} className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        </motion.div>
      )}

      {/* ═══════════ STEP 4: Upload ═══════════ */}
      {step === 4 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="w-full space-y-6"
        >
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-white">Upload your documents</h2>
            <p className="text-slate-400">Upload one or more documents for each module. We'll auto-route them.</p>
          </div>

          {/* Document help toggle */}
          <button
            onClick={() => setShowDocHelp(!showDocHelp)}
            className="flex items-center gap-2 text-sm text-gold-500 hover:text-gold-400 transition-colors"
          >
            <Info className="w-4 h-4" />
            {showDocHelp ? 'Hide document guide' : 'Which documents do I need?'}
          </button>

          {showDocHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              {DOCUMENT_TYPES.map((doc) => (
                <div key={doc.id} className="p-4 rounded-xl bg-navy-900 border border-navy-700">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-gold-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-white text-sm">{doc.label}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 font-medium">{doc.module}</span>
                        <span className="text-[10px] text-slate-600">{doc.formats}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{doc.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer bg-navy-900/50 transition-all duration-300 group",
              isDragging ? "border-gold-500 bg-gold-500/5 scale-[1.02]" : "border-navy-700 hover:border-gold-500/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all",
              isDragging ? "bg-gold-500/20 scale-110" : "bg-navy-800 group-hover:scale-110"
            )}>
              <UploadCloud className="w-7 h-7 text-gold-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              {isDragging ? 'Drop files here!' : 'Drag & drop your files here'}
            </h3>
            <p className="text-sm text-slate-400 max-w-xs">
              Supports multiple files — CAMS PDF, Form 16, bank statements, insurance docs. Max 25MB each.
            </p>
            {getError('file') && (
              <p className="text-sm text-coral-500 mt-3 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />{getError('file')}
              </p>
            )}
          </div>

          {/* Uploaded files list */}
          {uploadedDocs.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">{uploadedDocs.length} document{uploadedDocs.length > 1 ? 's' : ''} uploaded</p>
              {uploadedDocs.map((item, idx) => {
                const isParsable = mapToBackendType(item.docType) !== null;
                return (
                <div key={idx} className="rounded-2xl bg-navy-900 border border-teal-500/30 overflow-hidden">
                  <div className="p-4 flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      item.parseStatus === 'done' ? "bg-teal-500/10" :
                      item.parseStatus === 'error' ? "bg-coral-500/10" :
                      "bg-teal-500/10"
                    )}>
                      {(item.parseStatus === 'uploading' || item.parseStatus === 'parsing') ? (
                        <Loader2 className="w-5 h-5 text-gold-500 animate-spin" />
                      ) : item.parseStatus === 'done' ? (
                        <CheckCircle2 className="w-5 h-5 text-teal-500" />
                      ) : item.parseStatus === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-coral-500" />
                      ) : (
                        <FileText className="w-5 h-5 text-teal-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white text-sm truncate">{item.file.name}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-slate-400">{(item.file.size / 1024).toFixed(0)} KB</p>
                        {item.parseStatus === 'uploading' && <p className="text-[10px] text-gold-500">Uploading...</p>}
                        {item.parseStatus === 'parsing' && <p className="text-[10px] text-gold-500">AI parsing...</p>}
                        {item.parseStatus === 'done' && item.parsedData && (
                          <p className="text-[10px] text-teal-500">Parsed ({Math.round(item.parsedData.confidence * 100)}% confidence)</p>
                        )}
                        {item.parseStatus === 'error' && <p className="text-[10px] text-coral-500">{item.parseError || 'Failed'}</p>}
                        {!isParsable && !item.parseStatus && (
                          <p className="text-[10px] text-slate-500">AI parsing not yet available</p>
                        )}
                      </div>
                    </div>
                    <select
                      value={item.docType}
                      onChange={(e) => updateDocType(idx, e.target.value)}
                      className="text-xs bg-navy-950 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-gold-500"
                    >
                      {DOCUMENT_TYPES.map((dt) => (
                        <option key={dt.id} value={dt.id}>{dt.label}</option>
                      ))}
                    </select>
                    {item.parseStatus === 'done' && item.parsedData && (
                      <button
                        onClick={() => setExpandedPreviews(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        className="p-1.5 rounded-lg hover:bg-navy-800 transition-colors"
                      >
                        {expandedPreviews[idx] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>
                    )}
                    <button
                      onClick={() => removeUploadedFile(idx)}
                      className="p-1.5 rounded-lg hover:bg-navy-800 transition-colors"
                    >
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  {/* Low confidence warning */}
                  {item.parseStatus === 'done' && item.parsedData && item.parsedData.confidence < 0.5 && (
                    <div className="mx-4 mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-[11px] text-amber-400">Low confidence extraction — please verify the data below</p>
                    </div>
                  )}

                  {/* Parsed data preview (collapsible) */}
                  {item.parseStatus === 'done' && item.parsedData && expandedPreviews[idx] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 pb-4 border-t border-navy-800 pt-3"
                    >
                      {item.parsedData.type === 'cas' && (() => {
                        const data = item.parsedData!.data as { investorName?: string; pan?: string; funds?: { fundName: string; currentValue: number }[] };
                        return (
                          <div className="space-y-2 text-xs">
                            <p className="text-slate-300">
                              <span className="text-slate-500">Investor:</span> {data.investorName || '—'}
                              {data.pan && <span className="text-slate-500 ml-3">PAN: {data.pan}</span>}
                            </p>
                            <p className="text-teal-400 font-medium">Found {data.funds?.length || 0} fund{(data.funds?.length || 0) !== 1 ? 's' : ''}</p>
                            {data.funds && data.funds.length > 0 && (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {data.funds.slice(0, 5).map((f, fi) => (
                                  <div key={fi} className="flex justify-between text-[10px] py-1 border-b border-navy-800 last:border-0">
                                    <span className="text-slate-400 truncate flex-1 mr-2">{f.fundName}</span>
                                    <span className="text-white font-mono shrink-0">₹{formatIndianNumber(f.currentValue)}</span>
                                  </div>
                                ))}
                                {data.funds.length > 5 && (
                                  <p className="text-[10px] text-slate-500">+ {data.funds.length - 5} more funds</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {item.parsedData.type === 'form16' && (() => {
                        const data = item.parsedData!.data as { employerName?: string; assessmentYear?: string; grossSalary?: number; taxDeducted?: number };
                        return (
                          <div className="space-y-1.5 text-xs">
                            {data.employerName && <p className="text-slate-300"><span className="text-slate-500">Employer:</span> {data.employerName}</p>}
                            {data.assessmentYear && <p className="text-slate-300"><span className="text-slate-500">AY:</span> {data.assessmentYear}</p>}
                            <div className="flex gap-4 mt-1">
                              {data.grossSalary !== undefined && (
                                <p className="text-teal-400 font-medium">Gross Salary: ₹{formatIndianNumber(data.grossSalary)}</p>
                              )}
                              {data.taxDeducted !== undefined && (
                                <p className="text-gold-500 font-medium">TDS: ₹{formatIndianNumber(data.taxDeducted)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      {item.parsedData.type === 'payslip' && (() => {
                        const data = item.parsedData!.data as { month?: string; netSalary?: number; grossSalary?: number };
                        return (
                          <div className="space-y-1.5 text-xs">
                            {data.month && <p className="text-slate-300"><span className="text-slate-500">Month:</span> {data.month}</p>}
                            <div className="flex gap-4 mt-1">
                              {data.netSalary !== undefined && (
                                <p className="text-teal-400 font-medium">Net Salary: ₹{formatIndianNumber(data.netSalary)}</p>
                              )}
                              {data.grossSalary !== undefined && (
                                <p className="text-slate-300">Gross: ₹{formatIndianNumber(data.grossSalary)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </div>
                );
              })}

              {showPasswordInput && (
                <div className="p-4 rounded-xl bg-navy-900 border border-navy-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">PDF Password (if encrypted)</span>
                  </div>
                  <input
                    type="password"
                    placeholder="Leave blank if not password-protected"
                    value={uploadPassword}
                    onChange={(e) => setUploadPassword(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-700 rounded-lg px-4 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/50 text-sm"
                  />
                  <p className="text-[10px] text-slate-600 mt-2">CAMS password is usually your PAN followed by email first 3 chars (e.g. ABCDE1234Fgma)</p>
                </div>
              )}
            </div>
          )}

          {(() => {
            const parsableDocs = uploadedDocs.filter(d => mapToBackendType(d.docType) !== null);
            const parsedCount = parsableDocs.filter(d => d.parseStatus === 'done').length;
            const parsingInProgress = parsableDocs.some(d => d.parseStatus === 'uploading' || d.parseStatus === 'parsing');
            const allParsed = parsableDocs.length > 0 && parsedCount === parsableDocs.length;

            let buttonText: string;
            if (uploadedDocs.length === 0) {
              buttonText = 'Continue without upload';
            } else if (parsingInProgress) {
              buttonText = `Parsing... (${parsedCount}/${parsableDocs.length} done)`;
            } else if (allParsed) {
              buttonText = 'Continue with extracted data';
            } else if (parsableDocs.length > 0) {
              buttonText = `Parse & Analyse ${uploadedDocs.length} document${uploadedDocs.length > 1 ? 's' : ''}`;
            } else {
              buttonText = `Analyse ${uploadedDocs.length} document${uploadedDocs.length > 1 ? 's' : ''}`;
            }

            return (
              <button
                onClick={handleUploadContinue}
                disabled={parsingInProgress}
                className={cn(
                  "w-full py-4 rounded-xl font-medium transition-colors",
                  parsingInProgress
                    ? "bg-navy-700 text-slate-400 cursor-not-allowed"
                    : "bg-white text-navy-950 hover:bg-slate-100"
                )}
              >
                {parsingInProgress && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                {buttonText}
              </button>
            );
          })()}

          {uploadedDocs.length === 0 && (
            <div className="text-center">
              <button onClick={nextStep} className="text-sm text-slate-500 hover:text-slate-300 underline underline-offset-4">
                I'll do this later — use demo data
              </button>
            </div>
          )}
          <button onClick={prevStep} className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        </motion.div>
      )}
    </div>
  );
}
