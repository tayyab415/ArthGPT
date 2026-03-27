import { motion } from 'motion/react';
import { ArrowRight, UploadCloud, CheckCircle2, IndianRupee, Briefcase, Home, GraduationCap, TrendingUp, ShieldCheck, AlertCircle, X, FileText, Lock } from 'lucide-react';
import { useState, useRef, type Dispatch, type SetStateAction, type DragEvent, type ChangeEvent } from 'react';
import { cn } from '../lib/utils';
import type { UserProfile } from '../App';

interface OnboardingProps {
  step: number;
  nextStep: () => void;
  profile: UserProfile;
  setProfile: Dispatch<SetStateAction<UserProfile>>;
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

// ───────── component ─────────
export function Onboarding({ step, nextStep, profile, setProfile }: OnboardingProps) {
  const [goals, setGoals] = useState<string[]>(profile.goals);
  const [selectedInvestments, setSelectedInvestments] = useState<Record<string, boolean>>({});
  const [investmentValues, setInvestmentValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPassword, setUploadPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getError = (field: string) => errors.find(e => e.field === field)?.message;

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

  // ── Step 4: file upload ──
  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    const validTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.csv')) {
      setErrors([{ field: 'file', message: 'Please upload a PDF or CSV file (CAMS, KFintech, or Form 16)' }]);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrors([{ field: 'file', message: 'File is too large. Maximum size is 25MB.' }]);
      return;
    }
    setErrors([]);
    setUploadedFile(file);
    setShowPasswordInput(true);
  };

  const handleUploadContinue = () => {
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
          <button onClick={() => { setProfile(p => ({ ...p, investments: [] })); nextStep(); }} className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors">
            I don't have investments yet — skip
          </button>
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
        </motion.div>
      )}

      {/* ═══════════ STEP 4: Upload ═══════════ */}
      {step === 4 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="w-full space-y-8"
        >
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-white">Upload your statements</h2>
            <p className="text-slate-400">For precise analysis, upload your CAMS/KFintech PDF or Form 16.</p>
          </div>

          {!uploadedFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer bg-navy-900/50 transition-all duration-300 group",
                isDragging ? "border-gold-500 bg-gold-500/5 scale-[1.02]" : "border-navy-700 hover:border-gold-500/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-all",
                isDragging ? "bg-gold-500/20 scale-110" : "bg-navy-800 group-hover:scale-110"
              )}>
                <UploadCloud className="w-8 h-8 text-gold-500" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">
                {isDragging ? 'Drop it here!' : 'Drag & drop your PDF here'}
              </h3>
              <p className="text-sm text-slate-400 max-w-xs">
                Supports CAMS PDF, KFintech PDF, Form 16, and CSV exports. Max 25MB.
              </p>
              {getError('file') && (
                <p className="text-sm text-coral-500 mt-4 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />{getError('file')}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-navy-900 border border-teal-500/30 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-teal-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">{uploadedFile.name}</h4>
                  <p className="text-xs text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB • {uploadedFile.name.split('.').pop()?.toUpperCase()}</p>
                </div>
                <button
                  onClick={() => { setUploadedFile(null); setShowPasswordInput(false); setErrors([]); }}
                  className="p-2 rounded-lg hover:bg-navy-800 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

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

          <button
            onClick={handleUploadContinue}
            className="w-full py-4 bg-white text-navy-950 rounded-xl font-medium hover:bg-slate-100 transition-colors"
          >
            {uploadedFile ? 'Analyse my finances' : 'Continue without upload'}
          </button>

          {!uploadedFile && (
            <div className="text-center">
              <button onClick={nextStep} className="text-sm text-slate-500 hover:text-slate-300 underline underline-offset-4">
                I'll do this later — use demo data
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
