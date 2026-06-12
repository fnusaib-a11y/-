import React, { useState, useMemo, useEffect } from 'react';
import { Member, Loan } from '../types';
import { Landmark, Search, PlusCircle, Printer, X, Receipt, HandCoins, TrendingUp, Calendar, AlertTriangle, ArrowLeft, User, DollarSign, Percent, Hash, Check, Gavel, Banknote, Trash2, ShieldAlert, AlertCircle } from 'lucide-react';

// Helper to convert standard numbers to Bengali digits
const toBengaliDigits = (num: number | string) => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (d) => bnDigits[parseInt(d)]);
};

interface LoansProps {
  members: Member[];
  loans: Loan[];
  onAddLoan: (newLoan: Loan) => void;
  onRepayLoan: (
    loanId: string, 
    repayAmount: number, 
    installmentNo?: string, 
    principalPaid?: number, 
    profitPaid?: number
  ) => void;
  onDeleteLoan?: (id: string) => void;
  role: 'admin' | 'owner' | 'member';
  currentMemberId?: string;
}

export default function Loans({ members, loans, onAddLoan, onRepayLoan, onDeleteLoan, role, currentMemberId }: LoansProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isRepaying, setIsRepaying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepayLoan, setSelectedRepayLoan] = useState<Loan | null>(null);

  // Custom dialogue state for sandbox / iframe safety
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert';
    onConfirm?: () => void;
  } | null>(null);

  const showAlert = (title: string, message: string) => {
    setDialog({ isOpen: true, title, message, type: 'alert' });
  };

  const showConfirm = (title: string, message: string, onConfirmClick: () => void) => {
    setDialog({ isOpen: true, title, message, type: 'confirm', onConfirm: onConfirmClick });
  };

  // Repayment form fields
  const [repayInstallmentNo, setRepayInstallmentNo] = useState('');
  const [repayPrincipalAmount, setRepayPrincipalAmount] = useState('');
  const [repayProfitAmount, setRepayProfitAmount] = useState('');
  const [repayPenaltyAmount, setRepayPenaltyAmount] = useState('0');

  // Loan Issue form fields
  const [memberId, setMemberId] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestPercent, setInterestPercent] = useState('10');
  const [installmentCount, setInstallmentCount] = useState('12');
  const [installmentType, setInstallmentType] = useState('Weekly');
  const [takenDate, setTakenDate] = useState(new Date().toISOString().split('T')[0]);

  // Reactive calculations for Loan setup matching screenshot requirements
  const computedTotalPayable = useMemo(() => {
    const principal = parseFloat(principalAmount) || 0;
    const rate = parseFloat(interestPercent) || 0;
    return principal + (principal * (rate / 100));
  }, [principalAmount, interestPercent]);

  const computedInstallmentAmount = useMemo(() => {
    const total = computedTotalPayable;
    const count = parseInt(installmentCount) || 1;
    return Math.round((total / count) * 100) / 100;
  }, [computedTotalPayable, installmentCount]);

  const computedDueDate = useMemo(() => {
    const dateObj = new Date(takenDate);
    if (isNaN(dateObj.getTime())) return '';
    const count = parseInt(installmentCount) || 0;
    if (installmentType === 'Weekly') {
      dateObj.setDate(dateObj.getDate() + (count * 7));
    } else if (installmentType === 'Monthly') {
      dateObj.setMonth(dateObj.getMonth() + count);
    } else if (installmentType === 'Daily') {
      dateObj.setDate(dateObj.getDate() + count);
    } else {
      dateObj.setMonth(dateObj.getMonth() + 6);
    }
    return dateObj.toISOString().split('T')[0];
  }, [takenDate, installmentCount, installmentType]);

  // Filter members eligible for taking loans (active members)
  const activeMembers = members.filter(m => m?.status === 'active');

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const corePrincipal = parseFloat(principalAmount) || 0;
    if (!memberId || corePrincipal <= 0 || computedInstallmentAmount <= 0 || !computedDueDate) {
      showAlert('অসম্পূর্ণ ফরম!', 'দয়া করে সব আবশ্যক ফিল্ড সঠিকভাবে পূরণ করুন!');
      return;
    }

    const borrower = members.find(m => m?.id === memberId);
    if (!borrower) return;

    // Check if member already has active loan
    const hasActiveLoan = loans.some(l => l.memberId === memberId && l.status === 'active');
    if (hasActiveLoan) {
      showAlert('ঋণ ওভারল্যাপ ত্রুটি!', `দুঃখিত, "${borrower.name}" এর একটি ঋণ ইতিমধ্যে চলমান রয়েছে! পূর্বের ঋণ পরিশোধ হলে নতুন ঋণ নেওয়া যাবে।`);
      return;
    }

    const coreRate = parseFloat(interestPercent) || 10;
    const computedProfit = computedTotalPayable - corePrincipal;

    // Set principal amount of Loan to total payable amount (original principal + interest rate profit)
    // to match original code structure where repaidAmount reconciles from 0 to total original loan size.
    const newLoan: Loan = {
      id: `LOAN-${Math.floor(1000 + Math.random() * 9000)}`,
      memberId,
      memberName: borrower.name,
      principalAmount: computedTotalPayable,
      takenDate,
      dueDate: computedDueDate,
      repaidAmount: 0,
      installmentAmount: computedInstallmentAmount,
      status: 'active',
      interestPercent: coreRate,
      originalPrincipal: corePrincipal,
      profitAmount: computedProfit
    };

    onAddLoan(newLoan);
    setIsAdding(false);

    // Reset
    setMemberId('');
    setPrincipalAmount('');
    setInterestPercent('10');
    setInstallmentCount('12');
    setInstallmentType('Weekly');
  };

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(repayPrincipalAmount) || 0;
    const profit = parseFloat(repayProfitAmount) || 0;
    const fine = parseFloat(repayPenaltyAmount) || 0;
    const totalAmount = principal + profit + fine;

    if (!selectedRepayLoan || totalAmount <= 0) {
      showAlert('তথ্য ত্রুটি!', 'দয়া করে কিস্তির সঠিক আসল এবং লাভ পরিমাণ দিন!');
      return;
    }

    const remaining = selectedRepayLoan.principalAmount - selectedRepayLoan.repaidAmount;
    if (principal > remaining) {
      showAlert('আসল বেশি!', `দুঃখিত, পরিশোধের আসল পরিমাণ বকেয়া ঋণের চেয়ে বেশি হতে পারে না! সর্বোচ্চ বকেয়া আসল: ${remaining} ৳`);
      return;
    }

    // Capture fine in the installment text so it saves/syncs seamlessly in ledger/notifications
    const fineText = fine > 0 ? `। জরিমানা: ${fine} ৳` : '';
    const finalInstLabel = `${repayInstallmentNo}${fineText}`;

    onRepayLoan(selectedRepayLoan.id, totalAmount, finalInstLabel, principal, profit + fine);
    setIsRepaying(false);
    setSelectedRepayLoan(null);
    setRepayInstallmentNo('');
    setRepayPrincipalAmount('');
    setRepayProfitAmount('');
    setRepayPenaltyAmount('0');
  };

  // Bengali Month translator and date formatter
  const getBengaliMonthName = (dateStr: string) => {
    const months = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return '';
    return `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  };

  const getBengaliOrdinal = (num: number) => {
    const ordinals: Record<number, string> = {
      1: '১ম',
      2: '২য়',
      3: '৩য়',
      4: '৪র্থ',
      5: '৫ম',
      6: '৬ষ্ঠ',
      7: '৭ম',
      8: '৮ম',
      9: '৯ম',
      10: '১০ম'
    };
    return ordinals[num] || `${num}তম`;
  };

  const getFormattedDateEn = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate().toString().padStart(2, '0');
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${monthsEn[d.getMonth()]}`;
  };

  const formatReadableDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  // Generate dynamic 12-month (or custom N-month) installment schedule calendar for selected loan
  const computedInstallmentSchedule = useMemo(() => {
    if (!selectedRepayLoan) return [];

    const borrower = members.find(m => m.id === selectedRepayLoan.memberId);
    const intervalType = borrower?.type || 'monthly'; // default to monthly

    const totalAmount = selectedRepayLoan.principalAmount;
    const singleAmt = selectedRepayLoan.installmentAmount || Math.round(totalAmount / 12);
    const estCount = Math.round(totalAmount / singleAmt) || 12;

    const schedule = [];
    let runnerDate = new Date(selectedRepayLoan.takenDate);
    let runningPaidProgress = selectedRepayLoan.repaidAmount || 0;

    for (let i = 1; i <= estCount; i++) {
      if (intervalType === 'weekly') {
        runnerDate.setDate(runnerDate.getDate() + 7);
      } else if (intervalType === 'monthly') {
        runnerDate.setMonth(runnerDate.getMonth() + 1);
      } else if (intervalType === 'daily') {
        runnerDate.setDate(runnerDate.getDate() + 1);
      } else {
        runnerDate.setMonth(runnerDate.getMonth() + 1);
      }

      const dateStr = runnerDate.toISOString().split('T')[0];

      let status: 'paid' | 'partial' | 'due' = 'due';
      let coveredAmount = 0;

      if (runningPaidProgress >= singleAmt) {
        status = 'paid';
        coveredAmount = singleAmt;
        runningPaidProgress -= singleAmt;
      } else if (runningPaidProgress > 0) {
        status = 'partial';
        coveredAmount = runningPaidProgress;
        runningPaidProgress = 0;
      } else {
        status = 'due';
        coveredAmount = 0;
      }

      schedule.push({
        index: i,
        installmentNoStr: `${i}তম কিস্তি`,
        date: dateStr,
        expectedAmount: singleAmt,
        coveredAmount,
        status,
      });
    }
    return schedule;
  }, [selectedRepayLoan, members]);

  // Prepopulate the repayment inputs once a loan is opened
  useEffect(() => {
    if (selectedRepayLoan) {
      const borrower = members.find(m => m.id === selectedRepayLoan.memberId);
      const intervalType = borrower?.type || 'monthly';
      
      const totalAmount = selectedRepayLoan.principalAmount;
      const singleAmt = selectedRepayLoan.installmentAmount || Math.round(totalAmount / 12);
      
      const paidAmt = selectedRepayLoan.repaidAmount || 0;
      const nextIdx = Math.floor(paidAmt / singleAmt) + 1;
      
      let runnerDate = new Date(selectedRepayLoan.takenDate);
      for (let i = 1; i <= nextIdx; i++) {
        if (intervalType === 'weekly') {
          runnerDate.setDate(runnerDate.getDate() + 7);
        } else if (intervalType === 'monthly') {
          runnerDate.setMonth(runnerDate.getMonth() + 1);
        } else if (intervalType === 'daily') {
          runnerDate.setDate(runnerDate.getDate() + 1);
        } else {
          runnerDate.setMonth(runnerDate.getMonth() + 1);
        }
      }
      
      const dateStr = runnerDate.toISOString().split('T')[0];
      const monthLabel = getBengaliMonthName(dateStr);
      const finalLabel = `${nextIdx}তম কিস্তি (${monthLabel})`;
      
      setRepayInstallmentNo(finalLabel);
      
      const remainingTotal = totalAmount - paidAmt;
      const originalPrincipal = selectedRepayLoan.originalPrincipal || Math.round(totalAmount / 1.1);
      const totalProfit = selectedRepayLoan.profitAmount !== undefined ? selectedRepayLoan.profitAmount : (totalAmount - originalPrincipal);
      const profitRatio = totalAmount > 0 ? (totalProfit / totalAmount) : 0.0909;
      
      const currentPayAmt = Math.min(singleAmt, remainingTotal);
      const profitPart = Math.round(currentPayAmt * profitRatio);
      const principalPart = currentPayAmt - profitPart;

      setRepayPrincipalAmount(principalPart.toString());
      setRepayProfitAmount(profitPart.toString());
      setRepayPenaltyAmount('0');
    } else {
      setRepayInstallmentNo('');
      setRepayPrincipalAmount('');
      setRepayProfitAmount('');
      setRepayPenaltyAmount('0');
    }
  }, [selectedRepayLoan, members]);

  // Filter loans list depending on role
  // If role is member: MUST only see their own login loan details!
  const displayedLoans = loans.filter(l => {
    if (role === 'member') {
      return l?.memberId === currentMemberId;
    }
    // Admin / Owner sees searched list
    const memberName = l?.memberName || '';
    const memberId = l?.memberId || '';
    const loanId = l?.id || '';
    return memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
           loanId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Title Header */}
      {!isAdding && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">ঋণ বিতরণ ও আদায় খাতা</h2>
            <p className="text-xs text-slate-500 mt-1">
              {role === 'member' 
                ? 'আপনার নামে গৃহীত মোট ঋণ, নিয়মিত ঋণ পরিশোধ বিবরণী ও বকেয়া হিসাব কাস্টম প্যানেল।'
                : 'সদস্যদের ঋণ বিতরণ করা, নিয়মিত কিস্তিতে ঋণ আদায় করা এবং বকেয়া রিপোর্টিং।'
              }
            </p>
          </div>
          {role === 'admin' && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const activeLoans = loans.filter(l => l.status === 'active');
                  if (activeLoans.length > 0) {
                    setSelectedRepayLoan(activeLoans[0]);
                    setIsRepaying(true);
                  } else {
                    showAlert('নিষ্ক্রিয় ঋণ নথি', 'দুঃখিত, বর্তমানে কোনো সক্রিয় ঋণ নথি পাওয়া যায়নি যার কিস্তি আদায় করা যাবে!');
                  }
                }}
                className="flex items-center gap-1.5 bg-[#1d8df5] hover:bg-[#157ad7] text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow transition-all duration-200 cursor-pointer"
              >
                <Receipt className="h-4 w-4" />
                কিস্তি আদায় (বড় লোন)
              </button>

              <button
                onClick={() => {
                  setIsAdding(true);
                  setTakenDate(new Date().toISOString().split('T')[0]);
                }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow transition-all duration-200 cursor-pointer"
              >
                <HandCoins className="h-4 w-4" />
                নতুন ঋণ বিতরণ করুন
              </button>
            </div>
          )}
        </div>
      )}

      {/* Disburse Loan Form - Custom design styled EXACTLY like the user's uploaded image mockup! */}
      {isAdding && (
        <div className="bg-slate-50 rounded-3xl overflow-hidden shadow-2xl max-w-sm mx-auto border border-slate-100 pb-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Header Bar: Signature Blue */}
          <div className="bg-[#1d8df5] px-4 py-4.5 text-white flex items-center relative shadow-md">
            <button 
              type="button" 
              onClick={() => setIsAdding(false)} 
              className="absolute left-4 p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="পিছনে যান"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h3 className="w-full text-center text-base font-bold tracking-wide font-sans">
              ঋণ প্রদান
            </h3>
          </div>

          <form onSubmit={handleIssueSubmit} className="p-5 space-y-4">
            {/* Input 1: member select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 font-sans">সদস্য নির্বাচন করুন</label>
              <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl hover:border-blue-400 focus-within:border-[#1d8df5] focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                  <User className="h-4.5 w-4.5" />
                </span>
                <select
                  required
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="w-full pl-11 pr-10 py-3.5 bg-transparent rounded-2xl text-xs text-slate-800 font-sans outline-none appearance-none cursor-pointer"
                >
                  <option value="">নির্বাচন করুন...</option>
                  {activeMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
                <span className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">▼</span>
              </div>
            </div>

            {/* Input 2: Loan principal amount */}
            <div className="space-y-1.5">
              <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl hover:border-blue-400 focus-within:border-[#1d8df5] focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-650 text-slate-800 font-extrabold text-sm pointer-events-none">$</span>
                <input
                  type="number"
                  required
                  placeholder="ঋণের পরিমাণ"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-transparent rounded-2xl text-xs text-slate-800 outline-none font-sans placeholder-slate-400 font-semibold"
                />
              </div>
            </div>

            {/* Inputs 3: Side-by-side splits */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Interest percent */}
              <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl hover:border-blue-400 focus-within:border-[#1d8df5] focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-650 text-slate-800 pointer-events-none">
                  <Percent className="h-4 w-4" />
                </span>
                <input
                  type="number"
                  required
                  placeholder="সুদ (%)"
                  value={interestPercent}
                  onChange={(e) => setInterestPercent(e.target.value)}
                  className="w-full pl-10 pr-3 py-3.5 bg-transparent rounded-2xl text-xs text-slate-800 outline-none font-sans placeholder-slate-400 font-semibold"
                />
              </div>

              {/* Installment Count */}
              <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl hover:border-blue-400 focus-within:border-[#1d8df5] focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-650 text-slate-800 pointer-events-none">
                  <Hash className="h-4 w-4" />
                </span>
                <input
                  type="number"
                  required
                  placeholder="কিস্তি সংখ্যা"
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(e.target.value)}
                  className="w-full pl-10 pr-3 py-3.5 bg-transparent rounded-2xl text-xs text-[#06152b] outline-none font-sans placeholder-slate-400 font-semibold"
                />
              </div>
            </div>

            {/* Input 4: Installment type select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 font-sans">কিস্তির ধরন</label>
              <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl hover:border-blue-400 focus-within:border-[#1d8df5] focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                  <Calendar className="h-4 w-4" />
                </span>
                <select
                  required
                  value={installmentType}
                  onChange={(e) => setInstallmentType(e.target.value)}
                  className="w-full pl-11 pr-10 py-3.5 bg-transparent rounded-2xl text-xs text-slate-800 font-sans outline-none appearance-none cursor-pointer font-semibold"
                >
                  <option value="Weekly">Weekly (সাপ্তাহিক)</option>
                  <option value="Monthly">Monthly (মাসিক)</option>
                  <option value="Daily">Daily (দৈনিক)</option>
                </select>
                <span className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">▼</span>
              </div>
            </div>

            {/* Real-time Dynamic Calculator summary cards (Highly intuitive bookkeeping UI) */}
            {parseFloat(principalAmount) > 0 && (
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-[11px] text-blue-900 leading-normal space-y-1.5 font-sans">
                <div className="flex justify-between border-b border-blue-200/50 pb-1">
                  <span>মোট মূল ঋণ (সুদ বাদে):</span>
                  <strong className="font-mono">{principalAmount} ৳</strong>
                </div>
                <div className="flex justify-between border-b border-blue-200/50 pb-1">
                  <span>সুদের মুনাফা পরিমাণ ({interestPercent}%):</span>
                  <strong className="font-mono text-emerald-700">+ {Math.round(((parseFloat(principalAmount) || 0) * (parseFloat(interestPercent) || 0) / 100) * 100) / 100} ৳</strong>
                </div>
                <div className="flex justify-between border-[#157ad7]/20 border-b pb-1 font-bold">
                  <span>সর্বমোট পরিশোধ্য ঋণ:</span>
                  <strong className="font-mono text-[#1d8df5]">{computedTotalPayable} ৳</strong>
                </div>
                <div className="flex justify-between font-bold">
                  <span>প্রতি কিস্তির পরিমাণ ({installmentCount}টি):</span>
                  <strong className="font-mono text-[#1d8df5]">{computedInstallmentAmount} ৳</strong>
                </div>
              </div>
            )}

            {/* Submit / Cancel row */}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#1d8df5] hover:bg-[#157ad7] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all active:scale-[0.98]"
              >
                ঋণ অনুমোদন করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Amortization Repay Installment Modal */}
      {isRepaying && selectedRepayLoan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-left">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl md:max-w-4xl w-full relative border border-slate-100 max-h-[92vh] overflow-y-auto font-sans animate-in fade-in zoom-in-95 duration-200">
            
            {/* Elegant Header Resembling the Picture App Bar */}
            <div className="bg-[#1d8df5] text-white p-4 sm:p-5 rounded-t-3xl flex items-center gap-3 shadow-md relative">
              <button
                type="button"
                onClick={() => { setIsRepaying(false); setSelectedRepayLoan(null); }}
                className="text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"
                title="বন্ধ করুন"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h3 className="text-base font-bold select-none flex-1 text-center pr-8">
                কিস্তি আদায়
              </h3>
            </div>

            {/* Main Dual-Pane Matrix */}
            <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-start">
              
              {/* LEFT COLUMN: Input Form and Real-time Balance Math (6 Cols) */}
              <div className="md:col-span-6 space-y-4">
                
                {/* Ledger & Status info summary card */}
                <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-[12px] text-emerald-950 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">ঋণ গ্রহীতা:</span>
                    <strong className="text-emerald-900 text-sm font-bold">{selectedRepayLoan.memberName}</strong>
                  </div>
                  <div className="flex justify-between items-center border-t border-emerald-100 pt-1.5">
                    <span className="text-slate-500">বকেয়া ঋণ অবশিষ্ট:</span>
                    <strong className="font-mono text-rose-600 font-extrabold text-sm">
                      {selectedRepayLoan.principalAmount - selectedRepayLoan.repaidAmount} ৳
                    </strong>
                  </div>
                </div>

                {/* Interactive Form matching the precise visual specification */}
                <form onSubmit={handleRepaySubmit} className="space-y-4">
                  
                  {/* সদস্য নির্বাচন করুন (Select Member Dropdown) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">সদস্য নির্বাচন করুন</label>
                    <div className="relative flex items-center bg-white border border-slate-200 hover:border-slate-300 focus-within:border-[#1d8df5] rounded-2xl px-3 py-3 transition-all">
                      <User className="h-5 w-5 text-slate-500 mr-2 shrink-0" />
                      <select
                        value={selectedRepayLoan.id}
                        onChange={(e) => {
                          const found = loans.find(l => l.id === e.target.value);
                          if (found) setSelectedRepayLoan(found);
                        }}
                        className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer appearance-none pr-6 font-sans"
                      >
                        {loans.filter(l => l.status === 'active').map(l => (
                          <option key={l.id} value={l.id}>
                            {l.memberName} (ID: {l.memberId} | লোন: {l.id})
                          </option>
                        ))}
                      </select>
                      <span className="absolute right-3.5 pointer-events-none text-slate-400 text-[10px]">▼</span>
                    </div>
                  </div>

                  {/* কিস্তি নির্বাচন করুন (Select Installment Dropdown) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">কিস্তি নির্বাচন করুন</label>
                    <div className="relative flex items-center bg-white border border-slate-200 hover:border-slate-300 focus-within:border-[#1d8df5] rounded-2xl px-3 py-3 transition-all">
                      <Calendar className="h-5 w-5 text-slate-500 mr-2 shrink-0" />
                      <select
                        value={`${repayInstallmentNo.split(' ')[0] || ''}`}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const [idxStr, date, amtStr] = val.split('|');
                          const idx = parseInt(idxStr);
                          const amt = parseFloat(amtStr);
                          
                          const monthLabel = getBengaliMonthName(date);
                          setRepayInstallmentNo(`${idx}তম কিস্তি (${monthLabel})`);
                          
                          const totalAmount = selectedRepayLoan.principalAmount;
                          const paidAmt = selectedRepayLoan.repaidAmount || 0;
                          const remainingTotal = totalAmount - paidAmt;
                          setRepayPrincipalAmount(Math.min(amt, remainingTotal).toString());
                        }}
                        className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-[#0d1622] cursor-pointer appearance-none pr-6 font-sans"
                      >
                        <option value="">নির্বাচন করুন...</option>
                        {computedInstallmentSchedule.map(item => {
                          const formattedEn = getFormattedDateEn(item.date);
                          return (
                            <option 
                              key={item.index} 
                              value={`${item.index}|${item.date}|${item.expectedAmount}`}
                              disabled={item.status === 'paid'}
                            >
                              {formattedEn} - ৳{item.expectedAmount} {item.status === 'paid' ? ' [পরিশোধিত]' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <span className="absolute right-3.5 pointer-events-none text-slate-400 text-[10px]">▼</span>
                    </div>
                  </div>

                  {/* Dynamic Custom Ordinal Progress Banner (৪ কিস্তি দেওয়া শেষ, এটা ৫ম কিস্তি) */}
                  {selectedRepayLoan && (() => {
                    const totalAmount = selectedRepayLoan.principalAmount;
                    const singleAmt = selectedRepayLoan.installmentAmount || Math.round(totalAmount / 12);
                    const paidAmt = selectedRepayLoan.repaidAmount || 0;
                    const nextIdx = Math.floor(paidAmt / singleAmt) + 1;
                    
                    const paidCount = nextIdx - 1;
                    const currentOrdinal = getBengaliOrdinal(nextIdx);

                    return (
                      <div className="bg-blue-50 border border-blue-100 text-[#1d8df5] rounded-2xl p-3 text-xs text-left font-bold flex items-center gap-2 font-sans select-none animate-pulse">
                        <Check className="h-4 w-4 text-[#1d8df5] bg-blue-100 p-0.5 rounded-full shrink-0" />
                        <span>
                          {paidCount > 0 ? `${toBengaliDigits(paidCount)} কিস্তি দেওয়া শেষ, ` : 'পূর্বের কোনো কিস্তি দেওয়া হয়নি, '}
                          এটা <strong className="text-[#137ad7] font-extrabold underline decoration-2">{currentOrdinal} কিস্তি</strong>।
                        </span>
                      </div>
                    );
                  })()}

                  {/* Hidden current installment placeholder */}
                  <input type="hidden" value={repayInstallmentNo} />

                  {/* Side-by-Side overlapping inputs for আদায়ের পরিমাণ and জরিমানা */}
                  <div className="grid grid-cols-12 gap-3.5 pt-2">
                    
                    {/* আদায়ের পরিমাণ (Amount Collected) - Col size 7/12 */}
                    <div className="col-span-7 relative pt-2">
                      <label className="absolute top-0 left-3 bg-white px-1.5 text-[10px] font-bold text-[#1d8df5] z-10 rounded select-none">
                        আদায়ের পরিমাণ
                      </label>
                      <div className="flex items-center bg-white border-2 border-[#1d8df5] rounded-xl px-3 py-2.5 shadow-sm">
                        <Banknote className="h-4 w-4 text-slate-400 mr-2 shrink-0 animate-bounce" />
                        <input
                          type="number"
                          required
                          placeholder="টাকা"
                          value={repayPrincipalAmount}
                          onChange={(e) => setRepayPrincipalAmount(e.target.value)}
                          className="w-full bg-transparent border-none outline-none text-sm md:text-[15px] font-bold text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    {/* জরিমানা (Penalty Fine) - Col size 5/12 */}
                    <div className="col-span-12 sm:col-span-5 relative pt-2">
                      <label className="absolute top-0 left-3 bg-white px-1.5 text-[10px] font-bold text-slate-400 z-10 rounded select-none">
                        জরিমানা
                      </label>
                      <div className="flex items-center bg-white border border-slate-200 focus-within :border-[#1d8df5] rounded-xl px-3 py-2.5 shadow-sm transition-all animate-pulse">
                        <Gavel className="h-4 w-4 text-[#1d8df5] mr-1 shrink-0" />
                        <input
                          type="number"
                          required
                          placeholder="০"
                          value={repayPenaltyAmount}
                          onChange={(e) => setRepayPenaltyAmount(e.target.value)}
                          className="w-full bg-transparent border-none outline-none text-sm md:text-[15px] font-bold text-slate-850 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Optional Interest Repayment helper label */}
                  <div className="relative pt-2">
                    <label className="absolute top-0 left-3 bg-white px-1.5 text-[10px] font-bold text-slate-400 z-10 rounded select-none">
                      লাভের টাকা (প্রয়োজন হলে)
                    </label>
                    <div className="flex items-center bg-white border border-slate-200 focus-within:border-emerald-500 rounded-xl px-3 py-2.5 shadow-sm transition-all">
                      <Percent className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                      <input
                        type="number"
                        placeholder="যেমনঃ ৫০"
                        value={repayProfitAmount}
                        onChange={(e) => setRepayProfitAmount(e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-slate-700 font-mono"
                      />
                    </div>
                  </div>

                  {/* Dynamic Cash Ledger display */}
                  <div className="p-3.5 bg-slate-900 text-slate-200 rounded-2xl space-y-1.5 border border-slate-800 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1 flex justify-between items-center font-sans">
                      <span>টাকা জমার বিবরণ (Cash Summary)</span>
                      <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400 font-mono font-semibold">Live</span>
                    </div>
                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span>আসলের টাকা:</span>
                        <span>{(parseFloat(repayPrincipalAmount) || 0)} ৳</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>লাভের টাকা:</span>
                        <span>{(parseFloat(repayProfitAmount) || 0)} ৳</span>
                      </div>
                      {parseFloat(repayPenaltyAmount) > 0 && (
                        <div className="flex justify-between text-amber-400">
                          <span>জরিমানা ফি:</span>
                          <span>+ {repayPenaltyAmount} ৳</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-slate-800 text-[#1d8df5] font-extrabold text-xs">
                        <span>সর্বমোট আদায় নগদ:</span>
                        <span>{(parseFloat(repayPrincipalAmount) || 0) + (parseFloat(repayProfitAmount) || 0) + (parseFloat(repayPenaltyAmount) || 0)} ৳</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Actions resembling the solid design */}
                  <button
                    type="submit"
                    className="w-full bg-[#1d8df5] hover:bg-[#137ad7] text-white rounded-2xl py-3.5 text-xs font-bold tracking-wider shadow-sm text-center flex items-center justify-center cursor-pointer transition-transform active:scale-[0.99] font-sans"
                  >
                    আদায় সম্পন্ন করুন
                  </button>

                </form>
              </div>

              {/* RIGHT COLUMN: Auto-Generated 12-Month/Period Repayment Calendar Schedule (6 Cols) */}
              <div className="md:col-span-6 bg-slate-50 p-4 rounded-3xl border border-slate-200/50 flex flex-col space-y-3">
                <div className="border-b border-slate-200/60 pb-2 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black text-slate-800">স্বয়ংক্রিয় পরিশোধ ক্যালেন্ডার সূচী</h4>
                    <span className="text-[9.5px] text-slate-500">১২ মাস কিস্তি প্রদানের দিন তারিখ খতিয়ান</span>
                  </div>
                  <span className="text-[9.5px] font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg">
                    {members.find(m => m.id === selectedRepayLoan.memberId)?.type ? `টাইপ: ${members.find(m => m.id === selectedRepayLoan.memberId)?.type}` : 'মাসিক'}
                  </span>
                </div>

                {/* Calendar List items */}
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {computedInstallmentSchedule.map((item) => (
                    <div 
                      key={item.index}
                      onClick={() => {
                        if (item.status !== 'paid') {
                          const monthLabel = getBengaliMonthName(item.date);
                          setRepayInstallmentNo(`${item.index}তম কিস্তি (${monthLabel})`);
                          
                          const totalAmount = selectedRepayLoan.principalAmount;
                          const paidAmt = selectedRepayLoan.repaidAmount || 0;
                          const remainingTotal = totalAmount - paidAmt;
                          setRepayPrincipalAmount(Math.min(item.expectedAmount, remainingTotal).toString());
                        }
                      }}
                      className={`p-2.5 rounded-xl border flex justify-between items-center text-xs transition-colors cursor-pointer ${
                        item.status === 'paid' 
                          ? 'bg-emerald-50/50 border-emerald-100 opacity-75 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:bg-slate-100 hover:border-emerald-300'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${item.status === 'paid' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          <strong className="text-slate-800 font-semibold">{item.installmentNoStr}</strong>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {formatReadableDate(item.date)} ({getBengaliMonthName(item.date)})
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="font-mono font-bold text-slate-900">{item.expectedAmount} ৳</div>
                        {item.status === 'paid' ? (
                          <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                            <Check className="h-2.5 w-2.5" /> পরিশোধিত
                          </span>
                        ) : item.status === 'partial' ? (
                          <span className="inline-flex items-center bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md font-sans">
                            আংশিক জমাকৃ
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="bg-slate-100 text-slate-700 hover:bg-[#1d8df5] hover:text-white text-[9px] font-bold px-2 py-0.5 rounded transition-all font-sans"
                          >
                            পূরণ করুন
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[10.5px] border-t border-slate-200 pt-2 text-[#475569] text-left font-sans leading-relaxed">
                  💡 সূচীর যেকোনো বকেয়া কিস্তিতে ক্লিক করলে সেটি বামের পরিশোধ ফর্মে <strong>স্বয়ংক্রিয়ভাবে তারিখসহ পূরণ</strong> হয়ে যাবে।
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Display loan records ledger list */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {role !== 'member' && (
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="ঋণগ্রহীতার নাম বা মোবাইল বা আইডি দিয়ে খুঁজুন"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 focus:ring-2"
              />
            </div>

            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-2 leading-relaxed">
              <div>মোট ঋণ বিতরণ: <span className="font-bold text-slate-800 font-mono">{loans.reduce((sum, item) => sum + item.principalAmount, 0)} ৳</span></div>
              <div>মোট আদায় ঋণ: <span className="font-bold text-emerald-600 font-mono">{loans.reduce((sum, item) => sum + item.repaidAmount, 0)} ৳</span></div>
              <div className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100/80 flex items-center gap-1">
                <span>আদায়কৃত মুনাফা (শতকরা লাভ):</span>
                <span className="font-extrabold font-mono text-purple-900">{loans.reduce((sum, item) => sum + (item.profitRepaid || 0), 0)} ৳</span>
              </div>
              <div>বকেয়া ঋণ: <span className="font-bold text-rose-500 font-mono">{loans.reduce((sum, item) => sum + (item.principalAmount - item.repaidAmount), 0)} ৳</span></div>
              <div className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                (সম্ভাব্য মোট লাভ: <span className="font-semibold font-mono text-slate-600">{loans.reduce((sum, item) => {
                  const orig = item.originalPrincipal || Math.round(item.principalAmount / 1.1);
                  return sum + (item.profitAmount !== undefined ? item.profitAmount : (item.principalAmount - orig));
                }, 0)} ৳</span>)
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100/50 text-slate-600 font-medium border-b border-slate-200">
                <th className="p-4 w-16 text-center">সিরিয়াল নং</th>
                <th className="p-4">ঋণ আইডি (ID)</th>
                <th className="p-4">গ্রাহকের নাম ও আইডি</th>
                <th className="p-4 flex items-center gap-1">বিতরণ ও মেয়াদ</th>
                <th className="p-4">ঋণ ও লাভের হিসাব বিবরণী</th>
                <th className="p-4">কিস্তি পরিশোধ অগ্রগতি (Paid vs Remaining)</th>
                <th className="p-4">অবস্থা (Status)</th>
                {role === 'admin' && <th className="p-4 text-center">ব্যবস্থাপনা</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedLoans.length > 0 ? (
                displayedLoans.map((l, index) => {
                  const originalPrincipal = l.originalPrincipal || Math.round(l.principalAmount / 1.1);
                  const interestPercent = l.interestPercent !== undefined ? l.interestPercent : 10;
                  const profitAmount = l.profitAmount !== undefined ? l.profitAmount : (l.principalAmount - originalPrincipal);
                  
                  const remaining = l.principalAmount - l.repaidAmount;
                  const payRatio = Math.min(100, Math.round((l.repaidAmount / l.principalAmount) * 100));

                  const estSingleAmt = l.installmentAmount || Math.round(l.principalAmount / 12);
                  const paidInstNo = Math.round(l.repaidAmount / estSingleAmt);
                  const totalInstNo = Math.round(l.principalAmount / estSingleAmt);
                  
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 w-16 text-center text-slate-500 font-semibold font-mono">{index + 1}</td>
                      <td className="p-4 font-mono font-bold text-slate-900">{l.id}</td>
                      <td className="p-4 font-sans text-left">
                        <div>
                          <div className="font-semibold text-slate-800">{l.memberName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {l.memberId}</div>
                        </div>
                      </td>
                      <td className="p-4 space-y-1 text-left font-sans text-[11px]">
                        <div className="text-slate-500 flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3 inline text-emerald-600" /> বিতরণ: {l.takenDate}
                        </div>
                        <div className="text-slate-500 flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3 inline text-rose-500" /> মেয়াদ: {l.dueDate}
                        </div>
                      </td>
                      <td className="p-4 text-left space-y-1 font-sans">
                        <div className="text-xs text-slate-700">
                          আসল লোন: <span className="font-semibold text-slate-900 font-mono">{originalPrincipal} ৳</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          মুনাফা/লাভ ({interestPercent}%): <span className="font-semibold text-teal-600 font-mono">+{profitAmount} ৳</span>
                        </div>
                        <div className="text-xs border-t border-slate-100/50 pt-1 text-blue-700 font-medium">
                          মোট পরিশোধযোগ্য: <span className="font-bold text-blue-900 font-mono">{l.principalAmount} ৳</span>
                        </div>
                      </td>
                      <td className="p-4 space-y-2 min-w-[210px] text-left font-sans">
                        <div className="flex justify-between items-center text-[10px] sm:text-xs">
                          <span className="text-emerald-700 font-bold">আদায়: {l.repaidAmount} ৳ ({payRatio}%)</span>
                          <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold font-sans">
                            {toBengaliDigits(paidInstNo)}/{toBengaliDigits(totalInstNo)} কিস্তি
                          </span>
                          <span className="text-rose-600 font-bold">বাকি: {remaining} ৳ ({100 - payRatio}%)</span>
                        </div>
                        
                        {/* Progress slider bar */}
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${payRatio}%` }}></div>
                        </div>
                        
                        <div className="text-[10px] text-slate-500 flex flex-col gap-0.5 leading-tight">
                          <span>• প্রতি কিস্তি পরিমাণ: <strong className="font-mono text-slate-800">{l.installmentAmount} ৳</strong></span>
                          <span>• পরিশোধিত কিস্তি: <strong className="text-emerald-600">{toBengaliDigits(paidInstNo)}টি</strong>, অবশিষ্টাংশ: <strong className="text-rose-500">{toBengaliDigits(Math.max(0, totalInstNo - paidInstNo))}টি</strong></span>
                        </div>
                      </td>
                      <td className="p-4 text-left">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          remaining === 0 ? 'bg-emerald-100 text-emerald-800' :
                          new Date(l.dueDate) < new Date() ? 'bg-rose-100 text-rose-800 animate-pulse' :
                          'bg-sky-100 text-sky-800'
                        }`}>
                          {remaining === 0 ? 'পরিশোধিত' : 
                           new Date(l.dueDate) < new Date() ? 'মেয়াদোত্তীর্ণ (Overdue)' : 'চলমান ঋণ'}
                        </span>
                      </td>
                      {role === 'admin' && (
                        <td className="p-4">
                          <div className="flex justify-center gap-1.5">
                            {remaining > 0 ? (
                              <button
                                onClick={() => { setSelectedRepayLoan(l); setIsRepaying(true); }}
                                className="p-1 px-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded shadow-sm hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                              >
                                <Receipt className="h-3 w-3" />
                                কিস্তি আদায়
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px] font-bold">আদায় সম্পন্ন</span>
                            )}
                            {role === 'admin' && onDeleteLoan && (
                              <button
                                onClick={() => {
                                  showConfirm(
                                    'ঋণ ফাইল ডিলিট',
                                    'আপনি কি নিশ্চিত ঋণের এই ফাইলটি ডিলিট করতে চান? এটি রি-সাইকেল বিনে জমা হবে।',
                                    () => onDeleteLoan(l.id)
                                  );
                                }}
                                className="p-1 text-slate-405 hover:text-rose-600 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded cursor-pointer transition-all flex items-center justify-center font-sans font-bold"
                                title="মুছুন"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-slate-400 font-sans">
                    কোনো সক্রিয় ঋণ নথি পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Dialog/Modal system (Bypasses iFrame sandboxed constraints beautifully) */}
      {dialog && dialog.isOpen && (
        <div className="fixed inset-0 z-55 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 text-slate-800 text-left animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-2xl ${dialog.type === 'confirm' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                {dialog.type === 'confirm' ? (
                  <ShieldAlert className="h-6 w-6 shrink-0" />
                ) : (
                  <AlertCircle className="h-6 w-6 shrink-0" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{dialog.title}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{dialog.type === 'confirm' ? 'অনুমতি নিশ্চিতকরণ খাতা' : 'গুরুত্বপূর্ণ সতর্কতা সিগন্যাল'}</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed mb-6 font-sans">
              {dialog.message}
            </p>

            <div className="flex justify-end gap-2 text-xs">
              {dialog.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => setDialog(null)}
                    className="px-4 py-2 bg-slate-100 lg:hover:bg-slate-200 text-slate-705 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={() => {
                      if (dialog.onConfirm) dialog.onConfirm();
                      setDialog(null);
                    }}
                    className="px-4 py-2 bg-rose-600 lg:hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    নিশ্চিত করুন
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDialog(null)}
                  className="px-5 py-2 bg-emerald-650 lg:hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  ঠিক আছে
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
