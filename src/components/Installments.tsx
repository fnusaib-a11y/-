import React, { useState } from 'react';
import { Member, Installment } from '../types';
import { PlusCircle, Search, Printer, Receipt, MessageSquare, Send, X, Calendar, User, DollarSign, Wallet, Download, ArrowLeft, Banknote, Check, Trash2, ShieldAlert, AlertCircle, Percent, FileEdit } from 'lucide-react';
import { ADMIN_PROFILE } from '../db';
import { downloadPdf } from '../utils/pdfHelper';

interface InstallmentsProps {
  members: Member[];
  installments: Installment[];
  onAddInstallment: (newInst: Installment) => void;
  onDeleteInstallment: (id: string) => void;
  onUpdateMember?: (updatedMember: Member) => void;
  role: 'admin' | 'owner' | 'member';
}

// Helper to convert standard numbers to Bengali digits
const toBengaliDigits = (num: number | string) => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (d) => bnDigits[parseInt(d)]);
};

// Helper to convert numbers to Bengali ordinal suffixes
const getBengaliOrdinal = (n: number) => {
  if (n === 1) return '১ম';
  if (n === 2) return '২য়';
  if (n === 3) return '৩য়';
  if (n === 4) return '৪র্থ';
  if (n === 5) return '৫ম';
  if (n === 6) return '৬ষ্ঠ';
  if (n === 7) return '৭ম';
  if (n === 8) return '৮ম';
  if (n === 9) return '৯ম';
  if (n === 10) return '১০ম';
  return `${toBengaliDigits(n)}তম`;
};

