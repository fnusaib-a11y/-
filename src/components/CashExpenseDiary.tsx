import React, { useState } from 'react';
import { MonthlyExpense, CashVaultLog } from '../types';
import { 
  Wallet, Folder, FileText, PlusCircle, Trash2, ShieldAlert, 
  AlertCircle, Calendar, Receipt, DollarSign, BookOpen, Coffee, 
  Lightbulb, Globe, Car, Home, UtensilsCrossed, Printer, ShieldCheck, 
  Trash, Eye, PenTool, Sparkles, Download, Check, Pencil
} from 'lucide-react';
import { downloadPdf } from '../utils/pdfHelper';

// Helper to convert standard numbers to Bengali digits
const toBengaliDigits = (num: number | string) => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (d) => bnDigits[parseInt(d)]);
};

interface CashExpenseDiaryProps {
  role: 'admin' | 'owner' | 'member';
  monthlyExpenses: MonthlyExpense[];
  cashVaultLogs: CashVaultLog[];
  onAddMonthlyExpense: (expense: MonthlyExpense) => void;
  onDeleteMonthlyExpense: (id: string) => void;
  onAddCashVaultLog: (log: CashVaultLog) => void;
  onDeleteCashVaultLog: (id: string) => void;
}

export default function CashExpenseDiary({
  role,
  monthlyExpenses,
  cashVaultLogs,
  onAddMonthlyExpense,
  onDeleteMonthlyExpense,
  onAddCashVaultLog,
  onDeleteCashVaultLog
}: CashExpenseDiaryProps) {
  const [activeDiaryTab, setActiveDiaryTab] = useState<'expenses' | 'vault'>('expenses');
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<MonthlyExpense | null>(null);

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

  // Monthly Expense Form State (12 Expenses helper fields)
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [expense1, setExpense1] = useState(''); // খাতা, কলম ও স্টেশনারি
  const [expense2, setExpense2] = useState(''); // চা ও নাস্তা বিল
  const [expense3, setExpense3] = useState(''); // বিদ্যুৎ বিল
  const [expense4, setExpense4] = useState(''); // মোবাইল ও ইন্টারনেট বিল
  const [expense5, setExpense5] = useState(''); // যাতায়াত ভাড়া
  const [expense6, setExpense6] = useState(''); // অফিস ঘর ভাড়া
  const [expense7, setExpense7] = useState(''); // আপ্যায়ন খরচ
  const [expense8, setExpense8] = useState(''); // কার্টিজ ও প্রিন্টিং বিল
  const [expense9, setExpense9] = useState(''); // নাইটগার্ড ও নিরাপত্তা বেতন
  const [expense10, setExpense10] = useState(''); // মসজিদ বা দান ও সেবা
  const [expense11, setExpense11] = useState(''); // পরিচ্ছন্নতা বিল
  const [expense12, setExpense12] = useState(''); // বিবিধ আপৎকালীন খরচ
  const [expenseNote, setExpenseNote] = useState('');

  // Cash Vault Form State
  const [vaultAmount, setVaultAmount] = useState('');
  const [vaultLocation, setVaultLocation] = useState('প্রধান ক্যাশ ড্রয়ার');
  const [vaultDate, setVaultDate] = useState(new Date().toISOString().split('T')[0]);
  const [vaultNote, setVaultNote] = useState('');
  const [editingVaultId, setEditingVaultId] = useState<string | null>(null);

  // 12 Predefined Standard Expense Categories Labels & Icons
  const EXPENSE_CATEGORIES = [
    { key: 'expense1', label: 'খাতা, কলম ও স্টেশনারি (Stationery)', helper: 'খাতা, ডায়েরি, সাইনপেন, পিন ইত্যাদি', icon: BookOpen, setter: setExpense1, val: expense1 },
    { key: 'expense2', label: 'চা ও নাস্তা বিল (Tea & Snacks)', helper: 'অফিস মিটিং, চা, বিস্কুট ও নাস্তা খরচ', icon: Coffee, setter: setExpense2, val: expense2 },
    { key: 'expense3', label: 'অফিস বিদ্যুৎ বিল (Electricity)', helper: 'অফিসের মাসিক ইলেক্ট্রিসিটি চার্জ', icon: Lightbulb, setter: setExpense3, val: expense3 },
    { key: 'expense4', label: 'মোবাইল ও ইন্টারনেট (Internet)', helper: 'সার্ভার রাউটার রিচার্জ ও মোডেম ফেয়ার', icon: Globe, setter: setExpense4, val: expense4 },
    { key: 'expense5', label: 'যাতায়াত ও ভাড়া খরচ (Conveyance)', helper: 'আদায়কারীর রিকশা ভাড়া ও ভ্রমণ বিল', icon: Car, setter: setExpense5, val: expense5 },
    { key: 'expense6', label: 'অফিস ঘর ভাড়া (Office Rent)', helper: 'অফিস রুমের মাসিক ভাড়া বা এডভান্স কিস্তি', icon: Home, setter: setExpense6, val: expense6 },
    { key: 'expense7', label: 'আপ্যায়ন ও মেহমানদারি (Hospitality)', helper: 'সমিতির বিশেষ গেস্ট বা পরিচালক আহার', icon: UtensilsCrossed, setter: setExpense7, val: expense7 },
    { key: 'expense8', label: 'কার্টিজ ও প্রিন্টিং বিল (Printing)', helper: 'রশিদ বই মুদ্রণ ও প্রিন্টার টোনার ক্রয়', icon: Printer, setter: setExpense8, val: expense8 },
    { key: 'expense9', label: 'নাইটগার্ড ও নিরাপত্তা বিল (Guard)', helper: 'বাজার বা সমিতি নাইট ডিউটি পেমেন্ট', icon: ShieldCheck, setter: setExpense9, val: expense9 },
    { key: 'expense10', label: 'মসজিদ ও কল্যাণ দান (Donations)', helper: 'সামাজিক দান, ধর্মীয় ফান্ড বা মসজিদ চাঁদা', icon: Sparkles, setter: setExpense10, val: expense10 },
    { key: 'expense11', label: 'পরিচ্ছন্নতা ও ঝাড়ুদার (Cleaning)', helper: 'অফিস ওয়াশ ও মেথর/ঝাড়ুদার সেবা বিল', icon: Trash, setter: setExpense11, val: expense11 },
    { key: 'expense12', label: 'বিবিধ ও সাধারণ খরচ (Miscellaneous)', helper: 'উপরে উল্লেখিত নয় এমন আপৎকালীন খরচ', icon: PenTool, setter: setExpense12, val: expense12 },
  ];

  // Calculate live dynamic total
  const computeLiveTotal = () => {
    let sum = 0;
    sum += parseFloat(expense1) || 0;
    sum += parseFloat(expense2) || 0;
    sum += parseFloat(expense3) || 0;
    sum += parseFloat(expense4) || 0;
    sum += parseFloat(expense5) || 0;
    sum += parseFloat(expense6) || 0;
    sum += parseFloat(expense7) || 0;
    sum += parseFloat(expense8) || 0;
    sum += parseFloat(expense9) || 0;
    sum += parseFloat(expense10) || 0;
    sum += parseFloat(expense11) || 0;
    sum += parseFloat(expense12) || 0;
    return sum;
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmount = computeLiveTotal();

    if (totalAmount <= 0) {
      showAlert('তথ্য খালি!', 'দয়া করে অন্তত ১টি খরচ বা খাতার বিলের টাকা ইনপুট দিন!');
      return;
    }

    // Check duplicate month
    const monthExists = monthlyExpenses.some(m => m.month === selectedMonth);
    if (monthExists) {
      showConfirm(
        'সতর্কবার্তা - ওভাররাইট',
        `এই মাসের (${selectedMonth}) খরচ ডায়েরি পূর্বেই নিবন্ধিত রয়েছে। আপনি কি নতুন ডাটা দিয়ে ওল্ড ফাইলটি আপডেট করতে চান?`,
        () => saveExpenseRecord(true)
      );
    } else {
      saveExpenseRecord(false);
    }
  };

  const saveExpenseRecord = (overwrite: boolean) => {
    const totalAmount = computeLiveTotal();
    const recordId = overwrite 
      ? monthlyExpenses.find(m => m.month === selectedMonth)?.id || `EXP-${Date.now()}`
      : `EXP-${Date.now()}`;

    const newRecord: MonthlyExpense = {
      id: recordId,
      month: selectedMonth,
      date: new Date().toISOString().split('T')[0],
      expense1: parseFloat(expense1) || 0,
      expense2: parseFloat(expense2) || 0,
      expense3: parseFloat(expense3) || 0,
      expense4: parseFloat(expense4) || 0,
      expense5: parseFloat(expense5) || 0,
      expense6: parseFloat(expense6) || 0,
      expense7: parseFloat(expense7) || 0,
      expense8: parseFloat(expense8) || 0,
      expense9: parseFloat(expense9) || 0,
      expense10: parseFloat(expense10) || 0,
      expense11: parseFloat(expense11) || 0,
      expense12: parseFloat(expense12) || 0,
      totalAmount,
      note: expenseNote.trim()
    };

    onAddMonthlyExpense(newRecord);
    showAlert('সফল হয়েছে!', `${selectedMonth} মাসের ১২টি খাতের খরচ ডায়েরি সফলভাবে সংরক্ষিত হয়েছে।`);
    
    // Reset Form Fields
    EXPENSE_CATEGORIES.forEach(cat => cat.setter(''));
    setExpenseNote('');
  };

  const handleVaultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(vaultAmount);
    if (!amt || amt <= 0) {
      showAlert('ভুল পরিমাণ!', 'দয়া করে কেশে রাখার সঠিক টাকার পরিমাণ দিন!');
      return;
    }

    const newLog: CashVaultLog = {
      id: editingVaultId || `CASH-${Date.now()}`,
      date: vaultDate,
      amount: amt,
      location: vaultLocation.trim(),
      note: vaultNote.trim()
    };

    onAddCashVaultLog(newLog);
    if (editingVaultId) {
      showAlert('হালনাগাদ হয়েছে!', `${amt} টাকা সফলভাবে কেশে রাখার ডাটা আপডেট করা হয়েছে।`);
      setEditingVaultId(null);
    } else {
      showAlert('সংরক্ষিত হয়েছে!', `${amt} টাকা সফলভাবে কেশে রাখার ডায়েরিতে যুক্ত করা হয়েছে।`);
    }
    setVaultAmount('');
    setVaultNote('');
    setVaultLocation('প্রধান ক্যাশ ড্রয়ার');
  };

  const handleEditVault = (log: CashVaultLog) => {
    setEditingVaultId(log.id);
    setVaultDate(log.date);
    setVaultAmount(log.amount.toString());
    setVaultLocation(log.location);
    setVaultNote(log.note || '');
  };

  const handleCancelEditVault = () => {
    setEditingVaultId(null);
    setVaultAmount('');
    setVaultLocation('প্রধান ক্যাশ ড্রয়ার');
    setVaultDate(new Date().toISOString().split('T')[0]);
    setVaultNote('');
  };

  // Total logged cash in vault
  const totalCachedInVault = cashVaultLogs.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      {/* Visual Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Folder className="h-6 w-6 text-[#1d8df5]" />
            কেশের আলমারি ও অফিস খরচ ডায়েরি (Cash Box & Operational Expenses)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            মাসের খাতা-কলম, চা-নাস্তা বিল ও অন্যান্য ১২টি খরচের তালিকা এবং কেশে কত টাকা রাখা হলো তার পৃথক ডিজিটাল খাতা।
          </p>
        </div>
      </div>

      {/* Diary Folder Switcher Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveDiaryTab('expenses')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer border-b-2 transition-all ${
            activeDiaryTab === 'expenses' 
              ? 'border-emerald-600 text-emerald-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="h-4.5 w-4.5" />
          ১২টি খাতের মাসিক খরচ খাতা (12 Monthly Expenses App)
        </button>
        <button
          onClick={() => setActiveDiaryTab('vault')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer border-b-2 transition-all ${
            activeDiaryTab === 'vault' 
              ? 'border-emerald-600 text-emerald-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet className="h-4.5 w-4.5" />
          কেশে কত টাকা রাখলাম (Cash Drawer Diary)
        </button>
      </div>

      {/* DIARY EXPENSES SECTION */}
      {activeDiaryTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form to log 12 monthly costs */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 space-y-6 text-left">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-850 flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-emerald-600" />
                  ১২টি খরচের মাসভিত্তিক এন্ট্রি (12 Items Sheet)
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">সবগুলো ফিল্ড পূরণ আবশ্যক নয়, জাস্ট আপনার খরচগুলো লিখুন।</p>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1.5 px-3 rounded-xl">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[10px] font-bold text-slate-650 shrink-0">খরচের মাস:</span>
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent border-none text-xs outline-none font-bold text-emerald-700 w-24"
                />
              </div>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-6">
              {/* 12 fields structured grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {EXPENSE_CATEGORIES.map((cat, idx) => {
                  const CatIcon = cat.icon;
                  return (
                    <div key={cat.key} className="p-3 bg-slate-50 rounded-xl border border-slate-150 relative">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="p-1.5 bg-white shadow-xs rounded-lg text-slate-600 border border-slate-100">
                          <CatIcon className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{idx + 1}. {cat.label}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-3 mb-2">{cat.helper}</p>
                      
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="টাকার পরিমাণ লিখুন (০)"
                          value={cat.val}
                          onChange={(e) => cat.setter(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500 font-mono focus:ring-1 focus:ring-emerald-100"
                        />
                        <span className="absolute left-3 top-2 text-[11px] text-slate-400 font-bold font-sans">৳</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Extra notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">খাতা নোট বা বিশেষ মন্তব্য (ঐচ্ছিক)</label>
                <textarea
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="যেমনঃ নতুন সমিতির রেজিস্টার খাতা ও ২ ডজন চা-নাস্তা আনার স্পেশাল খরচ..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 h-16 resize-none"
                />
              </div>

              {/* Form Actions with Live Sum */}
              <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 gap-4">
                <div className="text-center sm:text-left leading-relaxed">
                  <span className="text-[11px] font-bold text-slate-500 block">মোট ১২টি খাতের হিসাব অনুযায়ী হিসেবকৃত খরচ:</span>
                  <strong className="text-xl font-bold font-sans text-emerald-700 grid grid-cols-1">
                    {toBengaliDigits(computeLiveTotal())} ৳ <span className="text-[10px] text-slate-450 font-normal">({computeLiveTotal()} Taka Only)</span>
                  </strong>
                </div>

                {role !== 'member' && (
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-emerald-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-4.5 w-4.5" />
                    মাসিক খরচ হিসেবে জমা করুন
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Sidebar list showing past monthly diaries */}
          <div className="space-y-4 text-left">
            <h3 className="text-xs font-bold text-slate-400 tracking-wider">মাসিক খরচ খাতার আর্কাইভ আর্কাইভ ({monthlyExpenses.length})</h3>
            
            {monthlyExpenses.length > 0 ? (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {monthlyExpenses.map((m) => (
                  <div key={m.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs hover:border-[#1d8df5] hover:shadow-md transition-all space-y-3 relative group">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-rose-50 rounded-xl text-rose-600 shrink-0 border border-rose-100">
                          <Receipt className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">{m.month}</h4>
                          <span className="text-[9px] text-slate-400 font-mono block">তারিখঃ {m.date}</span>
                        </div>
                      </div>
                      <strong className="text-sm font-sans font-bold text-rose-600 text-right">
                        -{m.totalAmount} ৳
                      </strong>
                    </div>

                    {m.note && (
                      <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg leading-relaxed italic line-clamp-2">
                        "{m.note}"
                      </p>
                    )}

                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 text-xs">
                      <button
                        onClick={() => setSelectedExpenseDetail(m)}
                        className="text-[11px] font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        বিবরণী দেখুন
                      </button>

                      {role === 'admin' && (
                        <button
                          onClick={() => {
                            showConfirm(
                              'খরচ ফাইল ডিলিট',
                              `আপনি কি নিশ্চিত ${m.month} মাসের খরচ ডায়েরি স্থায়ীভাবে মুছতে চান?`,
                              () => onDeleteMonthlyExpense(m.id)
                            );
                          }}
                          className="text-[10px] text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-0.5 cursor-pointer font-sans"
                        >
                          <Trash2 className="h-3 w-3" />
                          মুছুন
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-slate-50 rounded-2xl text-center border border-dashed text-slate-400 text-xs">
                এখনো কোনো মাসের খরচ ডায়েরি লেখা হয়নি।
              </div>
            )}
          </div>
        </div>
      )}

      {/* CASH VAULT DIARY SECTION */}
      {activeDiaryTab === 'vault' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form to log cash in vault */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5 text-left h-fit">
            <div>
              <h3 className="text-base font-bold text-slate-850 flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-emerald-600" />
                কেশে কত টাকা রাখলাম (New Journal)
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">অফিস আলমারি, ড্রয়ার বা ক্যাশ বক্সে টাকা রাখার লিখিত হিসাব ট্র্যাক করুন।</p>
            </div>

            <form onSubmit={handleVaultSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-650 mb-1">তারিখ নির্বাচন করুন *</label>
                <input
                  type="date"
                  required
                  value={vaultDate}
                  onChange={(e) => setVaultDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs outline-none focus:border-emerald-500 font-mono focus:ring-1 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 mb-1">কেশে কত টাকা রাখলাম (পরিমাণ) *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    placeholder="যেমনঃ ১৫০০০"
                    value={vaultAmount}
                    onChange={(e) => setVaultAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs outline-none focus:border-emerald-500 font-mono focus:ring-1 focus:ring-emerald-100"
                  />
                  <span className="absolute left-3 top-2 py-0.5 text-xs text-slate-400 font-bold">৳</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 mb-1">কোথায় রাখলেন (ক্যাশবিল / ক্যাশ ট্রাস্ট) *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমনঃ মূল চালানি আলমারি বা অফিস ক্যাশ টেবিল ড্রয়ার"
                  value={vaultLocation}
                  onChange={(e) => setVaultLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 mb-1">মন্তব্য বা আদেশের উৎস (ঐচ্ছিক)</label>
                <input
                  type="text"
                  placeholder="যেমনঃ ব্যাংকের ৩য় কিস্তি থেকে আলমারি লকারে রাখা ক্যাশ টাকা..."
                  value={vaultNote}
                  onChange={(e) => setVaultNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100"
                />
              </div>

              {role !== 'member' && (
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 p-2.5 bg-[#1d8df5] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-4.5 w-4.5" /> {editingVaultId ? 'হালনাগাদ (সম্পাদনা) করুন' : 'হিসাব খাতা এন্ট্রি যোগ করুন'}
                  </button>
                  {editingVaultId && (
                    <button
                      type="button"
                      onClick={handleCancelEditVault}
                      className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-205 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      বাতিল
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* List and cumulative info card */}
          <div className="lg:col-span-2 space-y-6 text-left">
            {/* Visual Safe Cabinet Box Card */}
            <div className="p-5 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-lg space-y-4 relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                <Wallet className="w-48 h-48 rotate-12" />
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 font-sans tracking-wide uppercase">কেশের মোট ফান্ড (Cash Safe Vault Status)</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">সবগুলো কেশে রাখার হিস্ট্রি থেকে গণনা করা মোট পরিমাণ</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>

              <div className="py-2.5">
                <span className="text-[10px] text-slate-400 block font-semibold">কেশে সংরক্ষিত বর্তমান মোট খতিয়ান স্থিতি:</span>
                <strong className="text-2xl sm:text-3xl font-sans tracking-wide text-emerald-400 block mt-1">
                  {toBengaliDigits(totalCachedInVault)} ৳ <span className="text-xs font-normal text-slate-400">({totalCachedInVault} Taka Total kept)</span>
                </strong>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed font-sans mt-2">
                এটি কোনো স্বয়ংক্রিয় হিসাব নয়, বরং ম্যানেজার বা পরিচালক নিজে কেশ ফান্ডে (লকার, ক্যাশ বাক্স ইত্যাদি) যে ক্যাশ টাকা সংরক্ষণের এন্ট্রি দিয়েছেন তারই লিখিত ইতিহাস।
              </p>
            </div>

            {/* Logs table & cards */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 tracking-wider">কেশে রাখার সাম্প্রতিক লেনদেনসমূহ ({cashVaultLogs.length})</h4>
              
              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block bg-white border border-slate-100 rounded-2xl overflow-x-auto shadow-xs">
                <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-205">
                      <th className="p-3">তারিখ</th>
                      <th className="p-3">পরিমাণ</th>
                      <th className="p-3">কোথায় রাখলেন (স্থান)</th>
                      <th className="p-3">মন্তব্য / বিবরণ</th>
                      {(role === 'admin' || role === 'owner') && <th className="p-3 text-center">কন্ট্রোল</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                    {cashVaultLogs.length > 0 ? (
                      cashVaultLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono text-slate-500">{log.date}</td>
                          <td className="p-3 font-bold text-emerald-600">+{log.amount} ৳</td>
                          <td className="p-3 font-semibold text-slate-800">{log.location}</td>
                          <td className="p-3 text-slate-500 italic max-w-xs truncate" title={log.note || ''}>
                            {log.note || '—'}
                          </td>
                          {(role === 'admin' || role === 'owner') && (
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditVault(log)}
                                  className="text-blue-600 hover:text-blue-800 hover:underline text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Pencil className="h-3 w-3" /> এডিট
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    showConfirm(
                                      'কেশের তথ্য ডিলিট',
                                      'আপনি কি নিশ্চিত কেশে রাখার লগের এই ডাটাটি ডিলিট করতে চান?',
                                      () => onDeleteCashVaultLog(log.id)
                                    );
                                  }}
                                  className="text-rose-600 hover:text-rose-800 hover:underline text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" /> মুছুন
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={(role === 'admin' || role === 'owner') ? 5 : 4} className="text-center p-8 text-slate-400">
                          কেশে টাকা রাখার ডায়েরিতে কোনো এন্ট্রি পাওয়া যায়নি।
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARD LIST VIEW (For App and Small Screens) */}
              <div className="block md:hidden space-y-3">
                {cashVaultLogs.length > 0 ? (
                  cashVaultLogs.map((log) => (
                    <div key={log.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3 text-left">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-500 rounded-full px-2.5 py-0.5 font-mono inline-block">
                            {log.date}
                          </span>
                          <h5 className="text-xs font-bold text-slate-800 mt-2">
                            স্থান: {log.location}
                          </h5>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                          +{toBengaliDigits(log.amount)} ৳
                        </span>
                      </div>

                      {log.note && (
                        <p className="text-[11px] text-slate-500 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 italic leading-relaxed">
                          "{log.note}"
                        </p>
                      )}

                      {(role === 'admin' || role === 'owner') && (
                        <div className="flex justify-end gap-2 pt-2.5 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleEditVault(log)}
                            className="bg-blue-50 text-blue-600 active:bg-blue-100 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil className="h-3 w-3" /> এডিট
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              showConfirm(
                                'কেশের তথ্য ডিলিট',
                                'আপনি কি নিশ্চিত কেশে রাখার লগের এই ডাটাটি ডিলিট করতে চান?',
                                () => onDeleteCashVaultLog(log.id)
                              );
                            }}
                            className="bg-rose-50 text-rose-600 active:bg-rose-100 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" /> মুছুন
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 bg-white border border-slate-100 rounded-2xl text-center text-slate-400 text-xs">
                    কেশে টাকা রাখার ডায়েরিতে কোনো এন্ট্রি পাওয়া যায়নি।
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL FOR MONTHLY 12 EXPENSES BreakDown */}
      {selectedExpenseDetail && (
        <div className="fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-slate-100 text-slate-800 text-left animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 border-none inline-flex items-center gap-1.5 uppercase tracking-wider">
                  <Receipt className="h-5 w-5 text-rose-600" />
                  {selectedExpenseDetail.month} মাসের খরচ খতিয়ান
                </h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">রেফারেন্স ফাইল আইডিঃ {selectedExpenseDetail.id}</p>
              </div>
              <button
                onClick={() => setSelectedExpenseDetail(null)}
                className="p-1 px-2.5 bg-slate-50 border border-slate-150 rounded-xl hover:bg-slate-100 hover:text-slate-900 text-slate-500 font-bold transition-all shrink-0 font-mono cursor-pointer text-xs"
              >
                বন্ধ করুন [✕]
              </button>
            </div>

            {/* Printable Details Screen Grid */}
            <div id="monthly-expense-print-block" className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="text-center py-2.5 bg-slate-50 rounded-2xl border border-slate-200/50 mb-4 px-3 flex justify-between items-center">
                <span className="text-slate-500 font-bold text-[10px]">অদলবদল তারিখঃ {selectedExpenseDetail.date}</span>
                <span className="text-sm font-bold text-rose-600 font-sans">সর্বমোট খরচঃ {selectedExpenseDetail.totalAmount} ৳</span>
              </div>

              {/* Grid listing all 12 items */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'খাতা, কলম ও স্টেশনারি', val: selectedExpenseDetail.expense1, icon: BookOpen },
                  { label: 'চা ও নাস্তা বিল', val: selectedExpenseDetail.expense2, icon: Coffee },
                  { label: 'বিদ্যুৎ বিল', val: selectedExpenseDetail.expense3, icon: Lightbulb },
                  { label: 'মোবাইল ও ইন্টারনেট', val: selectedExpenseDetail.expense4, icon: Globe },
                  { label: 'যাতায়াত ভাড়া', val: selectedExpenseDetail.expense5, icon: Car },
                  { label: 'অফিস ঘর ভাড়া', val: selectedExpenseDetail.expense6, icon: Home },
                  { label: 'আপ্যায়ন খরচ', val: selectedExpenseDetail.expense7, icon: UtensilsCrossed },
                  { label: 'কার্টিজ ও প্রিন্টিং বিল', val: selectedExpenseDetail.expense8, icon: Printer },
                  { label: 'নাইটগার্ড ও নিরাপত্তা বেতন', val: selectedExpenseDetail.expense9, icon: ShieldCheck },
                  { label: 'মসজিদ বা দান সাহায্য', val: selectedExpenseDetail.expense10, icon: Sparkles },
                  { label: 'অফিস পরিচ্ছন্নতা বিল', val: selectedExpenseDetail.expense11, icon: Trash },
                  { label: 'বিবিধ আপৎকালীন খরচ', val: selectedExpenseDetail.expense12, icon: PenTool },
                ].map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <item.icon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="text-[10.5px] font-bold text-slate-600 truncate">{item.label}</span>
                    </div>
                    <strong className="text-[11.5px] font-mono text-slate-800 shrink-0 pl-1.5">
                      {item.val || 0} ৳
                    </strong>
                  </div>
                ))}
              </div>

              {selectedExpenseDetail.note && (
                <div className="p-3 bg-indigo-50/30 rounded-xl text-slate-650 italic text-[11px] leading-relaxed border border-indigo-100/40">
                  মন্তব্য বা বিবরণীঃ "{selectedExpenseDetail.note}"
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => downloadPdf('monthly-expense-print-block', `অফিস_খরচ_রিপোর্ট_${selectedExpenseDetail.month}`, `${selectedExpenseDetail.month} মাসের খরচ খতিয়ান ডায়েরী`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer"
              >
                <Download className="h-4 w-4" /> পিডিএফ ডাউনলোড করুন
              </button>
              <button
                onClick={() => setSelectedExpenseDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM POPUP DIALOGS */}
      {dialog && dialog.isOpen && (
        <div className="fixed inset-0 z-55 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-104 text-slate-800 text-left animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-2xl ${dialog.type === 'confirm' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-[#1d8df5]'}`}>
                {dialog.type === 'confirm' ? (
                  <ShieldAlert className="h-6 w-6 shrink-0" />
                ) : (
                  <AlertCircle className="h-6 w-6 shrink-0" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{dialog.title}</h3>
                <p className="text-[10px] text-slate-550 mt-0.5">{dialog.type === 'confirm' ? 'অনুমতি নিশ্চিতকরণ খাতা' : 'গুরুত্বপূর্ণ ডায়েরী সতর্কতা'}</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed mb-6 font-sans">
              {dialog.message}
            </p>

            <div className="flex justify-end gap-2 text-xs font-bold">
              {dialog.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => setDialog(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={() => {
                      if (dialog.onConfirm) dialog.onConfirm();
                      setDialog(null);
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    নিশ্চিত করুন
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDialog(null)}
                  className="px-5 py-2 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all cursor-pointer"
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
