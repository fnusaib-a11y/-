import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSavedData, saveAllData, ADMIN_PROFILE, INITIAL_MEMBERS, INITIAL_INSTALLMENTS, INITIAL_LOANS, INITIAL_NOTIFICATIONS } from './db';
import { Member, Installment, Loan, TrashLog, AdminNotification, AppConfig, LedgerEntry, PinRequest, MonthlyExpense, CashVaultLog, LoanRepayment } from './types';
// @ts-ignore
import associationLogo from './assets/images/association_logo_1780420505055.png';

// Importing modules
import RoleSelector from './components/RoleSelector';
import MemberManagement from './components/MemberManagement';
import Installments from './components/Installments';
import Loans from './components/Loans';
import Reports from './components/Reports';
import TrashRestore from './components/TrashRestore';
import CashExpenseDiary from './components/CashExpenseDiary';

// Lucide icons
import {
  Users, Wallet, HandCoins, FileBarChart, Shield, Landmark,
  Bell, LogOut, Sun, Moon, Info, CloudCheck, ShieldAlert, CheckCircle,
  Clock, ArrowRightLeft, User, Phone, MapPin, Search, RefreshCw, Send, HelpCircle,
  Menu, BookOpen, X, Heart, Award, KeyRound, AlertCircle, Check, AlertTriangle
} from 'lucide-react';

