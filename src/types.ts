export type Member = {
  id: string; // e.g. "SMS-101"
  name: string;
  phone: string;
  address: string;
  nid: string;
  photoUrl?: string;
  joinDate: string;
  type: 'daily' | 'weekly' | 'monthly';
  targetInstallmentAmount: number; // expected installment amount
  status: 'active' | 'inactive';
  pin: string;
  memberCategory?: 'savings_only' | 'borrower';
};

export type Installment = {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  savingsAmount?: number;
  savingsPercent?: number;
  profitAmount?: number;
  date: string;
  type: 'daily' | 'weekly' | 'monthly';
  isBorrowerSavings?: boolean;
};

export type Loan = {
  id: string;
  memberId: string;
  memberName: string;
  principalAmount: number; // total amount with profit
  takenDate: string;
  dueDate: string;
  repaidAmount: number;
  installmentAmount: number; // installment repayment per week/month
  status: 'active' | 'paid' | 'overdue';
  interestPercent?: number;  // original interest profit percent (e.g., 10 for 10%)
  originalPrincipal?: number; // original principal amount without interest (e.g., 5000)
  profitAmount?: number;     // profit amount separately (e.g., 500)
  profitRepaid?: number;     // accumulated profit repaid separately
};

export type TrashLog = {
  id: string;
  type: 'member' | 'installment' | 'loan';
  data: any;
  deletedAt: string;
  description: string;
};

export type AdminNotification = {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
};

export type LedgerEntry = {
  id: string;
  type: 'income' | 'expense' | 'surplus';
  description: string;
  amount: number;
  date: string;
};

export type AppConfig = {
  adminName: string;
  adminPhone: string;
  adminAddress: string;
  adminPhotoUrl: string;
  adminPin: string;
  ownerName: string;
  ownerPhone: string;
  ownerPin: string;
  noticeText?: string;
  memberNoticeText?: string;
  shareholderNoticeText?: string;
};

export type PinRequest = {
  id: string;
  name: string;
  phone: string;
  requestedAt: string;
  status: 'pending' | 'resolved';
  resolvedPin?: string;
  memberId?: string;
};

export type MonthlyExpense = {
  id: string;
  month: string; // e.g. "2026-06"
  date: string;  // recording date
  expense1: number; // খাতা, কলম ও স্টেশনারি
  expense2: number; // চা ও নাস্তা বিল
  expense3: number; // বিদ্যুৎ বিল
  expense4: number; // মোবাইল ও ইন্টারনেট বিল
  expense5: number; // যাতায়াত ভাড়া
  expense6: number; // অফিস ঘর ভাড়া
  expense7: number; // আপ্যায়ন খরচ
  expense8: number; // কার্টিজ ও প্রিন্টিং বিল
  expense9: number; // নাইটগার্ড ও নিরাপত্তা বেতন
  expense10: number; // মসজিদ বা দান ও সেবা
  expense11: number; // পরিচ্ছন্নতা বিল
  expense12: number; // বিবিধ আপৎকালীন খরচ
  totalAmount: number;
  note?: string;
};

export type CashVaultLog = {
  id: string;
  date: string;
  amount: number; // কেশে কত টাকা রাখলাম
  location: string; // e.g. "অফিস লকার", "প্রধান আলমারি", "ব্যাংক ড্রয়ার"
  note?: string;
};

export type LoanRepayment = {
  id: string;
  loanId: string;
  memberId: string;
  memberName: string;
  repayAmount: number; // total = principal + profit + penalty
  principalPaid: number;
  profitPaid: number;
  penaltyPaid: number;
  savingsPaid?: number;
  date: string;
  installmentNo?: string;
};

export type Notice = {
  id: string;
  category: 'member' | 'shareholder' | 'all';
  text: string;
  date: string;
  createdAt: number;
};

