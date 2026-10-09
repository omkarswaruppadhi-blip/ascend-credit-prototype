import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  CreditCard,
  Lock,
  Unlock,
  Calendar,
  ChevronRight,
  Info,
  Clock,
  Flame,
  Zap,
  BookOpen,
  Layers,
  Wallet,
  PlusCircle,
  X,
  PiggyBank,
  HelpCircle,
  Award,
  ChevronDown,
  Check,
  Sliders,
  AlertTriangle,
  Activity,
  BarChart3,
  FileCheck,
  Crown,
  ChevronUp,
  FileText
} from 'lucide-react';

const STORAGE_KEY = 'ascend_fintech_state_v7';

const FD_TENURE_OPTIONS = [
  { months: 3, rate: 5.5, label: '3 Months (5.50% p.a.)' },
  { months: 6, rate: 6.25, label: '6 Months (6.25% p.a.)' },
  { months: 12, rate: 6.85, label: '12 Months (6.85% p.a.)' },
  { months: 24, rate: 7.1, label: '24 Months (7.10% p.a.)' }
];

const DEFAULT_USER = {
  name: '',
  age: '',
  city: '',
  monthlyIncome: ''
};

const DEFAULT_STAGE1 = {
  targetAmount: 600,
  timelineValue: 30,
  timelineDays: 30,
  frequency: 'daily',
  contributionAmount: 20,
  currentDay: 0,
  streakPoints: 0,
  totalSaved: 0,
  todayCompleted: false,
  completed: false
};

const INITIAL_APP_STATE = {
  user: DEFAULT_USER,
  stage: 0, // 0: onboarding, 1: savings, 2: secured card, 3: unsecured card, 4: premium card
  stage1: DEFAULT_STAGE1,
  fds: [],
  cardIssued: false,
  // Bureau & Multi-card progression state
  bureau: {
    status: 'no_score', // 'no_score' | 'generated'
    monthsReported: 1, // 1 to 6 until first score
    cibilScore: null, // null until generated, starts ~550
    onTimeCycles: 0,
    unsecuredCardIssued: false,
    unsecuredCardPending: false,
    premiumCardIssued: false,
    premiumCardPending: false
  },
  cardSim: {
    activeLimit: 2000,
    spentAmount: 500,
    daysUntilDue: 18,
    limitIncreasePending: false,
    requestedLimit: 2000
  },
  unsecuredSim: {
    activeLimit: 5000,
    spentAmount: 1200,
    daysUntilDue: 22
  },
  premiumSim: {
    activeLimit: 25000,
    spentAmount: 4500,
    daysUntilDue: 25
  }
};

const getFrequencyLabel = (freq) => {
  if (freq === 'weekly') return 'week';
  if (freq === 'monthly') return 'month';
  return 'day';
};

const getFrequencyUnit = (freq, count) => {
  const isPlural = count !== 1;
  if (freq === 'weekly') return isPlural ? 'weeks' : 'week';
  if (freq === 'monthly') return isPlural ? 'months' : 'month';
  return isPlural ? 'days' : 'day';
};

const getPresetsForFrequency = (freq) => {
  if (freq === 'weekly') return [4, 8, 12];
  if (freq === 'monthly') return [1, 3, 6];
  return [30, 60, 90];
};

const getMaxTimelineForFrequency = (freq) => {
  if (freq === 'weekly') return 52;
  if (freq === 'monthly') return 12;
  return 365;
};

const getIntervalCount = (timelineVal, frequency) => {
  const maxLimit = getMaxTimelineForFrequency(frequency);
  return Math.min(maxLimit, Math.max(1, Number(timelineVal) || 1));
};

const getStreakPointsForFrequency = (freq) => {
  if (freq === 'weekly') return 4;
  if (freq === 'monthly') return 10;
  return 1;
};

const getMinimumEnforcedContribution = (freq, isFirstFd = true) => {
  if (!isFirstFd) return 1;
  if (freq === 'weekly') return 140;
  if (freq === 'monthly') return 600;
  return 20;
};

const calculateMinContribution = (target, intervals, freq = 'daily', isFirstFd = true) => {
  if (!intervals || intervals <= 0) return getMinimumEnforcedContribution(freq, isFirstFd);
  const calculated = Math.ceil((target / intervals) * 100) / 100;
  const floor = getMinimumEnforcedContribution(freq, isFirstFd);
  return Math.max(floor, calculated);
};