import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Helper to convert standard numbers to Bengali digits
const toBengaliDigits = (num: number | string) => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (d) => bnDigits[parseInt(d)]);
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Load database state from client storage
  const [members, setMembers] = useState<Member[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [trash, setTrash] = useState<TrashLog[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [pinRequests, setPinRequests] = useState<PinRequest[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([]);
  const [cashVaultLogs, setCashVaultLogs] = useState<CashVaultLog[]>([]);
  const [loanRepayments, setLoanRepayments] = useState<LoanRepayment[]>([]);

  const [appConfig, setAppConfig] = useState<AppConfig>({
    adminName: "মিজানুর রহমান",
    adminPhone: "01660179421",
    adminAddress: "গাজীপুর কালিয়াকৈর মৌচাক হুপলুন গেট",
    adminPhotoUrl: "",
    adminPin: "1234",
    ownerName: "সম্মানিত শেয়ার হোল্ডার",
    ownerPhone: "01722222222",
    ownerPin: "5678"
  });

  const [isLoading, setIsLoading] = useState(true);

  // App running states
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentRole, setCurrentRole] = useState<'admin' | 'owner' | 'member' | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'members' | 'installments' | 'loans' | 'reports' | 'security' | 'diary'>('dashboard');
  
  const changeTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    navigate('/' + tab);
  };

  const [darkMode, setDarkMode] = useState(false);
  const [showOverdueDetails, setShowOverdueDetails] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'developer' | 'privacy' | 'guide' | 'rules' | null>(null);

  // Drawer Forget Password states
  const [isDrawerResetOpen, setIsDrawerResetOpen] = useState(false);
  const [drawerResetName, setDrawerResetName] = useState('');
  const [drawerResetPhone, setDrawerResetPhone] = useState('');
  const [drawerResetSuccess, setDrawerResetSuccess] = useState(false);
  const [drawerResetError, setDrawerResetError] = useState('');

  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  // Custom non-blocking warning modal state to replace native box alert()
  const [globalAlertDialog, setGlobalAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  const alert = (message: string) => {
    const isSuccess = message.includes('সফল') || message.includes('অভিনন্দন') || message.includes('ধন্যবাদ');
    setGlobalAlertDialog({
      isOpen: true,
      title: isSuccess ? 'সফল হয়েছে' : 'তথ্য সংকেত',
      message,
      type: isSuccess ? 'success' : 'alert'
    });
  };

  // Synchronize URL route changes with React state variables
  useEffect(() => {
    const path = location.pathname;

    // 1. If not logged in, redirect to /login
    if (!currentRole) {
      if (path !== '/login') {
        navigate('/login', { replace: true });
      }
      return;
    }

    // 2. If logged in but route is /login or /, redirect to /dashboard
    if (path === '/login' || path === '/') {
      navigate('/dashboard', { replace: true });
      return;
    }

    // 3. Map path to activeTab
    const tabName = path.substring(1) as any;

    // Direct access validations based on Role
    if (tabName === 'members' && currentRole === 'member') {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (tabName === 'reports' && currentRole === 'member') {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (tabName === 'diary' && currentRole !== 'admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (tabName === 'security' && currentRole !== 'admin') {
      navigate('/dashboard', { replace: true });
      return;
    }

    const validTabs = ['dashboard', 'members', 'installments', 'loans', 'reports', 'security', 'diary'];
    if (validTabs.includes(tabName)) {
      if (activeTab !== tabName) {
        setActiveTab(tabName);
      }
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, currentRole, navigate]);

  // Handle native popstate (BackButton) for overlays or to prevent exit past Dashboard
  useEffect(() => {
    const handleBeforePopState = (event: PopStateEvent) => {
      // Close open UI overlays first on back actions
      if (showExitConfirmModal) {
        setShowExitConfirmModal(false);
        navigate('/' + activeTab);
        return;
      }
      if (activeModal) {
        setActiveModal(null);
        navigate('/' + activeTab);
        return;
      }
      if (isDrawerResetOpen) {
        setIsDrawerResetOpen(false);
        navigate('/' + activeTab);
        return;
      }
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        navigate('/' + activeTab);
        return;
      }

      // If logged in and the target route would be /login or empty/root, intercept!
      if (currentRole) {
        const currentHash = window.location.hash;
        if (!currentHash || currentHash === '#/login' || currentHash === '#/' || currentHash === '#') {
          setShowExitConfirmModal(true);
          navigate('/dashboard');
        }
      }
    };

    window.addEventListener('popstate', handleBeforePopState);
    return () => {
      window.removeEventListener('popstate', handleBeforePopState);
    };
  }, [activeTab, currentRole, activeModal, isDrawerOpen, isDrawerResetOpen, showExitConfirmModal, navigate]);

  // Synchronize Firestore collections with app state
  useEffect(() => {
    // Load local storage data first as optimistic cache so there's no blank flash
    const localData = getSavedData();
    if (localData.members.length > 0) setMembers(localData.members);
    if (localData.installments.length > 0) setInstallments(localData.installments);
    if (localData.loans.length > 0) setLoans(localData.loans);
    if (localData.trash.length > 0) setTrash(localData.trash);
    if (localData.notifications.length > 0) setNotifications(localData.notifications);

    let unsubscribeMembers: (() => void) | null = null;
    let unsubscribeInstallments: (() => void) | null = null;
    let unsubscribeLoans: (() => void) | null = null;
    let unsubscribeTrash: (() => void) | null = null;
    let unsubscribeNotifications: (() => void) | null = null;
    let unsubscribeSettings: (() => void) | null = null;
    let unsubscribeLedger: (() => void) | null = null;
    let unsubscribePinRequests: (() => void) | null = null;
    let unsubscribeMonthlyExpenses: (() => void) | null = null;
    let unsubscribeCashVaultLogs: (() => void) | null = null;
    let unsubscribeLoanRepayments: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('Firebase anonymous auth session confirmed');
      }
    });

    // 1. Listen to members unconditionally to ensure instant real-time UI synchronization
    unsubscribeMembers = onSnapshot(collection(db, 'members'), async (snapshot) => {
      const list: Member[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as Member);
      });
      
      // If collection is empty, seed it!
      if (snapshot.empty && INITIAL_MEMBERS.length > 0) {
        console.log('Seeding members...');
        try {
          const batch = writeBatch(db);
          INITIAL_MEMBERS.forEach(m => {
            batch.set(doc(db, 'members', m.id), m);
          });
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'members');
        }
      } else {
        setMembers(list);
      }
    }, (err) => {
      console.warn('Firestore members read issue:', err);
      handleFirestoreError(err, OperationType.GET, 'members', false);
    });

    // 2. Listen to installments
    unsubscribeInstallments = onSnapshot(collection(db, 'installments'), async (snapshot) => {
      const list: Installment[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as Installment);
      });
      if (snapshot.empty && INITIAL_INSTALLMENTS.length > 0) {
        console.log('Seeding installments...');
        try {
          const batch = writeBatch(db);
          INITIAL_INSTALLMENTS.forEach(inst => {
            batch.set(doc(db, 'installments', inst.id), inst);
          });
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'installments');
        }
      } else {
        setInstallments(list);
      }
    }, (err) => {
      console.warn('Firestore installments read issue:', err);
      handleFirestoreError(err, OperationType.GET, 'installments', false);
    });

    // 3. Listen to loans
    unsubscribeLoans = onSnapshot(collection(db, 'loans'), async (snapshot) => {
      const list: Loan[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as Loan);
      });
      if (snapshot.empty && INITIAL_LOANS.length > 0) {
        console.log('Seeding loans...');
        try {
          const batch = writeBatch(db);
          INITIAL_LOANS.forEach(l => {
            batch.set(doc(db, 'loans', l.id), l);
          });
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'loans');
        }
      } else {
        setLoans(list);
      }
    }, (err) => {
      console.warn('Firestore loans read issue:', err);
      handleFirestoreError(err, OperationType.GET, 'loans', false);
    });

    // 4. Listen to trash
    unsubscribeTrash = onSnapshot(collection(db, 'trash'), (snapshot) => {
      const list: TrashLog[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as TrashLog);
      });
      setTrash(list);
    }, (err) => {
      console.warn('Firestore trash read issue:', err);
      handleFirestoreError(err, OperationType.GET, 'trash', false);
    });

    // 5. Listen to notifications
    unsubscribeNotifications = onSnapshot(collection(db, 'notifications'), async (snapshot) => {
      const list: AdminNotification[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as AdminNotification);
      });
      if (snapshot.empty && INITIAL_NOTIFICATIONS.length > 0) {
        console.log('Seeding notifications...');
        try {
          const batch = writeBatch(db);
          INITIAL_NOTIFICATIONS.forEach(n => {
            batch.set(doc(db, 'notifications', n.id), n);
          });
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'notifications');
        }
      } else {
        // Sort notifications to show latest first
        list.sort((a, b) => b.id.localeCompare(a.id));
        setNotifications(list);
      }
    }, (err) => {
      console.warn('Firestore notifications read issue:', err);
      handleFirestoreError(err, OperationType.GET, 'notifications', false);
    });

    // 6. Listen to app configuration
    unsubscribeSettings = onSnapshot(doc(db, 'settings', 'app_config'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AppConfig;
        setAppConfig(data);
      } else {
        // Seed default config into Firestore if not exists
        const defaultConfig: AppConfig = {
          adminName: "মিজানুর রহমান",
          adminPhone: "01660179421",
          adminAddress: "গাজীপুর কালিয়াকৈর মৌচাক হুপলুন গেট",
          adminPhotoUrl: "",
          adminPin: "1234",
          ownerName: "সম্মানিত শেয়ার হোল্ডার",
          ownerPhone: "01722222222",
          ownerPin: "5678"
        };
        setDoc(doc(db, 'settings', 'app_config'), defaultConfig).catch(err => {
          console.warn('Failed to seed default settings:', err);
        });
        setAppConfig(defaultConfig);
      }
    }, (err) => {
      console.warn('Firestore settings read issue:', err);
    });

    // 7. Listen to general ledger entries
    unsubscribeLedger = onSnapshot(collection(db, 'ledger'), (snapshot) => {
      const list: LedgerEntry[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as LedgerEntry);
      });
      // Sort ledger entries latest first
      list.sort((a, b) => b.date.localeCompare(a.date));
      setLedger(list);
    }, (err) => {
      console.warn('Firestore ledger read issue:', err);
    });

    // 8. Listen to pin requests
    unsubscribePinRequests = onSnapshot(collection(db, 'pin_requests'), (snapshot) => {
      const list: PinRequest[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as PinRequest);
      });
      // Sort pin requests latest first
      list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
      setPinRequests(list);
    }, (err) => {
      console.warn('Firestore pin requests read issue:', err);
    });

    // 9. Listen to monthly office expenses
    unsubscribeMonthlyExpenses = onSnapshot(collection(db, 'monthly_expenses'), (snapshot) => {
      const list: MonthlyExpense[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as MonthlyExpense);
      });
      list.sort((a, b) => b.month.localeCompare(a.month));
      setMonthlyExpenses(list);
    }, (err) => {
      console.warn('Firestore monthly expenses read issue:', err);
    });

    // 10. Listen to cash vault logs
    unsubscribeCashVaultLogs = onSnapshot(collection(db, 'cash_vault_logs'), (snapshot) => {
      const list: CashVaultLog[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as CashVaultLog);
      });
      list.sort((a, b) => b.date.localeCompare(a.date));
      setCashVaultLogs(list);
    }, (err) => {
      console.warn('Firestore cash vault logs read issue:', err);
    });

    // 11. Listen to individual loan repayments
    unsubscribeLoanRepayments = onSnapshot(collection(db, 'loan_repayments'), (snapshot) => {
      const list: LoanRepayment[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as LoanRepayment);
      });
      // Sort newest repayments first
      list.sort((a, b) => b.date.localeCompare(a.date));
      setLoanRepayments(list);
    }, (err) => {
      console.warn('Firestore loan repayments read issue:', err);
    });

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => {
      unsubscribeAuth();
      if (unsubscribeMembers) unsubscribeMembers();
      if (unsubscribeInstallments) unsubscribeInstallments();
      if (unsubscribeLoans) unsubscribeLoans();
      if (unsubscribeTrash) unsubscribeTrash();
      if (unsubscribeNotifications) unsubscribeNotifications();
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribeLedger) unsubscribeLedger();
      if (unsubscribePinRequests) unsubscribePinRequests();
      if (unsubscribeMonthlyExpenses) unsubscribeMonthlyExpenses();
      if (unsubscribeCashVaultLogs) unsubscribeCashVaultLogs();
      if (unsubscribeLoanRepayments) unsubscribeLoanRepayments();
      clearTimeout(timer);
    };
  }, []);

  // Save changes locally in addition for offline persistence fallback
  useEffect(() => {
    if (members.length > 0 || installments.length > 0) {
      saveAllData({ members, installments, loans, trash, notifications });
    }
  }, [members, installments, loans, trash, notifications]);

  // Synchronize dynamic ADMIN_PROFILE values for backward compatibility with older references
  useEffect(() => {
    ADMIN_PROFILE.name = appConfig.adminName;
    ADMIN_PROFILE.phone = appConfig.adminPhone;
    ADMIN_PROFILE.pin = appConfig.adminPin;
    ADMIN_PROFILE.ownerPhone = appConfig.ownerPhone;
    ADMIN_PROFILE.ownerPin = appConfig.ownerPin;
  }, [appConfig]);

  // Overdue Installment logic (Requirement 13) - Moved above early returns to comply with hook rules
  const getDaysElapsed = (dateString: string) => {
    if (!dateString) return 0;
    const cleanDate = dateString.split(' ')[0];
    const targetDate = new Date(cleanDate);
    const today = new Date();
    targetDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = today.getTime() - targetDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  const getMemberOverdueStatus = (member: any) => {
    if (!member || member.status !== 'active') return { isOverdue: false, days: 0, lastPaidDate: '' };
    const memberInsts = installments.filter(i => i.memberId === member.id);
    const sorted = [...memberInsts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastPaidDate = sorted.length > 0 ? sorted[0].date : member.joinDate;
    const days = getDaysElapsed(lastPaidDate);
    
    let isOverdue = false;
    if (member.type === 'daily' && days > 1) {
      isOverdue = true;
    } else if (member.type === 'weekly' && days > 7) {
      isOverdue = true;
    } else if (member.type === 'monthly' && days > 30) {
      isOverdue = true;
    }
    return { isOverdue, days, lastPaidDate };
  };

  const overdueMembersList = useMemo(() => {
    return members
      .map(m => {
        const { isOverdue, days, lastPaidDate } = getMemberOverdueStatus(m);
        return {
          member: m,
          isOverdue,
          days,
          lastPaidDate
        };
      })
      .filter(item => item.isOverdue);
  }, [members, installments]);

  // Handle configuration update from Admin Settings Panel
  const handleUpdateAppConfig = async (newConfig: AppConfig) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await setDoc(doc(db, 'settings', 'app_config'), newConfig);
      setAppConfig(newConfig);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/app_config');
    }
  };

  // Handle Login Event
  const handleLogin = (role: 'admin' | 'owner' | 'member', memberId?: string) => {
    setCurrentRole(role);
    setCurrentMemberId(memberId);
    navigate('/dashboard');
  };

  // Handle Logout Event
  const handleLogout = () => {
    setCurrentRole(null);
    setCurrentMemberId(undefined);
    navigate('/login');
  };

  // Synchronize with Central Server manually
  const triggerManualSync = async () => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই সিঙ্ক করতে পারবেন।');
      return;
    }
    setIsSyncing(true);
    try {
      const batch = writeBatch(db);
      members.forEach(m => batch.set(doc(db, 'members', m.id), m));
      installments.forEach(inst => batch.set(doc(db, 'installments', inst.id), inst));
      loans.forEach(l => batch.set(doc(db, 'loans', l.id), l));
      trash.forEach(t => batch.set(doc(db, 'trash', t.id), t));
      notifications.forEach(n => batch.set(doc(db, 'notifications', n.id), n));
      await batch.commit();
      
      const newNotif: AdminNotification = {
        id: `NOTIF-${Date.now()}`,
        title: "ক্লাউড সিকিউর সিঙ্ক সম্পন্ন",
        message: "স্থানীয় ডাটাবেজের সকল হিসাব নিরাপদে সেন্ট্রাল সার্ভারে আপডেট হয়েছে।",
        date: new Date().toISOString().split('T')[0],
        read: false
      };
      await setDoc(doc(db, 'notifications', newNotif.id), newNotif);
    } catch (err) {
      console.error('Manual Sync Failed:', err);
      handleFirestoreError(err, OperationType.WRITE, 'sync');
    } finally {
      setIsSyncing(false);
    }
  };

  // PIN Reset handles
  const handleAddPinRequest = async (req: PinRequest) => {
    try {
      await setDoc(doc(db, 'pin_requests', req.id), req);
      
      const newNotifId = `NOTIF-${Date.now()}`;
      const newNotif: AdminNotification = {
        id: newNotifId,
        title: "🔑 পিন রিসেট অনুরোধ",
        message: `${req.name} (মোবাইল: ${req.phone}) পিন রিসেট করার জন্য অনুরোধ পাঠিয়েছেন।`,
        date: new Date().toISOString().split('T')[0],
        read: false
      };
      await setDoc(doc(db, 'notifications', newNotifId), newNotif);
    } catch (err) {
      console.error('Error adding PIN request:', err);
    }
  };

  const handleResolvePinRequest = async (reqId: string, newPin: string, memberId?: string) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই পিন রিসেট অনুরোধ সমাধান করতে পারবেন।');
      return;
    }
    try {
      if (memberId) {
        const memberRef = doc(db, 'members', memberId);
        await updateDoc(memberRef, { pin: newPin });
      } else {
        const reqObj = pinRequests.find(r => r.id === reqId);
        if (reqObj) {
          const matchMember = members.find(m => m.phone === reqObj.phone);
          if (matchMember) {
            const memberRef = doc(db, 'members', matchMember.id);
            await updateDoc(memberRef, { pin: newPin });
          }
        }
      }
      
      const reqRef = doc(db, 'pin_requests', reqId);
      await updateDoc(reqRef, { 
        status: 'resolved',
        resolvedPin: newPin
      });
      
      const newNotifId = `NOTIF-${Date.now()}`;
      const newNotif: AdminNotification = {
        id: newNotifId,
        title: "✅ পিন রিসেট সম্পন্ন",
        message: `একটি পিন রিসেটের আবেদন সমাধান করে নতুন পিন সেট করা হয়েছে।`,
        date: new Date().toISOString().split('T')[0],
        read: false
      };
      await setDoc(doc(db, 'notifications', newNotifId), newNotif);
    } catch (err) {
      console.error('Error resolving PIN request:', err);
    }
  };

  const handleDrawerResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerResetError('');
    setDrawerResetSuccess(false);

    const cleanPhone = drawerResetPhone.trim();
    const cleanName = drawerResetName.trim();

    if (!cleanPhone || !cleanName) {
      setDrawerResetError('সবগুলো তথ্য সঠিকভাবে প্রদান করুন!');
      return;
    }

    const isMember = members.find(m => m.phone === cleanPhone || m.phone.endsWith(cleanPhone));
    const isAdmin = cleanPhone === appConfig.adminPhone || cleanPhone === 'admin';
    const isOwner = cleanPhone === appConfig.ownerPhone || cleanPhone === 'owner';

    if (!isMember && !isAdmin && !isOwner) {
      setDrawerResetError('এই মোবাইল নম্বরের কোনো রেজিস্টার্ড সদস্য বা অ্যাকাউন্ট খুঁজে পাওয়া যায়নি!');
      return;
    }

    try {
      const reqId = `PIN-REQ-${Date.now()}`;
      const req: PinRequest = {
        id: reqId,
        name: cleanName,
        phone: cleanPhone,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        memberId: isMember ? isMember.id : undefined
      };
      
      await handleAddPinRequest(req);
      setDrawerResetSuccess(true);
      setDrawerResetPhone('');
      setDrawerResetName('');
      setTimeout(() => {
        setIsDrawerResetOpen(false);
        setDrawerResetSuccess(false);
      }, 4050);
    } catch (err) {
      console.error('Drawer Reset Submission Failed:', err);
      setDrawerResetError('অনুরোধ পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  // CRUD Event: Add Member (Admin only)
  const handleAddMember = async (newMember: Member) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await setDoc(doc(db, 'members', newMember.id), newMember);
      const newNotif: AdminNotification = {
        id: `NOTIF-${Date.now()}`,
        title: "নতুন সদস্য নিবন্ধিত",
        message: `${newMember.name} (${newMember.id}) নামের নতুন সদস্য যুক্ত করেছেন ${ADMIN_PROFILE.name}।`,
        date: new Date().toISOString().split('T')[0],
        read: false
      };
      await setDoc(doc(db, 'notifications', newNotif.id), newNotif);
    } catch (err) {
      console.error('Error adding member:', err);
      handleFirestoreError(err, OperationType.WRITE, `members/${newMember.id}`);
    }
  };

  // CRUD Event: Update Member (Admin only)
  const handleUpdateMember = async (updatedMember: Member) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await setDoc(doc(db, 'members', updatedMember.id), updatedMember);
    } catch (err) {
      console.error('Error updating member:', err);
      handleFirestoreError(err, OperationType.WRITE, `members/${updatedMember.id}`);
    }
  };

  // CRUD Event: Delete Member with soft-delete logging
  const handleDeleteMember = async (id: string) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    const targetMember = members.find(m => m.id === id);
    if (!targetMember) return;

    try {
      await deleteDoc(doc(db, 'members', id));
      const newTrash: TrashLog = {
        id: `TRASH-${Date.now()}`,
        type: 'member',
        data: targetMember,
        deletedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        description: `সদস্য: ${targetMember.name} (ID: ${targetMember.id}), মোবাইল: ${targetMember.phone}`
      };
      await setDoc(doc(db, 'trash', newTrash.id), newTrash);
    } catch (err) {
      console.error('Error deleting member:', err);
      handleFirestoreError(err, OperationType.DELETE, `members/${id}`);
    }
  };

  // CRUD Event: Add installment (Admin only)
  const handleAddInstallment = async (newInst: Installment) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await setDoc(doc(db, 'installments', newInst.id), newInst);
      
      // Dynamically determine & update member's default installment settings
      try {
        const memberRef = doc(db, 'members', newInst.memberId);
        await updateDoc(memberRef, {
          type: newInst.type,
          targetInstallmentAmount: newInst.amount
        });
      } catch (memberErr) {
        console.warn('Could not update member installment parameters dynamically:', memberErr);
      }

      const newNotif: AdminNotification = {
        id: `NOTIF-${Date.now()}`,
        title: "কিস্তি জমা সংগৃহীত",
        message: `জমা রশিদ: ${newInst.id}, গ্রাহক: ${newInst.memberName}, পরিমাণ: ${newInst.amount} ৳।`,
        date: newInst.date,
        read: false
      };
      await setDoc(doc(db, 'notifications', newNotif.id), newNotif);
    } catch (err) {
      console.error('Error adding installment:', err);
      handleFirestoreError(err, OperationType.WRITE, `installments/${newInst.id}`);
    }
  };

  // CRUD Event: Delete installment (Admin only)
  const handleDeleteInstallment = async (id: string) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    const targetInst = installments.find(i => i.id === id);
    if (!targetInst) return;

    try {
      await deleteDoc(doc(db, 'installments', id));
      const newTrash: TrashLog = {
        id: `TRASH-${Date.now()}`,
        type: 'installment',
        data: targetInst,
        deletedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        description: `কিস্তি জমা রশিদ: ${targetInst.id}, সদস্য: ${targetInst.memberName}, পরিমাণ: ${targetInst.amount} ৳`
      };
      await setDoc(doc(db, 'trash', newTrash.id), newTrash);
    } catch (err) {
      console.error('Error deleting installment:', err);
      handleFirestoreError(err, OperationType.DELETE, `installments/${id}`);
    }
  };

  // CRUD Event: Add Ledger Entry
  const handleAddLedgerEntry = async (entry: LedgerEntry) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await setDoc(doc(db, 'ledger', entry.id), entry);
    } catch (err) {
      console.error('Error adding ledger entry:', err);
      handleFirestoreError(err, OperationType.WRITE, `ledger/${entry.id}`);
    }
  };

  // CRUD Event: Delete Ledger Entry
  const handleDeleteLedgerEntry = async (id: string) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await deleteDoc(doc(db, 'ledger', id));
    } catch (err) {
      console.error('Error deleting ledger entry:', err);
      handleFirestoreError(err, OperationType.DELETE, `ledger/${id}`);
    }
  };

  // CRUD Event: Add Monthly Expense (with 12 items)
  const handleAddMonthlyExpense = async (expense: MonthlyExpense) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await setDoc(doc(db, 'monthly_expenses', expense.id), expense);
    } catch (err) {
      console.error('Error adding monthly expense:', err);
      handleFirestoreError(err, OperationType.WRITE, `monthly_expenses/${expense.id}`);
    }
  };

  // CRUD Event: Delete Monthly Expense
  const handleDeleteMonthlyExpense = async (id: string) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await deleteDoc(doc(db, 'monthly_expenses', id));
    } catch (err) {
      console.error('Error deleting monthly expense:', err);
      handleFirestoreError(err, OperationType.DELETE, `monthly_expenses/${id}`);
    }
  };

  // CRUD Event: Add Cash Vault Log ("কেশে কত টাকা রাখলাম")
  const handleAddCashVaultLog = async (log: CashVaultLog) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await setDoc(doc(db, 'cash_vault_logs', log.id), log);
    } catch (err) {
      console.error('Error adding cash vault log:', err);
      handleFirestoreError(err, OperationType.WRITE, `cash_vault_logs/${log.id}`);
    }
  };

  // CRUD Event: Delete Cash Vault Log
  const handleDeleteCashVaultLog = async (id: string) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await deleteDoc(doc(db, 'cash_vault_logs', id));
    } catch (err) {
      console.error('Error deleting cash vault log:', err);
      handleFirestoreError(err, OperationType.DELETE, `cash_vault_logs/${id}`);
    }
  };

  // CRUD Event: Add loan (Admin only)
  const handleAddLoan = async (newLoan: Loan) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    try {
      await setDoc(doc(db, 'loans', newLoan.id), newLoan);
      const newNotif: AdminNotification = {
        id: `NOTIF-${Date.now()}`,
        title: "নতুন লোন বিতরণ ফাইল",
        message: `${newLoan.memberName} (${newLoan.memberId}) কে ${newLoan.principalAmount} ৳ এর ঋণ বিতরণ করা হয়েছে।`,
        date: newLoan.takenDate,
        read: false
      };
      await setDoc(doc(db, 'notifications', newNotif.id), newNotif);
    } catch (err) {
      console.error('Error adding loan:', err);
      handleFirestoreError(err, OperationType.WRITE, `loans/${newLoan.id}`);
    }
  };

  // CRUD Event: Repay Loan installment
  const handleRepayLoan = async (
    loanId: string, 
    repayAmount: number, 
    installmentNo?: string, 
    principalPaid?: number, 
    profitPaid?: number
  ) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    const targetLoan = loans.find(l => l.id === loanId);
    if (!targetLoan) return;

    // Repaid amount keeps track of actual principal repaid
    const afterPaid = targetLoan.repaidAmount + (principalPaid ?? repayAmount);
    const afterProfitPaid = (targetLoan.profitRepaid || 0) + (profitPaid ?? 0);
    
    // Loan is paid when total repaid principal reaches original loan value (excluding interest)
    const loanPrincipalLimit = targetLoan.originalPrincipal || (targetLoan.principalAmount - (targetLoan.profitAmount || 0));

    const updatedLoan: Loan = {
      ...targetLoan,
      repaidAmount: afterPaid,
      profitRepaid: afterProfitPaid,
      status: afterPaid >= loanPrincipalLimit ? 'paid' : targetLoan.status
    };

    try {
      await setDoc(doc(db, 'loans', loanId), updatedLoan);

      const repaymentId = `REPAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newRepayment: LoanRepayment = {
        id: repaymentId,
        loanId: targetLoan.id,
        memberId: targetLoan.memberId,
        memberName: targetLoan.memberName,
        repayAmount: repayAmount,
        principalPaid: principalPaid ?? repayAmount,
        profitPaid: profitPaid ?? 0,
        penaltyPaid: 0,
        date: new Date().toISOString().split('T')[0],
        installmentNo: installmentNo || ''
      };
      await setDoc(doc(db, 'loan_repayments', repaymentId), newRepayment);
      
      const installmentText = installmentNo ? ` (${installmentNo} কিস্তি)` : '';
      const breakdownText = (principalPaid !== undefined && profitPaid !== undefined)
        ? `। আসল আদায়: ${principalPaid} ৳, লাভ আদায়: ${profitPaid} ৳ (মোট আদায়: ${repayAmount} ৳)`
        : ` (মোট আদায়: ${repayAmount} ৳)`;

      const newNotif: AdminNotification = {
        id: `NOTIF-${Date.now()}`,
        title: "ঋণ কিস্তি আদায় হয়েছে",
        message: `${targetLoan.memberName} এর লোন কিস্তি বাবদ টাকা আদায় হয়েছে${installmentText}${breakdownText}।`,
        date: new Date().toISOString().split('T')[0],
        read: false
      };
      await setDoc(doc(db, 'notifications', newNotif.id), newNotif);
    } catch (err) {
      console.error('Error repaying loan:', err);
      handleFirestoreError(err, OperationType.WRITE, `loans/${loanId}`);
    }
  };

  // CRUD Event: Delete loan (Admin only)
  const handleDeleteLoan = async (id: string) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই এন্ট্রি বা পরিবর্তন করতে পারবেন।');
      return;
    }
    const targetLoan = loans.find(l => l.id === id);
    if (!targetLoan) return;

    try {
      await deleteDoc(doc(db, 'loans', id));
      const newTrash: TrashLog = {
        id: `TRASH-${Date.now()}`,
        type: 'loan',
        data: targetLoan,
        deletedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        description: `ঋণ নথি: ${targetLoan.id}, সদস্য: ${targetLoan.memberName}, ঋণের পরিমাণ: ${targetLoan.principalAmount} ৳`
      };
      await setDoc(doc(db, 'trash', newTrash.id), newTrash);
    } catch (err) {
      console.error('Error deleting loan:', err);
      handleFirestoreError(err, OperationType.DELETE, `loans/${id}`);
    }
  };

  // Restore deleted item helper
  const handleRestoreItem = async (trashId: string) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই তথ্য রিস্টোর করতে পারবেন।');
      return;
    }
    const trashLog = trash.find(t => t.id === trashId);
    if (!trashLog) return;

    try {
      if (trashLog.type === 'member') {
        await setDoc(doc(db, 'members', trashLog.data.id), trashLog.data);
      } else if (trashLog.type === 'installment') {
        await setDoc(doc(db, 'installments', trashLog.data.id), trashLog.data);
      } else if (trashLog.type === 'loan') {
        await setDoc(doc(db, 'loans', trashLog.data.id), trashLog.data);
      }
      await deleteDoc(doc(db, 'trash', trashId));
      alert('অভিনন্দন! ডিলিট হওয়া তথ্যটি সফলভাবে সিস্টেমে রিস্টোর হয়েছে।');
    } catch (err) {
      console.error('Error restoring item:', err);
      handleFirestoreError(err, OperationType.WRITE, `trash/${trashId}`);
    }
  };

  const handleClearTrash = async () => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই ট্র্যাশ ক্লিয়ার করতে পারবেন।');
      return;
    }
    try {
      const batch = writeBatch(db);
      trash.forEach(t => {
        batch.delete(doc(db, 'trash', t.id));
      });
      await batch.commit();
    } catch (err) {
      console.error('Error clearing trash:', err);
      handleFirestoreError(err, OperationType.DELETE, 'trash');
    }
  };

  const handleDeleteTrashItemPermanently = async (trashId: string) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই ট্র্যাশ থেকে নির্দিষ্ট তথ্য চিরতরে ডিলিট করতে পারবেন।');
      return;
    }
    try {
      await deleteDoc(doc(db, 'trash', trashId));
    } catch (err) {
      console.error('Error permanently deleting trash item:', err);
      handleFirestoreError(err, OperationType.DELETE, `trash/${trashId}`);
    }
  };

  const handleImportBackup = async (backupData: any) => {
    if (currentRole !== 'admin') {
      alert('দুঃখিত, শুধুমাত্র এডমিনই ব্যাকআপ ইম্পোর্ট করতে পারবেন।');
      return;
    }
    try {
      const batch = writeBatch(db);
      if (backupData.members) {
        backupData.members.forEach((m: Member) => batch.set(doc(db, 'members', m.id), m));
      }
      if (backupData.installments) {
        backupData.installments.forEach((i: Installment) => batch.set(doc(db, 'installments', i.id), i));
      }
      if (backupData.loans) {
        backupData.loans.forEach((l: Loan) => batch.set(doc(db, 'loans', l.id), l));
      }
      if (backupData.trash) {
        backupData.trash.forEach((t: TrashLog) => batch.set(doc(db, 'trash', t.id), t));
      }
      if (backupData.notifications) {
        backupData.notifications.forEach((n: AdminNotification) => batch.set(doc(db, 'notifications', n.id), n));
      }
      await batch.commit();
      alert('ব্যাকআপ সফলভাবে সেন্ট্রাল ক্লাউডে ইম্পোর্ট করা হয়েছে!');
    } catch (err) {
      console.error('Error importing backup:', err);
      handleFirestoreError(err, OperationType.WRITE, 'backup');
    }
  };

  // Get dynamic coloring styling per requirements
  // সদস্য UI হবে লাল, মালিক UI হবে নীল, এডমিন UI হবে সবুজ
  const getThemeClass = () => {
    if (currentRole === 'admin') return {
      accent: 'emerald',
      bgLight: 'bg-emerald-500',
      bgHover: 'hover:bg-emerald-600',
      textAccent: 'text-emerald-700',
      borderAccent: 'border-emerald-250',
      ringAccent: 'ring-emerald-100 font-sans',
      heroGrad: 'from-emerald-700 via-emerald-800 to-emerald-950',
      navActive: 'bg-emerald-800 text-white rounded-xl shadow-inner font-semibold underline decoration-emerald-450 decoration-emerald-400 decoration-2 underline-offset-4',
      badgeColor: 'bg-emerald-100 text-emerald-850',
      shadowColor: 'shadow-emerald-100',
      button: 'bg-emerald-600 hover:bg-emerald-700',
      sidebarBg: 'bg-emerald-700 text-white shadow-xl',
      navInactive: 'text-emerald-100 hover:bg-emerald-600 rounded-xl transition-colors',
      sidebarBorder: 'border-emerald-600',
      sidebarSubText: 'text-emerald-200'
    };
    if (currentRole === 'owner') return {
      accent: 'blue',
      bgLight: 'bg-blue-500',
      bgHover: 'hover:bg-blue-600',
      textAccent: 'text-blue-700',
      borderAccent: 'border-blue-250',
      ringAccent: 'ring-blue-105',
      heroGrad: 'from-blue-700 via-blue-800 to-blue-950',
      navActive: 'bg-blue-800 text-white rounded-xl shadow-inner font-semibold underline decoration-blue-405 decoration-blue-400 decoration-2 underline-offset-4',
      badgeColor: 'bg-blue-100 text-blue-850',
      shadowColor: 'shadow-blue-100',
      button: 'bg-blue-600 hover:bg-blue-700',
      sidebarBg: 'bg-blue-700 text-white shadow-xl',
      navInactive: 'text-blue-100 hover:bg-blue-600 rounded-xl transition-colors',
      sidebarBorder: 'border-blue-600',
      sidebarSubText: 'text-blue-200'
    };
    // Member layout is red
    return {
      accent: 'red',
      bgLight: 'bg-red-500',
      bgHover: 'hover:bg-red-600',
      textAccent: 'text-red-700',
      borderAccent: 'border-red-250',
      ringAccent: 'ring-red-100',
      heroGrad: 'from-red-750 via-red-800 to-rose-950',
      navActive: 'bg-red-800 text-white rounded-xl shadow-inner font-semibold underline decoration-red-405 decoration-red-400 decoration-2 underline-offset-4',
      badgeColor: 'bg-red-100 text-red-850',
      shadowColor: 'shadow-red-100',
      button: 'bg-red-600 hover:bg-red-700',
      sidebarBg: 'bg-red-700 text-white shadow-xl',
      navInactive: 'text-red-100 hover:bg-red-650 hover:bg-red-600 rounded-xl transition-colors',
      sidebarBorder: 'border-red-600',
      sidebarSubText: 'text-red-200'
    };
  };

  const themeTheme = getThemeClass();

  // Loading screen overlay with the custom logo
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 flex flex-col items-center justify-center relative overflow-hidden select-none font-sans p-6 text-white text-white">
        {/* Glow Effects */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center max-w-sm w-full text-center relative z-10 space-y-6">
          {/* Logo container with professional premium dual-ring housing and correct scale */}
          <div className="relative flex items-center justify-center">
            {/* Soft decorative ambient aura */}
            <div className="absolute w-44 h-44 bg-emerald-500/10 rounded-full blur-2xl animate-pulse"></div>
            
            {/* Outer brand ring */}
            <div className="relative w-36 h-36 md:w-40 md:h-40 rounded-full bg-slate-900 border-2 border-emerald-500/40 p-1 flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
              {/* Inner container to hold image perfectly scaled so no square edges ever show */}
              <div className="w-full h-full rounded-full bg-white overflow-hidden p-0.5 flex items-center justify-center shadow-inner">
                <img 
                  src={associationLogo} 
                  alt="ক্ষুদ্র সঞ্চয় সমিতি লোগো" 
                  className="w-full h-full object-cover rounded-full scale-[1.08] transition-transform duration-750 hover:scale-[1.12]" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight font-sans text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-200">
              ক্ষুদ্র সঞ্চয় সমিতি
            </h1>
            <p className="text-xs text-slate-400 font-mono tracking-wider uppercase">
              নিরাপদ ডিজিটাল সঞ্চয় ডাটাবেজ
            </p>
          </div>

          {/* Premium customized Bengali spinner/loader */}
          <div className="flex flex-col items-center space-y-3 mt-4 w-full">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium animate-pulse justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              লোডিং হচ্ছে... দয়া করে অপেক্ষা করুন...
            </div>
            {/* Horizontal progress bar animation */}
            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/10 mx-auto">
              <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 rounded-full animate-loading-progress"></div>
            </div>
          </div>
        </div>

        {/* Footer info inside loading screen */}
        <div className="absolute bottom-6 text-center text-[10px] text-white/30 font-sans">
          <p>গণপ্রজাতন্ত্রী বাংলাদেশ ক্ষুদ্র সঞ্চয় প্রকল্প কর্তৃক অনুমোদিত</p>
          <p className="text-[9px] mt-0.5">ডিজিটাল ও সিকিউর এনক্রিপশন সিস্টেম v1.0</p>
        </div>
      </div>
    );
  }

  // If user is not logged in, show lockscreen selector
  if (!currentRole) {
    return (
      <div className={darkMode ? "dark bg-slate-900" : "bg-slate-50"}>
        <RoleSelector 
          members={members} 
          onLogin={handleLogin} 
          appConfig={appConfig} 
          onRequestPinReset={handleAddPinRequest}
        />
      </div>
    );
  }

  // Dashboard calculation indicators (Requirement 9 / হিসাব Dashboard)
  const totalMemberCount = members.length;
  const activeMemberCount = members.filter(m => m.status === 'active').length;

  // 1. Total savings deposited = regular installments + extra savings (Excluding interest percentages completely!)
  const totalSavingsSum = installments.reduce((sum, item) => sum + item.amount + (item.savingsAmount || 0), 0);

  // 2. Total loan principal disbursed (subtract core principal from money container, not principalAmount which includes interest profit)
  const totalLoansDisbursedPrincipal = loans.reduce((sum, l) => sum + (l.originalPrincipal || (l.principalAmount - (l.profitAmount || 0))), 0);

  // 3. Total principal repaid (recovered principal)
  const totalLoansRecoveredPrincipal = loans.reduce((sum, l) => sum + l.repaidAmount, 0);

  // 4. Total outstanding principal loan due
  const totalLoansDueSum = totalLoansDisbursedPrincipal - totalLoansRecoveredPrincipal;

  // 5. Total Percentage Profits Vault (আলাদা মুনাফা ও লভ্যাংশ তহবিল - completely separate folder!)
  const totalSavingsPercentProfit = installments.reduce((sum, item) => sum + (item.profitAmount || 0), 0);
  const totalLoanPercentProfit = loans.reduce((sum, item) => sum + (item.profitRepaid || 0), 0);
  const totalPercentageProfitSum = totalSavingsPercentProfit + totalLoanPercentProfit;

  const customIncomeSum = ledger ? ledger.filter(l => l.type === 'income').reduce((sum, item) => sum + item.amount, 0) : 0;
  const customExpenseSum = ledger ? ledger.filter(l => l.type === 'expense').reduce((sum, item) => sum + item.amount, 0) : 0;
  const customSurplusSum = ledger ? ledger.filter(l => l.type === 'surplus').reduce((sum, item) => sum + item.amount, 0) : 0;

  // Net Cash Balance does NOT include the separate Percentage profits folder!
  const totalCashBalanceOfCoop = totalSavingsSum + totalLoansRecoveredPrincipal + customIncomeSum + customSurplusSum - totalLoansDisbursedPrincipal - customExpenseSum;

  const todayDateStr = new Date().toISOString().split('T')[0];
  const todaySavingsCollectionsSum = installments
    .filter(i => i.date === todayDateStr)
    .reduce((sum, item) => sum + item.amount + (item.savingsAmount || 0), 0);
  const todayLoanCollectionsSum = loanRepayments
    .filter(r => r.date === todayDateStr)
    .reduce((sum, item) => sum + item.repayAmount, 0);
  const todayCollectionsSum = todaySavingsCollectionsSum + todayLoanCollectionsSum;

  // User-specific member dashboard logic
  const activeMember = members.find(m => m.id === currentMemberId);
  const memberPersonalInstallments = installments.filter(i => i.memberId === currentMemberId);
  const memberPersonalSavingsTotal = memberPersonalInstallments.reduce((sum, item) => sum + item.amount + (item.savingsAmount || 0), 0);
  
  const memberPersonalLoans = loans.filter(l => l.memberId === currentMemberId);
  const memberPersonalLoansTotal = memberPersonalLoans.reduce((sum, item) => sum + (item.originalPrincipal || (item.principalAmount - (item.profitAmount || 0))), 0);
  const memberPersonalRepaidTotal = memberPersonalLoans.reduce((sum, item) => sum + item.repaidAmount, 0);
  const memberPersonalDueTotal = memberPersonalLoansTotal - memberPersonalRepaidTotal;
  const memberPersonalOriginalPrincipal = memberPersonalLoans.reduce((sum, item) => sum + (item.originalPrincipal || Math.round(item.principalAmount / 1.1)), 0);
  const memberPersonalProfitTotal = memberPersonalLoansTotal - memberPersonalOriginalPrincipal;

  // Unread alerts count
  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  const memberPayRatio = memberPersonalLoansTotal > 0 ? Math.min(100, Math.round((memberPersonalRepaidTotal / memberPersonalLoansTotal) * 100)) : 0;
  const memberRemRatio = 100 - memberPayRatio;

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Dynamic top bar header */}
      <header className={`sticky top-0 z-40 w-full px-4 py-3 md:px-8 border-b transition-all flex items-center justify-between shadow-sm ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        {/* Left branding (Click logo/branding to open mobile/desktop side drawer drawer) */}
        <button 
          onClick={() => setIsDrawerOpen(true)}
          title="মেনু ও তথ্য প্যানেল খুুলুন"
          className="flex items-center gap-2.5 text-left focus:outline-none cursor-pointer hover:opacity-90 active:scale-95 transition-all group shrink-0"
        >
          <div className="relative w-11 h-11 rounded-full bg-slate-900 border border-emerald-500/30 overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-md group-hover:border-emerald-400 group-hover:scale-105 transition-all duration-300">
            <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
              <img 
                src={associationLogo} 
                alt="ক্ষুদ্র সঞ্চয় সমিতি" 
                className="w-full h-full object-cover rounded-full scale-[1.08] group-hover:rotate-12 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-1 sm:gap-1.5 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
              <span className="hidden xs:inline">ক্ষুদ্র সঞ্চয় সমিতি</span>
              <span className="xs:hidden">সমিতি</span>
              <span className="text-[9px] sm:text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-sans font-semibold text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-lg flex items-center gap-1">
                <Menu className="h-3 w-3" />
                মেনু
              </span>
            </h1>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 dark:text-slate-500 font-mono tracking-wider flex items-center gap-1">
                <span className="hidden sm:inline">অনলাইন সিঙ্ক সক্রিয় (রিয়েল-টাইম ডায়েরি)</span>
                <span className="sm:hidden">অনলাইন সিঙ্ক সক্রিয়</span>
              </span>
            </div>
          </div>
        </button>

        {/* Right header controls list */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          
          {/* Simulation manual Sync Button */}
          <button
            onClick={triggerManualSync}
            disabled={isSyncing}
            title="ক্লাউড ডাটাবেজ সিঙ্ক"
            className={`p-1.5 sm:p-2 rounded-lg border text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center gap-1 text-[10px] uppercase font-bold tracking-tight ${
              darkMode ? 'bg-slate-850 border-slate-800 hover:bg-slate-800' : 'bg-slate-50 border-slate-150 hover:bg-slate-100'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : 'text-slate-400'}`} />
            {isSyncing ? (
              <span className="hidden sm:inline">সংরক্ষণ হচ্ছে</span>
            ) : (
              <span className="hidden sm:inline">সিঙ্ক</span>
            )}
          </button>

          {/* Sun / Moon Theme toggler */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              darkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Notifications Alerts bell dropdown triggers */}
          <div className="relative">
            <button
              onClick={async () => {
                setShowNotificationPanel(!showNotificationPanel);
                // Mark all read on click
                if (!showNotificationPanel && notifications.some(n => !n.read)) {
                  try {
                    const batch = writeBatch(db);
                    notifications.forEach(n => {
                      if (!n.read) {
                        batch.set(doc(db, 'notifications', n.id), { ...n, read: true });
                      }
                    });
                    await batch.commit();
                  } catch (err) {
                    console.error('Error marking notifications read:', err);
                    handleFirestoreError(err, OperationType.WRITE, 'notifications/read');
                  }
                }
              }}
              className={`p-2 rounded-xl border relative transition-all cursor-pointer ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Bell className="h-4 w-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full text-[8px] font-bold h-4 w-4 flex items-center justify-center animate-bounce">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* Notification Sliding Dropdown */}
            {showNotificationPanel && (
              <div className={`absolute right-0 mt-2 w-80 rounded-2xl shadow-xl border overflow-hidden p-3 space-y-2 z-50 text-xs text-left animate-in fade-in-50 slide-in-from-top-3 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100 mb-2">
                  <strong className="text-slate-800 dark:text-white">কার্যক্রমের এলার্ট ও নোটিশসমূহ</strong>
                  <button onClick={() => setShowNotificationPanel(false)} className="text-slate-400">বন্ধ</button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2.5">
                  {notifications.slice(0, 10).map((n) => (
                    <div key={n.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-start font-semibold text-slate-800 dark:text-slate-200">
                        <span>{n.title}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{n.date}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-350 mt-1 leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <p className="text-center p-4 text-slate-400">কোনো নতুন এলার্ট নেই।</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Secure lock exit logged in session */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 border border-rose-100 rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">লগআউট</span>
          </button>
        </div>
      </header>

    {/* Main app Grid Body */}
    <div className="flex-1 flex flex-col md:flex-row">
      
      {/* SIDE BAR NAVIGATION SECTION (Hidden on mobile) */}
      <aside className={`hidden md:block w-64 shrink-0 p-4 space-y-1.5 transition-all md:min-h-[calc(100vh-64px)] ${themeTheme.sidebarBg}`}>
        
        {/* User profile Identity Badge */}
        <div className="p-4 rounded-2xl mb-4 border border-white/20 bg-white/10 shadow-lg backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-full bg-slate-900 border border-white/20 overflow-hidden select-none shrink-0 p-0.5 flex items-center justify-center shadow-lg transition-transform hover:rotate-3 duration-300">
              <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                <img 
                  src={associationLogo} 
                  alt="ক্ষুদ্র সঞ্চয় সমিতি" 
                  className="w-full h-full object-cover rounded-full scale-[1.08]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div className="text-left font-sans text-xs overflow-hidden">
              {currentRole === 'admin' && (
                <>
                  <strong className="block text-white text-sm font-bold truncate">{ADMIN_PROFILE.name}</strong>
                  <span className="text-emerald-100 font-semibold">{themeTheme.sidebarSubText || 'পরিচালক ও এডমিন'}</span>
                </>
              )}
              {currentRole === 'owner' && (
                <>
                  <strong className="block text-white text-sm font-bold truncate">সম্মানিত অংশীদার</strong>
                  <span className="text-blue-100 font-semibold">{themeTheme.sidebarSubText || 'অংশীদার ও মালিক'}</span>
                </>
              )}
              {currentRole === 'member' && activeMember && (
                <>
                  <strong className="block text-white text-xs font-bold truncate">{activeMember.name}</strong>
                  <span className="text-red-100 font-semibold font-mono text-[10px] block truncate">ID: {activeMember.id}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <h3 className="px-3 text-[10px] font-bold text-white/50 uppercase tracking-widest text-left mb-2.5">মেনু বিভাগ</h3>

        {/* Switch tabs menu */}
        <div className="space-y-1.5">
          <button
            onClick={() => changeTab('dashboard')}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-left flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'dashboard' ? themeTheme.navActive : `${themeTheme.navInactive} text-white/80 hover:bg-white/10 hover:text-white`
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            হিসাব ড্যাশবোর্ড
          </button>

          {currentRole !== 'member' && (
            <button
              onClick={() => changeTab('members')}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-left flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === 'members' ? themeTheme.navActive : `${themeTheme.navInactive} text-white/80 hover:bg-white/10 hover:text-white`
              }`}
            >
              <User className="h-4 w-4 shrink-0" />
              সদস্য ব্যবস্থাপনা
            </button>
          )}

          <button
            onClick={() => changeTab('installments')}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-left flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'installments' ? themeTheme.navActive : `${themeTheme.navInactive} text-white/80 hover:bg-white/10 hover:text-white`
            }`}
          >
            <Wallet className="h-4 w-4 shrink-0" />
            {currentRole === 'member' ? 'নিজের সঞ্চয় স্লিপ' : 'সঞ্চয় ও কিস্তি আদায়'}
          </button>

          <button
            onClick={() => changeTab('loans')}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-left flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'loans' ? themeTheme.navActive : `${themeTheme.navInactive} text-white/80 hover:bg-white/10 hover:text-white`
            }`}
          >
            <HandCoins className="h-4 w-4 shrink-0" />
            {currentRole === 'member' ? 'নিজের লোন ও ফেরত' : 'ঋণ খাতা ও বিতরণ'}
          </button>

          {currentRole !== 'member' && (
            <button
              onClick={() => changeTab('reports')}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-left flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === 'reports' ? themeTheme.navActive : `${themeTheme.navInactive} text-white/80 hover:bg-white/10 hover:text-white`
              }`}
            >
              <FileBarChart className="h-4 w-4 shrink-0" />
              রিপোর্ট ও লাভ ক্ষতি
            </button>
          )}

          {currentRole === 'admin' && (
            <button
              onClick={() => changeTab('diary')}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-left flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === 'diary' ? themeTheme.navActive : `${themeTheme.navInactive} text-white/80 hover:bg-white/10 hover:text-white`
              }`}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              কেশের আলমারি ও খরচ ডায়েরি
            </button>
          )}

          {currentRole === 'admin' && (
            <button
              onClick={() => changeTab('security')}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-left flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === 'security' ? themeTheme.navActive : `${themeTheme.navInactive} text-white/80 hover:bg-white/10 hover:text-white`
              }`}
            >
              <Shield className="h-4 w-4 shrink-0" />
              ডাটা নিরাপত্তা ও রিস্টোর
            </button>
          )}
        </div>
      </aside>

      {/* WORKSPACE DETAILED WRAPPER SCREEN */}
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 space-y-6 overflow-y-auto">
        
        {/* TAB 1: DYNAMIC ROLES WORKSPACE INTERACTIVE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Top Hero Card branding block with role contextual gradient */}
            <div className={`p-6 md:p-8 text-white rounded-3xl text-left bg-gradient-to-br shadow-md ${themeTheme.heroGrad} ${themeTheme.shadowColor} flex flex-col md:flex-row justify-between items-start md:items-center gap-6`}>
              <div className="space-y-2 max-w-lg">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold backdrop-blur-md">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {currentRole === 'admin' && `এডমিন মোড সক্রিয় — ${ADMIN_PROFILE.name}`}
                  {currentRole === 'owner' && 'পর্যবেক্ষণ মোড সক্রিয় — সম্মানিত শেয়ার হোল্ডার'}
                  {currentRole === 'member' && activeMember && `সদস্য ডায়েরি সক্রিয় — ${activeMember.name}`}
                </div>
                <h2 className="text-xl md:text-2xl font-bold font-sans">
                  {currentRole === 'member' && activeMember ? `স্বাগতম, ${activeMember.name}` : currentRole === 'owner' ? `শুভ কামনা, পরিচালনায় সম্মানিত শেয়ার হোল্ডার` : `শুভ কামনা, পরিচালনায় ${ADMIN_PROFILE.name}`}
                </h2>
                <p className="text-[11px] md:text-xs text-white/80 leading-relaxed font-sans">
                  যাত্রা শুরু হোক আকাশ ছোয়ার স্বপ্ন নিয়ে
                </p>
              </div>

              {/* Director details */}
              <div className="text-left md:text-right text-xs shrink-0 self-end md:self-auto border-t md:border-t-0 p-3 md:p-0 border-white/10 w-full md:w-auto">
                <span className="text-[10px] text-white/50 block font-mono">
                  {currentRole === 'admin' ? 'অফিস ব্যবস্থাপক:' : currentRole === 'owner' ? 'সম্মানিত অংশীদার:' : 'সমিতি সদস্য:'}
                </span>
                <strong className="text-sm font-sans block">
                  {currentRole === 'admin' ? ADMIN_PROFILE.name : currentRole === 'owner' ? 'সম্মানিত শেয়ার হোল্ডার' : activeMember?.name || 'পরিচিতিহীন'}
                </strong>
                <span className="text-[10px] text-emerald-250 italic bg-white/10 px-1.5 py-0.5 rounded mt-1 inline-block">চলমান অর্থবছর ২০২৬</span>
              </div>
            </div>

            {/* Personal Overdue Warning for Logger Member Role */}
              {currentRole === 'member' && activeMember && (() => {
                const check = getMemberOverdueStatus(activeMember);
                if (!check.isOverdue) return null;
                return (
                  <div className="bg-rose-50 dark:bg-rose-950/25 border-2 border-rose-300 dark:border-rose-900 rounded-3xl p-5 text-left space-y-2 shadow-md animate-pulse">
                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
                      <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                      <span>⚠️ বকেয়া সঞ্চয় কিস্তি সতর্কতা (Overdue Payment Notice)</span>
                    </div>
                    <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-sans">
                      সম্মানিত গ্রাহক <strong>{activeMember.name}</strong>, আপনার সঞ্চয় কিস্তি প্রদানের নির্ধারিত সময় অতিক্রম হয়েছে। আপনি সর্বশেষ <strong>{check.lastPaidDate}</strong> তারিখে (<strong>{toBengaliDigits(check.days)} দিন পূর্বে</strong>) সঞ্চয় জমা দিয়েছেন। দয়া করে আপনার নিয়মিত সঞ্চয় কিস্তির নির্ধারিত পরিমাণ <strong>{toBengaliDigits(activeMember.targetInstallmentAmount)} ৳</strong> দ্রুত পরিশোধ করুন।
                    </p>
                  </div>
                );
              })()}

              {/* DASHBOARD SUMMARY INDICATORS WORKSPACE (For Admin & Owner) */}
              {currentRole !== 'member' ? (
                <div className="grid grid-cols-2 lg:grid-cols-8 gap-3 sm:gap-4">
                  <div className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-1 shadowing-sm border-b-4 border-b-emerald-500`}>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">মোট সদস্য</span>
                    <strong className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{totalMemberCount} জন</strong>
                    <div className="text-[9.5px] text-slate-400 flex items-center gap-1 font-sans">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      {activeMemberCount} সক্রিয়
                    </div>
                  </div>

                  <div className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-1 shadowing-sm border-b-4 border-b-blue-500`}>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">মোট সঞ্চয়</span>
                    <strong className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">{totalSavingsSum} ৳</strong>
                    <div className="text-[9.5px] text-slate-400 font-sans">সমিতির আমানত</div>
                  </div>

                  <div className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-1 shadowing-sm border-b-4 border-b-red-500`}>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">মোট ঋণ</span>
                    <strong className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">{totalLoansDisbursedPrincipal} ৳</strong>
                    <div className="text-[9.5px] text-slate-400 font-sans">বিতরিত আসল ঋণ</div>
                  </div>

                  <div className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-1 shadowing-sm border-b-4 border-b-teal-500`}>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">কিস্তি আদায় (আসল)</span>
                    <strong className="text-xl font-black text-teal-600 dark:text-teal-400 font-mono tracking-tight">{totalLoansRecoveredPrincipal} ৳</strong>
                    <div className="text-[9.5px] text-slate-400 font-sans">পুনরুদ্ধারকৃত আসল</div>
                  </div>

                  <div className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-1 shadowing-sm border-b-4 border-b-amber-500`}>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">বকেয়া ঋণ (আসল)</span>
                    <strong className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">{totalLoansDueSum} ৳</strong>
                    <div className="text-[9.5px] text-slate-400 font-sans">খেলাпи আসল আমানত</div>
                  </div>

                  <div className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-100 dark:border-rose-950 text-left space-y-1 shadowing-sm border-b-4 border-b-rose-500 bg-rose-50/10`}>
                    <span className="text-[10px] font-bold text-rose-500 block uppercase tracking-wider">আজ কালেকশন</span>
                    <strong className="text-xl font-black text-rose-600 font-mono tracking-tight">+{todayCollectionsSum} ৳</strong>
                    <div className="text-[9.5px] text-slate-400 font-mono">{todayDateStr}</div>
                  </div>

                  {/* Separate Percentage Profit Folder Card */}
                  <div className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-1 shadowing-sm border-b-4 border-b-purple-500 bg-purple-50/5`}>
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 block uppercase tracking-wider">মুনাফা আদায় (লাভ)</span>
                    <strong className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono tracking-tight">{totalPercentageProfitSum} ৳</strong>
                    <div className="text-[9.5px] text-slate-400 font-sans">মুনাফার আলাদা ফোল্ডার</div>
                  </div>

                  {/* Gorgeous Premium Cash In Hand Widget Card - Resolves Requirement */}
                  {currentRole === 'admin' ? (
                    <button
                      onClick={() => changeTab('diary')}
                      title="কেশের আলমারী ও খরচ ডায়েরি খতিয়ান দেখুন"
                      className={`bg-slate-950 text-slate-100 p-4 rounded-2xl border border-slate-800 text-left space-y-1 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-300 border-b-4 cursor-pointer group ${totalCashBalanceOfCoop >= 0 ? 'border-b-emerald-400' : 'border-b-rose-400'}`}
                    >
                      <span className="text-[10px] font-bold text-slate-350 block uppercase tracking-wider flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                        কেশে অবশিষ্ট
                      </span>
                      <strong className={`text-xl font-black font-mono tracking-tight transition-colors group-hover:text-emerald-400 ${totalCashBalanceOfCoop >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {totalCashBalanceOfCoop} ৳
                      </strong>
                      <div className="text-[9.5px] text-slate-350/90 font-sans leading-none flex items-center justify-between w-full">
                        <span>নিট ক্যাশ তহবিল</span>
                        <span className="text-[8px] text-emerald-400 group-hover:underline">ডায়েরি ➔</span>
                      </div>
                    </button>
                  ) : (
                    <div
                      title="কেশের অবশিষ্ট তহবিল"
                      className={`bg-slate-950 text-slate-100 p-4 rounded-2xl border border-slate-800 text-left space-y-1 shadow-md border-b-4 ${totalCashBalanceOfCoop >= 0 ? 'border-b-emerald-400' : 'border-b-rose-400'}`}
                    >
                      <span className="text-[10px] font-bold text-slate-350 block uppercase tracking-wider flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                        কেশে অবশিষ্ট
                      </span>
                      <strong className={`text-xl font-black font-mono tracking-tight ${totalCashBalanceOfCoop >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {totalCashBalanceOfCoop} ৳
                      </strong>
                      <div className="text-[9.5px] text-slate-350/90 font-sans leading-none flex items-center justify-between w-full">
                        <span>নিট ক্যাশ তহবিল</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* MEMBER DEDICATED PERSONAL DASHBOARD (For member Role - RED UI) */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
                  
                  {/* Item 1: Personal profile stats */}
                  {activeMember && (
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 relative space-y-2.5 shadow-md border-b-4 border-b-red-500 hover:shadow-lg transition-all">
                      <span className="text-[10px] font-bold text-red-650 uppercase tracking-widest block font-sans">সদস্য প্রোফাইল</span>
                      <div className="space-y-1">
                        <strong className="text-sm font-sans font-bold text-slate-800 dark:text-white block">{activeMember.name}</strong>
                        <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3 text-slate-400" /> {activeMember.phone}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 max-w-xs truncate font-sans">
                          <MapPin className="h-3 w-3 text-slate-400" /> {activeMember.address}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 border-t border-slate-100/60 dark:border-slate-800/60 pt-1.5 flex justify-between items-center">
                        <span>আইডি: <strong>{activeMember.id}</strong></span>
                        <span>যোগদান: {activeMember.joinDate}</span>
                      </div>
                    </div>
                  )}

                  {/* Item 2: Personal target savings */}
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 shadow-md border-b-4 border-b-emerald-500 hover:shadow-lg transition-all text-left">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">আপনার মোট সঞ্চয় আমানত</span>
                    <div className="flex items-baseline justify-between">
                      <strong className="text-2xl font-black text-emerald-600 font-mono">{memberPersonalSavingsTotal} ৳</strong>
                      <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">সক্রিয় সঞ্চয়কারী</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-sans border-t border-slate-100/60 dark:border-slate-800/60 pt-1.5 leading-relaxed">
                      কিস্তির ধরণ: <strong className="text-slate-850 dark:text-white">{activeMember?.type === 'daily' ? 'দৈনিক' : activeMember?.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'}</strong><br />
                      নির্ধারিত সঞ্চয় টার্গেট কিস্তি: <strong className="text-emerald-600 font-mono">{activeMember?.targetInstallmentAmount} ৳</strong>
                    </div>
                  </div>

                  {/* Item 3: Personal loans progress counter with interest breakdown */}
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 shadow-md border-b-4 border-b-blue-500 hover:shadow-lg transition-all text-left">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">গৃহীত মোট লোন ও লাভ</span>
                    <div className="flex items-baseline justify-between">
                      <strong className="text-2xl font-black text-blue-600 font-mono">{memberPersonalLoansTotal} ৳</strong>
                      <span className="text-[10px] font-mono font-bold text-slate-400">লোন সংখ্যা: {memberPersonalLoans.length}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-sans border-t border-slate-100/60 dark:border-slate-800/60 pt-1.5 leading-relaxed space-y-0.5">
                      <div>আসল ঋণ মঞ্জুর: <strong className="text-slate-700 dark:text-slate-300 font-mono">{memberPersonalOriginalPrincipal} ৳</strong></div>
                      <div>সমিতি সার্ভিস লাভ/মুনাফা: <strong className="text-teal-600 font-mono">+{memberPersonalProfitTotal} ৳</strong></div>
                    </div>
                  </div>

                  {/* Item 4: Personal loans due balance & repaid progress */}
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-100 dark:border-slate-850 text-left space-y-2 bg-amber-50/10 shadow-md border-b-4 border-b-amber-500 hover:shadow-lg transition-all">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">অবশিষ্ট ঋণের দায়বদ্ধতা/বকেয়া</span>
                    <div className="flex items-baseline justify-between border-b border-slate-100/60 dark:border-slate-800/60 pb-1.5">
                      <strong className="text-2xl font-black text-rose-600 font-mono">{memberPersonalDueTotal} ৳</strong>
                      <span className="text-[10px] font-bold text-slate-400">পরিশোধিত: {memberPersonalRepaidTotal} ৳</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-sans leading-relaxed space-y-2">
                      {memberPersonalDueTotal > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          ⚠️ আপনার বকেয়া লোন ঋণ কিস্তিতে পরিশোধ করুন। বিস্তারিত দেখতে নিচের <strong>"নিজের লোন"</strong> বাটনে ক্লিক করুন।
                        </span>
                      ) : (
                        <span className="text-emerald-605 font-medium">
                          🎉 আপনার কোনো সক্রিয় বকেয়া ঋণ নেই। আপনি লোন পরিশোধ সম্পন্ন করেছেন!
                        </span>
                      )}

                      {/* Visual Progress slider bar (Requirement 14) */}
                      {memberPersonalLoansTotal > 0 && (
                        <div className="space-y-1.5 pt-1.5 border-t border-slate-100/65">
                          <div className="flex justify-between items-center text-[10px] font-sans font-bold">
                            <span className="text-emerald-600">পরিশোধিত: {memberPayRatio}%</span>
                            <span className="text-rose-500">বাকি: {memberRemRatio}%</span>
                          </div>
                          <div className="w-full bg-slate-150 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${memberPayRatio}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Folder Shortcuts designed as real file folders */}
              {currentRole === 'admin' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Folder 1: Monthly Expenses */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-rose-500/10 transition-colors"></div>
                    <div className="space-y-1.5 relative z-10 max-w-sm sm:max-w-md">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-full text-[10px] font-bold">
                        <BookOpen className="h-3.5 w-3.5" />
                        মাসিক খরচ লেখার ফোল্ডার (১২টি খাত)
                      </div>
                      <h4 className="text-sm font-bold text-slate-850 dark:text-slate-100">১২টি খাতের মাসিক অফিস পরিচালন খরচ ডায়েরি</h4>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed font-sans">
                        খাতা-কলম, চা-নাস্তা বিল, বিদ্যুৎ ও ইন্টারনেট বিল সহ সমিতির দৈনন্দিন ১২টি নির্দিষ্ট খাতের মাসিক খরচের খতিয়ান ডিজিটাল খাতা বা শিটে লিখুন ও সংরক্ষণ করুন।
                      </p>
                    </div>
                    <button
                      onClick={() => changeTab('diary')}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-rose-100 dark:shadow-none hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                    >
                      খরচ লিখুন ও দেখুন ➔
                    </button>
                  </div>

                  {/* Folder 2: Cash Vault Deposited */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-colors"></div>
                    <div className="space-y-1.5 relative z-10 max-w-sm sm:max-w-md">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-full text-[10px] font-bold">
                        <Wallet className="h-3.5 w-3.5" />
                        কেশে কত টাকা রাখলাম ডায়েরি ফোল্ডার
                      </div>
                      <h4 className="text-sm font-bold text-slate-850 dark:text-slate-100">কেশের আলমারি ও ড্রয়ার ক্যাশ খাতা</h4>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed font-sans">
                        সমিতির ক্যাশ বাক্স, প্রধান আলমারি বা ট্রাস্ট লকারে কত টাকা নিরাপদ ক্যাশ রাখা হলো তার পৃথক ডিজিটাল ডায়েরি রেকর্ড। দিনভিত্তিক ড্রয়ার ক্যাশ ট্র্যাকিং।
                      </p>
                    </div>
                    <button
                      onClick={() => changeTab('diary')}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-blue-100 dark:shadow-none hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                    >
                      কেশে টাকা খাতা ➔
                    </button>
                  </div>
                </div>
              )}

              {/* RECENT ACTIVITY LIST / SAVINGS LEDGER (Dashboard body widgets) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Large main card: Collections Log Tracker */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-4 md:p-6 text-left shadow-sm">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-100 flex items-center gap-1.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <Clock className="h-4 w-4 text-emerald-500" />
                    সদ্য সংগৃহীত কিস্তির খতিয়ান বিবরণী
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                      <thead>
                        <tr className="text-slate-400 py-2.5 border-b font-medium">
                          <th className="py-2.5">রশিদ ক্রমি</th>
                          <th className="py-2.5">সদস্যের নাম</th>
                          <th className="py-2.5">পেমেন্ট তারিখ</th>
                          <th className="py-2.5 text-right">আদায় পরিমাণ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(currentRole === 'member' ? memberPersonalInstallments : installments).slice(0, 6).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50">
                            <td className="py-3 font-mono font-bold text-slate-900 dark:text-white">{item.id}</td>
                            <td className="py-3">
                              <span className="font-semibold block">{item.memberName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {item.memberId}</span>
                            </td>
                            <td className="py-3 font-mono">{item.date}</td>
                            <td className="py-3 text-right font-semibold font-mono text-emerald-600">+{item.amount} ৳</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Side interactive card: Bulletins/System Notification alerts (Requirement 10) */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-4 md:p-6 text-left shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-100 flex items-center gap-1.5 border-b border-zinc-100 dark:border-slate-800 pb-3">
                    <ShieldAlert className="h-4 w-4 text-amber-500 animate-pulse" />
                    সমিতি নোটিশ প্যানেল
                  </h3>

                  <div className="space-y-3">
                    {/* General/Emergency alert notice shown to all, if exists */}
                    {appConfig.noticeText && (
                      <div className={`p-3.5 border-l-4 rounded-xl text-xs leading-relaxed whitespace-pre-wrap font-sans font-semibold ${
                        darkMode ? 'bg-rose-950/30 border-rose-500 text-rose-200' : 'bg-rose-50 border-rose-600 text-rose-900'
                      }`}>
                        <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5 text-rose-500">জরুরি অ্যালارت নোটিশ:</div>
                        {appConfig.noticeText}
                      </div>
                    )}

                    {/* Member-specific notice */}
                    {currentRole === 'member' && (
                      appConfig.memberNoticeText ? (
                        <div className={`p-3.5 border-l-4 rounded-xl text-xs leading-relaxed whitespace-pre-wrap font-sans font-medium ${
                          darkMode ? 'bg-emerald-950/30 border-emerald-500 text-emerald-250' : 'bg-emerald-50 border-emerald-600 text-emerald-900'
                        }`}>
                          <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5 text-emerald-600">সদস্য নোটিশ (Notice for Members):</div>
                          {appConfig.memberNoticeText}
                        </div>
                      ) : (
                        <div className={`p-3.5 border-l-4 rounded-xl text-[11px] leading-relaxed ${
                          darkMode ? 'bg-slate-800 border-rose-500 text-slate-200' : 'bg-slate-50 border-rose-600 text-slate-600'
                        }`}>
                          <strong className={`block mb-1 font-sans font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>সদস্য লেনদেন সতর্কতা</strong>
                          নির্ধারিত সময়ের মধ্যে কিস্তির টাকা ক্যাশে বা সঞ্চয় অ্যাকাউন্টে জমা দিন। সঞ্চয় বৃদ্ধি করুন, নিরাপদ ভবিষ্যৎ গড়ুন।
                        </div>
                      )
                    )}

                    {/* Shareholder-specific notice */}
                    {currentRole === 'owner' && (
                      appConfig.shareholderNoticeText ? (
                        <div className={`p-3.5 border-l-4 rounded-xl text-xs leading-relaxed whitespace-pre-wrap font-sans font-medium ${
                          darkMode ? 'bg-blue-950/30 border-blue-500 text-blue-250' : 'bg-blue-50 border-blue-600 text-blue-900'
                        }`}>
                          <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5 text-blue-600">অংশীদার নোটিশ (Notice for Shareholders):</div>
                          {appConfig.shareholderNoticeText}
                        </div>
                      ) : (
                        <div className={`p-3.5 border-l-4 rounded-xl text-[11px] leading-relaxed ${
                          darkMode ? 'bg-slate-800 border-zinc-500 text-slate-200' : 'bg-slate-50 border-zinc-650 text-slate-600'
                        }`}>
                          <strong className={`block mb-1 font-sans font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>অংশীদার কল্যাণ বার্তা</strong>
                          সম্মানিত শেয়ার হোল্ডার ও অংশীদারদের হিসাব নিয়মিত নীরিক্ষা করার জন্য ড্যাশবোর্ড রিপোর্ট চেক করার পরামর্শ দেওয়া হলো।
                        </div>
                      )
                    )}

                    {/* Admin sees a summary of both notices so they can visualize */}
                    {currentRole === 'admin' && (
                      <div className="space-y-3">
                        <div className={`p-3.5 border border-slate-100 dark:border-slate-800 rounded-xl text-xs leading-relaxed ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                          <div className="font-bold text-[10px] text-emerald-600 mb-1">📢 সদস্যদের নোটিশ (সদস্যরা দেখছে):</div>
                          <div className="text-slate-650 dark:text-slate-350 italic whitespace-pre-wrap">{appConfig.memberNoticeText || '(কোনো কাস্টম নোটিশ লেখা হয়নি)'}</div>
                        </div>
                        <div className={`p-3.5 border border-slate-100 dark:border-slate-800 rounded-xl text-xs leading-relaxed ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                          <div className="font-bold text-[10px] text-blue-600 mb-1">📢 শেয়ার হোল্ডারদের নোটিশ (শেয়ার হোল্ডার দেখছে):</div>
                          <div className="text-slate-650 dark:text-slate-350 italic whitespace-pre-wrap">{appConfig.shareholderNoticeText || '(কোনো কাস্টম নোটিশ লেখা হয়নি)'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: MEMBERS MANAGEMENT */}
          {activeTab === 'members' && currentRole !== 'member' && (
            <MemberManagement
              members={members}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              role={currentRole}
              pinRequests={pinRequests}
              onResolvePinRequest={handleResolvePinRequest}
            />
          )}

          {/* TAB 3: INSTALLMENTS / SAVINGS DEPOSITS */}
          {activeTab === 'installments' && (
            <Installments
              members={members}
              installments={currentRole === 'member' ? memberPersonalInstallments : installments}
              onAddInstallment={handleAddInstallment}
              onDeleteInstallment={handleDeleteInstallment}
              role={currentRole}
            />
          )}

          {/* TAB 4: LOAN LEDGER DISBURSEMENTS */}
          {activeTab === 'loans' && (
            <Loans
              members={members}
              loans={loans}
              onAddLoan={handleAddLoan}
              onRepayLoan={handleRepayLoan}
              onDeleteLoan={handleDeleteLoan}
              role={currentRole}
              currentMemberId={currentMemberId}
            />
          )}

          {/* TAB 5: FINANCIAL DATA REPORTS */}
          {activeTab === 'reports' && currentRole !== 'member' && (
            <Reports
              members={members}
              installments={installments}
              loans={loans}
              role={currentRole}
              ledger={ledger}
              loanRepayments={loanRepayments}
              onAddLedger={handleAddLedgerEntry}
              onDeleteLedger={handleDeleteLedgerEntry}
            />
          )}

          {/* TAB 7: CASH & OPERATIONAL EXPENSES DIARY */}
          {activeTab === 'diary' && currentRole === 'admin' && (
            <CashExpenseDiary
              role={currentRole}
              monthlyExpenses={monthlyExpenses}
              cashVaultLogs={cashVaultLogs}
              onAddMonthlyExpense={handleAddMonthlyExpense}
              onDeleteMonthlyExpense={handleDeleteMonthlyExpense}
              onAddCashVaultLog={handleAddCashVaultLog}
              onDeleteCashVaultLog={handleDeleteCashVaultLog}
            />
          )}

          {/* TAB 6: SECURITY & TRASH DELETED ITEMS */}
          {activeTab === 'security' && currentRole === 'admin' && (
            <TrashRestore
              trash={trash}
              onRestore={handleRestoreItem}
              onClearTrash={handleClearTrash}
              onDeleteTrashPermanently={handleDeleteTrashItemPermanently}
              onImportBackup={handleImportBackup}
              fullState={{ members, installments, loans, trash, notifications }}
              appConfig={appConfig}
              onUpdateAppConfig={handleUpdateAppConfig}
              overdueMembersList={overdueMembersList}
            />
          )}

        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (নিচে সব এক সাথে শো হওয়ার সুবিধা) */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t ${
        darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
      } shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-safe`}>
        <div className={`grid ${
          currentRole === 'admin' ? 'grid-cols-7' : currentRole === 'owner' ? 'grid-cols-6' : 'grid-cols-3'
        } h-16`}>
          
          {/* TAB 1: Dashboard */}
          <button
            onClick={() => changeTab('dashboard')}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'dashboard'
                ? (currentRole === 'admin' ? 'text-emerald-500' : currentRole === 'owner' ? 'text-blue-500' : 'text-red-500')
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[9px] font-bold font-sans">ড্যাশবোর্ড</span>
          </button>

          {/* TAB 2: Members (Hidden from simple members) */}
          {currentRole !== 'member' && (
            <button
              onClick={() => changeTab('members')}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                activeTab === 'members'
                  ? (currentRole === 'admin' ? 'text-emerald-500' : 'text-blue-500')
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <User className="h-5 w-5" />
              <span className="text-[9px] font-bold font-sans">সদস্য</span>
            </button>
          )}

          {/* TAB 3: Installments */}
          <button
            onClick={() => changeTab('installments')}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'installments'
                ? (currentRole === 'admin' ? 'text-emerald-500' : currentRole === 'owner' ? 'text-blue-500' : 'text-red-500')
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Wallet className="h-5 w-5" />
            <span className="text-[9px] font-bold font-sans">
              {currentRole === 'member' ? 'নিজের সঞ্চয়' : 'সঞ্চয় খাতা'}
            </span>
          </button>

          {/* TAB 4: Loans */}
          <button
            onClick={() => changeTab('loans')}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'loans'
                ? (currentRole === 'admin' ? 'text-emerald-500' : currentRole === 'owner' ? 'text-blue-500' : 'text-red-500')
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <HandCoins className="h-5 w-5" />
            <span className="text-[9px] font-bold font-sans">
              {currentRole === 'member' ? 'নিজের লোন' : 'ঋণ খাতা'}
            </span>
          </button>

          {/* TAB 5: Reports (Admin & Owner) */}
          {currentRole !== 'member' && (
            <button
              onClick={() => changeTab('reports')}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                activeTab === 'reports'
                  ? (currentRole === 'admin' ? 'text-emerald-500' : 'text-blue-500')
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileBarChart className="h-5 w-5" />
              <span className="text-[9px] font-bold font-sans">রিপোর্ট</span>
            </button>
          )}

          {/* TAB 7: Cash & Expense Diary (Admin Only) */}
          {currentRole === 'admin' && (
            <button
              onClick={() => changeTab('diary')}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                activeTab === 'diary'
                  ? 'text-emerald-500'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <BookOpen className="h-5 w-5" />
              <span className="text-[9px] font-bold font-sans">খরচ ডায়েরী</span>
            </button>
          )}

          {/* TAB 6: Security (Admin) */}
          {currentRole === 'admin' && (
            <button
              onClick={() => changeTab('security')}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                activeTab === 'security'
                  ? 'text-emerald-500'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Shield className="h-5 w-5" />
              <span className="text-[9px] font-bold font-sans">রিস্টোর</span>
            </button>
          )}

        </div>
      </div>

      {/* ==================== LINEAR SIDE DRAWER DETAILS PANEL ==================== */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex animate-in fade-in duration-300">
          {/* Backside Dark Overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Side Drawer Body */}
          <div className={`relative w-80 max-w-[85vw] h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-300 ${
            darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
          }`}>
            
            {/* Drawer Header info */}
            <div className={`p-4 border-b flex items-center justify-between ${
              darkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-9 h-9 rounded-full bg-slate-900 border border-emerald-500/20 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                  <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                    <img src={associationLogo} alt="ক্ষুদ্র সঞ্চয় সমিতি" className="w-full h-full object-cover rounded-full scale-[1.08]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-black font-sans leading-tight">ক্ষুদ্র সঞ্চয় সমিতি</h3>
                  <span className="text-[9.5px] text-emerald-500 font-mono tracking-wider">রিয়েল-টাইম সিস্টেম</span>
                </div>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className={`p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable listing content drawer */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-left">
              
              {/* Active Profile ID Details */}
              <div className={`p-4 rounded-2xl border ${
                darkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50 border-slate-100'
              }`}>
                <span className="text-[9.5px] uppercase font-bold tracking-widest text-slate-400 block mb-1">অ্যাক্সেস লেভেল</span>
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-full bg-emerald-500/10 text-emerald-500">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-none">
                      {currentRole === 'admin' ? `প্রধান এডমিন (${ADMIN_PROFILE.name})` : currentRole === 'owner' ? 'সম্মানিত শেয়ার হোল্ডার' : activeMember ? activeMember.name : 'সমিতি সদস্য কার্ড'}
                    </h4>
                    <span className="text-[9px] text-slate-400 mt-1 block">অনলাইন অ্যাকাউন্ট সক্রিয়</span>
                  </div>
                </div>
              </div>

              {/* APP IMPORTANT SETTINGS (ONLY SETTINGS AND FORGOT PASSWORD AS PER USER INTENT) */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-900 dark:text-emerald-400 block px-3 mb-1">এপের গুরুত্বপূর্ণ সেটিংস ও পিন</span>
                
                {/* 1. Theme control setting */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-left flex items-center justify-between cursor-pointer transition-all bg-emerald-500/10 dark:bg-emerald-950/30 text-slate-900 dark:text-emerald-300 hover:bg-emerald-500/25 dark:hover:bg-emerald-950/55"
                >
                  <div className="flex items-center gap-2.5">
                    {darkMode ? <Sun className="h-4 w-5 text-amber-500" /> : <Moon className="h-4 w-5 text-emerald-600" />}
                    <span>১. ইন্টারফেস থিম: {darkMode ? 'লাইট মোড করুন' : 'ডার্ক মোড করুন'}</span>
                  </div>
                  <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 rounded">সুইচ</span>
                </button>

                {/* 2. Forgot Password direct command */}
                <button
                  onClick={() => { 
                    setIsDrawerOpen(false); 
                    setDrawerResetError('');
                    setDrawerResetSuccess(false);
                    setIsDrawerResetOpen(true); 
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-left flex items-center justify-between cursor-pointer transition-all bg-rose-500/10 dark:bg-rose-950/30 text-rose-900 dark:text-rose-300 hover:bg-rose-500/25 dark:hover:bg-rose-950/55"
                >
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="h-4 w-5 text-rose-500" />
                    <span>২. ফরগেট পাসওয়ার্ড / পিন উদ্ধার</span>
                  </div>
                  <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 bg-rose-600/20 text-rose-700 dark:text-rose-450 rounded">অনুরোধ</span>
                </button>
              </div>

              {/* SPECIAL SECTION ABOUT DEVELOPERS AND PRIVACY WITH HIGH CONTRAST */}
              <div className="space-y-1 pt-4 border-t border-dashed border-slate-350 dark:border-slate-800">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-930 dark:text-slate-400 block px-3 mb-2">সমিতি ডকুমেন্টেশন ও পলিসি</span>
                
                {/* 1. Developer Info link button */}
                <button
                  onClick={() => { setActiveModal('developer'); setIsDrawerOpen(false); }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-slate-800 text-left flex items-center justify-between group cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <User className="h-4 w-4 text-emerald-600 dark:text-emerald-450" />
                    <span className="text-slate-900 dark:text-white">১. ডেভেলপার পরিচিতি</span>
                  </div>
                  <span className="text-[10px] text-emerald-605 font-bold opacity-0 group-hover:opacity-100 transition-opacity">খুলুন ➔</span>
                </button>

                {/* 2. Privacy Policy link button */}
                <button
                  onClick={() => { setActiveModal('privacy'); setIsDrawerOpen(false); }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-800 text-left flex items-center justify-between group cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-450" />
                    <span className="text-slate-900 dark:text-white">২. প্রাইভেসি পলিসি</span>
                  </div>
                  <span className="text-[10px] text-blue-605 font-bold opacity-0 group-hover:opacity-100 transition-opacity">খুলুন ➔</span>
                </button>

                {/* 3. User Guide link button */}
                <button
                  onClick={() => { setActiveModal('guide'); setIsDrawerOpen(false); }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-100 hover:bg-amber-50 dark:hover:bg-slate-800 text-left flex items-center justify-between group cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-450" />
                    <span className="text-slate-900 dark:text-white">৩. ব্যবহার নির্দেশিকা</span>
                  </div>
                  <span className="text-[10px] text-amber-605 font-bold opacity-0 group-hover:opacity-100 transition-opacity">খুলুন ➔</span>
                </button>

                {/* 4. Association Rules link button */}
                <button
                  onClick={() => { setActiveModal('rules'); setIsDrawerOpen(false); }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-100 hover:bg-rose-50 dark:hover:bg-slate-800 text-left flex items-center justify-between group cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Award className="h-4 w-4 text-rose-600 dark:text-rose-455" />
                    <span className="text-slate-900 dark:text-white">৪. উদ্দেশ্য ও নীতিমালা</span>
                  </div>
                  <span className="text-[10px] text-rose-605 font-bold opacity-0 group-hover:opacity-100 transition-opacity">খুলুন ➔</span>
                </button>
              </div>

              {/* Bangladesh Cooperative Dept seal badge */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
                <p>নিবন্ধিত ও সুরক্ষিত ডিজিটাল সমাধান প্যানেল ২০২৬</p>
                <div className="flex items-center justify-center gap-1 text-rose-500 mt-2">
                  <Heart className="h-3 w-3 fill-rose-500" />
                  <span>সঞ্চয়ের মাধ্যমে আর্থিক স্বনির্ভরতা</span>
                </div>
              </div>
            </div>

            {/* Quick Lock-screen shortcut */}
            <div className={`p-4 border-t flex justify-between items-center ${
              darkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50'
            }`}>
              <span className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500">টোকেন সিঙ্ক: লাইভ</span>
              <button 
                onClick={() => { setIsDrawerOpen(false); handleLogout(); }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer flex items-center gap-1.5"
              >
                লগআউট <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Reset Password Modal */}
      {isDrawerResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-205">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm text-left shadow-2xl relative animate-in zoom-in-95 duration-205">
            <button
              onClick={() => setIsDrawerResetOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2 border-b border-white/5 pb-2 font-sans">
              <KeyRound className="h-5 w-5 text-rose-500" />
              পিন রিসেট অনুরোধ করুন
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4 font-sans">
              আপনার সঠিক নাম ও রেজিস্টার্ড মোবাইল নম্বর প্রদান করুন। এডমিন প্যানেলে সরাসরি আপনার অনুরোধটি পাঠানো হবে এবং এডমিন আপনার নতুন পিন নিরাপদ উপায়ে আপডেট করে দিতে পারবেন।
            </p>

            <form onSubmit={handleDrawerResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">সদস্যের নাম (বাংলায়)</label>
                <input
                  type="text"
                  placeholder="যেমন: মোঃ সাকিব"
                  value={drawerResetName}
                  onChange={(e) => setDrawerResetName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/95 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">রেজিস্টার্ড মোবাইল নম্বর</label>
                <input
                  type="text"
                  placeholder="যেমন: ০১৭XXXXXXXX"
                  value={drawerResetPhone}
                  onChange={(e) => setDrawerResetPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/95 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono"
                  required
                />
              </div>

              {drawerResetError && (
                <div className="p-3 bg-rose-500/10 border-l-3 border-rose-500 rounded-lg text-[11px] text-rose-200 leading-normal flex items-start gap-1.5 animate-pulse">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-505" />
                  <span>{drawerResetError}</span>
                </div>
              )}

              {drawerResetSuccess ? (
                <div className="p-3 bg-emerald-500/10 border-l-3 border-emerald-500 rounded-lg text-xs text-emerald-355 leading-normal flex items-start gap-1.5">
                  <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>অনুরোধ এডমিনের কাছে পাঠানো হয়েছে! এডমিন খুব শীঘ্রই আপনার পাসওয়ার্ড রিসেট করবেন। দরজাটি বন্ধ হচ্ছে...</span>
                </div>
              ) : (
                <button
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  অনুরোধ পাঠান ➔
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ==================== RESURRECTIVE SIDE MODAL VIEW OVERLAYS ==================== */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          {/* Central Backdrop closed */}
          <div 
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setActiveModal(null)}
          />

          {/* Modal Container */}
          <div className={`relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl p-6 shadow-2xl border transition-all animate-in zoom-in-95 duration-350 z-10 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            {/* Close icon wrapper */}
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* CONTENT 1: Developer Information */}
            {activeModal === 'developer' && (
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-3 border-b pb-4 border-dashed border-slate-100 dark:border-slate-800">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-sans">১. ডেভেলপার পরিচিতি ও টেকনিক্যাল সাপোর্ট</h3>
                    <p className="text-[11px] text-slate-400 font-mono">Developer profile & digital support desk</p>
                  </div>
                </div>

                <div className="space-y-3 font-sans text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
                  <p>
                    ক্ষুদ্র সঞ্চয় সমিতি ও গ্রামীণ স্বনির্ভর উন্নয়ন প্রকল্পসমূহের যাবতীয় হিসাব-নিকাশ সহজ, সচ্ছ এবং সম্পূর্ণ রিয়েল-টাইম ডাটা সিঙ্ক করার লক্ষ্যে এই <strong>অনলাইন খতিয়ান ও সঞ্চয় সিস্টেম</strong> তৈরি করা হয়েছে।
                  </p>

                  <div className={`p-4 rounded-2xl border ${
                    darkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50 border-slate-100'
                  } space-y-2`}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-600 dark:text-slate-400">ডেভেলপার:</span>
                      <strong className="text-slate-800 dark:text-white">নুসাইব বিন শহিদুল ফরাজী</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-600 dark:text-slate-400">অফিসিয়াল ইমেইল:</span>
                      <a href="mailto:fnusaib@gmail.com" className="text-emerald-600 dark:text-emerald-400 font-bold underline">fnusaib@gmail.com</a>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-600 dark:text-slate-400">সিস্টেম সংস্করণ:</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 font-mono px-2 py-0.5 rounded font-bold">v1.1.0</span>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-800 dark:text-white mt-4 flex items-center gap-1.5 text-xs">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    অ্যাপ্লিকেশনের মূল কারিগরি কার্যাবলী:
                  </h4>
                  <ul className="list-disc list-inside space-y-1.5 text-[11px] pl-2 text-slate-500 dark:text-slate-400">
                    <li><strong>রিয়েল-টাইম স্ন্যাপশট ক্লাউড:</strong> প্রতি সেকেন্ডে তথ্য রিমোটলি গুগল ফায়ারস্টোর ডাটাবেজে রেকর্ড করা হয়।</li>
                    <li><strong>সিকিউর মেম্বার পিন (PIN):</strong> সদস্যদের একাউন্ট অ্যাক্সেস আটকাতে এবং সত্যতা যাচাই করতে ৪-সংখ্যার ব্যক্তিগত পিনকোড।</li>
                    <li><strong>স্বয়ংক্রিয় ছবি রিসাইজার:</strong> ডাটাবেজে স্টোরেজ সাস্ময় এবং দ্রুত লোডিংয়ের জন্য ব্রাউজারেই জেপিজি কম্প্রেশন এবং রিসাইজিং হয়।</li>
                    <li><strong>তথ্য ট্র্যাশ ও রিস্টোর:</strong> এডমিন প্যানেল থেকে যেকোনো তথ্য মুছে ফেলার পর এক ক্লিকেই সম্পূর্ণ রিস্টোরেশন সুবিধা।</li>
                  </ul>
                </div>
              </div>
            )}

            {/* CONTENT 2: Privacy Policy details */}
            {activeModal === 'privacy' && (
              <div className="space-y-4 text-left font-sans">
                <div className="flex items-center gap-3 border-b pb-4 border-dashed border-slate-100 dark:border-slate-800">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-sans">২. ডিজিটাল ও ব্যক্তিগত নিরাপত্তা প্রাইভেসি পলিসি</h3>
                    <p className="text-[11px] text-slate-400 font-mono">Real-Time Data Security Policy</p>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-sans">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    আমাদের সমিতির আমানতকারীদের সমস্ত খতিয়ান ও হিসাবের গোপনীয়তা বজায় রাখতে আমরা বদ্ধপরিকর।
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white mb-1">ক) ক্লাউড নিরাপত্তা এবং এনক্রিপশন</h4>
                      <p className="text-slate-500 dark:text-slate-400">
                        সিস্টেমের যাবতীয় হিসাব সরাসরি গুগল ক্লাউডের সুরক্ষিত ডাটা সেন্টারে ফায়ারস্টোর ডাটাবেজের মাধ্যমে সংরক্ষিত থাকে। কোনো তথ্য হ্যাকিং বা ডিভাইস ধ্বংস হলেও ডাটা ক্লাউডে সম্পূর্ণ সুরক্ষিত থাকবে।
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white mb-1">খ) ক্যামেরা ব্যবহারের উদ্দেশ্য ও অনুমতি</h4>
                      <p className="text-slate-500 dark:text-slate-400">
                        সদস্য নিবন্ধনের সময় ব্যবহৃত ক্যামেরা বা গ্যালারি ব্যবহারের পারমিশন শুধুমাত্র ব্রাউজারের অভ্যন্তরেই ছবি সংকুচন কাজে ব্যয় হয় এবং এটি সরাসরি আপনার ডাটাবেইজের প্রোফাইল ইমেজে রেন্ডার হয়। কোনো অতিরিক্ত ব্যক্তিগত ফাইল আমরা বিশ্লেষণ করি না।
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white mb-1">গ) সিকিউর পিন (PIN) এবং ট্রানজেকশন ক্লিয়ারেন্স</h4>
                      <p className="text-slate-500 dark:text-slate-400">
                        সদস্যদের পিন নাম্বার ও ডাটা এডমিন কর্তৃক শতভাগ সুরক্ষিত এবং পিন যাচাইয়ের মাধ্যমে সদস্যদের জমার স্লিপ নিশ্চিত করা আবশ্যক।
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENT 3: User Help Manual guide */}
            {activeModal === 'guide' && (
              <div className="space-y-4 text-left font-sans">
                <div className="flex items-center gap-3 border-b pb-4 border-dashed border-slate-100 dark:border-slate-800">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-sans">৩. ডিজিটাল সঞ্চয় ডায়েরি ব্যবহার নির্দেশিকা</h3>
                    <p className="text-[11px] text-slate-400 font-mono">System User Manual & Walkthrough</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-sans">
                  <div className="space-y-3.5">
                    <div className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-805 dark:bg-amber-950 dark:text-amber-400 p-1 flex items-center justify-center font-bold font-mono text-xs shrink-0 shadow-sm">১</div>
                      <div>
                        <strong className="text-slate-850 dark:text-white block font-sans">নতুন সদস্য নিবন্ধন:</strong>
                        <span className="text-slate-500 dark:text-slate-400">সদস্য ব্যবস্থাপনা ট্যাবে যান, 'নতুন সদস্য ফরম' পূরণ করুন, ইউনিক আইডি দিন, মোবাইল নাম্বার ও ইউনিক পিন দিয়ে সাবমিট দিন। প্রয়োজনে সরাসরি তার ছবি তুলুন।</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-805 dark:bg-amber-950 dark:text-amber-400 p-1 flex items-center justify-center font-bold font-mono text-xs shrink-0 shadow-sm">২</div>
                      <div>
                        <strong className="text-slate-850 dark:text-white block font-sans">দৈনিক সঞ্চয় ও কিস্তি রিসিভ:</strong>
                        <span className="text-slate-500 dark:text-slate-400">'সঞ্চয় ও কিস্তি আদায়' প্যানেলে গিয়ে সদস্য নির্বাচন করুন। নির্দিষ্ট কিস্তির পরিমাণ বা সঞ্চয় এমাউন্ট লিখে এডমিন পিন নাম্বার বা গ্রাহক সাবমিট ক্লিকে এক ক্লিকেই রিসিভ করুন।</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-805 dark:bg-amber-950 dark:text-amber-400 p-1 flex items-center justify-center font-bold font-mono text-xs shrink-0 shadow-sm">৩</div>
                      <div>
                        <strong className="text-slate-850 dark:text-white block font-sans">লোন অনুমোদন ও ঋণ বুক:</strong>
                        <span className="text-slate-500 dark:text-slate-400">'ঋণ খাতা ও বিতরণ' ট্যাবে গিয়ে কাঙ্ক্ষিত সদস্যকে তার সঞ্চয় অনুপাতে নতুন ঋণ বিতরণ করুন। ফেরত কালেকশনও দৈনিক কিস্তি আকারে খুব সহজেই কর্তন করা যাবে।</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-805 dark:bg-amber-950 dark:text-amber-400 p-1 flex items-center justify-center font-bold font-mono text-xs shrink-0 shadow-sm">৪</div>
                      <div>
                        <strong className="text-slate-850 dark:text-white block font-sans">লাভ লোকসান অডিট রিপোর্ট:</strong>
                        <span className="text-slate-500 dark:text-slate-400">'রিপোর্ট ও লাভ ক্ষতি' ট্যাপে প্রতিদিনের সংগৃহীত সর্বমোট সঞ্চয় তহবিল, বিতরিত ঋণ, আদায়কৃত আসল ও মুনাফাসহ সমিতির নিট মুনাফার লেজার মুহূর্তেই অডিট করুন ও প্রিন্ট দিন।</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENT 4: Cooperative Rules & Mission Statement */}
            {activeModal === 'rules' && (
              <div className="space-y-4 text-left font-sans">
                <div className="flex items-center gap-3 border-b pb-4 border-dashed border-slate-100 dark:border-slate-800">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-sans">৪. ক্ষুদ্র সঞ্চয় উদ্দেশ্য ও সাংগঠনিক নিয়মাবলী</h3>
                    <p className="text-[11px] text-slate-400 font-mono">By-laws & Strategic Cooperatives Regulations</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-sans">
                  <blockquote className="border-l-4 border-rose-500 pl-3 italic text-slate-500 dark:text-slate-400 text-[11px]">
                     "সকলের তরে সকলে আমরা, প্রত্যেকে আমরা পরের তরে" - সঞ্চয় প্রকল্পটি মূলত তৃনমূলের ক্ষুদ্র অর্থনৈতিক মুক্তি লাভের সম্মিলিত শক্তি।
                  </blockquote>

                  <div className="space-y-3.5 pl-1">
                    <div>
                      <strong className="text-slate-800 dark:text-white block mb-0.5">১. নিয়মিত সঞ্চয় কিস্তির বাধ্যবাধকতা:</strong>
                      <p className="text-slate-500 dark:text-slate-400">সমিতির আমানতকারী সকল সদস্যকে নির্ধারিত দৈনিক অথবা সাপ্তাহিক মেয়াদে সঞ্চয়ের টার্গেট কিস্তি সম্পূর্ণ করার অনুরোধ করা গেল।</p>
                    </div>
                    <div>
                      <strong className="text-slate-800 dark:text-white block mb-0.5">২. দীর্ঘমেয়াদের লোন বা রিফান্ড পলিসি:</strong>
                      <p className="text-slate-500 dark:text-slate-400">সমিতির আইন অনুযায়ী ঋণ পরিশোধ সম্পূর্ণ হওয়া সাপেক্ষে আমানতকারী যেকোনো সময় তার সঞ্চিত জামানত সম্পূর্ণ উইথড্রয়াল বা ফেরত নিতে সক্ষম।</p>
                    </div>
                    <div>
                      <strong className="text-slate-800 dark:text-white block mb-0.5">৩. প্রকল্পের নৈতিক উদ্দেশ্য:</strong>
                      <p className="text-slate-500 dark:text-slate-400">সকল ক্ষুদ্র আমানতসমূহকে সমন্বিত করে স্বনির্ভর কর্মসংস্থান সৃষ্টি ও উৎপাদনশীল খাতে বিনিয়োগ বৃদ্ধির মাধ্যমে অর্থনৈতিক মুক্তি আনয়নই এই সমিতির মূল উদ্দেশ্য।</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick close modal button */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                প্যানেল বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit App / Logout Confirmation Modal */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => {
              setShowExitConfirmModal(false);
            }}
          />

          <div className={`relative w-full max-w-sm rounded-[24px] p-6 shadow-2xl border transition-all animate-in zoom-in-95 duration-350 z-10 text-center ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center mb-4">
              <LogOut className="h-6 w-6 animate-pulse" />
            </div>

            <h3 className="text-base font-bold mb-2 font-sans">
              লগআউট ও প্রস্থান নিশ্চিত করুন
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6 font-sans">
              আপনি কি নিশ্চিতভাবে আপনার অ্যাকাউন্ট থেকে লগআউট করে প্রস্থান করতে চাচ্ছেন?
            </p>

            <div className="flex gap-3 justify-center">
              <button 
                type="button"
                onClick={() => {
                  setShowExitConfirmModal(false);
                }}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.98]"
              >
                না, ফিরে যান
              </button>
              <button 
                type="button"
                onClick={() => {
                  setShowExitConfirmModal(false);
                  handleLogout();
                }}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.98]"
              >
                হ্যাঁ, লগআউট করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Custom React-based Alert Modal to eliminate android WebView crashes / freezes */}
      {globalAlertDialog.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`relative w-full max-w-sm rounded-[24px] p-6 shadow-2xl border transition-all animate-in zoom-in-95 duration-200 text-center ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              globalAlertDialog.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' 
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-500'
            }`}>
              {globalAlertDialog.type === 'success' ? (
                <CheckCircle className="h-6 w-6 animate-bounce" />
              ) : (
                <AlertTriangle className="h-6 w-6 animate-pulse" />
              )}
            </div>

            <h3 className="text-base font-bold mb-2 font-sans">
              {globalAlertDialog.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6 font-sans">
              {globalAlertDialog.message}
            </p>

            <button 
              type="button"
              onClick={() => setGlobalAlertDialog(prev => ({ ...prev, isOpen: false }))}
              className={`w-full py-2.5 px-4 text-white font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-[0.98] ${
                globalAlertDialog.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              ঠিক আছে
            </button>
          </div>
        </div>
      )}

      {/* FOOTER OFFICE MANAGEMENT */}
      <footer className={`py-4 text-center text-[10px] md:text-xs border-t transition-all leading-relaxed ${
        darkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
      }`}>
        <p>
          অফিস পরিচালনায়: <strong className="text-slate-700 dark:text-slate-300 font-sans">{appConfig.adminName}</strong> | মোবাইল: <strong className="text-slate-700 dark:text-slate-300 font-sans">{appConfig.adminPhone}</strong> | ঠিকানা: <strong className="text-slate-700 dark:text-slate-300 font-sans">{appConfig.adminAddress}</strong>
        </p>
        <p className="mt-0.5">
          সভাপতি: <strong className="text-slate-700 dark:text-slate-300 font-sans">মোঃ সম্রাট মিজি</strong> | মোবাইল: <strong className="text-slate-700 dark:text-slate-300 font-sans">01913-973850</strong>
        </p>
        <p className="mt-0.5 opacity-90">
          বর্তমান ইউজার: <strong className="text-slate-700 dark:text-slate-300 font-sans">{currentRole === 'admin' ? appConfig.adminName : currentRole === 'owner' ? 'সম্মানিত শেয়ারহোল্ডার' : activeMember?.name || 'পরিচিতিহীন'}</strong> | ক্ষুদ্র সঞ্চয় ও লোন খাতা ডায়েরি ২০২৬
        </p>
      </footer>
    </div>
  );
}
