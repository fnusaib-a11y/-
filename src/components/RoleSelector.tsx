import React, { useState, useEffect } from 'react';
import { AlertCircle, Phone, Lock, Eye, EyeOff, User, MapPin, Trash2, KeyRound, HelpCircle, X, Check } from 'lucide-react';
import { Member, AppConfig, PinRequest } from '../types';
// @ts-ignore
import associationLogo from '../assets/images/association_logo_1780420505055.png';

interface RoleSelectorProps {
  members: Member[];
  onLogin: (role: 'admin' | 'owner' | 'member', memberId?: string) => void;
  appConfig: AppConfig;
  onRequestPinReset?: (req: PinRequest) => void;
}

interface SavedAccount {
  phone: string;
  pin: string;
  name: string;
  role: 'admin' | 'owner' | 'member';
}

export default function RoleSelector({ members, onLogin, appConfig, onRequestPinReset }: RoleSelectorProps) {
  const [phoneInput, setPhoneInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  // Forgot password form states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPhone, setResetPhone] = useState('');
  const [resetName, setResetName] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  // Load persistent accounts and phone on startup
  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem('saved_login_phone');
      if (savedPhone) {
        setPhoneInput(savedPhone);
      }
      const savedRaw = localStorage.getItem('saved_accounts_list');
      if (savedRaw) {
        setSavedAccounts(JSON.parse(savedRaw));
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
  }, []);

  // Remove saved account handler
  const handleRemoveSavedAccount = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = savedAccounts.filter(acc => acc.phone !== phone);
      setSavedAccounts(updated);
      localStorage.setItem('saved_accounts_list', JSON.stringify(updated));
      if (phoneInput === phone) {
        setPhoneInput('');
        setPinInput('');
      }
    } catch (e) {
      console.warn('LocalStorage update failed:', e);
    }
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess(false);

    const cleanPhone = resetPhone.trim();
    const cleanName = resetName.trim();

    if (!cleanPhone || !cleanName) {
      setResetError('সবগুলো তথ্য সঠিকভাবে প্রদান করুন!');
      return;
    }

    // Check if phone matches a member or is owner/admin
    const isMember = members.find(m => m.phone === cleanPhone || m.phone.endsWith(cleanPhone));
    const isAdmin = cleanPhone === appConfig.adminPhone || cleanPhone === 'admin';
    const isOwner = cleanPhone === appConfig.ownerPhone || cleanPhone === 'owner';

    if (!isMember && !isAdmin && !isOwner) {
      setResetError('এই মোবাইল নম্বরের কোনো রেজিস্টার্ড সদস্য বা অ্যাকাউন্ট খুঁজে পাওয়া যায়নি!');
      return;
    }

    if (onRequestPinReset) {
      onRequestPinReset({
        id: `PIN-REQ-${Date.now()}`,
        name: cleanName,
        phone: cleanPhone,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        memberId: isMember ? isMember.id : undefined
      });
      setResetSuccess(true);
      setResetPhone('');
      setResetName('');
      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess(false);
      }, 4000);
    }
  };

  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!phoneInput) {
      setErrorMsg('দয়া করে রেজিস্টার্ড মোবাইল নম্বর দিন।');
      return;
    }
    if (!pinInput) {
      setErrorMsg('দয়া করে ৪-৬ ডিজিটের পিন লিখুন।');
      return;
    }

    const cleanPhone = phoneInput.trim();

    // Helper to save successful logins safely
    const saveAccountLocally = (role: 'admin' | 'owner' | 'member', name: string) => {
      try {
        const savedRaw = localStorage.getItem('saved_accounts_list');
        let list: SavedAccount[] = savedRaw ? JSON.parse(savedRaw) : [];
        list = list.filter(item => item.phone !== cleanPhone);
        list.unshift({ phone: cleanPhone, pin: pinInput, name, role });
        list = list.slice(0, 5); // Remember up to 5 accounts max
        localStorage.setItem('saved_accounts_list', JSON.stringify(list));
        localStorage.setItem('saved_login_phone', cleanPhone);
      } catch (e) {
        console.warn('LocalStorage save failed:', e);
      }
    };

    // 1. Check Admin Profile matching (Dynamic from Firestore)
    const isAdminPhone = cleanPhone === appConfig.adminPhone || cleanPhone === 'admin';
    if (isAdminPhone) {
      if (pinInput === appConfig.adminPin) {
        saveAccountLocally('admin', appConfig.adminName || 'পরিালক');
        onLogin('admin');
        return;
      } else {
        setErrorMsg('ভুল পিন নম্বর! আবার চেষ্টা করুন।');
        return;
      }
    }

    // 2. Check Owner Profile matching (Dynamic from Firestore)
    const isOwnerPhone = cleanPhone === appConfig.ownerPhone || cleanPhone === 'owner';
    if (isOwnerPhone) {
      if (pinInput === appConfig.ownerPin) {
        saveAccountLocally('owner', 'মালিক (Owner)');
        onLogin('owner');
        return;
      } else {
        setErrorMsg('ভুল পিন নম্বর! আবার চেষ্টা করুন।');
        return;
      }
    }

    // 3. Check Member database list
    const member = members.find(m => m.phone === cleanPhone || m.phone.endsWith(cleanPhone));
    if (member) {
      if (member.pin === pinInput) {
        saveAccountLocally('member', member.name);
        onLogin('member', member.id);
        return;
      } else {
        setErrorMsg('ভুল পিন নম্বর! আবার চেষ্টা করুন।');
        return;
      }
    }

    setErrorMsg('এই মোবাইল নম্বরের কোনো রেজিস্টার্ড সদস্য অ্যাকাউন্ট খুঁজে পাওয়া যায়নি!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 flex flex-col justify-between py-8 px-4 items-center relative overflow-hidden select-none font-sans text-white">
      {/* Decorative ambient blobs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Identity Block */}
      <div className="w-full max-w-md text-center my-auto relative z-10 flex flex-col items-center">
        <div className="flex justify-center mb-5">
          <div className="relative flex items-center justify-center">
            {/* Soft backdrop glow */}
            <div className="absolute w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl animate-pulse"></div>
            
            {/* App logo rendering in the circular badge */}
            <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full bg-slate-900 border-2 border-emerald-500/40 p-1 flex items-center justify-center shadow-2xl transition-all duration-500 hover:scale-[1.03] select-none">
              <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                <img 
                  src={associationLogo} 
                  alt="সমিতি লোগো" 
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </div>
        <h1 className="text-2.5xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-200 tracking-tight font-sans">ক্ষুদ্র সঞ্চয় সমিতি</h1>
        <p className="text-xs text-slate-400 mt-1.5 font-bold uppercase tracking-wider">গণপ্রজাতন্ত্রী বাংলাদেশ ক্ষুদ্র সঞ্চয় প্রকল্প কর্তৃক অনুমোদিত</p>

        {/* Form Container with high standard credentials Autofill */}
        <form onSubmit={handleLoginSubmit} className="mt-8 bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl shadow-2xl border border-white/10 text-left text-white w-full max-w-sm mx-auto">
          <h2 className="text-sm font-bold text-slate-300 mb-6 font-sans text-center">
            নিকটস্থ রেজিস্টার্ড মোবাইল নম্বর দিন
          </h2>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-500/10 border-l-4 border-rose-500 text-rose-200 text-xs rounded-xl flex items-start gap-2 animate-pulse leading-normal">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Phone Field */}
          <div className="mb-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-emerald-400">
                <Phone className="h-5 w-5" />
              </span>
              <input
                type="text"
                name="username"
                id="username"
                autoComplete="username"
                placeholder="মোবাইল নম্বর"
                inputMode="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-950/90 border border-white/10 rounded-2xl text-base outline-none text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono tracking-wider text-center font-bold placeholder-slate-500"
              />
            </div>
          </div>

          {/* Verification Code/PIN */}
          <div className="mb-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                <Lock className="h-5 w-5" />
              </span>
              <input
                type={showPin ? "text" : "password"}
                name="password"
                id="password"
                autoComplete="current-password"
                placeholder="গোপন পিন কোড"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full pl-12 pr-12 py-3 bg-slate-950/90 border border-white/10 rounded-2xl text-center text-sm outline-none font-sans text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono tracking-wider font-extrabold placeholder-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white"
              >
                {showPin ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end mb-4 px-1">
            <button
              type="button"
              onClick={() => {
                setResetError('');
                setResetSuccess(false);
                setShowResetModal(true);
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold hover:underline bg-transparent border-0 cursor-pointer p-0 text-right decoration-emerald-500/35"
            >
              পিন/পাসওয়ার্ড ভুলে গেছেন?
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3.5 px-4 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-950/15 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 font-sans"
          >
            <User className="h-4.5 w-4.5 text-white/95" />
            একাউন্টে প্রবেশ করুন
          </button>
        </form>

        {/* Saved Accounts Quick Switch list */}
        {savedAccounts.length > 0 && (
          <div className="mt-4 w-full max-w-sm bg-slate-900/95 backdrop-blur-md p-4 rounded-3xl border border-white/10 shadow-2xl text-left text-white">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block mb-2 px-1 flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
              সংরক্ষিত অ্যাকাউন্টসমূহ (দ্রুত প্রবশ)
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {savedAccounts.map((acc) => (
                <div 
                  key={acc.phone}
                  onClick={() => {
                    setPhoneInput(acc.phone);
                    setPinInput(acc.pin);
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl border border-white/5 bg-slate-950/40 hover:bg-emerald-950/30 cursor-pointer transition-all ${phoneInput === acc.phone ? 'border-emerald-500/40 bg-emerald-950/25' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-850 text-emerald-400 font-bold text-xs flex items-center justify-center border border-white/10">
                      {acc.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white leading-none">{acc.name}</div>
                      <div className="text-[9px] text-slate-400 leading-none mt-1 font-mono">{acc.phone} · {acc.role === 'admin' ? 'পরিচালক' : acc.role === 'owner' ? 'মালিক' : 'সদস্য'}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSavedAccount(acc.phone, e)}
                    className="p-1 hover:bg-rose-500/10 text-slate-400 hover:text-rose-550 rounded-lg transition-all cursor-pointer"
                    title="সংরক্ষণ মুছুন"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic access level credentials box in everyone's app */}
        <div className="mt-4 w-full max-w-sm bg-slate-900/95 backdrop-blur-md p-4 rounded-3xl border border-white/10 shadow-2xl flex items-center gap-3.5 text-left text-white">
          <div className="w-14 h-14 rounded-full border border-emerald-500/20 overflow-hidden shrink-0 bg-white flex items-center justify-center">
            {appConfig.adminPhotoUrl ? (
              <img src={appConfig.adminPhotoUrl} alt="পরিচালক ছবি" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                {appConfig.adminName.slice(0, 1)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] uppercase font-bold tracking-tight text-emerald-400 font-sans">অফিস অ্যাক্সেস তথ্য</span>
            <h3 className="text-xs font-bold text-white truncate leading-normal">পরিচালনায়: {appConfig.adminName}</h3>
            <p className="text-[11px] text-slate-300 mt-0.5 truncate flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0 text-emerald-400" />
              <span>মোবাইল: {appConfig.adminPhone}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1 border-b border-white/5 pb-1 mb-1">
              <MapPin className="h-3 w-3 shrink-0 text-emerald-450" />
              <span>ঠিকানা: {appConfig.adminAddress}</span>
            </p>
            <h4 className="text-xs font-bold text-emerald-400 mt-1 truncate leading-normal font-sans">সভাপতি: মোঃ সম্রাট মিজি</h4>
            <p className="text-[11px] text-slate-300 mt-0.5 truncate flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0 text-emerald-450" />
              <span>মোবাইল: 01913-973850</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer Administration note */}
      <footer className="text-center text-[10px] text-slate-400 mt-8 max-w-xs leading-relaxed font-sans relative z-10">
        <p>সফটওয়্যার পরিচালনায়: <span className="font-semibold text-slate-300">{appConfig.adminName}</span></p>
        <p className="text-[9px] mt-0.5 text-slate-500">নিরাপত্তা স্তর: ২৫কে-বিট এসএসএল এনক্রিপ্টেড ডাটাবেজ</p>
        <p className="text-[10px] text-slate-400 font-medium mt-1.5">
          Powered by ~ Mr Pipilika Lab's
        </p>
        <p className="text-[9px] text-slate-500 font-mono">
          fnusaib@gmail.com
        </p>
      </footer>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm text-left shadow-2xl relative animate-in zoom-in-95 duration-200 text-white">
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2 border-b border-white/5 pb-2 font-sans">
              <HelpCircle className="h-5 w-5 text-emerald-400" />
              পিন রিসেট অনুরোধ করুন
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4 font-sans">
              আপনার রেজিস্টার্ড নাম ও মোবাইল নম্বর প্রদান করুন। ম্যানেজার প্যানেলে সরাসরি আপনার অনুরোধটি পাঠানো হবে এবং এডমিন আপনার নতুন পিন নিরাপদ উপায়ে আপডেট করে দিতে পারবেন।
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">সদস্যের নাম (বাংলায়)</label>
                <input
                  type="text"
                  placeholder="যেমন: মোঃ মিজান"
                  value={resetName}
                  onChange={(e) => setResetName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">রেজিস্টার্ড মোবাইল নম্বর</label>
                <input
                  type="text"
                  placeholder="যেমন: ০১৭XXXXXXXX"
                  value={resetPhone}
                  onChange={(e) => setResetPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                  required
                />
              </div>

              {resetError && (
                <div className="p-3 bg-rose-500/10 border-l-4 border-rose-500 rounded-lg text-[11px] text-rose-200 leading-normal flex items-start gap-1.5 animate-pulse">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess ? (
                <div className="p-3 bg-emerald-500/10 border-l-4 border-emerald-500 rounded-lg text-xs text-emerald-300 leading-normal flex items-start gap-1.5">
                  <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>অনুরোধ সফলভাবে পাঠানো হয়েছে! এডমিনের সাথে যোগাযোগ করুন। দরজাটি বন্ধ হচ্ছে...</span>
                </div>
              ) : (
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  অনুরোধ পাঠান ➔
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
