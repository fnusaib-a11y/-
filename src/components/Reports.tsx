import React, { useState } from 'react';
import { Member, Installment, Loan, LedgerEntry, LoanRepayment } from '../types';
import { Download, Search, Printer, Calendar, FileText, CheckCircle, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { ADMIN_PROFILE } from '../db';
import { downloadPdf } from '../utils/pdfHelper';

interface ReportsProps {
  members: Member[];
  installments: Installment[];
  loans: Loan[];
  role: 'admin' | 'owner' | 'member';
  ledger: LedgerEntry[];
  loanRepayments?: LoanRepayment[];
  onAddLedger: (entry: LedgerEntry) => void;
  onDeleteLedger: (id: string) => void;
}

export default function Reports({ members, installments, loans, role, ledger, loanRepayments = [], onAddLedger, onDeleteLedger }: ReportsProps) {
  const [activeReportTab, setActiveReportTab] = useState<'collection' | 'due' | 'profit_loss' | 'summary'>('summary');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetMonth, setTargetMonth] = useState('2026-06');

  // Modern React Modal state for robust iframe / WebView compatibility
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

  // Ledger form states
  const [ledgerType, setLedgerType] = useState<'income' | 'expense' | 'surplus'>('income');
  const [ledgerDesc, setLedgerDesc] = useState('');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDate, setLedgerDate] = useState(new Date().toISOString().split('T')[0]);

  const handleAddLedgerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(ledgerAmount);
    if (!ledgerDesc.trim() || !amt || amt <= 0) {
      showAlert('তথ্য ইনপুট ত্রুটি', 'দয়া করে বিবরণ এবং সঠিক বা জমার পরিমাণ প্রবেশ করান!');
      return;
    }
    onAddLedger({
      id: `LEDG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: ledgerType,
      description: ledgerDesc.trim(),
      amount: amt,
      date: ledgerDate
    });
    setLedgerDesc('');
    setLedgerAmount('');
  };

  // Daily collection calculations
  const dailyInstallments = installments.filter(i => i.date === targetDate);
  const dailyRepayments = (loanRepayments || []).filter(r => r.date === targetDate);
  
  const dailySavingsTotalAmount = dailyInstallments.reduce((sum, item) => sum + (Number(item.amount) || 0) + (Number(item.savingsAmount) || 0), 0);
  const dailyLoansTotalAmount = dailyRepayments.reduce((sum, item) => sum + (Number(item.repayAmount) || 0), 0);
  const dailyTotalAmount = dailySavingsTotalAmount + dailyLoansTotalAmount;

  // Installment Due warnings calculation
  // Basic Algorithm: For each active member, check if they have paid in the selected month
  const unpaidMembersInSelectedMonth = members.filter(m => {
    if (m?.status !== 'active') return false;
    const installmentsThisMonth = installments.filter(inst => {
      const instMemberId = inst?.memberId || '';
      const memberId = m?.id || '';
      const instDate = inst?.date || '';
      return instMemberId === memberId && instDate.startsWith(targetMonth);
    });
    return installmentsThisMonth.length === 0;
  });

  // Profit/Loss Real ledger Calculations
  const customIncome = ledger ? ledger.filter(l => l.type === 'income').reduce((sum, item) => sum + (Number(item.amount) || 0), 0) : 0;
  const customExpense = ledger ? ledger.filter(l => l.type === 'expense').reduce((sum, item) => sum + (Number(item.amount) || 0), 0) : 0;
  const customSurplus = ledger ? ledger.filter(l => l.type === 'surplus').reduce((sum, item) => sum + (Number(item.amount) || 0), 0) : 0;

  const totalRevenues = customIncome + customSurplus;
  const totalExpenses = customExpense;
  const netIncome = totalRevenues - totalExpenses;

  // Grand Cooperative Cash Box calculations (কেশে অবশিষ্ট খতিয়ান হিসাব)
  const totalSavingsSumOfCoop = installments
    .filter(item => !item.isBorrowerSavings)
    .reduce((sum, item) => sum + (Number(item.amount) || 0) + (Number(item.savingsAmount) || 0), 0);
  const totalLoansDisbursedPrincipalOfCoop = loans.reduce((sum, l) => {
    const orig = Number(l.originalPrincipal) || (Number(l.principalAmount) - (Number(l.profitAmount) || 0)) || 0;
    return sum + orig;
  }, 0);
  const totalLoansRecoveredPrincipalOfCoop = loans.reduce((sum, l) => sum + (Number(l.repaidAmount) || 0), 0);
  const totalLoansDuePrincipalOfCoop = totalLoansDisbursedPrincipalOfCoop - totalLoansRecoveredPrincipalOfCoop;

  const totalSavingsPercentProfitOfCoop = installments.reduce((sum, item) => sum + (Number(item.profitAmount) || 0), 0);
  const totalLoanPercentProfitOfCoop = loans.reduce((sum, item) => sum + (Number(item.profitRepaid) || 0), 0);
  const totalPercentageProfitSumOfCoop = totalSavingsPercentProfitOfCoop + totalLoanPercentProfitOfCoop;
  const totalLoanPenaltiesOfCoop = loanRepayments.reduce((sum, item) => sum + (Number(item.penaltyPaid) || 0), 0);

  // Net Cash Balance includes all collections but EXCLUDES savings deposits (as per user request: savings does not count to cash/main balance)
  const totalCashBalanceOfCoop = totalLoansRecoveredPrincipalOfCoop + totalLoanPercentProfitOfCoop + totalLoanPenaltiesOfCoop + customIncome + customSurplus - totalLoansDisbursedPrincipalOfCoop - customExpense;

  // PRINT Trigger helper
  const handlePrintReport = (elementId: string, title: string) => {
    const printContents = document.getElementById(elementId)?.innerHTML;
    if (printContents) {
      const printWindow = window.open('', '_blank');
      printWindow?.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="p-10 bg-white font-sans text-slate-800">
            <div class="max-w-4xl mx-auto border border-slate-200 p-6 rounded-xl">
              <div class="text-center mb-8 pb-4 border-b">
                <h1 class="text-2xl font-bold">ক্ষুদ্র সঞ্চয় সমিতি</h1>
                <p class="text-sm text-slate-500">পরিচালনায়: ${ADMIN_PROFILE.name}</p>
                <p class="text-xs text-slate-400">রিপোর্ট: ${title}</p>
                <p class="text-xs text-slate-450 mt-1">তারিখ: ${new Date().toLocaleDateString('bn-BD')}</p>
              </div>
              ${printContents}
              <div class="mt-12 flex justify-between items-end text-xs text-slate-500">
                <div>
                  <p>রিপোর্ট জেনারেটর: স্বয়ংক্রিয় ক্লাউড সিস্টেম</p>
                </div>
                <div class="text-center">
                  <div class="w-32 border-b border-slate-400 mb-1"></div>
                  <p class="font-sans">${ADMIN_PROFILE.name} (${ADMIN_PROFILE.role})</p>
                </div>
              </div>
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow?.document.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800">রিপোর্ট ও লিজার খাতা</h2>
          <p className="text-xs text-slate-500 mt-1">সমিতির সব ধরণের আর্থিক হিসাব বিশ্লেষণ, কালেকশন তালিকা এবং লাভ/ক্ষতি রিপোর্ট প্রিন্ট বা পিডিএফ ডায়েরি।</p>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-xl max-w-xl">
        <button
          onClick={() => setActiveReportTab('summary')}
          className={`flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeReportTab === 'summary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          সমিতি ও ঋণ সারসংক্ষেপ
        </button>
        <button
          onClick={() => setActiveReportTab('collection')}
          className={`flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeReportTab === 'collection' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          আজকের কালেকশন রিপোর্ট
        </button>
        <button
          onClick={() => setActiveReportTab('due')}
          className={`flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeReportTab === 'due' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          বকেয়া কিস্তির নোটিশ
        </button>
        <button
          onClick={() => setActiveReportTab('profit_loss')}
          className={`flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeReportTab === 'profit_loss' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          লাভ-ক্ষতি খতিয়ান
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeReportTab === 'summary' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-sky-600" />
              সমিতি ও ঋণ পোর্টফোলিও সামারি
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadPdf('summary-report-print', 'সমিতি_হিসাব_সারসংক্ষেপ', 'সমিতি হিসাব সারসংক্ষেপ')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-[11px] font-semibold rounded text-white border border-indigo-600 cursor-pointer transition-all hover:scale-95 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> পিডিএফ ডাউনলোড (PDF)
              </button>
              <button
                type="button"
                onClick={() => handlePrintReport('summary-report-print', 'সমিতি হিসাব সারসংক্ষেপ')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold rounded text-slate-700 border border-slate-200 cursor-pointer transition-all hover:scale-95 shadow-sm"
              >
                <Printer className="h-3 w-3" /> প্রিন্ট সামারি
              </button>
            </div>
          </div>

          <div id="summary-report-print" className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-2xl border border-slate-100">
            {/* Columns 1: Members and Savings */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 tracking-wider">সদস্য ও সঞ্চয় সারসংক্ষেপ</h4>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600">
                  <span>মোট নিবন্ধিত সদস্য:</span>
                  <strong className="text-slate-800">{members.length} জন</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600">
                  <span>সক্রিয় চলমান সদস্য:</span>
                  <strong className="text-emerald-700">{members.filter(m => m?.status === 'active').length} জন</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600">
                  <span>নিষ্ক্রিয় সদস্য:</span>
                  <strong className="text-slate-500">{members.filter(m => m?.status === 'inactive').length} জন</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600">
                  <span>মোট সঞ্চিত আমানত (আসল):</span>
                  <strong className="text-emerald-600">{totalSavingsSumOfCoop} ৳</strong>
                </div>
              </div>
            </div>

            {/* Column 2: Loan Summary block */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 tracking-wider">ঋণ পোর্টফোলিও সারসংক্ষেপ</h4>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600">
                  <span>মোট ঋণ বিতরণের কেস:</span>
                  <strong className="text-slate-850">{loans.length} টি</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600">
                  <span>মোট বিতরণকৃত লোন (আসল):</span>
                  <strong className="text-slate-800">{totalLoansDisbursedPrincipalOfCoop} ৳</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600">
                  <span>মোট আদায়কৃত লোন (আসল):</span>
                  <strong className="text-emerald-600">{totalLoansRecoveredPrincipalOfCoop} ৳</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600">
                  <span>অবশিষ্ট বকেয়া লোন (আসল):</span>
                  <strong className="text-rose-600">{totalLoansDuePrincipalOfCoop} ৳</strong>
                </div>
              </div>
            </div>

            {/* Column 3: Percent Profit Folder */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-purple-400 tracking-wider">শতকরা লভ্যাংশ তহবিল সারসংক্ষেপ</h4>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600">
                  <span>সঞ্চয়ের ওপর শতকরা লাভ:</span>
                  <strong className="text-slate-800">{totalSavingsPercentProfitOfCoop} ৳</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600">
                  <span>ঋণ কিস্তির শতকরা লাভ:</span>
                  <strong className="text-purple-700">{totalLoanPercentProfitOfCoop} ৳</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 text-xs text-slate-600 font-bold text-purple-900 border-t pt-1">
                  <span>শতকরা গচ্ছিত লভ্যাংশ:</span>
                  <span className="text-purple-600">{totalPercentageProfitSumOfCoop} ৳</span>
                </div>
                <div className="flex justify-between py-2 text-xs text-slate-600 font-semibold text-emerald-800">
                  <span>কেশে অবশিষ্ট (শতকরা বাদে):</span>
                  <span className="text-emerald-600">{totalCashBalanceOfCoop} ৳</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAILY COLLECTIONS REPORT */}
      {activeReportTab === 'collection' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-100 gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span>তারিখ নির্বাচন করুন:</span>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadPdf('daily-print-report', `দৈনিক_কালেকশন_রিপোর্ট_${targetDate}`, `দৈনিক কালেকশন রিপোর্ট - ${targetDate}`)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-[11px] font-semibold text-white rounded border border-indigo-600 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-95 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> পিডিএফ ডাউনলোড (PDF)
              </button>
              <button
                type="button"
                onClick={() => handlePrintReport('daily-print-report', `দৈনিক কালেকশন রিপোর্ট - ${targetDate}`)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 rounded border border-slate-200 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-95 shadow-sm"
              >
                <Printer className="h-3 w-3" /> প্রিন্ট তালিকা
              </button>
            </div>
          </div>

          <div id="daily-print-report" className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="p-4 bg-emerald-50 text-emerald-800 font-sans text-xs flex justify-between">
              <span>কালেকশন তারিখ: <strong>{targetDate}</strong></span>
              <span>মোট আদায়: <strong>{dailyTotalAmount} ৳</strong></span>
            </div>

            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="p-4">রসিদ / ট্রানজেকশন নং</th>
                  <th className="p-4">সদস্যের নাম ও আইডি</th>
                  <th className="p-4">ধরণ ও কিস্তি</th>
                  <th className="p-4 text-emerald-600">আদায়কৃত সঞ্চয়</th>
                  <th className="p-4 text-teal-600">আসল আদায় (কিস্তি)</th>
                  <th className="p-4 text-purple-600">মুনাফা আদায় (লাভ)</th>
                  <th className="p-4 font-bold text-slate-800">মোট আদায়</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {dailyInstallments.length > 0 || dailyRepayments.length > 0 ? (
                  <>
                    {/* Render Savings Deposits */}
                    {dailyInstallments.map((item) => {
                      const total = item.amount + (item.savingsAmount || 0) + (item.profitAmount || 0);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-mono font-semibold text-slate-700">{item.id}</td>
                          <td className="p-4">
                            <strong className="text-slate-900">{item.memberName}</strong>
                            <span className="text-[10px] text-slate-400 block font-mono">ID: {item.memberId}</span>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700 font-bold">
                              সঞ্চয় জমা ({item.type === 'daily' ? 'দৈনিক' : item.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'})
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-emerald-600">+{item.amount + (item.savingsAmount || 0)} ৳</td>
                          <td className="p-4 font-mono text-slate-400">০ ৳</td>
                          <td className="p-4 font-mono text-purple-650">+{item.profitAmount || 0} ৳</td>
                          <td className="p-4 font-mono font-black text-slate-800">{total} ৳</td>
                        </tr>
                      );
                    })}
                    
                    {/* Render Loan Repayments */}
                    {dailyRepayments.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-mono font-semibold text-slate-700">{item.id}</td>
                        <td className="p-4">
                          <strong className="text-slate-900">{item.memberName}</strong>
                          <span className="text-[10px] text-slate-400 block font-mono">ID: {item.memberId}</span>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-50 text-purple-700 font-bold">
                            ঋণ আদায় {item.installmentNo ? `(${item.installmentNo})` : ''}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-400">০ ৳</td>
                        <td className="p-4 font-mono font-bold text-teal-600">+{item.principalPaid} ৳</td>
                        <td className="p-4 font-mono font-bold text-purple-600">+{item.profitPaid} ৳</td>
                        <td className="p-4 font-mono font-black text-slate-800">{item.repayAmount} ৳</td>
                      </tr>
                    ))}
                  </>
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-slate-400">
                      এই তারিখে কোনো আদায় বা কালেকশনের এন্ট্রি নেই।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DUE REGISTER WARNING LIST */}
      {activeReportTab === 'due' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-100 gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="h-4 w-4 text-rose-500" />
              <span>মাস নির্বাচন করুন (Due Check):</span>
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadPdf('due-print-report', `বকেয়া_কিস্তি_খেলাপি_রিপোর্ট_${targetMonth}`, `বকেয়া কিস্তি খেলাপি রিপোর্ট - ${targetMonth}`)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-[11px] font-semibold text-white rounded border border-indigo-600 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-95 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> পিডিএফ ডাউনলোড (PDF)
              </button>
              <button
                type="button"
                onClick={() => handlePrintReport('due-print-report', `বকেয়া কিস্তি খেলাপি রিপোর্ট - ${targetMonth}`)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 rounded border flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-3 w-3" /> প্রিন্ট বকেয়া নোটিশ
              </button>
            </div>
          </div>

          <div id="due-print-report" className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="p-4 bg-rose-50 text-rose-850 font-sans text-xs flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>মাসের কিস্তি বকেয়া তালিকা: <strong>{targetMonth}</strong></span>
              </div>
              <span className="bg-rose-100 text-rose-850 px-2 py-1 rounded font-bold">{unpaidMembersInSelectedMonth.length} জন বকেয়া</span>
            </div>

            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="p-4">সদস্য আইডি</th>
                  <th className="p-4">সদস্যের নাম</th>
                  <th className="p-4">মোবাইল নম্বর</th>
                  <th className="p-4">টার্গেট কিস্তির টাকা</th>
                  <th className="p-4">অবস্থা (Status)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unpaidMembersInSelectedMonth.length > 0 ? (
                  unpaidMembersInSelectedMonth.map((m) => (
                    <tr key={m.id} className="hover:bg-rose-50/20">
                      <td className="p-4 font-mono font-bold text-slate-900">{m.id}</td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{m.name}</div>
                        <span className="text-[10px] text-slate-400 block font-mono">NID: {m?.nid || ''}</span>
                      </td>
                      <td className="p-4 font-mono text-slate-600">{m?.phone || ''}</td>
                      <td className="p-4 font-mono font-bold text-rose-600">{m?.targetInstallmentAmount || 0} ৳ ({m?.type === 'daily' ? 'দৈনিক' : m?.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'})</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[9px] animate-pulse">কিস্তি বকেয়া</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-slate-400">
                      এই মাসে সকল সদস্যের কিস্তি আদায় আপডেট রয়েছে! কোনো বকেয়া নেই।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeReportTab === 'profit_loss' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 animate-fadeIn">
              <TrendingUp className="h-4 w-4 text-emerald-600 animate-pulse" />
              আয়-ব্যয় খতিয়ান খাতা ও অতিরিক্ত ক্যাশ ডায়েরি (General Ledger & Cash Diary)
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadPdf('profit-loss-print', 'আয়_ব্যয়_খতিয়ান_খাতা', 'আয়-ব্যয় খতিয়ান খাতা')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-[11px] font-semibold text-white rounded border border-indigo-600 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-95 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> পিডিএফ ডাউনলোড (PDF)
              </button>
              <button
                type="button"
                onClick={() => handlePrintReport('profit-loss-print', 'আয়-ব্যয় খতিয়ান খাতা')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-705 rounded border border-slate-205 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-95 shadow-sm"
              >
                <Printer className="h-3 w-3" /> প্রিন্ট বিবরণী
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Input Form Card */}
            {role === 'admin' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-100 h-fit space-y-4 text-left">
                <h4 className="text-xs font-bold text-slate-700 border-b pb-2.5 flex items-center gap-1.5">
                  <Wallet className="h-4.5 w-4.5 text-emerald-600" />
                  নতুন আয় / ব্যয় / অতিরিক্ত ক্যাশ এন্ট্রি
                </h4>

                {/* Quick Preset Macros - Extremely Helpful for the Association! */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">দ্রুত এন্ট্রি ও জরিমানার টেমপ্লেট</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerType('income');
                        setLedgerDesc('সদস্য সঞ্চয় জরিমানা ও বিলম্ব ফি');
                      }}
                      className="p-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-[10px] font-bold rounded-lg border border-rose-105 transition-colors cursor-pointer"
                    >
                      + সঞ্চয় জরিমানা
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerType('income');
                        setLedgerDesc('ভর্তি ফি ও ফরম পূরণ বাবদ আদায়');
                      }}
                      className="p-1.5 px-2 bg-blue-50 hover:bg-blue-105 text-[#1d8df5] text-[10px] font-bold rounded-lg border border-blue-100 transition-colors cursor-pointer"
                    >
                      + ভর্তি ফি ও বই বিক্রয়
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerType('surplus');
                        setLedgerDesc('অতিরিক্ত অংশীদার মূলধন ও বাড়তি আদায়');
                      }}
                      className="p-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-100 transition-colors cursor-pointer"
                    >
                      + ক্যাশ বাড়তি আদায়
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddLedgerSubmit} className="space-y-3.5 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">এন্ট্রির ক্যাটাগরি খাত *</label>
                    <select
                      value={ledgerType}
                      onChange={(e) => setLedgerType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100"
                    >
                      <option value="income">আয় খাত (Income)</option>
                      <option value="expense">ব্যয়/খরচ খাত (Expenses)</option>
                      <option value="surplus">অতিরিক্ত ক্যাশ জমা (Month Cash Surplus)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">বিবরণ (Description) *</label>
                    <input
                      type="text"
                      required
                      placeholder="যেমনঃ office খাতা ক্রয় বা অতিরিক্ত ৩০০০ টাকা ক্যাশ জমা"
                      value={ledgerDesc}
                      onChange={(e) => setLedgerDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">পরিমাণ (টাকা) *</label>
                    <input
                      type="number"
                      required
                      placeholder="যেমনঃ ৩০০০"
                      value={ledgerAmount}
                      onChange={(e) => setLedgerAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg text-xs outline-none focus:border-emerald-505 focus:ring-1 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">তারিখ *</label>
                    <input
                      type="date"
                      required
                      value={ledgerDate}
                      onChange={(e) => setLedgerDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="h-4 w-4" /> এন্ট্রি যোগ করুন
                  </button>
                </form>
              </div>
            )}

            {/* Right: Main Statement and Ledger items list */}
            <div className={`${role === 'admin' ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
              {/* Financial Balance Summary Card */}
              <div id="profit-loss-print" className="bg-white p-6 rounded-2xl border border-slate-100 space-y-5 text-left">
                <div className="text-center py-1 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800">ক্ষুদ্র সঞ্চয় সমিতি - আয়, ব্যয় ও মাসিক অতিরিক্ত ক্যাশ বিবরণী</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">রিয়েল-টাইম খতিয়ান খাতা</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Total Income */}
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-850 text-xs border border-emerald-100">
                    <span className="block text-slate-500 font-semibold text-[10px]">মোট সংগৃহীত আয়</span>
                    <strong className="text-lg font-mono tracking-tight">{customIncome} ৳</strong>
                  </div>

                  {/* Monthly Surplus Cash */}
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-850 text-xs border border-indigo-100">
                    <span className="block text-slate-500 font-semibold text-[10px]">অতিরিক্ত ক্যাশ জমা</span>
                    <strong className="text-lg font-mono tracking-tight">{customSurplus} ৳</strong>
                  </div>

                  {/* Total Expenses */}
                  <div className="p-3 bg-rose-50 rounded-xl text-rose-850 text-xs border border-rose-100">
                    <span className="block text-slate-500 font-semibold text-[10px]">মোট পরিচালন ব্যয়</span>
                    <strong className="text-lg font-mono tracking-tight">{customExpense} ৳</strong>
                  </div>
                </div>

                {/* Net Income Indicator block */}
                <div className={`p-4 rounded-xl text-center border ${netIncome >= 0 ? 'bg-emerald-50 text-emerald-850 border-emerald-200/50' : 'bg-rose-50 text-rose-850 border-rose-200/50'}`}>
                  <span className="text-[10px] font-bold text-slate-500 block">অবशिष्ट নিট ক্যাশ ব্যালেন্স (Net Cash Balance)</span>
                  <strong className="text-xl font-mono block mt-1">
                    {netIncome >= 0 ? `+${netIncome}` : netIncome} ৳
                  </strong>
                </div>

                {/* Grand Cash In Hand Book block - Extremely robust visual accounting tool */}
                <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-3.5 border border-slate-800 shadow-lg">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-400 font-sans">সমিতির ক্যাশ বাক্সের হিসাব (Cooperative Cash Box Ledger)</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg font-bold font-sans">কেশে অবশিষ্ট খতিয়ান</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed font-sans">
                    <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-800 pb-3 md:pb-0 md:pr-4">
                      <div className="text-[11px] font-bold text-emerald-400 pb-1 border-b border-emerald-950">কালেকশন ও জমা খাত (+)</div>
                      <div className="flex justify-between opacity-50">
                        <span className="text-slate-400">মোট সংগৃহীত সঞ্চয় (মেইন ক্যাশ বহির্ভূত):</span>
                        <span className="font-mono text-slate-350">{totalSavingsSumOfCoop} ৳ (আলাদা ঘর)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">মোট আদায়কৃত লোন আসল সংগ্রহ:</span>
                        <span className="font-mono text-emerald-400 font-bold">+{totalLoansRecoveredPrincipalOfCoop} ৳</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">মোট আদায়কৃত লোন মুনাফা (লাভ):</span>
                        <span className="font-mono text-emerald-400 font-bold">+{totalLoanPercentProfitOfCoop} ৳</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ঋণ গ্রহীতাদের কিস্তি জরিমানা আদায়:</span>
                        <span className="font-mono text-emerald-400 font-bold">+{totalLoanPenaltiesOfCoop} ৳</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">সদস্য সঞ্চয় জরিমানা ও ভর্তি ফি বাবদ আদায়:</span>
                        <span className="font-mono text-emerald-400 font-bold">+{customIncome} ৳</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">অতিরিক্ত ক্যাশ উদ্বৃত্ত জমা:</span>
                        <span className="font-mono text-emerald-400 font-bold">+{customSurplus} ৳</span>
                      </div>
                     </div>

                     <div className="space-y-1.5 md:pl-2">
                       <div className="text-[11px] font-bold text-rose-400 pb-1 border-b border-rose-950">বিতরণ ও খরচ খাত (-)</div>
                       <div className="flex justify-between">
                         <span className="text-slate-400">মোট বিতরিত ঋণ গ্রহীতাদের প্রদান:</span>
                         <span className="font-mono text-rose-400 font-bold">-{totalLoansDisbursedPrincipalOfCoop} ৳</span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-slate-400">মোট অফিস পরিচালনা ব্যয়:</span>
                         <span className="font-mono text-rose-400 font-bold">-{customExpense} ৳</span>
                       </div>
                     </div>
                   </div>

                   <div className="pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center text-xs gap-2 font-sans">
                     <div className="font-semibold text-slate-300">
                       কেশে সর্বমোট অবশিষ্ট লিকুইড ক্যাশ (Remaining Cash balance):
                     </div>
                     <span className={`text-base font-black font-mono tracking-wide px-3.5 py-1.5 rounded-xl ${totalCashBalanceOfCoop >= 0 ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border border-rose-500/25'}`}>
                       {totalCashBalanceOfCoop} ৳
                     </span>
                   </div>
                 </div>

                {/* Net Income Indicator block */}
                <div className={`p-4 rounded-xl text-center border ${netIncome >= 0 ? 'bg-emerald-50 text-emerald-850 border-emerald-200/50' : 'bg-rose-50 text-rose-850 border-rose-200/50'}`}>
                  <span className="text-[10px] font-bold text-slate-500 block">অবশিষ্ট নিট ক্যাশ ব্যালেন্স (Net Cash Balance)</span>
                  <strong className="text-xl font-mono block mt-1">
                    {netIncome >= 0 ? `+${netIncome}` : netIncome} ৳
                  </strong>
                </div>

                {/* Custom entered list */}
                <div className="space-y-3 pt-2">
                  <h5 className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    বিবরণী খতিয়ান তালিকা (Real-Time Ledger Logs)
                  </h5>

                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <th className="p-2.5">তারিখ</th>
                          <th className="p-2.5">ধরণ</th>
                          <th className="p-2.5">বিবরণ</th>
                          <th className="p-2.5 text-right">টাকা</th>
                          {role === 'admin' && <th className="p-2.5 text-center">নিয়ন্ত্রণ</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {ledger && ledger.length > 0 ? (
                          ledger.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 animate-fadeIn">
                              <td className="p-2.5 font-mono text-[10px] text-slate-500">{item.date}</td>
                              <td className="p-2.5">
                                {item.type === 'income' ? (
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold">আয়</span>
                                ) : item.type === 'expense' ? (
                                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold">ব্যয়</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold">সারপ্লাস</span>
                                )}
                              </td>
                              <td className="p-2.5 font-sans font-medium text-slate-800">{item.description}</td>
                              <td className={`p-2.5 text-right font-bold font-mono ${item.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {item.type === 'expense' ? '-' : '+'}{item.amount} ৳
                              </td>
                              {role === 'admin' && (
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => onDeleteLedger(item.id)}
                                    className="text-[10px] text-rose-600 hover:text-rose-800 font-sans hover:underline cursor-pointer"
                                  >
                                    মুছুন
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={role === 'admin' ? 5 : 4} className="text-center p-8 text-slate-400">
                              খতিয়ান খাতায় কোনো লেনদেন বা খরচ লেখা হয়নি।
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern React-based Modal Dialog for reliable warnings and confirmations in embedded WebView/iFrame */}
      {dialog && dialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="p-2.5 rounded-full bg-red-100 text-rose-600">
                <AlertTriangle className="h-5.5 w-5.5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{dialog.title}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">গুরুত্বপূর্ণ সতর্কতা সিগন্যাল</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed mb-6 font-sans">
              {dialog.message}
            </p>

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setDialog(null)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                ঠিক আছে
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
