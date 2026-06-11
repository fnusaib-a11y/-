import React, { useState } from 'react';
import { Member, Installment } from '../types';
import { PlusCircle, Search, Printer, Receipt, MessageSquare, Send, X, Calendar, User, DollarSign, Wallet, Download, ArrowLeft, Banknote, Gavel, Check, Trash2, ShieldAlert, AlertCircle } from 'lucide-react';
import { ADMIN_PROFILE } from '../db';
import { downloadPdf } from '../utils/pdfHelper';

interface InstallmentsProps {
  members: Member[];
  installments: Installment[];
  onAddInstallment: (newInst: Installment) => void;
  onDeleteInstallment: (id: string) => void;
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

// Helper to format English short month and date (e.g., "06 Mar")
const formatExpectedDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate().toString().padStart(2, '0');
    const month = months[d.getMonth()];
    return `${day} ${month}`;
  } catch (e) {
    return dateStr;
  }
};

export default function Installments({ members, installments, onAddInstallment, onDeleteInstallment, role }: InstallmentsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Installment | null>(null);

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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Clean selections
  const activeMembers = members.filter(m => m?.status === 'active');
  const selectedMember = members.find(m => m?.id === memberId);

  // Auto-fill amount based on member's preset target
  const handleMemberChange = (id: string) => {
    setMemberId(id);
    const m = members.find(x => x.id === id);
    if (m) {
      setAmount(m.targetInstallmentAmount.toString());
    } else {
      setAmount('');
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const instAmt = parseFloat(amount) || 0;
    const savAmt = parseFloat(savingsAmount) || 0;

    if (!memberId || (instAmt <= 0 && savAmt <= 0)) {
      showAlert('ভুল ইনপুট!', 'দয়া করে সঠিক সদস্য এবং অন্তত কিস্তি অথবা সঞ্চয় জমার পরিমাণ প্রবেশ করান!');
      return;
    }

    const currentMember = members.find(m => m.id === memberId);
    if (!currentMember) return;

    const newInst: Installment = {
      id: `INST-${Math.floor(1000 + Math.random() * 9000)}`,
      memberId,
      memberName: currentMember.name,
      amount: instAmt,
      savingsAmount: savAmt,
      date,
      type: currentMember.type
    };

    onAddInstallment(newInst);
    setIsAdding(false);
    
    // Auto show receipt after entry for fast printing!
    setSelectedReceipt(newInst);

    // Reset
    setMemberId('');
    setAmount('');
    setSavingsAmount('');
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

  // Calculate total savings for a member helper
  const getMemberTotalSavings = (mId: string) => {
    return installments
      .filter(i => i.memberId === mId)
      .reduce((sum, item) => sum + item.amount + (item.savingsAmount || 0), 0);
  };

  // Convert numbers to Bengali words (Professional banking notation)
  const numberToBanglaWords = (num: number) => {
    if (num === 0) return 'শূণ্য';
    const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const teens = ['দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ'];
    const tens = ['', '', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই'];
    
    const convertTwoDigits = (n: number) => {
      if (n < 10) return units[n];
      if (n >= 10 && n < 20) return teens[n - 10];
      const unitPart = n % 10;
      const tenPart = Math.floor(n / 10);
      return tens[tenPart] + (unitPart > 0 ? ' ' + units[unitPart] : '');
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
               onClick={() => setIsAdding(false)}
               className="text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer absolute left-4"
               title="বন্ধ করুন"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h3 className="text-[17px] font-bold select-none flex-1 text-center font-sans tracking-wide">
              কিস্তি আদায় ও সঞ্চয় সংগ্রহ
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
                <div className="col-span-7 relative pt-2">
                  <label className="absolute top-0 left-3 bg-[#fcfdfd] px-1.5 text-[10px] font-bold text-emerald-600 z-10 rounded select-none">
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
                <div className="col-span-5 relative pt-2">
                  <label className="absolute top-0 left-3 bg-[#fcfdfd] px-1.5 text-[10px] font-bold text-slate-400 z-10 rounded select-none">
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

              {/* Submit button at the bottom */}
              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3.5 text-xs font-bold tracking-wider shadow-md text-center flex items-center justify-center cursor-pointer transition-transform active:scale-[0.99] font-sans"
                >
                  সঞ্চয় জমা সম্পন্ন করুন
                </button>
              </div>

            </form>
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
                {filteredInstallments.reduce((sum, item) => sum + item.amount, 0)} ৳
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100/50 text-slate-600 font-medium border-b border-slate-200">
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
                          {i.type === 'daily' ? 'দৈনিক' : i.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-600">{i.date}</td>
                      <td className="p-4 font-mono text-emerald-600 font-bold text-sm">+{i.amount} ৳</td>
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
                <p className="text-[9.5px] text-slate-500 leading-tight font-medium">ঢাকা, বাংলাদেশ • মোবাইল: {ADMIN_PROFILE.phone}</p>
                <div className="mt-2 inline-block px-2.5 py-0.5 bg-slate-55 dark:bg-slate-50 border border-slate-200 text-slate-700 rounded-md font-extrabold text-[9px]">
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
                <div className="flex justify-between items-center bg-slate-50/50 p-1.5 rounded-lg">
                  <span className="text-slate-500 font-medium">সদস্যের নাম:</span>
                  <strong className="text-slate-800 font-bold">{selectedReceipt.memberName}</strong>
                </div>
                <div className="flex justify-between items-center p-1.5 py-0.5">
                  <span className="text-slate-500 font-medium">সদস্য আইডি:</span>
                  <strong className="text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded text-[10px] border border-slate-200">{selectedReceipt.memberId}</strong>
                </div>
                <div className="flex justify-between items-center p-1.5 py-0.5">
                  <span className="text-slate-500 font-medium">মোবাইল নম্বর:</span>
                  <span className="text-slate-800 font-semibold font-mono">
                    {members.find(m => m.id === selectedReceipt.memberId)?.phone || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-1.5 py-0.5">
                  <span className="text-slate-500 font-medium">হিসাবের ধরণ:</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[9px] font-extrabold rounded-md border border-emerald-100">
                    {selectedReceipt.type === 'daily' ? 'দৈনিক সঞ্চয়' : selectedReceipt.type === 'weekly' ? 'সাপ্তাহিক সঞ্চয়' : 'মাসিক সঞ্চয়'}
                  </span>
                </div>
              </div>

              {/* Transaction Amount Table */}
              <div className="my-3 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-50 text-emerald-800 font-extrabold text-[9.5px] border-b border-emerald-100">
                      <th className="p-2">আদায় বিবরণী</th>
                      <th className="p-2 text-right">পরিমাণ (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-slate-700 bg-white">
                    <tr>
                      <td className="p-2 font-medium text-slate-600">১. নিয়মিত সঞ্চয় কিস্তি (Regular)</td>
                      <td className="p-2 text-right font-mono font-bold">{selectedReceipt.amount} ৳</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium text-slate-600">২. অতিরিক্ত সঞ্চয় আমানত (Extra Detail)</td>
                      <td className="p-2 text-right font-mono font-bold">{(selectedReceipt.savingsAmount || 0)} ৳</td>
                    </tr>
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
                  <span className="text-[8px] text-slate-450 block font-bold leading-none tracking-wider uppercase mb-1">সদস্যের সঞ্চয় ব্যালেন্স</span>
                  <span className="text-[9px] text-amber-300 font-semibold font-sans">সর্বমোট আমানত স্থিতি</span>
                </div>
                <strong className="text-xs font-sans text-emerald-300 font-extrabold">
                  {toBengaliDigits(getMemberTotalSavings(selectedReceipt.memberId))} ৳
                </strong>
              </div>

              {/* Notice text */}
              <p className="text-[8.5px] text-slate-400 text-center select-none font-medium mt-3.5 italic">
                * নিয়মিত সঞ্চয় জমা রাখুন, ভবিষ্যৎ জীবন সুরক্ষিত রাখুন। ধন্যবাদ। *
              </p>

              {/* Official Signature Blocks */}
              <div className="mt-8 flex justify-between items-end select-none">
                <div className="text-center w-20">
                  <div className="h-0.5 w-full bg-slate-300"></div>
                  <span className="text-[8.5px] text-slate-505 mt-1 block font-bold">গ্রাহকের স্বাক্ষর</span>
                </div>
                <div className="text-center w-28 relative">
                  <span className="block text-emerald-600 text-[11px] italic font-semibold font-serif mb-0.5 px-1 truncate">
                    {ADMIN_PROFILE.name}
                  </span>
                  <div className="h-0.5 w-full bg-slate-300"></div>
                  <span className="text-[8.5px] text-slate-505 mt-1 block font-bold">আদায়কারী / এডমিন</span>
                </div>
              </div>
            </div>

            {/* Sharing & Printing Controls */}
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => downloadPdf('printable-savings-receipt', `রসিদ-${selectedReceipt?.id || 'রিসিপ্ট'}`, 'সদস্য সঞ্চয় জমা রসিদ')}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold shadow flex items-center justify-center gap-1 cursor-pointer transition-all hover:scale-95"
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
                              @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700;800&family=Inter:wght@405;500;600;700&display=swap');
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
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold shadow flex items-center justify-center gap-1 cursor-pointer transition-all hover:scale-95"
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
                  হায়াটসঅ্যাপে পাঠান
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