export default function Installments({ members, installments, onAddInstallment, onDeleteInstallment, onUpdateMember, role }: InstallmentsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Installment | null>(null);
  const [savingsTab, setSavingsTab] = useState<'members' | 'history'>('members');

  const handleEditClick = (inst: Installment) => {
    setEditingId(inst.id);
    setMemberId(inst.memberId);
    setAmount(inst.amount.toString());
    setSavingsAmount((inst.savingsAmount || 0).toString());
    setSavingsPercent((inst.savingsPercent || 0).toString());
    setCustomProfitAmount((inst.fixedProfitAmount || inst.profitAmount || 0).toString());
    setIsBorrowerSavings(!!inst.isBorrowerSavings);
    setDate(inst.date);
    setInstType(inst.type);
    setIsAdding(true);
  };

  const handleCancelAdding = () => {
    setIsAdding(false);
    setEditingId(null);
    setMemberId('');
    setAmount('');
    setSavingsAmount('');
    setSavingsPercent('0');
    setCustomProfitAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setInstType('weekly');
    setIsBorrowerSavings(false);
  };

  const getMemberTotalSavings = (mId: string) => {
    return installments
      .filter(i => i.memberId === mId && !i.isBorrowerSavings)
      .reduce((sum, item) => sum + (Number(item.amount) || 0) + (Number(item.savingsAmount) || 0), 0);
  };

  const getMemberBorrowerSavings = (mId: string) => {
    return installments
      .filter(i => i.memberId === mId && i.isBorrowerSavings)
      .reduce((sum, item) => sum + (Number(item.amount) || 0) + (Number(item.savingsAmount) || 0), 0);
  };

  const getMemberTotalProfit = (mId: string) => {
    return installments
      .filter(i => i.memberId === mId)
      .reduce((sum, item) => sum + (Number(item.profitAmount) || 0), 0);
  };

  const handleQuickAddSavings = (mId: string) => {
    setMemberId(mId);
    const m = members.find(temp => temp.id === mId);
    if (m) {
      setAmount(m.targetInstallmentAmount.toString());
      setInstType(m.type);
    }
    setIsAdding(true);
  };

  // Modern React Modal state for robust iframe compatibility
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

  // Form Fields
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [savingsAmount, setSavingsAmount] = useState('');
  const [savingsPercent, setSavingsPercent] = useState('0');
  const [customProfitAmount, setCustomProfitAmount] = useState('');
  const [isBorrowerSavings, setIsBorrowerSavings] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [instType, setInstType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // New States for editing "কিস্তি ধরণ ও টার্গেট"
  const [editingTargetMember, setEditingTargetMember] = useState<Member | null>(null);
  const [newMemberType, setNewMemberType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [newMemberTargetAmount, setNewMemberTargetAmount] = useState('0');

  // New States for editing "মোট সঞ্চয় জমা"
  const [editingSavingsMember, setEditingSavingsMember] = useState<Member | null>(null);
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editingInstallmentDate, setEditingInstallmentDate] = useState('');
  const [editingInstallmentAmount, setEditingInstallmentAmount] = useState('');
  const [editingInstallmentSavings, setEditingInstallmentSavings] = useState('');

  const handleOpenEditTargetModal = (m: Member) => {
    setEditingTargetMember(m);
    setNewMemberType(m.type || 'weekly');
    setNewMemberTargetAmount((m.targetInstallmentAmount || 0).toString());
  };

  const handleSaveTargetEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTargetMember) return;
    if (onUpdateMember) {
      const updated: Member = {
        ...editingTargetMember,
        type: newMemberType,
        targetInstallmentAmount: parseFloat(newMemberTargetAmount) || 0
      };
      onUpdateMember(updated);
      showAlert('সফল!', `সদস্য "${editingTargetMember.name}" এর কিস্তির ধরণ ও টার্গেট সফলভাবে সংশোধন করা হয়েছে।`);
      setEditingTargetMember(null);
    } else {
      showAlert('ত্রুটি', 'সদস্য আপডেট করার কোনো ফাংশন পাওয়া যায়নি!');
    }
  };

  const handleOpenEditSavingsModal = (m: Member) => {
    setEditingSavingsMember(m);
    setEditingInstallmentId(null);
  };

  const handleStartInlineEditInstallment = (inst: Installment) => {
    setEditingInstallmentId(inst.id);
    setEditingInstallmentDate(inst.date);
    setEditingInstallmentAmount(inst.amount.toString());
    setEditingInstallmentSavings((inst.savingsAmount || 0).toString());
  };

  const handleSaveInlineEditInstallment = (inst: Installment) => {
    const amt = parseFloat(editingInstallmentAmount) || 0;
    const savAmt = parseFloat(editingInstallmentSavings) || 0;
    if (amt < 0 || savAmt < 0) {
      showAlert('ভুল ইনপুট!', 'টাকার পরিমাণ অবশ্যই ০ বা তার চেয়ে বড় হতে হবে!');
      return;
    }
    const updated: Installment = {
      ...inst,
      date: editingInstallmentDate,
      amount: amt,
      savingsAmount: savAmt,
    };
    onAddInstallment(updated);
    setEditingInstallmentId(null);
    showAlert('সফল!', 'রশিদ বা সঞ্চয় তথ্য সফলভাবে সংশোধন করা হয়েছে।');
  };

  // Clean selections (Only those who give savings, excluding pure borrowers)
  const activeMembers = members.filter(m => m?.status === 'active' && (m?.memberCategory || 'borrower') !== 'borrower');
  const selectedMember = members.find(m => m?.id === memberId);

  const filteredMembersForSavings = members.filter(m => {
    const matchesCategory = (m.memberCategory || 'borrower') !== 'borrower';
    const matchesSearch = (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (m.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (m.phone || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Auto-fill amount based on member's preset target
  const handleMemberChange = (id: string) => {
    setMemberId(id);
    const m = members.find(x => x.id === id);
    if (m) {
      setAmount(m.targetInstallmentAmount ? m.targetInstallmentAmount.toString() : '');
      setInstType(m.type || 'weekly');
      setIsBorrowerSavings(m.memberCategory === 'borrower' || m.memberCategory === 'percent_borrower');
    } else {
      setAmount('');
      setInstType('weekly');
      setIsBorrowerSavings(false);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const instAmt = parseFloat(amount) || 0;
    const savAmt = parseFloat(savingsAmount) || 0;
    const pct = parseFloat(savingsPercent) || 0;
    const directProfit = parseFloat(customProfitAmount) || 0;
    const totalDeposit = instAmt + savAmt;
    
    let computedSavingsProfit = 0;
    if (directProfit > 0) {
      computedSavingsProfit = directProfit;
    } else if (pct > 0) {
      computedSavingsProfit = Math.round((totalDeposit * (pct / 100)) * 100) / 100;
    }

    if (!memberId || (instAmt <= 0 && savAmt <= 0)) {
      showAlert('ভুল ইনপুট!', 'দয়া করে সঠিক সদস্য এবং অন্তত কিস্তি অথবা সঞ্চয় জমার পরিমাণ প্রবেশ করান!');
      return;
    }

    const currentMember = members.find(m => m.id === memberId);
    if (!currentMember) return;

    const newInst: Installment = {
      id: editingId || `INST-${Math.floor(1000 + Math.random() * 9000)}`,
      memberId,
      memberName: currentMember.name,
      amount: instAmt,
      savingsAmount: savAmt,
      profitAmount: computedSavingsProfit,
      date,
      type: instType,
      isBorrowerSavings: isBorrowerSavings,
      ...(directProfit <= 0 && pct > 0 ? { savingsPercent: pct } : {}),
      ...(directProfit > 0 ? { fixedProfitAmount: directProfit } : {})
    };

    onAddInstallment(newInst);
    setIsAdding(false);
    setEditingId(null);
    
    // Auto show receipt after entry for fast printing!
    setSelectedReceipt(newInst);

    // Reset
    setMemberId('');
    setAmount('');
    setSavingsAmount('');
    setSavingsPercent('0');
    setCustomProfitAmount('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  // Safe search
  const filteredInstallments = installments.filter(i => {
    const memberName = i?.memberName || '';
    const memberId = i?.memberId || '';
    const instId = i?.id || '';
    return (
      memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Convert numbers to Bengali words (Professional banking notation)
  const numberToBanglaWords = (num: number) => {
    if (num === 0) return 'শূণ্য';
    
    const banglaNumbers: { [key: number]: string } = {
      1: 'এক', 2: 'দুই', 3: 'তিন', 4: 'চার', 5: 'পাঁচ', 6: 'ছয়', 7: 'সাত', 8: 'আট', 9: 'নয়', 10: 'দশ',
      11: 'এগারো', 12: 'বারো', 13: 'তেরো', 14: 'চৌদ্দ', 15: 'পনেরো', 16: 'ষোলো', 17: 'সতেরো', 18: 'আঠারো', 19: 'উনিশ', 20: 'বিশ',
      21: 'একুশ', 22: 'বাইশ', 23: 'তেইশ', 24: 'চব্বিশ', 25: 'পঁচিশ', 26: 'ছাব্বিশ', 27: 'সাতাশ', 28: 'আটাশ', 29: 'উনত্রিশ', 30: 'ত্রিশ',
      31: 'একত্রিশ', 32: 'বত্রিশ', 33: 'তেত্রিশ', 34: 'চৌত্রিশ', 35: 'পঁয়ত্রিশ', 36: 'ছত্রিশ', 37: 'সাইত্রিশ', 38: 'আটত্রিশ', 39: 'উনচল্লিশ', 40: 'চল্লিশ',
      41: 'একচল্লিশ', 42: 'বিয়াল্লিশ', 43: 'তেতাল্লিশ', 44: 'চুয়াল্লিশ', 45: 'পঁয়তাল্লিশ', 46: 'ছেচল্লিশ', 47: 'সাতচল্লিশ', 48: 'আটচল্লিশ', 49: 'উনপঞ্চাশ', 50: 'পঞ্চাশ',
      51: 'একান্ন', 52: 'বাহান্ন', 53: 'তিপ্পান্ন', 54: 'চুয়ান্ন', 55: 'পঞ্চান্ন', 56: 'ছাপ্পান্ন', 57: 'সাতান্ন', 58: 'আটান্ন', 59: 'উনষাট', 60: 'ষাট',
      61: 'একষট্টি', 62: 'বাষট্টি', 63: 'তেষট্টি', 64: 'চৌষট্টি', 65: 'পঁয়ষট্টি', 66: 'ছেষট্টি', 67: 'সাতষট্টি', 68: 'আটষট্টি', 69: 'উনসত্তর', 70: 'সত্তর',
      71: 'একাত্তর', 72: 'বাহাত্তর', 73: 'তিয়াত্তর', 74: 'চুয়াত্তর', 75: 'পঁচাত্তর', 76: 'ছিয়াত্তর', 77: 'সাতাত্তর', 78: 'আটাত্তর', 79: 'উনআশি', 80: 'আশি',
      81: 'একাশি', 82: 'বিরাশি', 83: 'তিরাশি', 84: 'চুরাশি', 85: 'পঁচাশী', 86: 'ছিয়াশি', 87: 'সাতাশি', 88: 'আটাশি', 89: 'উননব্বই', 90: 'নব্বই',
      91: 'একানব্বই', 92: 'বিরানব্বই', 93: 'তিরানব্বই', 94: 'চুরানব্বই', 95: 'পঁচানব্বই', 96: 'ছিয়ানব্বই', 97: 'সাতানব্বই', 98: 'আটানব্বই', 99: 'নিরানব্বই'
    };
    
    const convertTwoDigits = (n: number) => {
      if (n === 0) return '';
      return banglaNumbers[n] || '';
    };

    let words = '';
    let temp = num;

    const crore = Math.floor(temp / 10000000);
    temp %= 10000000;
    if (crore > 0) {
      words += convertTwoDigits(crore) + ' কোটি ';
    }

    const lakh = Math.floor(temp / 100000);
    temp %= 100000;
    if (lakh > 0) {
      words += convertTwoDigits(lakh) + ' লক্ষ ';
    }

    const thousand = Math.floor(temp / 1000);
    temp %= 1000;
    if (thousand > 0) {
      words += convertTwoDigits(thousand) + ' হাজার ';
    }

    const hundred = Math.floor(temp / 100);
    temp %= 100;
    if (hundred > 0) {
      words += convertTwoDigits(hundred) + 'শত ';
    }

    if (temp > 0) {
      words += convertTwoDigits(temp);
    }

    return `${words.trim()} টাকা মাত্র`;
  };

  // Build SMS / WhatsApp template text
  const getShareText = (receipt: Installment) => {
    const totalSavings = getMemberTotalSavings(receipt.memberId);
    const totalAmt = receipt.amount + (receipt.savingsAmount || 0);
    return `সম্মানিত গ্রাহক, ${receipt.memberName}, আপনার সঞ্চয় কিস্তি জমা সফল হয়েছে।\nরশিদ নং: ${receipt.id}\nতারিখ: ${receipt.date}\nজমার পরিমাণ: ${totalAmt} ৳\nমোট সঞ্চয় ব্যালেন্স: ${totalSavings} ৳।\nধন্যবাদান্তে: ${ADMIN_PROFILE.name}।`;
  };

  return (
    <div className="space-y-6">
      {/* Page Title Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-850 font-sans">সঞ্চয় হিসাব</h2>
          <p className="text-xs text-slate-500 mt-1">দৈনিক, সাপ্তাহিক ও মাসিক সঞ্চয় জমা এন্ট্রি করা এবং রসিদ বা স্লিপ ডাউনলোড করা।</p>
        </div>
        {role === 'admin' && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow transition-all duration-200 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            নতুন সঞ্চয় এন্ট্রি
          </button>
        )}
      </div>

      {isAdding ? (
        /* Highly responsive, polished mockup for Savings Deposit Collection */
        <div className="bg-[#fcfdfd] rounded-3xl shadow-xl max-w-md mx-auto overflow-hidden border border-emerald-100 font-sans">
          
          {/* Elegant header banner with emerald-accent and back action */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 sm:p-5 flex items-center justify-between shadow-md relative">
            <button
               type="button"
               onClick={handleCancelAdding}
               className="text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer absolute left-4"
               title="বন্ধ করুন"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h3 className="text-[17px] font-bold select-none flex-1 text-center font-sans tracking-wide">
              {editingId ? 'সঞ্চয় জমা তথ্য সম্পাদন (সংশোধন)' : 'কিস্তি আদায় ও সঞ্চয় সংগ্রহ'}
            </h3>
            <div className="w-5 h-5"></div>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <form onSubmit={handleAddSubmit} className="space-y-4">
              
              {/* সদস্য নির্বাচন করুন (Select Member Dropdown) */}
              <div className="space-y-1 text-left">
                <label className="block text-xs font-bold text-slate-700">সদস্য নির্বাচন করুন</label>
                <div className="relative flex items-center bg-white border border-slate-200 hover:border-slate-300 focus-within:border-emerald-500 rounded-2xl px-3.5 py-3 transition-all shadow-sm">
                  <User className="h-5 w-5 text-slate-500 mr-2 shrink-0" />
                  <select
                    required
                    value={memberId}
                    onChange={(e) => handleMemberChange(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer appearance-none pr-6 font-sans"
                  >
                    <option value="">নির্বাচন করুন...</option>
                    {activeMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-3.5 pointer-events-none text-slate-400 text-[10px]">▼</span>
                </div>
              </div>

              {/* জমার তারিখ নির্বাচন করুন */}
              <div className="space-y-1 text-left">
                <label className="block text-xs font-bold text-slate-700">জমার তারিখ</label>
                <div className="relative flex items-center bg-white border border-slate-200 hover:border-slate-300 focus-within:border-emerald-500 rounded-2xl px-3.5 py-3 transition-all shadow-sm">
                  <Calendar className="h-5 w-5 text-slate-500 mr-2 shrink-0" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-slate-800 font-sans cursor-pointer"
                  />
                </div>
              </div>

              {/* কিস্তির ধরন (Installment Type) */}
              <div className="space-y-1 text-left">
                <label className="block text-xs font-bold text-slate-700">কিস্তির ধরন</label>
                <div className="relative flex items-center bg-white border border-slate-200 hover:border-slate-300 focus-within:border-emerald-500 rounded-2xl px-3.5 py-3 transition-all shadow-sm">
                  <select
                    required
                    value={instType}
                    onChange={(e) => setInstType(e.target.value as any)}
                    className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer appearance-none pr-6 font-sans"
                  >
                    <option value="daily">দৈনিক কিস্তি (Daily)</option>
                    <option value="weekly">সাপ্তাহিক কিস্তি (Weekly)</option>
                    <option value="monthly">মাসিক কিস্তি (Monthly)</option>
                  </select>
                  <span className="absolute right-3.5 pointer-events-none text-slate-400 text-[10px]">▼</span>
                </div>
              </div>

              {/* member auto-installment tracker matching the precise requirement */}
              {selectedMember && (() => {
                const paidCount = installments.filter(i => i.memberId === selectedMember.id).length;
                const currentOrdinal = getBengaliOrdinal(paidCount + 1);

                return (
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-3.5 text-xs text-left font-bold flex items-center gap-2 font-sans select-none animate-pulse">
                    <Check className="h-4.5 w-4.5 text-emerald-600 bg-emerald-100 p-0.5 rounded-full shrink-0" />
                    <span>
                      {paidCount > 0 ? `${toBengaliDigits(paidCount)} কিস্তি দেওয়া শেষ, ` : 'পূর্বের কোনো কিস্তি দেওয়া হয়নি, '}
                      এটা <strong className="text-emerald-950 font-extrabold underline decoration-2">{currentOrdinal} কিস্তি</strong>।
                    </span>
                  </div>
                );
              })()}

              {/* Member Savings Target/Total Stats Banner */}
              {selectedMember && (
                <div className="bg-emerald-50/60 border border-emerald-100 text-emerald-800 rounded-2xl p-3.5 text-xs text-left space-y-1 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900 border-b border-emerald-100/50 pb-1 mb-1 font-sans">
                    <Wallet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>সদস্যের সঞ্চয় তথ্য</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">নির্ধারিত আমানত:</span>
                    <strong>{toBengaliDigits(selectedMember.targetInstallmentAmount)} ৳ ({selectedMember.type === 'daily' ? 'দৈনিক' : selectedMember.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">মোট সঞ্চিত আমানত:</span>
                    <strong className="text-emerald-700 font-bold">{toBengaliDigits(getMemberTotalSavings(selectedMember.id))} ৳</strong>
                  </div>
                </div>
              )}

              {/* Side-by-Side overlapping inputs for নিয়মিত সঞ্চয় and অতিরিক্ত জমা */}
              <div className="grid grid-cols-12 gap-3.5 pt-1.5">
                
                {/* নিয়মিত সঞ্চয় জমা (Regular Deposit) - Col size 7/12 */}
                <div className="col-span-12 sm:col-span-7 relative pt-2">
                  <label className="absolute top-0 left-3 bg-[#fcfdfd] px-1.5 text-[10px] font-bold text-emerald-600 z-10 rounded select-none font-sans">
                    নিয়মিত সঞ্চয় কিস্তি
                  </label>
                  <div className="flex items-center bg-white border-2 border-emerald-500 rounded-2xl px-3 py-3 shadow-xs">
                    <Banknote className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="number"
                      required
                      placeholder="যেমন: ৫০০"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-800 font-mono"
                    />
                  </div>
                </div>

                {/* অতিরিক্ত সঞ্চয় জমা (Extra Deposit) - Col size 5/12 */}
                <div className="col-span-12 sm:col-span-5 relative pt-2">
                  <label className="absolute top-0 left-3 bg-[#fcfdfd] px-1.5 text-[10px] font-bold text-slate-400 z-10 rounded select-none font-sans">
                    অতিরিক্ত জমা (ঐচ্ছিক)
                  </label>
                  <div className="flex items-center bg-white border border-slate-200 focus-within:border-emerald-500 rounded-2xl px-3 py-3 shadow-xs transition-all">
                    <DollarSign className="h-4 w-4 text-slate-400 mr-1 shrink-0" />
                    <input
                      type="number"
                      placeholder="০"
                      value={savingsAmount}
                      onChange={(e) => setSavingsAmount(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-800 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* শতকরা লাভ/লভ्याংশ হার (%) অথবা সরাসরি লাভ/লভ্যাংশ পরিমাণ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative pt-2 text-left">
                  <label className="absolute top-0 left-3 bg-[#fcfdfd] px-1.5 text-[10px] font-bold text-emerald-600 z-10 rounded select-none font-sans">
                    মুনাফার শতকরা হার (%) (Profit Rate Percent)
                  </label>
                  <div className="flex items-center bg-white border border-slate-200 focus-within:border-emerald-500 rounded-2xl px-3.5 py-3 shadow-sm transition-all">
                    <Percent className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="number"
                      placeholder="যেমনঃ ১৫ (মুনাফার শতকরা লভ্যাংশ)"
                      value={savingsPercent}
                      disabled={parseFloat(customProfitAmount) > 0}
                      onChange={(e) => setSavingsPercent(e.target.value)}
                      className={`w-full bg-transparent border-none outline-none text-sm font-bold text-slate-800 font-mono ${parseFloat(customProfitAmount) > 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>

                <div className="relative pt-2 text-left">
                  <label className="absolute top-0 left-3 bg-[#fcfdfd] px-1.5 text-[10px] font-bold text-indigo-600 z-10 rounded select-none font-sans animate-pulse">
                    💰 সরাসরি নির্ধারিত লাভ/মুনাফা (টাকা)
                  </label>
                  <div className="flex items-center bg-white border border-slate-200 focus-within:border-indigo-500 rounded-2xl px-3.5 py-3 shadow-sm transition-all border-l-4 border-l-indigo-500">
                    <Banknote className="h-4 w-4 text-indigo-500 mr-2 shrink-0 animate-bounce" />
                    <input
                      type="number"
                      placeholder="যেমনঃ ৫০০ (১০,০০০ টাকায় ৫০০ লাভ)"
                      value={customProfitAmount}
                      onChange={(e) => setCustomProfitAmount(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-800 font-mono"
                    />
                  </div>
                </div>
              </div>

              {parseFloat(customProfitAmount) > 0 && (
                <div className="px-3.5 py-2 bg-indigo-50/70 border border-indigo-150 rounded-xl text-[10px] text-indigo-900 leading-normal font-sans shadow-xs">
                  💡 <strong>আমানত অক্ষুণ্ণ রেখে লাভ পরিশোধ ব্যবস্থা:</strong> আপনি সঞ্চয়ের বা আমানতের সাথে সরাসরি <strong>{customProfitAmount} ৳</strong> নির্ধারিত মাসিক লভ্যাংশ পরিশোধ যোগ করছেন। মূল সঞ্চয়ের টাকা অক্ষত থাকবে। (উদাঃ ১০,০০০/- সঞ্চয় অপরিবর্তিত থাকবে এবং ৫০০/- টাকা সরাসরি লাভ বা মুনাফা তহবিল হিসেবে কাজ করবে)।
                </div>
              )}

              {/* ঋণগ্রহীতার সঞ্চয়? (Borrower's Savings account) */}
              <div className="flex items-start gap-2.5 p-3.5 bg-indigo-50/40 border border-indigo-150 rounded-2xl text-left select-none">
                <input
                  type="checkbox"
                  id="isBorrowerSavingsCheckbox"
                  checked={isBorrowerSavings}
                  onChange={(e) => setIsBorrowerSavings(e.target.checked)}
                  className="h-4 w-4 mt-0.5 text-indigo-600 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="isBorrowerSavingsCheckbox" className="text-xs font-bold text-slate-700 cursor-pointer leading-tight">
                  এটা কি ঋণগ্রহীতার সঞ্চয়? (Borrower's Savings Account)
                  <span className="block text-[10px] text-slate-450 font-normal mt-0.5">
                    * সিলেক্ট করলে এই সঞ্চয়টি অন্য কোথাও না গিয়ে শুধুমাত্র <strong>"ঋণগ্রহীতার সঞ্চয়"</strong> তহবিলে জমা হবে।
                  </span>
                </label>
              </div>

              {/* Dynamic calculations list */}
              {(parseFloat(amount) > 0 || parseFloat(savingsAmount) > 0 || parseFloat(customProfitAmount) > 0) && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-[11px] text-emerald-950 leading-normal space-y-1.5 font-sans">
                  <div className="flex justify-between border-b border-emerald-200/50 pb-1">
                    <span>নিয়মিত সঞ্চয় কিস্তি:</span>
                    <strong className="font-mono">{(parseFloat(amount) || 0)} ৳</strong>
                  </div>
                  <div className="flex justify-between border-b border-emerald-200/50 pb-1">
                    <span>অতিরিক্ত সঞ্চয় আমানত:</span>
                    <strong className="font-mono">{(parseFloat(savingsAmount) || 0)} ৳</strong>
                  </div>
                  {parseFloat(customProfitAmount) > 0 ? (
                    <div className="flex justify-between border-b border-emerald-200/50 pb-1 text-indigo-700 font-bold">
                      <span>অর্জিত সঞ্চয় লভ্যাংশ (সরাসরি নির্ধারিত):</span>
                      <strong className="font-mono">+{parseFloat(customProfitAmount)} ৳ (লাভ)</strong>
                    </div>
                  ) : parseFloat(savingsPercent) > 0 ? (
                    <div className="flex justify-between border-b border-emerald-200/50 pb-1 text-teal-700 font-bold">
                      <span>অর্জিত সঞ্চয় লভ্যাংশ ({savingsPercent}%):</span>
                      <strong className="font-mono">+{Math.round(((parseFloat(amount) || 0) + (parseFloat(savingsAmount) || 0)) * (parseFloat(savingsPercent) / 100) * 100) / 100} ৳</strong>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-1 text-emerald-800 font-black text-xs">
                    <span>সর্বমোট মূল নগদ জমা (আসল অপরিবর্তিত):</span>
                    <strong className="font-mono">{(parseFloat(amount) || 0) + (parseFloat(savingsAmount) || 0)} ৳</strong>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs sm:text-sm tracking-wide shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {editingId ? <Check className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                {editingId ? 'হালনাগাদ (সংশোধন) নিশ্চিত করুন' : 'সঞ্চয় জমা নিশ্চিত করুন'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          {/* Advanced Sub-Tabs for Members aggregation vs Receipts List */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4 max-w-md">
            <button
              onClick={() => setSavingsTab('members')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                savingsTab === 'members'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-650 hover:text-slate-800'
              }`}
            >
              📊 সদস্যভিত্তিক সঞ্চয় খাতা
            </button>
            <button
              onClick={() => setSavingsTab('history')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                savingsTab === 'history'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-650 hover:text-slate-800'
              }`}
            >
              🧾 রশিদ ও কিস্তি জমার তালিকা
            </button>
          </div>

          {savingsTab === 'members' ? (
            /* Member-wise aggregated list - Resolves duplicate member listings! */
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative max-w-sm w-full">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="নাম, মোবাইল বা আইডি দিয়ে সদস্য খুঁজুন"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div className="text-xs text-slate-500 font-sans">
                  সদস্য সংখ্যা: <span className="font-bold text-emerald-600 font-mono">{filteredMembersForSavings.length} জন</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs bg-white">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-medium border-b border-slate-200">
                      <th className="p-4">সদস্য আইডি</th>
                      <th className="p-4">সদস্যের নাম ও মোবাইল</th>
                      <th className="p-4">ক্যাটাগরি</th>
                      <th className="p-4">কিস্তি ধরণ ও টার্গেট</th>
                      <th className="p-4">মোট সঞ্চয় জমা</th>
                      <th className="p-4 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredMembersForSavings.length > 0 ? (
                      filteredMembersForSavings.map((m) => {
                        const totalSavings = getMemberTotalSavings(m.id);
                        const totalProfit = getMemberTotalProfit(m.id);
                        return (
                           <tr key={m.id} className="hover:bg-slate-50/85 transition-colors">
                             <td className="p-4 font-mono font-bold text-slate-900">{m.id}</td>
                             <td className="p-4">
                               <div>
                                 <div className="font-bold text-slate-800">{m.name}</div>
                                 <div className="text-[10px] text-slate-400 font-mono">মোবাইল: {m.phone}</div>
                               </div>
                             </td>
                             <td className="p-4">
                               <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                 m.memberCategory === 'savings_only'
                                   ? 'bg-emerald-100 text-emerald-800'
                                   : m.memberCategory === 'percent_member'
                                   ? 'bg-teal-100 text-teal-800'
                                   : m.memberCategory === 'percent_borrower'
                                   ? 'bg-purple-100 text-purple-800'
                                   : 'bg-amber-100 text-amber-800'
                               }`}>
                                 {m.memberCategory === 'savings_only' ? 'শুধু সঞ্চয়কারী' :
                                  m.memberCategory === 'percent_member' ? 'পারসেন্ট সদস্য' :
                                  m.memberCategory === 'percent_borrower' ? 'পারসেন্ট ও লোন' : 'ঋণগ্রহীতা (Borrower)'}
                               </span>
                             </td>
                             <td className="p-4">
                               <div className="flex items-center gap-1.5 group">
                                 <div>
                                   <span className="text-[10px] text-slate-500 italic font-sans block">
                                     {m.type === 'daily' ? 'দৈনিক' : m.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'}
                                   </span>
                                   <div className="font-extrabold text-slate-700 font-mono">{m.targetInstallmentAmount} ৳</div>
                                 </div>
                                 {role === 'admin' && (
                                   <button
                                     type="button"
                                     onClick={() => handleOpenEditTargetModal(m)}
                                     className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all cursor-pointer shrink-0"
                                     title="কিস্তি ধরণ ও টার্গেট পরিবর্তন করুন"
                                   >
                                     <FileEdit className="h-3.5 w-3.5" />
                                   </button>
                                 )}
                               </div>
                             </td>
                             <td className="p-4 font-mono text-emerald-600 font-bold text-xs">
                               <div className="flex items-center gap-1.5 group">
                                 <div>
                                   <div className="text-[11px] text-slate-550 font-sans">
                                     সদস্য সঞ্চয়: <span className="font-extrabold text-emerald-600">{toBengaliDigits(totalSavings)} ৳</span>
                                   </div>
                                   {getMemberBorrowerSavings(m.id) > 0 && (
                                     <div className="text-[11px] text-indigo-700 font-bold mt-1 font-sans">
                                       ঋণগ্রহীতা সঞ্চয়: <span className="text-indigo-600 font-extrabold">{toBengaliDigits(getMemberBorrowerSavings(m.id))} ৳</span>
                                     </div>
                                   )}
                                   {totalProfit > 0 && (
                                     <div className="text-[10px] text-teal-600 font-sans font-medium mt-1">
                                       লভ্যাংশ: +{toBengaliDigits(totalProfit)} ৳
                                     </div>
                                   )}
                                 </div>
                                 {role === 'admin' && (
                                   <button
                                     type="button"
                                     onClick={() => handleOpenEditSavingsModal(m)}
                                     className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-all cursor-pointer shrink-0 animate-pulse hover:animate-none"
                                     title="সঞ্চয় জমা খতিয়ান ও সংশোধন করুন"
                                   >
                                     <FileEdit className="h-3.5 w-3.5" />
                                   </button>
                                 )}
                               </div>
                             </td>
                             <td className="p-4">
                               <div className="flex justify-center gap-1.5">
                                 {role === 'admin' && (
                                   <button
                                     onClick={() => handleQuickAddSavings(m.id)}
                                     className="p-1 px-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded hover:bg-emerald-100 flex items-center gap-1 cursor-pointer font-extrabold text-[10px]"
                                   >
                                     <PlusCircle className="h-3 w-3" />
                                     জমা নেন
                                   </button>
                                 )}
                               </div>
                             </td>
                           </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-slate-400">
                          কোনো সদস্যের সঞ্চয় তথ্য পাওয়া যায়নি!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Installment Collections List */
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative max-w-sm w-full">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="সদস্য স্লিপ বা রশিদ খুঁজুন"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 animate-in"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  মোট জমার পরিমাণ: <span className="font-bold text-emerald-600 font-mono">
                    {Math.round(filteredInstallments.reduce((sum, item) => sum + (Number(item.amount) || 0) + (Number(item.savingsAmount) || 0), 0))} ৳
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-105-f5 text-slate-600 font-medium border-b border-slate-200">
                      <th className="p-4">রশিদ নং (Serial)</th>
                      <th className="p-4">সদস্যের নাম</th>
                      <th className="p-4">কিস্তির ধরণ</th>
                      <th className="p-4">পেমেন্ট তারিখ</th>
                      <th className="p-4">আদায়কৃত সঞ্চয় (টাকা)</th>
                      <th className="p-4 text-center">রসিদ / স্লিপ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredInstallments.length > 0 ? (
                      filteredInstallments.map((i) => (
                        <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-900">{i.id}</td>
                          <td className="p-4">
                            <div>
                              <div className="font-semibold text-slate-800">{i.memberName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {i.memberId}</div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                              i.type === 'daily' ? 'bg-amber-100 text-amber-800' :
                              i.type === 'weekly' ? 'bg-teal-100 text-teal-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {i.type === 'daily' ? 'দৈনিক' : i.type === 'weekly' ? 'sাপ্তাহিক' : 'মাসিক'}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-slate-600">{i.date}</td>
                          <td className="p-4 font-mono text-emerald-600 font-bold text-sm">
                            <div>+{i.amount + (i.savingsAmount || 0)} ৳</div>
                            {i.savingsPercent !== undefined && i.savingsPercent > 0 && (
                              <div className="text-[10px] text-teal-600 font-sans font-medium mt-0.5">
                                মুনাফা: +{i.profitAmount || 0} ৳ ({i.savingsPercent}%)
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedReceipt(i)}
                                className="p-1 px-2 bg-slate-100 text-slate-700 border border-slate-200 rounded hover:bg-slate-200 flex items-center gap-1 cursor-pointer"
                              >
                                <Receipt className="h-3 w-3" />
                                মানি রসিদ
                              </button>
                              {role === 'admin' && (
                                <>
                                  <button
                                    onClick={() => handleEditClick(i)}
                                    className="p-1 px-1.5 text-blue-600 hover:bg-blue-50 border border-blue-200 hover:border-blue-300 rounded cursor-pointer transition-all flex items-center justify-center gap-0.5"
                                    title="সম্পাদনা (সংশোধন)"
                                  >
                                    <FileEdit className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      showConfirm(
                                        'কিস্তি জমা ডিলিট',
                                        'আপনি কি নিশ্চিত এই কিস্তি জমার তথ্যটি মুছতে চান? এটি রি-সাইকেল বিনে জমা হবে।',
                                        () => onDeleteInstallment(i.id)
                                      );
                                    }}
                                    className="p-1 px-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded cursor-pointer transition-all flex items-center justify-center gap-0.5"
                                    title="মুছুন"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-slate-400 font-sans">
                          কোনো আদায়ের রেকর্ড খুঁজে পাওয়া যায়নি।
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* POS Style Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 shadow-2xl max-w-sm w-full relative border border-slate-100 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-4 right-4 text-slate-400 p-1 rounded-full bg-slate-100 hover:text-slate-600 z-10 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Beautiful Printable Area Wrapper */}
            <div 
              id="printable-savings-receipt" 
              className="p-5 bg-white text-slate-900 border-[3px] border-emerald-600 rounded-2xl shadow-sm text-xs relative overflow-hidden font-sans"
              style={{ fontFamily: "'Hind Siliguri', 'Inter', sans-serif" }}
            >
              {/* Top Accent Bar */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-600"></div>
              
              {/* Official Stamp Overlay decoration */}
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/5 rounded-full border-4 border-dashed border-emerald-500/15 flex items-center justify-center rotate-12 pointer-events-none select-none">
                <span className="text-emerald-600/10 font-bold tracking-widest text-[9px] uppercase">Micro Finance</span>
              </div>

              {/* Title & Official Header */}
              <div className="text-center pb-3 border-b-2 border-emerald-100 relative">
                <div className="flex justify-center mb-1">
                  <div className="p-1 px-3 bg-emerald-600 text-white font-extrabold text-[9px] rounded-full uppercase tracking-wider select-none shadow-sm">
                    Money Receipt
                  </div>
                </div>
                <h3 className="text-md font-black text-emerald-800 tracking-tight leading-normal">ক্ষুদ্র সঞ্চয় ও কিস্তি আদায় সমিতি</h3>
                <p className="text-[9.5px] text-slate-505 leading-tight font-medium">ঢাকা, বাংলাদেশ • মোবাইল: {ADMIN_PROFILE.phone}</p>
                <div className="mt-2 inline-block px-2.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-md font-extrabold text-[9px]">
                  সঞ্চয় সাপ্তাহিক/দৈনিক কিস্তি স্লিপ
                </div>
              </div>

              {/* Receipt metadata pills */}
              <div className="grid grid-cols-2 gap-2 my-3.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-left">
                  <span className="text-[8.5px] text-slate-400 block uppercase font-bold tracking-wider">রশিদ আইডি</span>
                  <strong className="text-[10.5px] font-mono text-emerald-700">{selectedReceipt.id}</strong>
                </div>
                <div className="text-right">
                  <span className="text-[8.5px] text-slate-400 block uppercase font-bold tracking-wider">তারিখ</span>
                  <strong className="text-[10.5px] font-mono text-slate-700">{selectedReceipt.date}</strong>
                </div>
              </div>

              {/* Member profile key data */}
              <div className="space-y-1.5 border-b border-dashed border-emerald-100 pb-3 text-left">
                <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg">
                  <span className="text-slate-500 font-medium">সদস্যের নাম:</span>
                  <strong className="text-slate-800 font-bold">{selectedReceipt.memberName}</strong>
                </div>
                <div className="flex justify-between items-center p-1.5 py-0.5">
                  <span className="text-slate-500 font-medium">সদস্য আইডি:</span>
                  <strong className="text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded text-[10px] border border-slate-200">{selectedReceipt.memberId}</strong>
                </div>
                <div className="flex justify-between items-center p-1.5 py-0.5">
                  <span className="text-slate-500 font-medium">মোবাইল নম্বর:</span>
                  <span className="text-slate-805 font-semibold font-mono">
                    {members.find(m => m.id === selectedReceipt.memberId)?.phone || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-1.5 py-0.5">
                  <span className="text-slate-500 font-medium">হিসাবের ধরণ:</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[9px] font-extrabold rounded-md border border-emerald-101">
                    {selectedReceipt.type === 'daily' ? 'দৈনিক সঞ্চয়' : selectedReceipt.type === 'weekly' ? 'সাপ্তাহিক সঞ্চয়' : 'মাসিক সঞ্চয়'}
                  </span>
                </div>
              </div>

              {/* Transaction Amount Table */}
              <div className="my-3 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-50 text-emerald-800 font-extrabold text-[9.5px] border-b border-emerald-101">
                      <th className="p-2">আদায় বিবরণী</th>
                      <th className="p-2 text-right">পরিমাণ (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-slate-700 bg-white">
                    <tr>
                      <td className="p-2 font-medium text-slate-605">১. নিয়মিত সঞ্চয় কিস্তি (Regular)</td>
                      <td className="p-2 text-right font-mono font-bold">{selectedReceipt.amount} ৳</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium text-slate-605">২. অতিরিক্ত সঞ্চয় আমানত (Extra Detail)</td>
                      <td className="p-2 text-right font-mono font-bold">{(selectedReceipt.savingsAmount || 0)} ৳</td>
                    </tr>
                    {selectedReceipt.savingsPercent !== undefined && selectedReceipt.savingsPercent > 0 && (
                      <tr className="text-teal-700 bg-emerald-50/20">
                        <td className="p-2 font-semibold text-teal-600">৩. অর্জিত সঞ্চয় মুনাফা ({selectedReceipt.savingsPercent}%)</td>
                        <td className="p-2 text-right font-mono font-bold">+{selectedReceipt.profitAmount || 0} ৳</td>
                      </tr>
                    )}
                    <tr className="bg-emerald-500/5 text-slate-900 font-bold text-[11px] border-t-2 border-emerald-600/25">
                      <td className="p-2 text-emerald-800 font-extrabold">সর্বমোট আদায়কৃত (Net Amount)</td>
                      <td className="p-2 text-right font-mono font-extrabold text-emerald-700">
                        {toBengaliDigits(selectedReceipt.amount + (selectedReceipt.savingsAmount || 0))} ৳
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Words Representation */}
              <div className="text-left px-1.5 mb-3">
                <span className="text-[8px] text-slate-400 font-bold block mb-0.5">কথায় (Amount in Words)</span>
                <span className="font-semibold text-emerald-800 bg-emerald-500/5 p-1.5 rounded-lg block border border-emerald-500/10 text-[9.5px]">
                  {numberToBanglaWords(selectedReceipt.amount + (selectedReceipt.savingsAmount || 0))}
                </span>
              </div>

              {/* Total Balance highlight */}
              <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-slate-800 flex justify-between items-center my-3.5 shadow-md">
                <div className="text-left">
                  <span className="text-[8px] text-slate-400 block font-bold leading-none tracking-wider uppercase mb-1">সদস্যের সঞ্চয় ব্যালেন্স</span>
                  <span className="text-[9px] text-amber-300 font-semibold font-sans">সর্বমোট আমানত স্থিতি</span>
                </div>
                <strong className="text-xs font-sans text-emerald-300 font-extrabold">
                  {toBengaliDigits(getMemberTotalSavings(selectedReceipt.memberId))} ৳
                </strong>
              </div>

              {/* Notice text */}
              <p className="text-[8.5px] text-slate-405 text-center select-none font-medium mt-3.5 italic">
                * নিয়মিত সঞ্চয় জমা রাখুন, ভবিষ্যৎ জীবন সুরক্ষিত রাখুন। ধন্যবাদ। *
              </p>

              {/* Official Signature Blocks */}
              <div className="mt-8 flex justify-between items-end select-none">
                <div className="text-center w-20">
                  <div className="h-0.5 w-full bg-slate-300"></div>
                  <span className="text-[8.5px] text-slate-500 mt-1 block font-bold">গ্রাহকের স্বাক্ষর</span>
                </div>
                <div className="text-center w-28 relative">
                  <span className="block text-emerald-600 text-[11px] italic font-semibold font-serif mb-0.5 px-1 truncate">
                    {ADMIN_PROFILE.name}
                  </span>
                  <div className="h-0.5 w-full bg-slate-300"></div>
                  <span className="text-[8.5px] text-slate-500 mt-1 block font-bold">আদায়কারী / এডমিন</span>
                </div>
              </div>
            </div>

            {/* Sharing & Printing Controls */}
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => downloadPdf('printable-savings-receipt', `রসিদ-${selectedReceipt?.id || 'রিসিপ্ট'}`, 'সদস্য সঞ্চয় জমা রসিদ')}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold shadow flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  পিডিএফ ডাউনলোড (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const printContents = document.getElementById('printable-savings-receipt')?.outerHTML;
                    if (printContents) {
                      const printWindow = window.open('', '_blank');
                      printWindow?.document.write(`
                        <html>
                          <head>
                            <title>SAVINGS RECEIPT - ${selectedReceipt.id}</title>
                            <script src="https://cdn.tailwindcss.com"></script>
                            <style>
                              @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
                              body { 
                                font-family: 'Hind Siliguri', 'Inter', sans-serif; 
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                                background-color: #ffffff;
                              }
                              /* Optimize printing sizing */
                              @page {
                                size: auto;
                                margin: 15mm;
                              }
                            </style>
                          </head>
                          <body class="flex items-center justify-center min-h-screen bg-slate-50 p-6">
                            <div class="scale-125 w-full max-w-sm">${printContents}</div>
                            <script>
                              window.onload = function() {
                                window.print();
                              };
                            </script>
                          </body>
                        </html>
                      `);
                      printWindow?.document.close();
                    }
                  }}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold shadow flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <Printer className="h-3.5 w-3.5 shrink-0" />
                  রসিদ প্রিন্ট করুন
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getShareText(selectedReceipt))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 bg-slate-100 hover:bg-slate-200 text-teal-800 rounded-xl text-[10px] font-bold border border-slate-200 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  হায়াটসঅ্যাপে পাঠান
                </a>
                <a
                  href={`sms:?&body=${encodeURIComponent(getShareText(selectedReceipt))}`}
                  className="py-2 bg-slate-100 hover:bg-slate-200 text-sky-800 rounded-xl text-[10px] font-bold border border-slate-200 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                  এসএমএস (SMS)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Modal for editing target & type */}
      {editingTargetMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 text-slate-800 text-left animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900 font-sans">কিস্তি ধরণ ও টার্গেট সংশোধন</h3>
              <button
                type="button"
                onClick={() => setEditingTargetMember(null)}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            
            <div className="mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <p className="text-[10px] text-slate-450 font-sans">সদস্যের নাম ও আইডি</p>
              <h4 className="text-xs font-bold text-slate-800 mt-0.5">{editingTargetMember.name} ({editingTargetMember.id})</h4>
            </div>

            <form onSubmit={handleSaveTargetEdit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5">কিস্তির ধরণ</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewMemberType(t)}
                      className={`py-2 px-1 text-center rounded-xl text-[10px] font-bold transition-all border cursor-pointer ${
                        newMemberType === t
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'daily' ? 'দৈনিক' : t === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5">টার্গেট কিস্তির পরিমাণ (৳)</label>
                <input
                  type="number"
                  required
                  value={newMemberTargetAmount}
                  onChange={(e) => setNewMemberTargetAmount(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-sans"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTargetMember(null)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[10px] transition-all cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[10px] transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  সংশোধন নিশ্চিত
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal for editing member's savings entries (ledger) */}
      {editingSavingsMember && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xl w-full border border-slate-100 text-slate-800 text-left animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 font-sans">সদস্য সঞ্চয় খতিয়ান ও সংশোধন</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">রশিদ ভিত্তিক সঞ্চয় জমা সংশোধন / ডিলিট করার খাতা</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSavingsMember(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5 text-slate-500" />
              </button>
            </div>

            <div className="mb-4 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[9px] text-slate-400 font-sans uppercase font-bold">সদস্য বিবরণী</span>
                <h4 className="text-xs font-black text-slate-800">{editingSavingsMember.name} ({editingSavingsMember.id})</h4>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-400 font-sans uppercase font-bold">মোট জমানো সঞ্চয়</span>
                <div className="text-sm font-black text-emerald-600 font-sans">
                  {getMemberTotalSavings(editingSavingsMember.id)} ৳
                </div>
              </div>
            </div>

            {/* List of installments/savings entries of this specific member */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 mb-4 min-h-[250px]">
              <h5 className="text-[10px] font-bold text-slate-500 mb-2 sticky top-0 bg-white py-1">জমা রশিদের তালিকা</h5>
              {installments.filter(i => i.memberId === editingSavingsMember.id).length > 0 ? (
                installments
                  .filter(i => i.memberId === editingSavingsMember.id)
                  .sort((a,b) => b.date.localeCompare(a.date))
                  .map((inst) => {
                    const isEditingThis = editingInstallmentId === inst.id;
                    return (
                      <div key={inst.id} className={`p-3 rounded-2xl border transition-all ${
                        isEditingThis ? 'bg-amber-50/40 border-amber-200 shadow-sm' : 'bg-slate-50/40 border-slate-100 hover:border-slate-200'
                      }`}>
                        {isEditingThis ? (
                          /* Inline edit form */
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[8px] font-bold text-slate-500 mb-1">তারিখ</label>
                                <input
                                  type="date"
                                  value={editingInstallmentDate}
                                  onChange={(e) => setEditingInstallmentDate(e.target.value)}
                                  className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-100 font-sans font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-bold text-slate-500 mb-1">মূল কিস্তি (৳)</label>
                                <input
                                  type="number"
                                  value={editingInstallmentAmount}
                                  onChange={(e) => setEditingInstallmentAmount(e.target.value)}
                                  className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-100 font-sans font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-bold text-slate-500 mb-1">অতিরিক্ত সঞ্চয় (৳)</label>
                                <input
                                  type="number"
                                  value={editingInstallmentSavings}
                                  onChange={(e) => setEditingInstallmentSavings(e.target.value)}
                                  className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-100 font-sans font-bold"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 text-[10px] font-bold pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingInstallmentId(null)}
                                className="px-2.5 py-1 bg-slate-150 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                              >
                                বাতিল
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveInlineEditInstallment(inst)}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="h-3 w-3" /> সংশোধন নিশ্চিত
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <div className="flex items-center justify-between gap-2.5">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-sans font-extrabold text-[11px] text-slate-800">
                                  {inst.amount + (inst.savingsAmount || 0)} ৳
                                </span>
                                <span className="text-[8px] font-mono bg-slate-200 text-slate-600 px-1 py-0.5 rounded tracking-wider">
                                  {inst.id}
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-400 mt-1 font-sans flex items-center gap-2">
                                <span>তারিখ: {inst.date}</span>
                                <span className="text-slate-300">|</span>
                                <span>কিস্তি: {inst.amount} ৳</span>
                                {inst.savingsAmount ? (
                                  <>
                                    <span className="text-slate-300">|</span>
                                    <span>অতিরিক্ত: {inst.savingsAmount} ৳</span>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartInlineEditInstallment(inst)}
                                className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 rounded text-[9px] font-sans font-bold cursor-pointer transition-colors"
                              >
                                সংশোধন
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  showConfirm(
                                    'রশিদ ডিলিট নিশ্চিতকরণ',
                                    `আপনি কি নিশ্চিতভাবেই রশিদ "${inst.id}" ডিলিট করতে চান? ডিলিট করলে ${inst.amount + (inst.savingsAmount || 0)} ৳ সঞ্চয় মোট তহবিল থেকে কেটে নেওয়া হবে।`,
                                    () => {
                                      onDeleteInstallment(inst.id);
                                      showAlert('সফল!', 'রশিদটি সফলভাবে ডিলিট করা হয়েছে এবং তহবিল হালনাগাদ করা হয়েছে।');
                                    }
                                  );
                                }}
                                className="p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 rounded text-[9px] cursor-pointer transition-colors"
                                title="ডিলিট করুন"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-2xl text-slate-400 text-xs">
                  কোনো সঞ্চয় জমা রশিদ পাওয়া যায়নি!
                </div>
              )}
            </div>

            <div className="border-t pt-4 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingSavingsMember(null);
                  handleQuickAddSavings(editingSavingsMember.id);
                }}
                className="w-full py-2.5 bg-emerald-650 hover:bg-emerald-700 text-white font-bold rounded-xl text-[10px] transition-all shadow active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="h-4 w-4" /> নতুন জমা যোগ করুন
              </button>
              <button
                type="button"
                onClick={() => setEditingSavingsMember(null)}
                className="w-full py-2.5 bg-slate-105 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[10px] transition-all cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Dialog/Modal system (Bypasses iFrame sandboxed constraints beautifully) */}
      {dialog && dialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                <p className="text-[10px] text-slate-500 mt-0.5">{dialog.type === 'confirm' ? 'অনুমতি নিশ্চিতকরণ খাতা' : 'গুরুত্বपूर्ण সতর্কতা সিগন্যাল'}</p>
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
                    className="px-4 py-2 bg-slate-100 lg:hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
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
