import { Member, Installment, Loan, TrashLog, AdminNotification } from './types';

// Default Admin/Owner setup
export const ADMIN_PROFILE = {
  name: "মিজানুর রহমান",
  role: "পরিচালক",
  phone: "01711111111", // Admin Phone Number
  pin: "1234", // Default PIN
  ownerPhone: "01722222222", // Proprietor/Shareholder Phone Number
  ownerPin: "5678" // Proprietor/Shareholder PIN
};

// Seed data to make the app looks populated immediately
export const INITIAL_MEMBERS: Member[] = [];

export const INITIAL_INSTALLMENTS: Installment[] = [];

export const INITIAL_LOANS: Loan[] = [];

export const INITIAL_NOTIFICATIONS: AdminNotification[] = [];

// Localstorage state initialization
export function getSavedData() {
  if (typeof window === 'undefined') {
    return {
      members: INITIAL_MEMBERS,
      installments: INITIAL_INSTALLMENTS,
      loans: INITIAL_LOANS,
      trash: [] as TrashLog[],
      notifications: INITIAL_NOTIFICATIONS
    };
  }

  const savedMembers = localStorage.getItem('sms_v3_members');
  const savedInstallments = localStorage.getItem('sms_v3_installments');
  const savedLoans = localStorage.getItem('sms_v3_loans');
  const savedTrash = localStorage.getItem('sms_v3_trash');
  const savedNotifs = localStorage.getItem('sms_v3_notifications');

  return {
    members: savedMembers ? JSON.parse(savedMembers) : INITIAL_MEMBERS,
    installments: savedInstallments ? JSON.parse(savedInstallments) : INITIAL_INSTALLMENTS,
    loans: savedLoans ? JSON.parse(savedLoans) : INITIAL_LOANS,
    trash: savedTrash ? JSON.parse(savedTrash) : [] as TrashLog[],
    notifications: savedNotifs ? JSON.parse(savedNotifs) : INITIAL_NOTIFICATIONS
  };
}

export function saveAllData(data: {
  members: Member[];
  installments: Installment[];
  loans: Loan[];
  trash: TrashLog[];
  notifications: AdminNotification[];
}) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sms_v3_members', JSON.stringify(data.members));
  localStorage.setItem('sms_v3_installments', JSON.stringify(data.installments));
  localStorage.setItem('sms_v3_loans', JSON.stringify(data.loans));
  localStorage.setItem('sms_v3_trash', JSON.stringify(data.trash));
  localStorage.setItem('sms_v3_notifications', JSON.stringify(data.notifications));
}