const formatRupee = (val) => {
  const num = Number(val) || 0;
  return num % 1 === 0
    ? num.toLocaleString('en-IN')
    : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function App() {
  const [appState, setAppState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_APP_STATE,
          ...parsed,
          stage1: {
            ...DEFAULT_STAGE1,
            ...(parsed.stage1 || {})
          },
          bureau: {
            ...INITIAL_APP_STATE.bureau,
            ...(parsed.bureau || {})
          },
          cardSim: {
            ...INITIAL_APP_STATE.cardSim,
            ...(parsed.cardSim || {})
          },
          unsecuredSim: {
            ...INITIAL_APP_STATE.unsecuredSim,
            ...(parsed.unsecuredSim || {})
          },
          premiumSim: {
            ...INITIAL_APP_STATE.premiumSim,
            ...(parsed.premiumSim || {})
          },
          fds: Array.isArray(parsed.fds) ? parsed.fds : []
        };
      }
    } catch {
      // Fallback
    }
    return INITIAL_APP_STATE;
  });

  const [currentScreen, setCurrentScreen] = useState(() => {
    const hasProfile = Boolean(appState.user?.name?.trim());
    if (!hasProfile) return 'welcome';
    if (appState.cardIssued) return 'stage2';
    if (appState.stage === 1) return 'stage1';
    return 'home';
  });

  // Active card tab in Card view (when multiple cards exist)
  const [activeCardTab, setActiveCardTab] = useState('secured'); // 'secured' | 'unsecured' | 'premium'

  // Modals & Popups
  const [showTransitionModal, setShowTransitionModal] = useState(false); // Stage 1 -> 2 (preserved)
  const [showPreStage1Modal, setShowPreStage1Modal] = useState(false); // Onboarding: Cards 1 & 2
  const [showStage2To3Modal, setShowStage2To3Modal] = useState(false); // Stage 2 -> 3: Cards 5 & 6
  const [showStage3ToGradModal, setShowStage3ToGradModal] = useState(false); // Stage 3 -> Graduation: Cards 7 & 8
  const [showProgressionModal, setShowProgressionModal] = useState(false);
  const [showFdModal, setShowFdModal] = useState(false);
  const [showStreakInfoModal, setShowStreakInfoModal] = useState(false);
  const [showIncreaseTargetModal, setShowIncreaseTargetModal] = useState(false);
  const [showLimitIncreaseModal, setShowLimitIncreaseModal] = useState(false);
  const [showUnsecuredApplyModal, setShowUnsecuredApplyModal] = useState(false);
  const [showPremiumApplyModal, setShowPremiumApplyModal] = useState(false);
  const [newTargetInput, setNewTargetInput] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Home Screen active tab ('all' | 'card' | 'savings' | 'cibil')
  const [homeTab, setHomeTab] = useState('all');

  // Limit Increase custom amount selection state
  const [requestedLimitInput, setRequestedLimitInput] = useState(2000);

  // Form states for onboarding
  const [onboardingForm, setOnboardingForm] = useState({
    name: appState.user.name || '',
    age: appState.user.age || '',
    city: appState.user.city || '',
    monthlyIncome: appState.user.monthlyIncome || ''
  });
  const [onboardingError, setOnboardingError] = useState('');

  // Expandable cards state for Home
  const [expandedEdu, setExpandedEdu] = useState({ card1: false, card2: false });

  // Customizer toggles
  const [isCustomTargetOpen, setIsCustomTargetOpen] = useState(
    ![600, 1000, 2000].includes(appState.stage1.targetAmount)
  );
  const [isCustomTimelineOpen, setIsCustomTimelineOpen] = useState(
    !getPresetsForFrequency(appState.stage1.frequency).includes(
      appState.stage1.timelineValue || appState.stage1.timelineDays || 30
    )
  );

  // FD Creation Modal state
  const [fdAllocatedSavings, setFdAllocatedSavings] = useState(0);
  const [fdTopUpAmount, setFdTopUpAmount] = useState(1400);
  const [fdTenureMonths, setFdTenureMonths] = useState(12);
  const [fdModalError, setFdModalError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch {
      // Storage unavailable
    }
  }, [appState]);

  const totalFdsValue = useMemo(() => {
    return (appState.fds || []).reduce((acc, curr) => acc + (Number(curr.principal) || 0), 0);
  }, [appState.fds]);

  const activeCardLimit = useMemo(() => {
    if (!appState.cardIssued) return Math.max(2000, totalFdsValue);
    return appState.cardSim?.activeLimit || (appState.fds.length > 0 ? appState.fds[0].principal : 2000);
  }, [appState.cardIssued, appState.cardSim?.activeLimit, appState.fds, totalFdsValue]);

  const canIncreaseLimit = appState.cardIssued && totalFdsValue > activeCardLimit;

  const activeStreakPts = appState.stage1.streakPoints ?? 0;
  const isStreakComplete = activeStreakPts >= 30;
  const isSavingsTargetReached = (appState.stage1.totalSaved || 0) >= appState.stage1.targetAmount;
  const isSavingsOverflow = (appState.stage1.totalSaved || 0) > appState.stage1.targetAmount;
  const overflowAmount = isSavingsOverflow
    ? Math.round(((appState.stage1.totalSaved || 0) - appState.stage1.targetAmount) * 100) / 100
    : 0;

  const isStage1FullyQualified = isSavingsTargetReached && isStreakComplete;
  const isFdEligible = totalFdsValue >= 2000;
  const hasFirstFd = (appState.fds || []).length > 0;
  const isFirstFdFlow = !hasFirstFd;

  const activeTimelineValue = appState.stage1.timelineValue || appState.stage1.timelineDays || 30;
  const currentIntervals = getIntervalCount(activeTimelineValue, appState.stage1.frequency);
  const numericContribution = Number(appState.stage1.contributionAmount) || 0;
  const enforcedFloor = getMinimumEnforcedContribution(appState.stage1.frequency, isFirstFdFlow);

  const remainingSavings = Math.max(
    0,
    Math.round(((appState.stage1.targetAmount || 600) - (appState.stage1.totalSaved || 0)) * 100) / 100
  );

  const remainingIntervalsNeeded = useMemo(() => {
    if (remainingSavings <= 0) return 0;
    if (numericContribution <= 0) return 0;
    return Math.ceil(remainingSavings / numericContribution);
  }, [remainingSavings, numericContribution]);

  const totalDynamicChecklistSlots = useMemo(() => {
    const logged = appState.stage1.currentDay || 0;
    const computedTotal = logged + remainingIntervalsNeeded;
    return Math.max(computedTotal, currentIntervals, 1);
  }, [appState.stage1.currentDay, remainingIntervalsNeeded, currentIntervals]);

  const isPlanViable =
    numericContribution >= enforcedFloor &&
    (appState.stage1.totalSaved + numericContribution * remainingIntervalsNeeded >= appState.stage1.targetAmount ||
      numericContribution * currentIntervals >= appState.stage1.targetAmount);

  const unitLabel = getFrequencyLabel(appState.stage1.frequency);
  const unitPlural = getFrequencyUnit(appState.stage1.frequency, totalDynamicChecklistSlots);
  const currentPresets = getPresetsForFrequency(appState.stage1.frequency);
  const currentMaxTimeline = getMaxTimelineForFrequency(appState.stage1.frequency);
  const streakPerDeposit = getStreakPointsForFrequency(appState.stage1.frequency);

  const selectedTenureOption =
    FD_TENURE_OPTIONS.find((t) => t.months === Number(fdTenureMonths)) || FD_TENURE_OPTIONS[2];

  const currentCibilScore = useMemo(() => {
    if (!appState.cardIssued) return null;
    if (appState.bureau.status !== 'generated') return null;

    let base = appState.bureau.cibilScore || 550;
    const spent = appState.cardSim.spentAmount || 0;
    const limit = activeCardLimit || 2000;
    const cur = (spent / limit) * 100;
    const due = appState.cardSim.daysUntilDue ?? 18;

    let modifier = 0;
    if (cur <= 15) modifier += 12;
    else if (cur <= 30) modifier += 6;
    else if (cur <= 50) modifier -= 18;
    else if (cur <= 75) modifier -= 35;
    else modifier -= 55;

    if (due === 0) modifier -= 40;
    else if (due <= 3) modifier -= 15;

    return Math.max(300, Math.min(900, Math.round(base + modifier)));
  }, [appState.cardIssued, appState.bureau.status, appState.bureau.cibilScore, appState.cardSim.spentAmount, activeCardLimit, appState.cardSim.daysUntilDue]);

  const canApplyUnsecured = currentCibilScore !== null && currentCibilScore >= 600;
  const canApplyPremium = currentCibilScore !== null && currentCibilScore >= 750;

  const totalCardsCount = useMemo(() => {
    let count = 0;
    if (appState.cardIssued) count += 1;
    if (appState.bureau.unsecuredCardIssued) count += 1;
    if (appState.bureau.premiumCardIssued) count += 1;
    return count;
  }, [appState.cardIssued, appState.bureau.unsecuredCardIssued, appState.bureau.premiumCardIssued]);

  const showToast = (title, subtitle = '') => {
    setToastMessage({ title, subtitle });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleJudgeSkipNoScore = () => {
    const mockFd = {
      id: 'ASCEND-FD-STAGE2-01',
      principal: 2000,
      tenureMonths: 12,
      interestRate: 6.85,
      bookingDate: '01 Oct 2026',
      maturityDate: '01 Oct 2027',
      lienStatus: '100% Lien - Securing Credit Line'
    };

    setAppState((prev) => ({
      ...prev,
      user: {
        name: prev.user.name || 'Aarav Sharma',
        age: prev.user.age || 19,
        city: prev.user.city || 'Pune',
        monthlyIncome: prev.user.monthlyIncome || 6000
      },
      stage: 2,
      cardIssued: true,
      stage1: {
        ...prev.stage1,
        totalSaved: prev.stage1.totalSaved > 0 ? prev.stage1.totalSaved : 600,
        streakPoints: 30,
        completed: true
      },
      fds: prev.fds.length > 0 ? prev.fds : [mockFd],
      bureau: {
        status: 'no_score',
        monthsReported: 1,
        cibilScore: null,
        onTimeCycles: 1,
        unsecuredCardIssued: false,
        premiumCardIssued: false
      },
      cardSim: {
        activeLimit: prev.cardSim.activeLimit || 2000,
        spentAmount: 400,
        daysUntilDue: 18,
        limitIncreasePending: false,
        requestedLimit: 2000
      }
    }));
    setActiveCardTab('secured');
    setCurrentScreen('stage2');
    showToast('⚡ Judge Fast-Track: Stage 2 (No Score Yet)', 'Secured FD Card active • Credit bureau transmission Month 1 of 3-6.');
  };

  const handleJudgeSkipInitialScore = () => {
    const mockFd = {
      id: 'ASCEND-FD-STAGE2-01',
      principal: 2000,
      tenureMonths: 12,
      interestRate: 6.85,
      bookingDate: '01 Jul 2026',
      maturityDate: '01 Jul 2027',
      lienStatus: '100% Lien - Securing Credit Line'
    };

    setAppState((prev) => ({
      ...prev,
      user: {
        name: prev.user.name || 'Aarav Sharma',
        age: prev.user.age || 19,
        city: prev.user.city || 'Pune',
        monthlyIncome: prev.user.monthlyIncome || 6000
      },
      stage: 2,
      cardIssued: true,
      stage1: {
        ...prev.stage1,
        totalSaved: prev.stage1.totalSaved > 0 ? prev.stage1.totalSaved : 600,
        streakPoints: 30,
        completed: true
      },
      fds: prev.fds.length > 0 ? prev.fds : [mockFd],
      bureau: {
        status: 'generated',
        monthsReported: 4,
        cibilScore: 552,
        onTimeCycles: 4,
        unsecuredCardIssued: false,
        premiumCardIssued: false
      },
      cardSim: {
        activeLimit: prev.cardSim.activeLimit || 2000,
        spentAmount: 380,
        daysUntilDue: 18,
        limitIncreasePending: false,
        requestedLimit: 2000
      }
    }));
    setActiveCardTab('secured');
    setCurrentScreen('stage2');
    showToast('⚡ Judge Fast-Track: Initial Score ~552', 'First official 3-digit score generated after 4 months of card repayment.');
  };

  const handleJudgeSkipStage3 = () => {
    const mockFd = {
      id: 'ASCEND-FD-STAGE2-01',
      principal: 2000,
      tenureMonths: 12,
      interestRate: 6.85,
      bookingDate: '01 Apr 2026',
      maturityDate: '01 Apr 2027',
      lienStatus: '100% Lien - Securing Credit Line'
    };

    setAppState((prev) => ({
      ...prev,
      user: {
        name: prev.user.name || 'Aarav Sharma',
        age: prev.user.age || 19,
        city: prev.user.city || 'Pune',
        monthlyIncome: prev.user.monthlyIncome || 6000
      },
      stage: 3,
      cardIssued: true,
      stage1: {
        ...prev.stage1,
        totalSaved: prev.stage1.totalSaved > 0 ? prev.stage1.totalSaved : 600,
        streakPoints: 30,
        completed: true
      },
      fds: prev.fds.length > 0 ? prev.fds : [mockFd],
      bureau: {
        status: 'generated',
        monthsReported: 8,
        cibilScore: 624,
        onTimeCycles: 8,
        unsecuredCardIssued: true,
        premiumCardIssued: false
      },
      cardSim: {
        activeLimit: prev.cardSim.activeLimit || 2000,
        spentAmount: 400,
        daysUntilDue: 18,
        limitIncreasePending: false,
        requestedLimit: 2000
      },
      unsecuredSim: {
        activeLimit: 5000,
        spentAmount: 1100,
        daysUntilDue: 22
      }
    }));
    setActiveCardTab('unsecured');
    setCurrentScreen('stage2');
    showToast('⚡ Judge Fast-Track: Stage 3 (CIBIL 624)', 'Unlocked 2 Cards: ₹2,000 Secured Card + ₹5,000 Unsecured Starter Card!');
  };

  const handleJudgeSkipStage4 = () => {
    const mockFd = {
      id: 'ASCEND-FD-STAGE2-01',
      principal: 2000,
      tenureMonths: 12,
      interestRate: 6.85,
      bookingDate: '01 Jan 2026',
      maturityDate: '01 Jan 2027',
      lienStatus: 'Unpledged / Free Term Deposit'
    };

    setAppState((prev) => ({
      ...prev,
      user: {
        name: prev.user.name || 'Aarav Sharma',
        age: prev.user.age || 19,
        city: prev.user.city || 'Pune',
        monthlyIncome: prev.user.monthlyIncome || 6000
      },
      stage: 4,
      cardIssued: true,
      stage1: {
        ...prev.stage1,
        totalSaved: prev.stage1.totalSaved > 0 ? prev.stage1.totalSaved : 600,
        streakPoints: 30,
        completed: true
      },
      fds: prev.fds.length > 0 ? prev.fds : [mockFd],
      bureau: {
        status: 'generated',
        monthsReported: 14,
        cibilScore: 768,
        onTimeCycles: 14,
        unsecuredCardIssued: true,
        premiumCardIssued: true
      },
      cardSim: {
        activeLimit: prev.cardSim.activeLimit || 2000,
        spentAmount: 250,
        daysUntilDue: 20,
        limitIncreasePending: false,
        requestedLimit: 2000
      },
      unsecuredSim: {
        activeLimit: 5000,
        spentAmount: 1200,
        daysUntilDue: 22
      },
      premiumSim: {
        activeLimit: 25000,
        spentAmount: 4800,
        daysUntilDue: 25
      }
    }));
    setActiveCardTab('premium');
    setCurrentScreen('stage2');
    showToast('⚡ Judge Fast-Track: Stage 4 (Prime CIBIL 768)', 'All 3 Cards Unlocked! Secured + ₹5k Unsecured + ₹25k Premium Prime Card.');
  };

  const handleSimulateMonthlyCycle = () => {
    setAppState((prev) => {
      const nextMonths = (prev.bureau.monthsReported || 0) + 1;
      let nextStatus = prev.bureau.status;
      let nextScore = prev.bureau.cibilScore;

      if (nextMonths >= 3 && nextStatus !== 'generated') {
        nextStatus = 'generated';
        nextScore = 552;
      } else if (nextStatus === 'generated') {
        const spent = prev.cardSim.spentAmount || 0;
        const limit = prev.cardSim.activeLimit || 2000;
        const cur = (spent / limit) * 100;
        const delta = cur <= 30 ? 18 : cur <= 50 ? 5 : -15;
        nextScore = Math.min(900, Math.max(300, (nextScore || 550) + delta));
      }

      const nextStage = nextScore && nextScore >= 750 ? 4 : nextScore && nextScore >= 600 ? 3 : prev.stage;

      return {
        ...prev,
        stage: nextStage,
        bureau: {
          ...prev.bureau,
          status: nextStatus,
          monthsReported: nextMonths,
          cibilScore: nextScore,
          onTimeCycles: (prev.bureau.onTimeCycles || 0) + 1
        },
        cardSim: {
          ...prev.cardSim,
          spentAmount: Math.round(prev.cardSim.activeLimit * 0.2),
          daysUntilDue: 28
        }
      };
    });

    showToast('📅 Monthly Statement Settled', 'Repayment transmitted to CIBIL & Experian. Cycle advanced.');
  };

  const handleApplyUnsecuredCard = () => {
    setAppState((prev) => ({
      ...prev,
      bureau: {
        ...prev.bureau,
        unsecuredCardPending: true
      }
    }));
    setShowUnsecuredApplyModal(false);
    showToast('📝 Application Submitted to Partner Bank', 'Review in progress for ₹5,000 Unsecured Starter Card.');
  };

  const handleApproveUnsecuredCard = () => {
    setAppState((prev) => ({
      ...prev,
      stage: Math.max(3, prev.stage),
      bureau: {
        ...prev.bureau,
        unsecuredCardPending: false,
        unsecuredCardIssued: true
      }
    }));
    setActiveCardTab('unsecured');
    showToast('🎉 ₹5,000 Unsecured Starter Card Approved!', 'No collateral required. 2 Cards now active in your portfolio.');
  };

  const handleApplyPremiumCard = () => {
    setAppState((prev) => ({
      ...prev,
      bureau: {
        ...prev.bureau,
        premiumCardPending: true
      }
    }));
    setShowPremiumApplyModal(false);
    showToast('📝 Platinum Underwriting Submitted', 'Prime credit review in progress.');
  };

  const handleApprovePremiumCard = () => {
    setAppState((prev) => ({
      ...prev,
      stage: 4,
      bureau: {
        ...prev.bureau,
        premiumCardPending: false,
        premiumCardIssued: true
      }
    }));
    setActiveCardTab('premium');
    showToast('👑 Premium RuPay Card Approved (₹25,000 Limit)!', 'Prime 750+ standing verified. All 3 cards active.');
  };

  const handleUpdatePlan = (field, value) => {
    setAppState((prev) => {
      const isFirst = (prev.fds || []).length === 0;
      const target = field === 'targetAmount' ? Number(value) : prev.stage1.targetAmount;
      const frequency = field === 'frequency' ? value : prev.stage1.frequency;

      let timelineVal = prev.stage1.timelineValue || prev.stage1.timelineDays || 30;
      if (field === 'timelineValue') {
        timelineVal = Number(value);
      } else if (field === 'frequency' && value !== prev.stage1.frequency) {
        const presets = getPresetsForFrequency(value);
        timelineVal = presets[0];
        setIsCustomTimelineOpen(false);
      }

      const maxLimit = getMaxTimelineForFrequency(frequency);
      const safeTimeline = Math.min(maxLimit, Math.max(1, timelineVal));
      const intervals = Math.max(1, safeTimeline);

      const currentSaved = prev.stage1.totalSaved || 0;
      const remainingToSave = Math.max(0, target - currentSaved);
      const remainingIntervals = Math.max(1, intervals - (prev.stage1.currentDay || 0));

      let newContribution;
      if (field === 'contributionAmount') {
        newContribution = value === '' ? '' : Math.max(0, Number(value));
      } else {
        newContribution = remainingToSave > 0
          ? calculateMinContribution(remainingToSave, remainingIntervals, frequency, isFirst)
          : calculateMinContribution(target, intervals, frequency, isFirst);
      }

      return {
        ...prev,
        stage1: {
          ...prev.stage1,
          targetAmount: target,
          frequency,
          timelineValue: safeTimeline,
          timelineDays:
            frequency === 'weekly'
              ? safeTimeline * 7
              : frequency === 'monthly'
              ? safeTimeline * 30
              : safeTimeline,
          contributionAmount: newContribution,
          currentDay: prev.stage1.currentDay,
          streakPoints: prev.stage1.streakPoints,
          totalSaved: prev.stage1.totalSaved,
          todayCompleted: prev.stage1.todayCompleted,
          completed: prev.stage1.totalSaved >= target && (prev.stage1.streakPoints || 0) >= 30
        }
      };
    });
  };

  const handleSaveToday = () => {
    const { stage1 } = appState;
    if (!isPlanViable || numericContribution <= 0 || stage1.todayCompleted) return;

    const nextInterval = stage1.currentDay + 1;
    const addedPoints = getStreakPointsForFrequency(stage1.frequency);
    const currentPoints = stage1.streakPoints ?? 0;
    const nextPoints = Math.min(30, currentPoints + addedPoints);

    const nextTotalSaved = Math.round((stage1.totalSaved + numericContribution) * 100) / 100;
    const targetMet = nextTotalSaved >= stage1.targetAmount;
    const pointsMet = nextPoints >= 30;
    const isCompleted = targetMet && pointsMet;

    setAppState((prev) => ({
      ...prev,
      stage: isCompleted && prev.stage < 1 ? 1 : prev.stage,
      stage1: {
        ...prev.stage1,
        currentDay: nextInterval,
        streakPoints: nextPoints,
        totalSaved: nextTotalSaved,
        todayCompleted: true,
        completed: isCompleted || prev.stage1.completed
      }
    }));

    if (nextTotalSaved > stage1.targetAmount) {
      showToast(
        '⚡ Savings Overflow!',
        `Saved ₹${formatRupee(nextTotalSaved)} (₹${formatRupee(nextTotalSaved - stage1.targetAmount)} over target)!`
      );
    } else if (isCompleted) {
      showToast('🎉 Dual Qualification Achieved!', `Target ₹${formatRupee(nextTotalSaved)} reached AND 30 Streak Points completed.`);
      if (totalFdsValue >= 2000) {
        setShowTransitionModal(true);
      }
    } else {
      showToast(
        `${unitLabel.toUpperCase()} ${nextInterval} complete ✓`,
        `₹${formatRupee(numericContribution)} saved. Total: ₹${formatRupee(nextTotalSaved)} / ₹${formatRupee(stage1.targetAmount)}`
      );
    }
  };

  const handleSimulateNextDay = () => {
    const { stage1 } = appState;
    if (!isPlanViable || numericContribution <= 0) return;

    if (stage1.todayCompleted) {
      setAppState((prev) => ({
        ...prev,
        stage1: {
          ...prev.stage1,
          todayCompleted: false
        }
      }));
      showToast(`Simulated next ${unitLabel} started`, `Ready for deposit ${stage1.currentDay + 1}`);
    } else {
      const nextInterval = stage1.currentDay + 1;
      const addedPoints = getStreakPointsForFrequency(stage1.frequency);
      const currentPoints = stage1.streakPoints ?? 0;
      const nextPoints = Math.min(30, currentPoints + addedPoints);

      const nextTotalSaved = Math.round((stage1.totalSaved + numericContribution) * 100) / 100;
      const targetMet = nextTotalSaved >= stage1.targetAmount;
      const pointsMet = nextPoints >= 30;
      const isCompleted = targetMet && pointsMet;

      setAppState((prev) => ({
        ...prev,
        stage: isCompleted && prev.stage < 1 ? 1 : prev.stage,
        stage1: {
          ...prev.stage1,
          currentDay: nextInterval,
          streakPoints: nextPoints,
          totalSaved: nextTotalSaved,
          todayCompleted: true,
          completed: isCompleted || prev.stage1.completed
        }
      }));

      if (isCompleted) {
        showToast('🎉 Dual Qualification Achieved!', `Target ₹${formatRupee(nextTotalSaved)} reached AND 30 Streak Points completed.`);
      } else {
        showToast(`Simulated ${unitLabel} ${nextInterval} logged ✓`, `₹${formatRupee(numericContribution)} added.`);
      }
    }
  };

  const handleOpenFdModal = () => {
    const liquid = appState.stage1.totalSaved || 0;
    setFdAllocatedSavings(liquid);
    const needed = Math.max(0, 2000 - liquid);
    setFdTopUpAmount(needed);
    setFdModalError('');
    setShowFdModal(true);
  };

  const handleConfirmBookFd = () => {
    const liquid = appState.stage1.totalSaved || 0;
    const fromSavings = Math.min(liquid, Math.max(0, Number(fdAllocatedSavings) || 0));
    const freshTopUp = Math.max(0, Number(fdTopUpAmount) || 0);
    const principal = fromSavings + freshTopUp;

    if (isFirstFdFlow && principal < 2000) {
      setFdModalError(`Primary Fixed Deposit requires at least ₹2,000 to back your secured card. Current total: ₹${formatRupee(principal)}`);
      return;
    }

    if (principal < 500) {
      setFdModalError('Minimum micro-deposit amount is ₹500.');
      return;
    }

    const newFd = {
      id: `ASCEND-FD-${Math.floor(10000 + Math.random() * 90000)}`,
      principal,
      tenureMonths: selectedTenureOption.months,
      interestRate: selectedTenureOption.rate,
      bookingDate: '09 Oct 2026',
      maturityDate: '09 Oct 2027',
      lienStatus: '100% Lien - Securing Credit Line'
    };

    setAppState((prev) => {
      const remainingLiquid = Math.max(0, prev.stage1.totalSaved - fromSavings);
      const updatedFds = [...(prev.fds || []), newFd];
      const newTotalFd = updatedFds.reduce((a, b) => a + b.principal, 0);
      const isCardReady = newTotalFd >= 2000 && (prev.stage1.streakPoints || 0) >= 30;

      return {
        ...prev,
        stage: isCardReady ? 2 : prev.stage >= 1 ? prev.stage : 1,
        stage1: {
          ...prev.stage1,
          totalSaved: remainingLiquid
        },
        fds: updatedFds
      };
    });

    setShowFdModal(false);
    showToast(
      `Micro-FD booked: ₹${formatRupee(principal)} ✓`,
      `Allocated ₹${formatRupee(fromSavings)} from savings + ₹${formatRupee(freshTopUp)} fresh top-up.`
    );

    if (!appState.cardIssued && isFirstFdFlow && principal >= 2000 && activeStreakPts >= 30) {
      setShowTransitionModal(true);
    }
  };

  const handleIssueCard = () => {
    if (totalFdsValue < 2000 || activeStreakPts < 30) {
      showToast('Prerequisites Not Met', 'Requires both: 30 Streak Points AND at least ₹2,000 Fixed Deposit collateral.');
      return;
    }
    setAppState((prev) => ({
      ...prev,
      stage: 2,
      cardIssued: true,
      bureau: {
        status: 'no_score',
        monthsReported: 1,
        cibilScore: null,
        onTimeCycles: 1,
        unsecuredCardIssued: false,
        premiumCardIssued: false
      },
      cardSim: {
        ...prev.cardSim,
        activeLimit: totalFdsValue,
        spentAmount: Math.round(totalFdsValue * 0.25),
        daysUntilDue: 18,
        limitIncreasePending: false,
        requestedLimit: totalFdsValue
      }
    }));
    setActiveCardTab('secured');
    setCurrentScreen('stage2');
    showToast('🎉 Secured Credit Card Issued!', `Limit: ₹${formatRupee(totalFdsValue)} • Bureau reporting cycle begins (Month 1 of 3-6).`);
  };

  const handleOpenLimitIncreaseModal = () => {
    // If user has unpledged FD collateral, default to totalFdsValue
    // If all FDs are already pledged, default to activeCardLimit + 1000
    const defaultVal = totalFdsValue > activeCardLimit ? totalFdsValue : activeCardLimit + 1000;
    setRequestedLimitInput(defaultVal);
    setShowLimitIncreaseModal(true);
  };

  const handleApplyLimitIncrease = () => {
    const targetAmt = Number(requestedLimitInput) || (activeCardLimit + 1000);
    
    // If requested limit exceeds total existing FDs, auto-create the necessary backing FD
    if (targetAmt > totalFdsValue) {
      const neededFd = targetAmt - totalFdsValue;
      const newFd = {
        id: `ASCEND-FD-${Math.floor(10000 + Math.random() * 90000)}`,
        principal: neededFd,
        tenureMonths: 12,
        interestRate: 6.85,
        bookingDate: '09 Oct 2026',
        maturityDate: '09 Oct 2027',
        lienStatus: '100% Lien - Securing Credit Line'
      };
      setAppState((prev) => ({
        ...prev,
        fds: [...(prev.fds || []), newFd],
        cardSim: {
          ...prev.cardSim,
          limitIncreasePending: true,
          requestedLimit: targetAmt
        }
      }));
    } else {
      setAppState((prev) => ({
        ...prev,
        cardSim: {
          ...prev.cardSim,
          limitIncreasePending: true,
          requestedLimit: targetAmt
        }
      }));
    }

    setShowLimitIncreaseModal(false);
    showToast(`Applied for secured limit increase to ₹${formatRupee(targetAmt)}`, 'Review in progress. Use Judge Skip to approve instantly.');
  };

  const handleInstantLimitIncrease = () => {
    const approvedLimit = appState.cardSim?.requestedLimit || Math.max(activeCardLimit + 1000, totalFdsValue);
    
    // Ensure FD backing exists for the approved limit
    setAppState((prev) => {
      let updatedFds = [...(prev.fds || [])];
      const currentTotalFd = updatedFds.reduce((a, b) => a + (Number(b.principal) || 0), 0);
      
      if (approvedLimit > currentTotalFd) {
        const extraNeeded = approvedLimit - currentTotalFd;
        updatedFds.push({
          id: `ASCEND-FD-${Math.floor(10000 + Math.random() * 90000)}`,
          principal: extraNeeded,
          tenureMonths: 12,
          interestRate: 6.85,
          bookingDate: '09 Oct 2026',
          maturityDate: '09 Oct 2027',
          lienStatus: '100% Lien - Securing Credit Line'
        });
      }

      return {
        ...prev,
        fds: updatedFds,
        cardSim: {
          ...prev.cardSim,
          activeLimit: approvedLimit,
          limitIncreasePending: false,
          requestedLimit: approvedLimit
        }
      };
    });

    setShowLimitIncreaseModal(false);
    showToast('⚡ Secured Limit Upgraded!', `Card 1 credit line boosted to ₹${formatRupee(approvedLimit)}.`);
  };

  const handleUpdateCardSim = (field, val) => {
    setAppState((prev) => ({
      ...prev,
      cardSim: {
        ...prev.cardSim,
        [field]: Number(val)
      }
    }));
  };

  const handleApplyNewTarget = (targetVal) => {
    const num = Number(targetVal);
    if (!num || num <= appState.stage1.targetAmount) {
      showToast('Invalid Target', `Please enter an amount higher than your current ₹${formatRupee(appState.stage1.targetAmount)} target.`);
      return;
    }
    handleUpdatePlan('targetAmount', num);
    setShowIncreaseTargetModal(false);
    showToast('🎯 Target Upgraded!', `Target goal set to ₹${formatRupee(num)}.`);
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAppState(INITIAL_APP_STATE);
    setOnboardingForm({ name: '', age: '', city: '', monthlyIncome: '' });
    setCurrentScreen('welcome');
    setShowTransitionModal(false);
    setShowPreStage1Modal(false);
    setShowStage2To3Modal(false);
    setShowStage3ToGradModal(false);
    setShowProgressionModal(false);
    setShowFdModal(false);
    setShowStreakInfoModal(false);
    setShowIncreaseTargetModal(false);
    showToast('Application state reset to ground zero');
  };

  const renderHeader = () => (
    <header className="border-b border-slate-800/80 bg-[#141d2b]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentScreen(Boolean(appState.user?.name?.trim()) ? 'home' : 'welcome')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 fill-current" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-black tracking-tight text-slate-100 flex items-center gap-1.5">
                <span>ASCEND</span>
                <span className="text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                  {appState.bureau.premiumCardIssued
                    ? 'Stage 4 · Prime (3 Cards)'
                    : appState.bureau.unsecuredCardIssued
                    ? 'Stage 3 · Unsecured (2 Cards)'
                    : appState.cardIssued
                    ? 'Stage 2 · Secured'
                    : 'Stage 1 · Savings'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Fintech Credit Pathway</p>
            </div>
          </button>

          <div className="flex md:hidden items-center gap-1.5">
            <button
              type="button"
              onClick={handleReset}
              title="Reset application to ground zero"
              className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-rose-400 border border-slate-700/80 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* JUDGE FAST-TRACK BAR - Slideable on mobile */}
        <div className="w-full md:w-auto overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1.5 p-1 rounded-2xl bg-[#0e141f] border border-amber-500/30 shrink-0">
          <span className="text-[9px] font-mono font-bold text-amber-400 px-1.5 flex items-center gap-1 uppercase shrink-0">
            <Zap className="w-3 h-3 fill-amber-400" />
            <span>Skips:</span>
          </span>

          <button
            type="button"
            onClick={handleJudgeSkipNoScore}
            title="Fast-track to Stage 2: Card Issued, No Score Yet (3-6m generation window)"
            className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold transition-all shrink-0 whitespace-nowrap"
          >
            1. No Score (3-6m)
          </button>

          <button
            type="button"
            onClick={handleJudgeSkipInitialScore}
            title="Fast-track to Stage 2: Score Generated ~552"
            className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold transition-all shrink-0 whitespace-nowrap"
          >
            2. Initial (~550)
          </button>

          <button
            type="button"
            onClick={handleJudgeSkipStage3}
            title="Fast-track to Stage 3: Score 624 (Apply/Unlock ₹5k Unsecured Card - 2 Cards)"
            className="px-2 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-[10px] font-mono font-bold transition-all shrink-0 whitespace-nowrap"
          >
            3. Stage 3 (2 Cards)
          </button>

          <button
            type="button"
            onClick={handleJudgeSkipStage4}
            title="Fast-track to Stage 4: Score 768 (Apply/Unlock Premium Card - All 3 Cards)"
            className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold transition-all shrink-0 whitespace-nowrap"
          >
            4. Stage 4 (3 Cards)
          </button>
        </div>

        {/* Global Navigation Tabs - Slideable on mobile */}
        <div className="w-full md:w-auto overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1.5 pb-0.5 md:pb-0 shrink-0">
          {Boolean(appState.user?.name?.trim()) && (
            <>
              {!appState.cardIssued && (
                <button
                  type="button"
                  onClick={() => setShowStreakInfoModal(true)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold transition-all shrink-0 whitespace-nowrap"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
                  <span>{activeStreakPts}/30 Pts</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCurrentScreen('home')}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                  currentScreen === 'home'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
                }`}
              >
                Home
              </button>

              {appState.cardIssued && (
                <button
                  type="button"
                  onClick={() => setCurrentScreen('stage2')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                    currentScreen === 'stage2'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Cards ({totalCardsCount})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCurrentScreen('stage1')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                  currentScreen === 'stage1'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
                }`}
              >
                <PiggyBank className="w-3.5 h-3.5" />
                <span>Savings</span>
                <span className="text-[10px] font-mono px-1 rounded bg-slate-900/50">₹{formatRupee(appState.stage1.totalSaved)}</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentScreen('cibil')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                  currentScreen === 'cibil'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>CIBIL</span>
                {currentCibilScore ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-extrabold border border-emerald-500/30">
                    {currentCibilScore}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    NH
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCurrentScreen('fd-vault')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                  currentScreen === 'fd-vault'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>FDs</span>
                <span className="text-[10px] font-mono px-1 rounded bg-slate-900/50">₹{formatRupee(totalFdsValue)}</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                title="Reset application to ground zero"
                className="hidden md:inline-flex p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-rose-400 border border-slate-700/80 transition-all shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );

  const renderWelcomeScreen = () => (
    <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16 space-y-8 animate-fadeIn">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Regulated Indian Credit Pathway</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight leading-tight">
          Build your first credit history, <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent">
            from ground zero to Prime.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto leading-relaxed">
          No credit history? Start with a disciplined savings habit, unlock a 100% secured card, generate your first official score in 3-6 months (~550), and graduate to unsecured cards (600+) and premium lines (750+).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-[#17202c] border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <span className="font-mono text-emerald-400 font-bold">STAGE 1 & 2</span>
          <h4 className="font-bold text-slate-200">Micro-FD Secured Card</h4>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            ₹600 savings proof + top-up into ₹2,000 Micro-FD. Score generates in 3-6 months (~550).
          </p>
        </div>

        <div className="bg-[#17202c] border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <span className="font-mono text-teal-400 font-bold">STAGE 3 (CIBIL 600+)</span>
          <h4 className="font-bold text-slate-200">Unsecured Starter Card</h4>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Qualify for ₹5,000 unsecured credit with zero collateral. Hold 2 active cards.
          </p>
        </div>

        <div className="bg-[#17202c] border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <span className="font-mono text-amber-400 font-bold">STAGE 4 (CIBIL 750+)</span>
          <h4 className="font-bold text-slate-200">Premium RuPay Card</h4>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Upgrade to ₹25,000+ premium line. Manage all 3 cards in your prime portfolio.
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setOnboardingForm({ name: 'Aarav Sharma', age: '19', city: 'Pune', monthlyIncome: '6000' });
            setCurrentScreen('onboarding');
          }}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 group"
        >
          <span>Get Started (Onboard Aarav)</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <button
            type="button"
            onClick={handleJudgeSkipNoScore}
            className="py-2.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold"
          >
            ⚡ Skip: Stage 2 (No Score)
          </button>
          <button
            type="button"
            onClick={handleJudgeSkipInitialScore}
            className="py-2.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold"
          >
            ⚡ Skip: Initial (~550)
          </button>
          <button
            type="button"
            onClick={handleJudgeSkipStage3}
            className="py-2.5 px-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-[11px] font-mono font-bold"
          >
            ⚡ Skip: Stage 3 (2 Cards)
          </button>
          <button
            type="button"
            onClick={handleJudgeSkipStage4}
            className="py-2.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold"
          >
            ⚡ Skip: Stage 4 (3 Cards)
          </button>
        </div>
      </div>
    </div>
  );

  const renderOnboardingScreen = () => {
    const handleSubmitOnboarding = (e) => {
      e.preventDefault();
      if (!onboardingForm.name.trim() || !onboardingForm.age || !onboardingForm.city.trim() || !onboardingForm.monthlyIncome) {
        setOnboardingError('Please provide all details to establish your Stage 0 foundation.');
        return;
      }
      setAppState((prev) => ({
        ...prev,
        user: {
          name: onboardingForm.name.trim(),
          age: Number(onboardingForm.age),
          city: onboardingForm.city.trim(),
          monthlyIncome: Number(onboardingForm.monthlyIncome)
        },
        stage: prev.stage || 0
      }));
      // Show Pre-Stage 1 educational flashcards popup upon baseline establishment
      setShowPreStage1Modal(true);
      setCurrentScreen('home');
      showToast('Baseline Created', 'Welcome to ASCEND, Aarav. Review your NA/NH credit fundamentals.');
    };

    return (
      <div className="max-w-xl mx-auto px-4 py-10 sm:py-12 space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentScreen('welcome')}
            className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreStage1Modal(true)}
              className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1 hover:bg-emerald-500/20"
            >
              <BookOpen className="w-3 h-3" />
              <span>NA/NH Facts</span>
            </button>
            <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
              Stage 0 · Foundation
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Create your financial baseline</h2>
          <p className="text-xs text-slate-400">
            Tell us about yourself. Your declared cash inflow establishes your baseline before saving begins.
          </p>
        </div>

        {onboardingError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{onboardingError}</span>
          </div>
        )}

        <form onSubmit={handleSubmitOnboarding} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Full Name</label>
            <input
              type="text"
              placeholder="e.g. Aarav Sharma"
              value={onboardingForm.name}
              onChange={(e) => setOnboardingForm({ ...onboardingForm, name: e.target.value })}
              className="w-full bg-[#111722] border border-slate-700/80 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Age</label>
              <input
                type="number"
                placeholder="e.g. 19"
                value={onboardingForm.age}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, age: e.target.value })}
                className="w-full bg-[#111722] border border-slate-700/80 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">City</label>
              <input
                type="text"
                placeholder="e.g. Pune"
                value={onboardingForm.city}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, city: e.target.value })}
                className="w-full bg-[#111722] border border-slate-700/80 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Declared Monthly Inflow</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
              <input
                type="number"
                placeholder="e.g. 6000"
                value={onboardingForm.monthlyIncome}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, monthlyIncome: e.target.value })}
                className="w-full bg-[#111722] border border-slate-700/80 rounded-xl py-3 pl-9 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 mt-4"
          >
            <span>Confirm & Enter Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  };

  const renderSavingsOverflowPrompt = () => {
    if (!isSavingsOverflow) return null;
    const suggestedTarget = Math.max(
      appState.stage1.targetAmount + 500,
      Math.ceil(appState.stage1.totalSaved / 500) * 500
    );

    return (
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-teal-950/70 via-emerald-950/40 to-slate-900 border border-teal-500/40 shadow-xl space-y-3 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-mono text-teal-300 font-bold uppercase tracking-wider">
                Savings Overflow · ₹{formatRupee(overflowAmount)} Above Target!
              </span>
              <h4 className="text-sm font-black text-slate-100">Surpassed your ₹{formatRupee(appState.stage1.targetAmount)} Goal</h4>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold self-start sm:self-auto">
            TARGET EXCEEDED
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          You have saved <strong>₹{formatRupee(appState.stage1.totalSaved)}</strong>. Upgrade your target goal to capture your savings discipline or allocate into a Fixed Deposit to boost your credit limit.
        </p>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handleApplyNewTarget(suggestedTarget)}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-teal-500/20"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Increase Target to ₹{formatRupee(suggestedTarget)}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewTargetInput(String(suggestedTarget));
              setShowIncreaseTargetModal(true);
            }}
            className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all"
          >
            Custom Target
          </button>

          <button
            type="button"
            onClick={handleOpenFdModal}
            className="py-2.5 px-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>Lock into Micro-FD</span>
          </button>
        </div>
      </div>
    );
  };

  const renderHomeScreen = () => {
    const target = appState.stage1.targetAmount || 600;
    const saved = appState.stage1.totalSaved || 0;
    const progressPercent = target > 0 ? Math.round((saved / target) * 100) : 0;
    const remaining = Math.max(0, Math.round((target - saved) * 100) / 100);
    const requestedLim = appState.cardSim?.requestedLimit || totalFdsValue;

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
        {/* User Identity Header Card */}
        <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-44 h-44 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  {appState.bureau.premiumCardIssued
                    ? 'Stage 4 · Prime Credit Active'
                    : appState.bureau.unsecuredCardIssued
                    ? 'Stage 3 · Unsecured Card Active'
                    : appState.cardIssued
                    ? 'Stage 2 · Secured Card Active'
                    : 'Stage 1 · Savings Proof'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  CURRENT
                </span>
                {!currentCibilScore ? (
                  <button
                    type="button"
                    onClick={() => setShowPreStage1Modal(true)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                  >
                    <BookOpen className="w-2.5 h-2.5" />
                    <span>NA/NH Facts</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => canApplyUnsecured ? setShowStage3ToGradModal(true) : setShowStage2To3Modal(true)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30 font-bold hover:bg-teal-500/20 transition-colors flex items-center gap-1"
                  >
                    <BookOpen className="w-2.5 h-2.5" />
                    <span>{canApplyUnsecured ? 'KFS & RBI Rules' : 'CUR & DPD Facts'}</span>
                  </button>
                )}
              </div>
              <h1 className="text-2xl font-black text-slate-100 tracking-tight mt-1">
                {appState.user.name || 'Aarav Sharma'}
              </h1>
              <p className="text-xs text-slate-400">
                {appState.user.age ? `${appState.user.age} yrs` : '19 yrs'} • {appState.user.city || 'Pune'} • Inflow: ₹{formatRupee(appState.user.monthlyIncome || 6000)}/mo
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Credit Footprint</div>
                <div className="text-xs font-bold text-slate-200">
                  {currentCibilScore ? `CIBIL: ${currentCibilScore}` : 'No History (NH)'}
                </div>
                <div className="text-[10px] text-emerald-400">
                  {appState.bureau.status === 'generated'
                    ? 'Official Score Generated'
                    : appState.cardIssued
                    ? `Generating in 3-6 months (${appState.bureau.monthsReported || 1}m reported)`
                    : 'Requires Stage 1 & 2'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentScreen('cibil')}
                className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 hover:scale-105 transition-transform"
              >
                <TrendingUp className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stage 3 Graduation Milestone Banner */}
        {appState.cardIssued && !appState.bureau.unsecuredCardIssued && canApplyUnsecured && (
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-teal-950/70 via-emerald-950/50 to-slate-900 border border-teal-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-mono text-teal-300 font-bold uppercase tracking-wider">
                  Stage 3 Milestone Achieved · CIBIL {currentCibilScore} $\ge$ 600
                </span>
                <button
                  type="button"
                  onClick={() => setShowStage2To3Modal(true)}
                  className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[9px] font-bold flex items-center gap-1 hover:bg-teal-500/30"
                >
                  <BookOpen className="w-2.5 h-2.5" />
                  <span>CUR & DPD Facts</span>
                </button>
              </div>
              <h4 className="text-sm font-black text-slate-100">You qualify for an Unsecured Credit Card!</h4>
              <p className="text-xs text-slate-300">
                Get an initial ₹5,000 credit line with <strong>zero fixed deposit collateral</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUnsecuredApplyModal(true)}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md shrink-0 flex items-center gap-1.5"
            >
              <span>Apply for ₹5,000 Card</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stage 4 Prime Milestone Banner */}
        {appState.cardIssued && appState.bureau.unsecuredCardIssued && !appState.bureau.premiumCardIssued && canApplyPremium && (
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-950/70 via-yellow-950/40 to-slate-900 border border-amber-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono text-amber-300 font-bold uppercase tracking-wider">
                  Stage 4 Prime Milestone · CIBIL {currentCibilScore} $\ge$ 750
                </span>
                <button
                  type="button"
                  onClick={() => setShowStage3ToGradModal(true)}
                  className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold flex items-center gap-1 hover:bg-amber-500/30"
                >
                  <FileText className="w-2.5 h-2.5" />
                  <span>KFS & RBI Rules</span>
                </button>
              </div>
              <h4 className="text-sm font-black text-slate-100">You qualify for the Premium RuPay Card!</h4>
              <p className="text-xs text-slate-300">
                Unlock a ₹25,000 premium credit line with platinum privileges and complete your 3-card deck.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPremiumApplyModal(true)}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs transition-all shadow-md shrink-0 flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Apply for Premium Card</span>
            </button>
          </div>
        )}

        {/* Dashboard Navigation Tabs - Slideable on mobile */}
        <div className="w-full overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-2 p-1.5 rounded-2xl bg-[#17202c] border border-slate-800">
          <button
            type="button"
            onClick={() => setHomeTab('all')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              homeTab === 'all'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
          {appState.cardIssued && (
            <button
              type="button"
              onClick={() => setHomeTab('card')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                homeTab === 'card'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Credit Cards ({totalCardsCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setHomeTab('savings')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              homeTab === 'savings'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>Savings & Habit</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-900/60 text-emerald-400 font-bold">
              ₹{formatRupee(appState.stage1.totalSaved)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setHomeTab('cibil')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              homeTab === 'cibil'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>CIBIL Score</span>
            {currentCibilScore ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-extrabold border border-emerald-500/30">
                {currentCibilScore}
              </span>
            ) : (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold">
                NH
              </span>
            )}
          </button>
        </div>

        {/* 1. CREDIT CARDS VIEW */}
        {appState.cardIssued && (homeTab === 'card' || homeTab === 'all') && (
          <div className="bg-[#17202c] border border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">
                    Your Credit Card Suite ({totalCardsCount} Active Card{totalCardsCount > 1 ? 's' : ''})
                  </h3>
                  <p className="text-xs text-slate-400">
                    {appState.bureau.premiumCardIssued
                      ? '3 Cards: Secured FD + Unsecured ₹5k + Premium RuPay ₹25k'
                      : appState.bureau.unsecuredCardIssued
                      ? '2 Cards: Secured FD + Unsecured Starter ₹5,000'
                      : 'Stage 2: 100% FD-backed secured card'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStage2To3Modal(true)}
                  className="py-1.5 px-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all flex items-center gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CUR & DPD Facts</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('stage2')}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 border border-slate-700 transition-all flex items-center gap-1"
                >
                  <span>Full Card Suite</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Consumer Cards Portfolio Showcase */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Secured Card */}
              <div
                className="p-5 rounded-3xl bg-gradient-to-br from-[#122320] via-[#0d1b19] to-[#081211] border border-emerald-500/40 hover:border-emerald-400/80 transition-all shadow-lg space-y-4 group relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-mono text-emerald-300 font-extrabold uppercase tracking-wider">
                      Card 1 · Secured FD
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    100% LIEN
                  </span>
                </div>

                <div 
                  onClick={() => {
                    setActiveCardTab('secured');
                    setCurrentScreen('stage2');
                  }}
                  className="space-y-1 cursor-pointer"
                >
                  <span className="text-[10px] font-mono uppercase text-emerald-400/80 font-bold tracking-wider">
                    Total Credit Limit
                  </span>
                  <div className="text-3xl font-black tracking-tight text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                    ₹{formatRupee(activeCardLimit)}
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-950/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-400">Current Spends:</span>
                    <span className="text-slate-300 font-bold">₹{formatRupee(appState.cardSim.spentAmount || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Available Credit:</span>
                    <span className="text-slate-400 font-mono font-semibold">
                      ₹{formatRupee(Math.max(0, activeCardLimit - (appState.cardSim.spentAmount || 0)))}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.round(((appState.cardSim.spentAmount || 0) / activeCardLimit) * 100))}%`
                      }}
                    />
                  </div>
                </div>

                {/* Permanent Secured Limit Enhancement Trigger */}
                <div className="pt-1 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenLimitIncreaseModal();
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Increase Limit</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCardTab('secured');
                      setCurrentScreen('stage2');
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition-all"
                  >
                    Manage
                  </button>
                </div>
              </div>

              {/* Card 2: Unsecured Starter Card (600+) */}
              {appState.bureau.unsecuredCardIssued ? (
                <div
                  onClick={() => {
                    setActiveCardTab('unsecured');
                    setCurrentScreen('stage2');
                  }}
                  className="p-5 rounded-3xl bg-gradient-to-br from-[#0e272a] via-[#091f22] to-[#051314] border border-teal-500/50 hover:border-teal-400/80 transition-all cursor-pointer shadow-lg space-y-4 group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-400" />
                      <span className="text-[10px] font-mono text-teal-300 font-extrabold uppercase tracking-wider">
                        Card 2 · Unsecured
                      </span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                      STAGE 3
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-teal-400/80 font-bold tracking-wider">
                      Total Credit Limit
                    </span>
                    <div className="text-3xl font-black tracking-tight text-teal-300 drop-shadow-[0_0_12px_rgba(45,212,191,0.3)]">
                      ₹5,000
                    </div>
                  </div>

                  <div className="pt-2 border-t border-teal-950/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-400">Current Spends:</span>
                      <span className="text-slate-300 font-bold">₹{formatRupee(appState.unsecuredSim.spentAmount || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Available Credit:</span>
                      <span className="text-slate-400 font-mono font-semibold">
                        ₹{formatRupee(Math.max(0, 5000 - (appState.unsecuredSim.spentAmount || 0)))}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-400 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round(((appState.unsecuredSim.spentAmount || 0) / 5000) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : appState.bureau.unsecuredCardPending ? (
                <div className="p-5 rounded-3xl bg-[#141b26] border border-amber-500/40 space-y-3.5 shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Card 2 · Under Review
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        PENDING
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-100">₹5,000 Unsecured Line</div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Application submitted to partner bank based on CIBIL {currentCibilScore}.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleApproveUnsecuredCard}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Judge Skip: Approve ₹5,000 Card</span>
                  </button>
                </div>
              ) : canApplyUnsecured ? (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-teal-950/50 to-[#101c24] border border-teal-500/50 space-y-3.5 shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-teal-300 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        Stage 3 Milestone
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                        ELIGIBLE
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-black text-teal-300">₹5,000 Unsecured Line</div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      CIBIL {currentCibilScore} qualifies you for zero-collateral credit.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowUnsecuredApplyModal(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <span>Apply for ₹5,000 Card</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-3xl bg-[#111722]/50 border border-dashed border-slate-800 space-y-3 opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Card 2 · Unsecured</span>
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-500">₹5,000 Limit</div>
                  <div className="text-[11px] text-amber-400 font-medium">Unlocks when CIBIL reaches 600+</div>
                </div>
              )}

              {/* Card 3: Premium RuPay Platinum Card (750+) */}
              {appState.bureau.premiumCardIssued ? (
                <div
                  onClick={() => {
                    setActiveCardTab('premium');
                    setCurrentScreen('stage2');
                  }}
                  className="p-5 rounded-3xl bg-gradient-to-br from-[#2a1d08] via-[#1f1505] to-[#120c02] border border-amber-500/50 hover:border-amber-400/80 transition-all cursor-pointer shadow-lg space-y-4 group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span className="text-[10px] font-mono text-amber-300 font-extrabold uppercase tracking-wider">
                        Card 3 · Premium
                      </span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      STAGE 4 PRIME
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-amber-400/80 font-bold tracking-wider">
                      Total Credit Limit
                    </span>
                    <div className="text-3xl font-black tracking-tight text-amber-300 drop-shadow-[0_0_14px_rgba(245,158,11,0.35)]">
                      ₹25,000
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-950/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-400">Current Spends:</span>
                      <span className="text-slate-300 font-bold">₹{formatRupee(appState.premiumSim.spentAmount || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Available Credit:</span>
                      <span className="text-slate-400 font-mono font-semibold">
                        ₹{formatRupee(Math.max(0, 25000 - (appState.premiumSim.spentAmount || 0)))}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round(((appState.premiumSim.spentAmount || 0) / 25000) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : appState.bureau.premiumCardPending ? (
                <div className="p-5 rounded-3xl bg-[#141b26] border border-amber-500/40 space-y-3.5 shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Card 3 · Under Review
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        PENDING
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-100">₹25,000 Platinum Line</div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Platinum verification in progress based on CIBIL {currentCibilScore}.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleApprovePremiumCard}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <Crown className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Judge Skip: Approve ₹25,000 Card</span>
                  </button>
                </div>
              ) : canApplyPremium ? (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950/50 to-[#22170d] border border-amber-500/50 space-y-3.5 shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5" />
                        Stage 4 Prime Milestone
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        ELIGIBLE
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-black text-amber-300">₹25,000 Prime Line</div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      CIBIL {currentCibilScore} qualifies you for top-tier RuPay Platinum.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPremiumApplyModal(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Apply for Premium Card</span>
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-3xl bg-[#111722]/50 border border-dashed border-slate-800 space-y-3 opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Card 3 · Premium</span>
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-500">₹25,000 Limit</div>
                  <div className="text-[11px] text-amber-400 font-medium">Unlocks when CIBIL reaches 750+</div>
                </div>
              )}
            </div>

            {/* Limit Increase Flow - Always accessible for Card 1 */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-[#111722] border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              {appState.cardSim.limitIncreasePending ? (
                <div className="space-y-1 flex-1">
                  <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
                    APPLICATION UNDER REVIEW
                  </span>
                  <p className="text-slate-200 font-bold text-sm">
                    Applied for Card 1 limit increase to ₹{formatRupee(requestedLim)}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Awaiting partner bank underwriting. Use the Judge Skip below to approve instantly.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                      Card 1 · Secured Limit Enhancement
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Current: ₹{formatRupee(activeCardLimit)}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    {canIncreaseLimit
                      ? `You have ₹${formatRupee(totalFdsValue - activeCardLimit)} unpledged FD collateral ready to boost your secured limit.`
                      : 'Increase your Card 1 limit anytime by pledging additional FD collateral or linking fresh deposits.'}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                {appState.cardSim.limitIncreasePending ? (
                  <button
                    type="button"
                    onClick={handleInstantLimitIncrease}
                    className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Judge Skip: Approve to ₹{formatRupee(requestedLim)}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenLimitIncreaseModal}
                    className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-md flex items-center gap-1.5"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Boost Secured Limit</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. CIBIL SCORE TAB / VIEW */}
        {(homeTab === 'cibil' || (homeTab === 'all' && appState.cardIssued)) && (
          <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">CIBIL Credit Bureau Status</h3>
                  <p className="text-xs text-slate-400">
                    {appState.bureau.status === 'generated'
                      ? 'Live numerical score active with partner bureaus'
                      : 'Score generates 3 to 6 months after first statement cycle'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!currentCibilScore ? (
                  <button
                    type="button"
                    onClick={() => setShowPreStage1Modal(true)}
                    className="py-1.5 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>NA/NH Facts</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowStage2To3Modal(true)}
                    className="py-1.5 px-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>CUR & DPD Facts</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentScreen('cibil')}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 border border-slate-700 transition-all flex items-center gap-1"
                >
                  <span>Score Analytics</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-[#111722] border border-emerald-500/30 flex flex-col justify-between space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">CIBIL Score</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-emerald-400">
                    {currentCibilScore ?? 'NH'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">
                    {currentCibilScore ? '/ 900' : '(No History)'}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-emerald-300">
                  {currentCibilScore === null
                    ? `Generating in 3-6 months (Month ${appState.bureau.monthsReported || 1} of 6)`
                    : currentCibilScore >= 750
                    ? 'Prime Range (Stage 4 Complete)'
                    : currentCibilScore >= 600
                    ? 'Eligible for Stage 3 Unsecured Card'
                    : 'Initial Score (~550) - Building Upwards'}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#111722] border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Transmission Timeline</span>
                <div className="text-sm font-black text-slate-100">
                  {appState.bureau.status === 'generated' ? `${appState.bureau.monthsReported} Months Active` : `Month ${appState.bureau.monthsReported} of 3-6 Window`}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Partner bank submits monthly statement repayments. No artificial simulations — genuine bureau transmission.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#111722] border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Monthly Repayment Action</span>
                <button
                  type="button"
                  onClick={handleSimulateMonthlyCycle}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-300 border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Simulate Next Statement (+1 Mo)</span>
                </button>
                <p className="text-[10px] text-slate-500">
                  Advance 1 month of disciplined repayment to naturally increase your score.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. SAVINGS & HABIT TAB / VIEW */}
        {(homeTab === 'savings' || homeTab === 'all' || !appState.cardIssued) && (
          <div className="space-y-6">
            {renderSavingsOverflowPrompt()}

            <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold tracking-wider">
                    {appState.cardIssued ? 'Savings & Habit Buffer' : 'Stage 1 Progress · Dual Requirement'}
                  </span>
                  <h2 className="text-xl font-black text-slate-100">
                    {appState.cardIssued ? 'Liquid Savings Balance' : 'Savings Target & Habit Checklist'}
                  </h2>
                  <p className="text-xs text-amber-300/90 font-medium">
                    {appState.cardIssued
                      ? 'Ongoing savings available to back additional Micro-FDs and limit increases'
                      : `Target: ₹${formatRupee(target)} • ${remainingIntervalsNeeded} ${unitPlural} needed at ₹${formatRupee(numericContribution)}/${unitLabel}`}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-2xl font-black text-emerald-400">
                    ₹{formatRupee(saved)} <span className="text-xs font-bold text-slate-500">/ ₹{formatRupee(target)}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isSavingsOverflow ? (
                      <span className="text-teal-400 font-bold">Overflow: +₹{formatRupee(overflowAmount)} above target</span>
                    ) : remaining > 0 ? (
                      `₹${formatRupee(remaining)} remaining (${remainingIntervalsNeeded} ${unitPlural} at current rate)`
                    ) : (
                      'Savings target achieved ✓'
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSavingsOverflow
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-sm shadow-teal-500/50'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className={isSavingsOverflow ? 'text-teal-400 font-bold' : ''}>
                    {progressPercent}% of target saved {isSavingsOverflow && `(Overflow)`}
                  </span>
                  {!appState.cardIssued && (
                    <span className="text-amber-400 font-bold">
                      {activeStreakPts}/30 Streak Pts {isStreakComplete ? '✓' : `(${30 - activeStreakPts} pts left)`}
                    </span>
                  )}
                </div>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-[#111722] p-3 rounded-2xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">CONTRIBUTION</div>
                  <div className="text-sm font-black text-slate-100">₹{formatRupee(numericContribution)}</div>
                  <div className="text-[10px] text-slate-500">per {unitLabel}</div>
                </div>
                <div className="bg-[#111722] p-3 rounded-2xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">REMAINING DAYS</div>
                  <div className="text-sm font-black text-emerald-400">{remainingIntervalsNeeded} {unitPlural}</div>
                  <div className="text-[10px] text-slate-500">at ₹{formatRupee(numericContribution)}/{unitLabel}</div>
                </div>
                <div className="bg-[#111722] p-3 rounded-2xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">TARGET GOAL</div>
                  <div className="text-sm font-black text-slate-100">₹{formatRupee(target)}</div>
                  <div className="text-[10px] text-slate-500">Liquid proof</div>
                </div>
                <div className="bg-[#111722] p-3 rounded-2xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">
                    {!appState.cardIssued ? 'STREAK POINTS' : 'CARDS ACTIVE'}
                  </div>
                  <div className={`text-sm font-black ${!appState.cardIssued ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {!appState.cardIssued ? `${activeStreakPts} / 30 Pts` : `${totalCardsCount} Active Card${totalCardsCount > 1 ? 's' : ''}`}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {!appState.cardIssued ? 'Whichever comes 2nd' : 'Portfolio status'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentScreen('stage1')}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <span>{isStage1FullyQualified ? 'View Savings Plan & Deposit More' : 'Continue Saving & Log Habit'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenFdModal}
                  className="py-3.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <PiggyBank className="w-4 h-4" />
                  <span>Book Micro-FD</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ASCEND Progression Modal Trigger */}
        <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-black text-slate-100 tracking-wide uppercase">ASCEND 4-Stage Pathway</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowProgressionModal(true)}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              <span>View Full Progression</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-[#111722] border border-emerald-500/30 space-y-1">
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Current Stage</span>
              <div className="text-sm font-extrabold text-slate-100">
                {appState.bureau.premiumCardIssued
                  ? 'Stage 4 · Prime Card Portfolio (3 Cards)'
                  : appState.bureau.unsecuredCardIssued
                  ? 'Stage 3 · Unsecured Starter Card (2 Cards)'
                  : appState.cardIssued
                  ? 'Stage 2 · Secured Credit Card'
                  : 'Stage 1 · Savings Proof'}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {appState.bureau.premiumCardIssued
                  ? 'All 3 cards active. Premium RuPay Platinum with high limits.'
                  : appState.bureau.unsecuredCardIssued
                  ? 'Holding both ₹2,000 Secured and ₹5,000 Unsecured Starter credit cards.'
                  : appState.cardIssued
                  ? 'Secured card backed 100% by your FD. Transmitting initial records (3-6m wait).'
                  : 'Demonstrating cash-flow discipline via micro-contributions.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#111722] border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Next Milestone</span>
              <div className="text-sm font-extrabold text-slate-200">
                {appState.bureau.premiumCardIssued
                  ? 'Credit Limit Enhancements & Unpledging Collateral'
                  : appState.bureau.unsecuredCardIssued
                  ? 'Reach CIBIL 750+ for Stage 4 Premium Card'
                  : appState.cardIssued
                  ? 'Reach CIBIL 600+ for Stage 3 Unsecured Card'
                  : 'Complete ₹600 + 30 Streak Points for FD Card'}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {appState.cardIssued
                  ? 'Keep utilization under 30% to build your score from ~550 towards 600+.'
                  : 'Both requirements must be satisfied before credit card issuance.'}
              </p>
            </div>
          </div>
        </div>

        {/* Education & Flashcard Hub Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              {currentCibilScore ? 'Active Credit Strategy Flashcards' : 'Credit Education Flashcards'}
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {currentCibilScore ? `Score ${currentCibilScore} Active • Bureau Guidance` : 'New-to-Credit Baseline'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {!currentCibilScore ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowPreStage1Modal(true)}
                  className="text-left bg-[#17202c] border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Pre-Stage 1</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mt-1">NA/NH Status & CIBIL 750</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Why you have no score yet and why 750 unlocks 79% of prime credit.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTransitionModal(true)}
                  className="text-left bg-[#17202c] border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Stage 1 → Stage 2</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mt-1">FD Collateral & Score Debut</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Why the ₹2k micro-deposit eliminates risk and when your score debuts at ~550.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStage2To3Modal(true)}
                  className="text-left bg-[#17202c] border border-slate-800 hover:border-teal-500/40 rounded-2xl p-4 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-teal-400 font-bold uppercase">Stage 2 → Stage 3</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mt-1">The 30% CUR Rule & DPD Risk</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    How utilization and missed due dates dictate 65% of your credit score.
                  </p>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowStage2To3Modal(true)}
                  className="text-left bg-[#17202c] border border-slate-800 hover:border-teal-500/40 rounded-2xl p-4 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-teal-400 font-bold uppercase">Utilization Strategy</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mt-1">The 30% CUR Rule & DPD Risk</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Maintain balances &lt;30% to advance your {currentCibilScore} score towards 600+ and 750+.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStage3ToGradModal(true)}
                  className="text-left bg-[#17202c] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">RBI 2026 Mandate</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mt-1">RBI Weekly Credit Reporting</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    How 4x/month reporting updates your repayment history in 7 to 10 days.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStage3ToGradModal(true)}
                  className="text-left bg-[#17202c] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">Prime Transparency</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mt-1">Reading Your 1-Page KFS</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Verify true APR, fee schedules, and unpledging terms before accepting prime lines.
                  </p>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStage1Screen = () => {
    const stage1Target = appState.stage1.targetAmount || 600;
    const stage1Saved = appState.stage1.totalSaved || 0;
    const stage1Percent = stage1Target > 0 ? Math.round((stage1Saved / stage1Target) * 100) : 0;
    const stage1Remaining = Math.max(0, Math.round((stage1Target - stage1Saved) * 100) / 100);

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                STAGE 1 · SAVINGS PROOF & HABIT TRACK
              </span>
              {!appState.cardIssued && (
                <button
                  type="button"
                  onClick={() => setShowStreakInfoModal(true)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold flex items-center gap-1 hover:bg-amber-500/20 transition-colors"
                >
                  <Flame className="w-3 h-3" />
                  <span>Streak: {activeStreakPts}/30 Pts</span>
                  <HelpCircle className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1">
              Build your first financial signal.
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              {!appState.cardIssued
                ? `Save to hit your target (₹${formatRupee(stage1Target)}) AND 30 Streak Points — whichever comes second.`
                : 'Accumulate liquid savings to back future Fixed Deposits and credit limit increases.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!currentCibilScore ? (
              <button
                type="button"
                onClick={() => setShowPreStage1Modal(true)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>NA/NH Facts</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowStage2To3Modal(true)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                <span>CUR & DPD Facts</span>
              </button>
            )}
            {!appState.cardIssued && (
              <button
                type="button"
                onClick={() => setShowTransitionModal(true)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Transition Facts</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenFdModal}
              className="py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <PiggyBank className="w-3.5 h-3.5" />
              <span>Book FD</span>
            </button>
          </div>
        </div>

        {/* Primary Savings Meter */}
        <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold tracking-wider">
                Current Savings Meter
              </span>
              <h2 className="text-xl font-black text-slate-100">
                ₹{formatRupee(stage1Saved)}{' '}
                <span className="text-xs font-normal text-slate-400">/ Goal: ₹{formatRupee(stage1Target)}</span>
              </h2>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-lg font-black text-emerald-400">
                {stage1Percent}% Completed
              </div>
              <div className="text-[11px] text-slate-400">
                {isSavingsOverflow ? (
                  <span className="text-teal-400 font-bold">Overflow: +₹{formatRupee(overflowAmount)} above target</span>
                ) : stage1Remaining > 0 ? (
                  `₹${formatRupee(stage1Remaining)} remaining (${remainingIntervalsNeeded} ${unitPlural} needed)`
                ) : (
                  'Target achieved ✓'
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="h-3.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isSavingsOverflow
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-md shadow-teal-500/40'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                style={{ width: `${Math.min(100, stage1Percent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className={isSavingsOverflow ? 'text-teal-400 font-bold' : ''}>
                ₹{formatRupee(stage1Saved)} saved of ₹{formatRupee(stage1Target)} goal
              </span>
              {!appState.cardIssued && (
                <span className="text-amber-400 font-bold">
                  Streak: {activeStreakPts}/30 Pts {isStreakComplete ? '✓' : `(${30 - activeStreakPts} pts left)`}
                </span>
              )}
            </div>
          </div>
        </div>

        {renderSavingsOverflowPrompt()}

        {/* Custom Plan Controls */}
        <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wide">
                Customise Savings Schedule
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              Dynamically updates without resetting saved funds
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Target Goal */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">1. Target Goal</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[600, 1000, 2000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setIsCustomTargetOpen(false);
                      handleUpdatePlan('targetAmount', amt);
                    }}
                    className={`py-2 px-1 text-xs font-extrabold rounded-xl border transition-all text-center ${
                      appState.stage1.targetAmount === amt && !isCustomTargetOpen
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-400 shadow-sm'
                        : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
                    }`}
                  >
                    ₹{formatRupee(amt)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustomTargetOpen(true)}
                  className={`py-2 px-1 text-xs font-extrabold rounded-xl border transition-all text-center ${
                    isCustomTargetOpen
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-400 shadow-sm'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
                  }`}
                >
                  Custom
                </button>
              </div>

              {isCustomTargetOpen && (
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={appState.stage1.targetAmount}
                    onChange={(e) => handleUpdatePlan('targetAmount', Math.max(10, Number(e.target.value)))}
                    className="w-full bg-[#111722] border border-slate-700/80 rounded-xl py-2 pl-8 pr-3 text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* 2. Frequency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">2. Frequency</label>
                {!appState.cardIssued && (
                  <button
                    type="button"
                    onClick={() => setShowStreakInfoModal(true)}
                    className="text-[10px] font-mono text-amber-300 font-bold hover:underline"
                  >
                    +{streakPerDeposit} pts/{unitLabel}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'daily', label: !appState.cardIssued ? 'Daily (+1 pt)' : 'Daily' },
                  { key: 'weekly', label: !appState.cardIssued ? 'Weekly (+4 pts)' : 'Weekly' },
                  { key: 'monthly', label: !appState.cardIssued ? 'Monthly (+10 pts)' : 'Monthly' }
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleUpdatePlan('frequency', f.key)}
                    className={`py-2 px-1 text-xs font-extrabold rounded-xl border transition-all text-center ${
                      appState.stage1.frequency === f.key
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-400 shadow-sm'
                        : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Timeline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  3. Timeline ({appState.stage1.frequency === 'weekly' ? 'Weeks' : appState.stage1.frequency === 'monthly' ? 'Months' : 'Days'})
                </label>
                <span className="text-[10px] font-mono text-slate-400">Max {currentMaxTimeline}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {currentPresets.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setIsCustomTimelineOpen(false);
                      handleUpdatePlan('timelineValue', val);
                    }}
                    className={`py-2 px-1 text-xs font-extrabold rounded-xl border transition-all text-center ${
                      activeTimelineValue === val && !isCustomTimelineOpen
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-400 shadow-sm'
                        : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
                    }`}
                  >
                    {val}{appState.stage1.frequency === 'weekly' ? 'w' : appState.stage1.frequency === 'monthly' ? 'm' : 'd'}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustomTimelineOpen(true)}
                  className={`py-2 px-1 text-xs font-extrabold rounded-xl border transition-all text-center ${
                    isCustomTimelineOpen
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-400 shadow-sm'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
                  }`}
                >
                  Custom
                </button>
              </div>

              {isCustomTimelineOpen && (
                <div className="relative mt-2">
                  <input
                    type="number"
                    min="1"
                    max={currentMaxTimeline}
                    value={activeTimelineValue}
                    onChange={(e) => {
                      const num = Math.min(currentMaxTimeline, Math.max(1, Number(e.target.value) || 1));
                      handleUpdatePlan('timelineValue', num);
                    }}
                    className="w-full bg-[#111722] border border-slate-700/80 rounded-xl py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Contribution per {unitLabel}
              </label>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                Remaining: ₹{formatRupee(remainingSavings)} • {remainingIntervalsNeeded} {unitPlural} left
              </span>
            </div>

            <div className="relative group max-w-md">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 font-bold transition-colors">
                ₹
              </div>
              <input
                type="number"
                min={enforcedFloor}
                step="any"
                value={
                  appState.stage1.contributionAmount === 0 || appState.stage1.contributionAmount === ''
                    ? ''
                    : appState.stage1.contributionAmount
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    handleUpdatePlan('contributionAmount', '');
                    return;
                  }
                  const num = parseFloat(val);
                  handleUpdatePlan('contributionAmount', isNaN(num) ? '' : Math.max(0, num));
                }}
                className="w-full bg-[#111722] border border-slate-700/80 rounded-xl py-3 pl-9 pr-4 text-sm font-bold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Deposit Trigger */}
        <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-100">
                Make {unitLabel === 'day' ? 'Daily' : unitLabel === 'week' ? 'Weekly' : 'Monthly'} Deposit
              </h3>
              <p className="text-xs text-slate-400">
                Deposit ₹{formatRupee(numericContribution)} to record habit consistency. Total saved:{' '}
                <strong className="text-emerald-400">₹{formatRupee(stage1Saved)}</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSimulateNextDay}
              disabled={!isPlanViable}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold transition-all border border-slate-700/80 flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulate Next {unitLabel}</span>
            </button>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveToday}
              disabled={!isPlanViable || appState.stage1.todayCompleted}
              className={`w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                appState.stage1.todayCompleted
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                  : !isPlanViable
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25'
              }`}
            >
              {appState.stage1.todayCompleted ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>
                    {unitLabel.toUpperCase()} {appState.stage1.currentDay} complete ✓. Return next {unitLabel}.
                  </span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  <span>
                    Deposit ₹{formatRupee(numericContribution)} • {remainingIntervalsNeeded} {unitPlural} left to reach ₹{formatRupee(stage1Target)}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Habit Checklist */}
        <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
                  Dynamic Habit Checklist
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                {appState.stage1.currentDay} {unitPlural} completed • <strong>{remainingIntervalsNeeded} remaining</strong> at ₹{formatRupee(numericContribution)}/{unitLabel}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-emerald-400 font-bold block">
                ₹{formatRupee(stage1Saved)} / ₹{formatRupee(stage1Target)}
              </span>
              <span className="text-[10px] text-slate-500">
                {remainingSavings > 0 ? `₹${formatRupee(remainingSavings)} to goal` : 'Goal achieved ✓'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 max-h-60 overflow-y-auto p-1">
            {Array.from({ length: totalDynamicChecklistSlots }).map((_, i) => {
              const isDone = i < appState.stage1.currentDay;
              const isCurrent = i === appState.stage1.currentDay && !appState.stage1.todayCompleted;
              const unitPrefix = appState.stage1.frequency === 'weekly' ? 'W' : appState.stage1.frequency === 'monthly' ? 'M' : 'D';

              return (
                <div
                  key={i}
                  className={`h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold border transition-all ${
                    isDone
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : isCurrent
                      ? 'bg-slate-800 border-emerald-400 text-slate-100 ring-2 ring-emerald-500/30 animate-pulse'
                      : 'bg-[#111722] border-slate-800 text-slate-500'
                  }`}
                >
                  <span className="text-[9px] font-mono">
                    {unitPrefix}{i + 1}
                  </span>
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  ) : (
                    <span className="text-[8px] text-slate-400 font-mono">₹{formatRupee(numericContribution)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderCibilScreen = () => {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                BUREAU REPORTING & PROGRESSION
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {appState.bureau.status === 'generated' ? 'SCORE ACTIVE' : '3-6 MO TRANSMISSION'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1">
              CIBIL Credit Score Architecture
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Generating genuine bureau scores after 3-6 months, starting around ~550, then unlocking Stage 3 (600+) and Stage 4 (750+).
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!currentCibilScore ? (
              <button
                type="button"
                onClick={() => setShowPreStage1Modal(true)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>NA/NH Facts</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowStage2To3Modal(true)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                <span>CUR & DPD Facts</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSimulateMonthlyCycle}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulate Statement (+1m)</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen('stage2')}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Card Suite</span>
            </button>
          </div>
        </div>

        {/* Big Score Gauge Card */}
        <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                Official Credit Score
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl sm:text-6xl font-black text-slate-100 tracking-tight">
                  {currentCibilScore ?? 'NH'}
                </span>
                <span className="text-base text-slate-500 font-bold">
                  {currentCibilScore ? '/ 900' : '(No History Yet)'}
                </span>
              </div>

              {appState.bureau.status !== 'generated' ? (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>3 to 6 Months Reporting Period Active</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Credit scores are not simulated instantly. Partner banks submit your monthly statements. Expect your first score to debut around <strong>~550</strong> in month 3 to 6.
                  </p>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    {currentCibilScore >= 750
                      ? 'Prime Standing (Stage 4 Complete)'
                      : currentCibilScore >= 600
                      ? 'Stage 3 Qualified (Unsecured Cards Open)'
                      : 'Initial Score (~550) - Building Momentum'}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-[#111722] border border-slate-800 space-y-3 min-w-[240px]">
              <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">Score Progression Tiers</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span>750 – 900 (Stage 4)</span>
                  <span>Premium RuPay Card</span>
                </div>
                <div className="flex items-center justify-between text-teal-400 font-bold">
                  <span>600 – 749 (Stage 3)</span>
                  <span>Unsecured ₹5,000 Card</span>
                </div>
                <div className="flex items-center justify-between text-amber-400 font-bold">
                  <span>550 – 599 (Stage 2)</span>
                  <span>Initial Debuted Score</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>NH / Months 1–3</span>
                  <span>Bureau Accumulation</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Milestone Unlocks Roadmap */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`p-4 rounded-2xl border space-y-2 ${
            appState.cardIssued ? 'bg-[#111722] border-emerald-500/40' : 'bg-[#111722]/50 border-slate-800'
          }`}>
            <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">Tier 1 · Stage 2</span>
            <div className="text-sm font-black text-slate-100">Micro-FD Secured Card</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              100% deposit collateral. Generates bureau record after 3-6 months at ~550.
            </p>
          </div>

          <div className={`p-4 rounded-2xl border space-y-2 ${
            appState.bureau.unsecuredCardIssued ? 'bg-[#111722] border-teal-500/40' : canApplyUnsecured ? 'bg-teal-950/20 border-teal-500/40' : 'bg-[#111722]/50 border-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-teal-400 uppercase font-bold">Tier 2 · Stage 3 (600+)</span>
              <button
                type="button"
                onClick={() => setShowStage2To3Modal(true)}
                className="text-[9px] font-mono text-teal-300 underline font-bold"
              >
                CUR Facts
              </button>
            </div>
            <div className="text-sm font-black text-slate-100">₹5,000 Unsecured Starter</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Zero cash collateral required. Borrow on pure creditworthiness.
            </p>
            {canApplyUnsecured && !appState.bureau.unsecuredCardIssued && (
              <button
                type="button"
                onClick={() => setShowUnsecuredApplyModal(true)}
                className="w-full py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-[11px]"
              >
                Apply for ₹5,000 Card
              </button>
            )}
          </div>

          <div className={`p-4 rounded-2xl border space-y-2 ${
            appState.bureau.premiumCardIssued ? 'bg-[#111722] border-amber-500/40' : canApplyPremium ? 'bg-amber-950/20 border-amber-500/40' : 'bg-[#111722]/50 border-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">Tier 3 · Stage 4 (750+)</span>
              <button
                type="button"
                onClick={() => setShowStage3ToGradModal(true)}
                className="text-[9px] font-mono text-amber-300 underline font-bold"
              >
                KFS Rules
              </button>
            </div>
            <div className="text-sm font-black text-slate-100">₹25,000 Premium RuPay</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Prime credit standing unlocked. Hold all 3 cards simultaneously.
            </p>
            {canApplyPremium && !appState.bureau.premiumCardIssued && (
              <button
                type="button"
                onClick={() => setShowPremiumApplyModal(true)}
                className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px]"
              >
                Apply for Premium Card
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStage2Screen = () => {
    // Current card limit & spent amount dynamically based on selected active card tab
    const isSecuredActive = activeCardTab === 'secured';
    const isUnsecuredActive = activeCardTab === 'unsecured';
    const isPremiumActive = activeCardTab === 'premium';

    const currentTabLimit = isPremiumActive
      ? 25000
      : isUnsecuredActive
      ? 5000
      : activeCardLimit;

    const currentTabSpent = isPremiumActive
      ? (appState.premiumSim.spentAmount || 0)
      : isUnsecuredActive
      ? (appState.unsecuredSim.spentAmount || 0)
      : (appState.cardSim.spentAmount || 0);

    const currentTabDue = isPremiumActive
      ? (appState.premiumSim.daysUntilDue ?? 25)
      : isUnsecuredActive
      ? (appState.unsecuredSim.daysUntilDue ?? 22)
      : (appState.cardSim.daysUntilDue ?? 18);

    const cardLimit = currentTabLimit;
    const spentAmount = currentTabSpent;
    const daysUntilDue = currentTabDue;
    const curRatio = Math.round((spentAmount / cardLimit) * 100);

    let curColorClass = 'text-emerald-400';
    let curBgClass = 'bg-emerald-500/20 border-emerald-500/40';
    let curBadge = 'Optimal (<30%)';

    if (curRatio > 80) {
      curColorClass = 'text-rose-400';
      curBgClass = 'bg-rose-500/20 border-rose-500/40';
      curBadge = 'Critical Risk (>80%)';
    } else if (curRatio > 50) {
      curColorClass = 'text-orange-400';
      curBgClass = 'bg-orange-500/20 border-orange-500/40';
      curBadge = 'High Depletion (>50%)';
    } else if (curRatio > 30) {
      curColorClass = 'text-amber-400';
      curBgClass = 'bg-amber-500/20 border-amber-500/40';
      curBadge = 'Caution (>30%)';
    }

    let dueBadge = 'Grace Period Active';
    if (daysUntilDue === 0) {
      dueBadge = 'Due Today! (Compounding Interest & DPD)';
    } else if (daysUntilDue <= 3) {
      dueBadge = 'Critical: Pay Immediately';
    } else if (daysUntilDue <= 7) {
      dueBadge = 'Approaching Due Date';
    }

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                {appState.bureau.premiumCardIssued
                  ? 'STAGE 4 · PRIME PORTFOLIO (3 CARDS ACTIVE)'
                  : appState.bureau.unsecuredCardIssued
                  ? 'STAGE 3 · UNSECURED GRADUATION (2 CARDS ACTIVE)'
                  : 'STAGE 2 · SECURED CREDIT & REPAYMENT'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1">
              Credit Card Management Suite
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              {appState.bureau.premiumCardIssued
                ? 'Managing all 3 credit lines: Secured FD, Unsecured Starter, and Premium RuPay Platinum.'
                : appState.bureau.unsecuredCardIssued
                ? 'Holding 2 active cards: ₹2,000 Secured Card and ₹5,000 Unsecured Starter Card.'
                : 'Active limit backed 100% by pledged Fixed Deposit. Score generates in 3-6 months (~550).'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowStage2To3Modal(true)}
              className="py-2 px-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>CUR & DPD Facts</span>
            </button>
            <button
              type="button"
              onClick={handleSimulateMonthlyCycle}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulate Statement (+1m)</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen('stage1')}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <PiggyBank className="w-3.5 h-3.5 text-emerald-400" />
              <span>Savings</span>
            </button>
          </div>
        </div>

        {/* Multi-Card Switcher Tabs - Slideable on mobile */}
        {appState.cardIssued && (
          <div className="w-full overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveCardTab('secured')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeCardTab === 'secured'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Card 1: Secured FD (₹{formatRupee(cardLimit)})</span>
            </button>

            {appState.bureau.unsecuredCardIssued && (
              <button
                type="button"
                onClick={() => setActiveCardTab('unsecured')}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeCardTab === 'unsecured'
                    ? 'bg-teal-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Card 2: Unsecured (₹5,000)</span>
              </button>
            )}

            {appState.bureau.premiumCardIssued && (
              <button
                type="button"
                onClick={() => setActiveCardTab('premium')}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeCardTab === 'premium'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Card 3: Premium RuPay (₹25,000)</span>
              </button>
            )}
          </div>
        )}

        {/* Virtual Card Graphic */}
        <div className="relative max-w-md mx-auto aspect-[1.586/1] rounded-3xl p-6 sm:p-7 text-slate-100 shadow-2xl flex flex-col justify-between overflow-hidden border transition-all duration-300"
          style={{
            background:
              activeCardTab === 'premium'
                ? 'linear-gradient(135deg, #1c1402 0%, #2e2307 50%, #0d0a02 100%)'
                : activeCardTab === 'unsecured'
                ? 'linear-gradient(135deg, #071f1e 0%, #0c3330 50%, #041212 100%)'
                : 'linear-gradient(135deg, #071917 0%, #0f2b25 50%, #030d0b 100%)',
            borderColor:
              activeCardTab === 'premium'
                ? 'rgba(245, 158, 11, 0.4)'
                : activeCardTab === 'unsecured'
                ? 'rgba(20, 184, 166, 0.4)'
                : 'rgba(16, 185, 129, 0.4)'
          }}
        >
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              {activeCardTab === 'premium' ? (
                <Crown className="w-5 h-5 text-amber-400" />
              ) : (
                <Sparkles className="w-5 h-5 text-emerald-400" />
              )}
              <span className="text-sm font-black tracking-widest uppercase">
                {activeCardTab === 'premium'
                  ? 'ASCEND PRIME PLATINUM'
                  : activeCardTab === 'unsecured'
                  ? 'ASCEND UNSECURED STARTER'
                  : 'ASCEND SECURE FD'}
              </span>
            </div>
            <div className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900/60 font-bold border border-white/10">
              {activeCardTab === 'premium'
                ? 'STAGE 4 PRIME'
                : activeCardTab === 'unsecured'
                ? 'STAGE 3 UNSECURED'
                : 'STAGE 2 SECURED'}
            </div>
          </div>

          <div className="space-y-1 relative z-10 my-auto">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              Available Credit Limit
            </div>
            <div className="text-3xl font-black tracking-tight text-slate-100">
              {activeCardTab === 'premium' ? (
                <>₹{formatRupee(25000 - (appState.premiumSim.spentAmount || 0))} <span className="text-xs text-slate-400 font-normal">/ ₹25,000</span></>
              ) : activeCardTab === 'unsecured' ? (
                <>₹{formatRupee(5000 - (appState.unsecuredSim.spentAmount || 0))} <span className="text-xs text-slate-400 font-normal">/ ₹5,000</span></>
              ) : (
                <>₹{formatRupee(Math.max(0, cardLimit - spentAmount))} <span className="text-xs text-slate-400 font-normal">/ ₹{formatRupee(cardLimit)}</span></>
              )}
            </div>
            <div className="text-[10px] text-emerald-400 font-mono">
              {activeCardTab === 'premium'
                ? 'Zero Collateral • Lounge Access • 1% Cashback'
                : activeCardTab === 'unsecured'
                ? 'Zero Collateral • Stage 3 Graduation'
                : '100% Backed by Term Deposit Collateral'}
            </div>
          </div>

          <div className="flex items-center justify-between relative z-10 pt-2 border-t border-white/10">
            <div>
              <div className="text-[8px] font-mono uppercase text-slate-500">Cardholder</div>
              <div className="text-xs font-bold tracking-wider uppercase text-slate-200">
                {appState.user.name || 'Aarav Sharma'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8px] font-mono uppercase text-slate-500">Network</div>
              <div className="text-xs font-mono font-bold text-slate-200">RuPay Platinum</div>
            </div>
          </div>
        </div>

        {/* Live Card Usage & Due Date Sliders */}
        {appState.cardIssued && (
          <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-black text-slate-100">Live Card Risk & Repayment Simulator</h3>
                  <p className="text-xs text-slate-400">
                    Test how credit utilization ratio and payment due dates directly dictate your CIBIL score.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStage2To3Modal(true)}
                className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 font-bold transition-all flex items-center gap-1 self-start sm:self-auto"
              >
                <BookOpen className="w-3 h-3" />
                <span>Learn 30% CUR Rule</span>
              </button>
            </div>

            {/* Slider 1: Credit Utilization Ratio (CUR) */}
            <div className="space-y-3 p-4 rounded-2xl bg-[#111722] border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                    1. Credit Usage / Current Balance ({isPremiumActive ? 'Card 3: Premium' : isUnsecuredActive ? 'Card 2: Unsecured' : 'Card 1: Secured'})
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Spent: <strong className="text-slate-100">₹{formatRupee(spentAmount)}</strong> of ₹{formatRupee(cardLimit)} limit
                  </span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-xs font-mono font-bold self-start sm:self-auto ${curBgClass} ${curColorClass}`}>
                  CUR: {curRatio}% • {curBadge}
                </div>
              </div>

              <div className="relative pt-1">
                <input
                  type="range"
                  min="0"
                  max={cardLimit}
                  step="50"
                  value={spentAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (isPremiumActive) {
                      setAppState((p) => ({ ...p, premiumSim: { ...p.premiumSim, spentAmount: val } }));
                    } else if (isUnsecuredActive) {
                      setAppState((p) => ({ ...p, unsecuredSim: { ...p.unsecuredSim, spentAmount: val } }));
                    } else {
                      handleUpdateCardSim('spentAmount', val);
                    }
                  }}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1">
                  <span>₹0 (0%)</span>
                  <span className="text-emerald-400">₹{formatRupee(Math.round(cardLimit * 0.3))} (30% Max Safe)</span>
                  <span className="text-amber-400">₹{formatRupee(Math.round(cardLimit * 0.5))} (50%)</span>
                  <span className="text-rose-400">₹{formatRupee(cardLimit)} (100% Maxed)</span>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed space-y-1 ${
                  curRatio <= 30
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : curRatio <= 50
                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-black">
                  {curRatio <= 30 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>
                    {curRatio <= 30
                      ? 'Optimal Credit Utilization Strategy (<30%)'
                      : curRatio <= 50
                      ? 'High Credit Utilization Warning (30% - 50%)'
                      : 'Critical Credit Over-Utilization Alert (>50%)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {curRatio <= 30 ? (
                    <>
                      Keeping balances under 30% (₹{formatRupee(Math.round(cardLimit * 0.3))}) signals disciplined borrowing. Credit bureaus award maximum points for CURs below 30%, priming your score for 600+ and 750+.
                    </>
                  ) : curRatio <= 50 ? (
                    <>
                      <strong>Caution:</strong> Using {curRatio}% crosses the 30% threshold, slowing your progression towards prime credit.
                    </>
                  ) : (
                    <>
                      <strong>Danger to CIBIL:</strong> Maxing out {curRatio}% triggers "Credit Hunger" flags at CIBIL & Experian. High utilization accounts for nearly <strong>30% of your total credit score</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Slider 2: Due Date Timeline */}
            <div className="space-y-3 p-4 rounded-2xl bg-[#111722] border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                    2. Payment Due Date Timeline
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Cycle status: <strong className="text-slate-100">{daysUntilDue} days remaining</strong> to clear statement
                  </span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-xs font-mono font-bold self-start sm:self-auto ${
                  daysUntilDue <= 3 ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : daysUntilDue <= 7 ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}>
                  {dueBadge}
                </div>
              </div>

              <div className="relative pt-1">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={daysUntilDue}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (isPremiumActive) {
                      setAppState((p) => ({ ...p, premiumSim: { ...p.premiumSim, daysUntilDue: val } }));
                    } else if (isUnsecuredActive) {
                      setAppState((p) => ({ ...p, unsecuredSim: { ...p.unsecuredSim, daysUntilDue: val } }));
                    } else {
                      handleUpdateCardSim('daysUntilDue', val);
                    }
                  }}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1">
                  <span className="text-rose-400 font-bold">0 Days (Due Today!)</span>
                  <span className="text-amber-400">3 Days (Urgent)</span>
                  <span className="text-slate-400">15 Days (Mid-Cycle)</span>
                  <span className="text-emerald-400">30 Days (Statement Generated)</span>
                </div>
              </div>
            </div>

            {/* Permanent Secured Limit Enhancement Box in Stage 2 (when Secured Card is active) */}
            {isSecuredActive && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-[#111722] border border-emerald-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                      Card 1 Limit Management
                    </span>
                    <h4 className="text-sm font-black text-slate-100">
                      Current Limit: ₹{formatRupee(activeCardLimit)} • Backed by ₹{formatRupee(totalFdsValue)} FD
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {totalFdsValue > activeCardLimit
                        ? `You have ₹${formatRupee(totalFdsValue - activeCardLimit)} unpledged FD collateral ready to add to your limit.`
                        : 'Pledge additional FD collateral anytime to expand Card 1 limit and reduce utilization.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenLimitIncreaseModal}
                    className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-md shrink-0 flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{totalFdsValue > activeCardLimit ? 'Pledge FD & Increase Limit' : 'Add Collateral & Boost Limit'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 1 Requirements Checklist */}
        {!appState.cardIssued && (
          <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
              Card Issuance Requirements (Whichever comes 2nd)
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#111722] border border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isStreakComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">Gate 1: 30 Streak Points</div>
                    <div className="text-[11px] text-slate-400">Verifies consistent financial cash-flow discipline</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-300">{activeStreakPts}/30 Pts</span>
                  {isStreakComplete ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#111722] border border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isFdEligible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">Gate 2: ₹2,000 Micro-FD Collateral</div>
                    <div className="text-[11px] text-slate-400">100% lien against bank deposit eliminates default risk</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-300">₹{formatRupee(totalFdsValue)} / ₹2,000</span>
                  {isFdEligible ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Lock className="w-4 h-4 text-slate-500" />}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleIssueCard}
                disabled={!isStreakComplete || !isFdEligible}
                className={`w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                  isStreakComplete && isFdEligible
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25'
                    : 'bg-slate-800 text-slate-500 border border-slate-700/80 cursor-not-allowed'
                }`}
              >
                {!isStreakComplete ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Accumulate 30 Streak Pts to Unlock ({activeStreakPts}/30 pts)</span>
                  </>
                ) : !isFdEligible ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Book ₹2,000 Micro-FD to Apply for Card</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Apply & Issue Secured Card (₹{formatRupee(cardLimit)} Limit)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFdVaultScreen = () => {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
              PORTFOLIO LEDGER
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1">
              Fixed Deposit Vault
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              View your active term deposits, interest rates, and lien statuses.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenFdModal}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Open Micro-FD</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#17202c] border border-slate-800 rounded-2xl p-4">
            <div className="text-[10px] font-mono text-slate-400">TOTAL PRINCIPAL</div>
            <div className="text-2xl font-black text-slate-100">₹{formatRupee(totalFdsValue)}</div>
            <div className="text-[10px] text-emerald-400 font-medium">
              {appState.fds.length} Active Deposit{appState.fds.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="bg-[#17202c] border border-slate-800 rounded-2xl p-4">
            <div className="text-[10px] font-mono text-slate-400">CREDIT LIMIT BACKED</div>
            <div className="text-2xl font-black text-emerald-400">₹{formatRupee(totalFdsValue)}</div>
            <div className="text-[10px] text-slate-400">100% Lien for Secured Card</div>
          </div>

          <div className="bg-[#17202c] border border-slate-800 rounded-2xl p-4">
            <div className="text-[10px] font-mono text-slate-400">LIQUID SAVINGS REMAINING</div>
            <div className="text-2xl font-black text-teal-300">₹{formatRupee(appState.stage1.totalSaved)}</div>
            <div className="text-[10px] text-slate-400">Available to allocate</div>
          </div>
        </div>

        <div className="bg-[#17202c] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-200">Active Term Deposits</h3>

          {appState.fds.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <PiggyBank className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">No active Fixed Deposits yet</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Once you save or top-up ₹2,000, your deposit will register here and accrue interest at up to 7.10% p.a.
              </p>
              <button
                type="button"
                onClick={handleOpenFdModal}
                className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-slate-700 transition-all inline-flex items-center gap-1.5"
              >
                <span>Book your first FD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {appState.fds.map((fd) => (
                <div key={fd.id} className="p-4 rounded-2xl bg-[#111722] border border-slate-800 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-400">{fd.id}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                        {fd.interestRate}% p.a.
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-100">₹{formatRupee(fd.principal)}</div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block">Booked</span>
                      <span>{fd.bookingDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Matures</span>
                      <span>{fd.maturityDate} ({fd.tenureMonths}m)</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-slate-500 block">Status</span>
                      <span className="text-emerald-400 font-semibold">{fd.lienStatus}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderModals = () => {
    const liquid = appState.stage1.totalSaved || 0;
    const fromSavings = Math.min(liquid, Math.max(0, Number(fdAllocatedSavings) || 0));
    const freshTopUp = Math.max(0, Number(fdTopUpAmount) || 0);
    const totalPrincipal = fromSavings + freshTopUp;
    const estInterest =
      Math.round(((totalPrincipal * (selectedTenureOption.rate / 100) * selectedTenureOption.months) / 12) * 100) / 100;
    const projectedMaturity = totalPrincipal + estInterest;

    return (
      <>
        {/* Onboarding Flashcards Modal (Pre-Stage 1: Before Micro-Savings) */}
        {showPreStage1Modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-emerald-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-6 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">Onboarding Credit Facts (Pre-Stage 1)</h3>
                    <p className="text-xs text-slate-400">Fundamental credit knowledge before starting your savings proof</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreStage1Modal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Card 1: What is "NA/NH" Status? */}
              <div className="p-4 rounded-2xl bg-[#111722] border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Card 1 · Classification</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    NA/NH STATUS
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-100">Question: Why do I have no credit score right now?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Answer:</strong> You are marked as "NA/NH" (No Activity / No History) because you have no past credit cards or loans reported to credit bureaus. It does not mean you have a bad score; it simply means you are a "New-to-Credit" borrower.
                </p>
              </div>

              {/* Card 2: What is CIBIL & Why Does 750 Matter? */}
              <div className="p-4 rounded-2xl bg-[#111722] border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Card 2 · Benchmark Target</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    CIBIL 750+ GOAL
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-100">Question: What is a CIBIL score and what score should I aim for?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Answer:</strong> CIBIL is a 3-digit credit score ranging from 300 to 900 managed by TransUnion CIBIL under RBI regulation. Approximately 79% of all approved credit cards and loans in India are granted to applicants holding a score of 750 or higher.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowPreStage1Modal(false)}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <span>Understood, Let's Build Savings Habit</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage 2 → Stage 3 Flashcards Modal (Transition to Unsecured Credit) */}
        {showStage2To3Modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-teal-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-6 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">Stage 2 → Stage 3 Transition Facts</h3>
                    <p className="text-xs text-slate-400">Rules required to graduate from secured to unsecured credit</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStage2To3Modal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Card 5: The 30% Credit Utilization Rule (CUR) */}
              <div className="p-4 rounded-2xl bg-[#111722] border border-teal-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-teal-400 font-bold uppercase">Card 5 · Utilization Strategy</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                    30% CUR CEILING
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-100">Question: How much of my credit limit should I spend each month?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Answer:</strong> Credit utilization makes up 30% of your score. Keeping card spending below 30% of your total limit (e.g., spending under ₹600 on a ₹2,000 limit) signals financial discipline, whereas spending over 75% signals debt stress and lowers your score.
                </p>
              </div>

              {/* Card 6: The Danger of "Days Past Due" (DPD) */}
              <div className="p-4 rounded-2xl bg-[#111722] border border-teal-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-rose-400 font-bold uppercase">Card 6 · Repayment Risk</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30">
                    DPD AVOIDANCE
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-100">Question: What happens if I miss my bill due date?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Answer:</strong> Payment history is the single largest factor in your score (35% weight). Overdue payments exceeding 3 days are reported to CIBIL, and a single 30-day late payment can drop your score by 80 to 100 points.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowStage2To3Modal(false)}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <span>Understood, Keep CUR Below 30%</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage 3 → Graduation Flashcards Modal (Weekly AutoPay & Bank Offers) */}
        {showStage3ToGradModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-amber-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-6 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">Stage 3 → Graduation Transition Facts</h3>
                    <p className="text-xs text-slate-400">Weekly AutoPay, RBI reporting regulations & prime bank offers</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStage3ToGradModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Card 7: RBI's Weekly Credit Reporting Rules */}
              <div className="p-4 rounded-2xl bg-[#111722] border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">Card 7 · Regulatory Transmission</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    RBI 2026 MANDATE
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-100">Question: How quickly do my card repayments update on my CIBIL report?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Answer:</strong> Under RBI rules effective 2026, lenders report borrower data 4 times a month (on the 9th, 16th, 23rd, and month-end). Timely repayments improve your credit profile within 7 to 10 days.
                </p>
              </div>

              {/* Card 8: Reading Your Key Fact Statement (KFS) */}
              <div className="p-4 rounded-2xl bg-[#111722] border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">Card 8 · Transparency & APR</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    1-PAGE KFS
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-100">Question: How do I check the true cost of a credit offer?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Answer:</strong> RBI mandates that lenders provide a 1-page Key Fact Statement (KFS) detailing all interest rates, fees, penalties, and the Annual Percentage Rate (APR) in plain language before card activation.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowStage3ToGradModal(false)}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <span>Understood, Proceed to Prime Graduation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage 3: Unsecured Card Application Modal (CIBIL 600+) */}
        {showUnsecuredApplyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-teal-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">Stage 3 Graduation: Unsecured Card</h3>
                    <p className="text-xs text-slate-400">Zero collateral required • CIBIL {currentCibilScore} verified</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUnsecuredApplyModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#111722] border border-teal-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Approved Starting Limit:</span>
                  <span className="text-base font-black text-teal-300">₹5,000 (Unsecured)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Required Fixed Deposit:</span>
                  <span className="font-mono text-emerald-400 font-bold">₹0 (Zero Collateral)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Portfolio Status:</span>
                  <span className="font-bold text-slate-200">You will hold 2 cards</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                By maintaining clean repayment cycles on your secured card and keeping utilization under 30%, you have earned a 600+ bureau score. Submit your application below to initiate underwriting.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setShowStage2To3Modal(true)}
                  className="py-3 px-3 rounded-xl bg-slate-800 text-teal-300 font-bold text-xs border border-teal-500/30 flex items-center justify-center gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Review CUR & DPD</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyUnsecuredCard}
                  className="py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Submit Application</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsecuredApplyModal(false);
                    handleApproveUnsecuredCard();
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20 flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Judge Skip: Approve Instantly</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage 4: Premium Card Application Modal (CIBIL 750+) */}
        {showPremiumApplyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-amber-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">Stage 4 Prime: Premium RuPay Card</h3>
                    <p className="text-xs text-slate-400">Prime standing • CIBIL {currentCibilScore} verified ($\ge 750$)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPremiumApplyModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#111722] border border-amber-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Approved Prime Limit:</span>
                  <span className="text-base font-black text-amber-300">₹25,000 (Platinum Line)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Portfolio Cards:</span>
                  <span className="font-bold text-slate-200">All 3 Cards Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Privileges:</span>
                  <span className="text-emerald-400 font-bold">Lounge Access + 1% Fuel Surcharge Waiver</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Reaching a 750+ CIBIL score places you in India's top credit tier. Submit your application below to enter underwriting review.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setShowStage3ToGradModal(true)}
                  className="py-3 px-3 rounded-xl bg-slate-800 text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center justify-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Review KFS & Rules</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyPremiumCard}
                  className="py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Submit Application</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPremiumApplyModal(false);
                    handleApprovePremiumCard();
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Judge Skip: Approve Instantly</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Credit Limit Increase Application Modal */}
        {showLimitIncreaseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-emerald-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">Card 1 Secured Limit Enhancement</h3>
                    <p className="text-xs text-slate-400">Available across all stages (even with Cards 2 & 3 active)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLimitIncreaseModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#111722] border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Current Limit</span>
                    <span className="text-base font-black text-slate-200">₹{formatRupee(activeCardLimit)}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40">
                    <span className="text-[10px] font-mono text-emerald-400 block uppercase font-bold">Total Backed FD</span>
                    <span className="text-base font-black text-emerald-300">₹{formatRupee(totalFdsValue)}</span>
                    <span className="text-[10px] text-emerald-400 block">
                      {totalFdsValue > activeCardLimit 
                        ? `+₹${formatRupee(totalFdsValue - activeCardLimit)} Unpledged Collateral`
                        : '100% Pledged • Add More Below'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 p-3.5 rounded-2xl bg-[#111722] border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-200 text-xs">Select Requested Limit Amount</label>
                    <span className="font-mono text-emerald-400 font-bold text-sm">₹{formatRupee(requestedLimitInput)}</span>
                  </div>
                  <input
                    type="range"
                    min={activeCardLimit}
                    max={Math.max(activeCardLimit + 10000, totalFdsValue + 5000)}
                    step="500"
                    value={requestedLimitInput}
                    onChange={(e) => setRequestedLimitInput(Number(e.target.value))}
                    className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>Min: ₹{formatRupee(activeCardLimit)}</span>
                    <span>Max: ₹{formatRupee(Math.max(activeCardLimit + 10000, totalFdsValue + 5000))}</span>
                  </div>
                </div>

                {/* Quick Collateral Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-300">Quick Limit Enhancements:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      activeCardLimit + 1000,
                      activeCardLimit + 3000,
                      activeCardLimit + 5000
                    ].map((targetAmt) => (
                      <button
                        key={targetAmt}
                        type="button"
                        onClick={() => setRequestedLimitInput(targetAmt)}
                        className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all text-center ${
                          requestedLimitInput === targetAmt
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        ₹{formatRupee(targetAmt)}
                      </button>
                    ))}
                  </div>
                </div>

                {requestedLimitInput > totalFdsValue && (
                  <div className="p-3 rounded-xl bg-teal-950/30 border border-teal-500/40 text-[11px] text-teal-300 leading-relaxed">
                    💡 Requesting ₹{formatRupee(requestedLimitInput)} will automatically create a supplemental Fixed Deposit of <strong>₹{formatRupee(requestedLimitInput - totalFdsValue)}</strong> earning 6.85% p.a. to back this new credit limit.
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowLimitIncreaseModal(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyLimitIncrease}
                  className="py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Submit Application</span>
                </button>
                <button
                  type="button"
                  onClick={handleInstantLimitIncrease}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Judge Skip: Approve to ₹{formatRupee(requestedLimitInput)}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Target Upgrade Modal */}
        {showIncreaseTargetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-teal-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">Upgrade Savings Target</h3>
                    <p className="text-xs text-slate-400">Capture your savings momentum</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIncreaseTargetModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-300">
                  Current Target: <strong className="text-slate-100">₹{formatRupee(appState.stage1.targetAmount)}</strong>. Total Saved:{' '}
                  <strong className="text-teal-400">₹{formatRupee(appState.stage1.totalSaved)}</strong>.
                </p>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-200">Enter New Target (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                    <input
                      type="number"
                      min={appState.stage1.targetAmount + 50}
                      step="50"
                      value={newTargetInput}
                      onChange={(e) => setNewTargetInput(e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full bg-[#111722] border border-slate-700/80 rounded-xl py-3 pl-8 pr-3 text-sm font-bold text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {[1000, 1500, 2000, 3000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setNewTargetInput(String(val))}
                      className="flex-1 py-1.5 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                    >
                      ₹{formatRupee(val)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowIncreaseTargetModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyNewTarget(newTargetInput)}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20"
                >
                  Confirm Target
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Streak Points Explanation Modal */}
        {showStreakInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-amber-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Flame className="w-4 h-4 fill-amber-400/30 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">What are Streak Points?</h3>
                    <p className="text-xs text-slate-400">Behavioral risk calibration metric</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStreakInfoModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div className="p-3.5 rounded-2xl bg-[#111722] border border-amber-500/30 space-y-1.5">
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Equivalence Rule: 1 Streak Point = 1 Day of Financial Discipline</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Streak points measure your demonstrated consistency over time before credit exposure is granted.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-[#111722] border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-mono">DAILY</div>
                    <div className="text-sm font-black text-emerald-400">+1 Point</div>
                    <div className="text-[9px] text-slate-500">per daily deposit</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#111722] border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-mono">WEEKLY</div>
                    <div className="text-sm font-black text-amber-400">+4 Points</div>
                    <div className="text-[9px] text-slate-500">per weekly deposit</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#111722] border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-mono">MONTHLY</div>
                    <div className="text-sm font-black text-teal-400">+10 Points</div>
                    <div className="text-[9px] text-slate-500">per monthly deposit</div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowStreakInfoModal(false)}
                className="w-full py-3 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg"
              >
                Understood
              </button>
            </div>
          </div>
        )}

        {/* Book Fixed Deposit Modal */}
        {showFdModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">Book a Fixed Deposit</h3>
                    <p className="text-xs text-slate-400">Back your secured credit line with term deposit</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFdModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {fdModalError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fdModalError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">1. Allocate from Liquid Savings</label>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Available: ₹{formatRupee(liquid)}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    max={liquid}
                    min="0"
                    value={fdAllocatedSavings}
                    onChange={(e) => setFdAllocatedSavings(Math.min(liquid, Math.max(0, Number(e.target.value))))}
                    className="w-full bg-[#111722] border border-slate-700/80 rounded-xl py-2.5 pl-8 pr-20 text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFdAllocatedSavings(0)}
                      className="px-2 py-1 text-[10px] font-bold rounded bg-slate-800 text-slate-400 hover:text-slate-200"
                    >
                      ₹0
                    </button>
                    <button
                      type="button"
                      onClick={() => setFdAllocatedSavings(liquid)}
                      className="px-2 py-1 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    >
                      Use All
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">2. Fresh Top-Up Amount</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={fdTopUpAmount}
                    onChange={(e) => setFdTopUpAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#111722] border border-slate-700/80 rounded-xl py-2.5 pl-8 pr-3 text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="Enter additional funds"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {[1400, 3000, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFdTopUpAmount(amt)}
                      className="flex-1 py-1 text-[10px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    >
                      +₹{formatRupee(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">3. Select Tenure & Interest Rate</label>
                <div className="grid grid-cols-2 gap-2">
                  {FD_TENURE_OPTIONS.map((opt) => (
                    <button
                      key={opt.months}
                      type="button"
                      onClick={() => setFdTenureMonths(opt.months)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        fdTenureMonths === opt.months
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-[#111722] border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold">{opt.months} Months</div>
                      <div className="text-[10px] text-emerald-400">{opt.rate}% p.a.</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#111722] border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Deposit Principal:</span>
                  <span className="font-black text-slate-100">₹{formatRupee(totalPrincipal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Estimated Accrued Interest:</span>
                  <span className="font-mono text-emerald-400 font-bold">+₹{formatRupee(estInterest)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-bold">
                  <span className="text-slate-200">Maturity Value:</span>
                  <span className="text-emerald-300 font-mono">₹{formatRupee(projectedMaturity)}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleConfirmBookFd}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/20"
                >
                  Book Fixed Deposit (₹{formatRupee(totalPrincipal)})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage 1 → 2 Transition Facts Modal (Preserved as requested) */}
        {showTransitionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">Stage 1 → Stage 2 Transition Facts</h3>
                    <p className="text-xs text-slate-400">Crucial underwriting knowledge before card issuance</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTransitionModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#111722] border border-emerald-500/30 space-y-2">
                <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Fact 1: Collateral & Approval</div>
                <h4 className="text-xs font-bold text-slate-100">Why do I need an FD to get my first credit card?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Banks reject most unbanked students due to a lack of income proof. A micro-FD (e.g., ₹2,000) acts as 100% collateral, guaranteeing card approval while creating your first official bureau record without default risk.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#111722] border border-emerald-500/30 space-y-2">
                <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Fact 2: Bureau Reporting Timeline</div>
                <h4 className="text-xs font-bold text-slate-100">How long until I see my first 3-digit CIBIL score?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your official credit score generates after <strong>3 to 6 months</strong> of monthly statements submitted by the partner bank, debuting around <strong>~550</strong> before you build it upwards towards 600+ and 750+.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransitionModal(false);
                    setCurrentScreen('stage2');
                  }}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <span>Understood, Proceed to Stage 2 Micro-FD</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full 4-Stage Progression Modal */}
        {showProgressionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="bg-[#17202c] border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100">ASCEND 4-Stage Credit Progression</h3>
                    <p className="text-xs text-slate-400">Structured path from zero history (NH) to Prime 750+</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProgressionModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-[#111722] border border-emerald-500/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Stage 1 · Savings Proof</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">FOUNDATION</span>
                  </div>
                  <h4 className="font-bold text-slate-100">Build a ₹600 Saving Habit & 30 Streak Points</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Demonstrate daily or weekly cash-flow consistency before accessing credit.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#111722] border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Stage 2 · Secured Credit</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">COLLATERALIZED</span>
                  </div>
                  <h4 className="font-bold text-slate-200">₹2,000 Micro-FD Card • Score Generates in 3-6 Months (~550)</h4>
                  <p className="text-slate-400 leading-relaxed">
                    A 100% collateralized line issued with zero bureau rejection risk. After 3-6 months, your initial 3-digit score debuts around 550.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#111722] border border-teal-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-teal-400 font-bold uppercase">Stage 3 · Unsecured Card (600+)</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30">2 CARDS ACTIVE</span>
                  </div>
                  <h4 className="font-bold text-slate-200">Unlock ₹5,000 Unsecured Starter Card</h4>
                  <p className="text-slate-400 leading-relaxed">
                    When your CIBIL reaches 600 or higher, apply for your first zero-collateral credit card. Hold 2 cards simultaneously.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#111722] border border-amber-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">Stage 4 · Prime Card (750+)</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">ALL 3 CARDS</span>
                  </div>
                  <h4 className="font-bold text-slate-200">Premium RuPay Platinum Card (₹25,000 Limit)</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Achieve prime status with a 750+ score. Hold all 3 cards in your portfolio with option to unpledge your original FD collateral.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowProgressionModal(false)}
                className="w-full py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
              >
                Close Progression
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#111722] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Touch-Friendly CSS Utilities */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {renderHeader()}

      <main className="flex-1 pb-16">
        {currentScreen === 'welcome' && renderWelcomeScreen()}
        {currentScreen === 'onboarding' && renderOnboardingScreen()}
        {currentScreen === 'home' && renderHomeScreen()}
        {currentScreen === 'stage1' && renderStage1Screen()}
        {currentScreen === 'stage2' && renderStage2Screen()}
        {currentScreen === 'cibil' && renderCibilScreen()}
        {currentScreen === 'fd-vault' && renderFdVaultScreen()}
      </main>

      {renderModals()}

      {/* Floating Action Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-2xl bg-[#17202c] border border-emerald-500/40 shadow-2xl animate-fadeIn space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage.title}</span>
          </div>
          {toastMessage.subtitle && (
            <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">{toastMessage.subtitle}</p>
          )}
        </div>
      )}

      {/* Persistent Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-400 bg-[#141d2b]/80 backdrop-blur-md relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-400">
            ASCEND • Stage 1 Habit → Stage 2 Secured (~550) → Stage 3 Unsecured (600+) → Stage 4 Prime (750+)
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono text-emerald-400 font-semibold">
            {currentCibilScore ? (
              <span className="text-emerald-400">CIBIL: {currentCibilScore}</span>
            ) : appState.cardIssued ? (
              <span className="text-amber-400">Reporting Month {appState.bureau.monthsReported} of 3-6</span>
            ) : (
              <span className="text-slate-400">No Bureau Score Yet (NH)</span>
            )}
            <span>•</span>
            <span>{totalCardsCount} Card{totalCardsCount === 1 ? '' : 's'} Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}