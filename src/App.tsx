import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Onboarding } from './components/Onboarding';
import { Loading } from './components/Loading';
import { Dashboard } from './components/Dashboard';

export interface UserProfile {
  age: number;
  city: string;
  income: number;
  investments: { type: string; value: number }[];
  goals: string[];
  retireAge: number;
  // Tax-specific inputs
  baseSalary: number;
  hraReceived: number;
  rentPaid: number;
  section80C: number;
  section80CCD1B: number;
  section80D: number;
  homeLoanInterest: number;
  isMetro: boolean;
  // FIRE-specific
  targetMonthlyExpense: number;
  declaredLifeCover: number;
  monthlySipCurrent: number;
}

const defaultProfile: UserProfile = {
  age: 0,
  city: '',
  income: 0,
  investments: [],
  goals: [],
  retireAge: 50,
  baseSalary: 0,
  hraReceived: 0,
  rentPaid: 0,
  section80C: 0,
  section80CCD1B: 0,
  section80D: 0,
  homeLoanInterest: 0,
  isMetro: true,
  targetMonthlyExpense: 0,
  declaredLifeCover: 0,
  monthlySipCurrent: 0,
};

export default function App() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);

  const nextStep = () => setStep((s) => s + 1);
  const handleLoadingComplete = useCallback(() => setStep(6), []);

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 font-sans selection:bg-gold-500/30">
      <AnimatePresence mode="wait">
        {step < 5 && (
          <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Onboarding step={step} nextStep={nextStep} profile={profile} setProfile={setProfile} />
          </motion.div>
        )}
        {step === 5 && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Loading onComplete={handleLoadingComplete} />
          </motion.div>
        )}
        {step === 6 && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Dashboard profile={profile} setProfile={setProfile} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
