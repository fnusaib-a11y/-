import React, { useRef, useState, useEffect } from 'react';
import { TrashLog, AppConfig } from '../types';
import { 
  RotateCcw, Download, Upload, Trash2, Database, Shield, 
  MapPin, Phone, User, Key, Save, Image, CheckCircle, RefreshCw, 
  ShieldAlert, AlertCircle
} from 'lucide-react';

interface TrashRestoreProps {
  trash: TrashLog[];
  onRestore: (trashId: string) => void;
  onClearTrash: () => void;
  onDeleteTrashPermanently?: (trashId: string) => void;
  onImportBackup: (backupData: any) => void;
  fullState: any; // Entire localstorage dump for backup download!
  appConfig: AppConfig;
  onUpdateAppConfig: (newConfig: AppConfig) => Promise<void>;
}

export default function TrashRestore({ 
  trash, 
  onRestore, 
  onClearTrash, 
  onDeleteTrashPermanently,
  onImportBackup, 
  fullState,
  appConfig,
  onUpdateAppConfig
}: TrashRestoreProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Profile Form state
  const [adminName, setAdminName] = useState(appConfig.adminName);
  const [adminPhone, setAdminPhone] = useState(appConfig.adminPhone);
  const [adminAddress, setAdminAddress] = useState(appConfig.adminAddress);
  const [adminPhotoUrl, setAdminPhotoUrl] = useState(appConfig.adminPhotoUrl);
  const [adminPin, setAdminPin] = useState(appConfig.adminPin);
  const [ownerPhone, setOwnerPhone] = useState(appConfig.ownerPhone);
  const [ownerPin, setOwnerPin] = useState(appConfig.ownerPin);
  const [noticeText, setNoticeText] = useState(appConfig.noticeText || '');
  const [memberNoticeText, setMemberNoticeText] = useState(appConfig.memberNoticeText || '');
  const [shareholderNoticeText, setShareholderNoticeText] = useState(appConfig.shareholderNoticeText || '');

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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

  const handleClearTrashClick = () => {
    showConfirm(
      'রিসাইকেল বিন খালি করুন',
      'আপনি কি নিশ্চিত সম্পূর্ণ রিসাইকেল বিন স্থায়ীভাবে খালি করতে চান? এটি আর ফিরিয়ে আনা যাবে না।',
      () => onClearTrash()
    );
  };

  // Update states if the Firestore values change
  useEffect(() => {
    setAdminName(appConfig.adminName);
    setAdminPhone(appConfig.adminPhone);
    setAdminAddress(appConfig.adminAddress);
    setAdminPhotoUrl(appConfig.adminPhotoUrl || '');
    setAdminPin(appConfig.adminPin);
    setOwnerPhone(appConfig.ownerPhone || '01722222222');
    setOwnerPin(appConfig.ownerPin || '5678');
    setNoticeText(appConfig.noticeText || '');
    setMemberNoticeText(appConfig.memberNoticeText || '');
    setShareholderNoticeText(appConfig.shareholderNoticeText || '');
  }, [appConfig]);

  // Handle Photo dynamic file upload converting to Base64
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: keep base64 strings reasonably compressed for Firebase
    if (file.size > 2 * 1024 * 1024) {
      alert('দুঃখিত, ফাইল সাইজ ২ মেগাবাইট (2MB) এর নিচে হতে হবে।');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        setAdminPhotoUrl(result); // Dynamic base64 preview and save state
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit Brand Changes
  const handleSaveConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim()) {
      alert('পরিচালকের নাম অবশ্যই দিতে হবে।');
      return;
    }
    if (!adminPhone.trim() || adminPhone.trim().length < 11) {
      alert('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।');
      return;
    }

    setIsSaving(true);
    setSuccessMessage('');

    try {
      await onUpdateAppConfig({
        adminName: adminName.trim(),
        adminPhone: adminPhone.trim(),
        adminAddress: adminAddress.trim(),
        adminPhotoUrl: adminPhotoUrl,
        adminPin: adminPin.trim(),
        ownerName: "সম্মানিত শেয়ার হোল্ডার",
        ownerPhone: ownerPhone.trim(),
        ownerPin: ownerPin.trim(),
        noticeText: noticeText.trim(),
        memberNoticeText: memberNoticeText.trim(),
        shareholderNoticeText: shareholderNoticeText.trim()
      });
      setSuccessMessage('অভিনন্দন! সিস্টেম অ্যাক্সেস এবং অফিস পরিচিতি সফলভাবে আপডেট করা হয়েছে।');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert('ডাটাবেজ সেভ করতে সমস্যা হয়েছে। দয়া করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।');
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger JSON file download
  const handleDownloadBackup = () => {
    const dataStr = JSON.stringify(fullState, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `sms_database_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Trigger local JSON file import upload
  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          if (event.target && typeof event.target.result === 'string') {
            const parsed = JSON.parse(event.target.result);
            if (parsed.members && parsed.installments && parsed.loans) {
              onImportBackup(parsed);
              alert('অভিনন্দন! ব্যাকআপ ফাইল থেকে ডাটাবেজ সফলভাবে রিস্টোর হয়েছে।');
            } else {
              alert('ভুল ফরম্যাট! অরিজিনাল ব্যাকআপ ফাইল আপলোড করুন।');
            }
          }
        } catch (err) {
          alert('ফাইলটি লোড করা সম্ভব হয়নি! দয়া করে সঠিক JSON ব্যাকআপ ফাইল নির্বাচন করুন।');
        }
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-850 dark:text-white">সিস্টেম কন্ট্রোল ও অ্যাক্সেস লেভেল প্যানেল</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">অফিস পরিচিতি, পরিচালক ও সম্মানিত শেয়ারহোল্ডারদের অ্যাক্সেস তথ্য পরিবর্তন এবং রিসাইকেল বিন পুনরুদ্ধার।</p>
        </div>
      </div>

      {/* Row 1: App Settings (Full Width Form) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800 overflow-hidden text-left">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-950/20 flex gap-2 items-center">
          <Shield className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">অফিস ও অ্যাক্সেস লেভেল কনফিগারেশন সেটিংস</h3>
        </div>

        {successMessage && (
          <div className="m-5 p-3.5 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-850 text-xs rounded-xl flex items-center gap-2 animate-fadeIn dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-600 leading-normal font-sans">
            <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveConfigSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Column 1: Profile Photo uploading and compilation */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800 rounded-2xl space-y-3 relative">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">পরিচালক অফিস ছবি</span>
              <div className="w-28 h-28 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden relative shadow-inner">
                {adminPhotoUrl ? (
                  <img src={adminPhotoUrl} alt="ছবি প্রিভিউ" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-slate-400 text-center flex flex-col items-center p-2">
                    <Image className="h-7 w-7 text-slate-350" />
                    <span className="text-[10px] mt-1 font-sans">ছবি নেই</span>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                accept="image/*" 
                ref={photoInputRef}
                onChange={handlePhotoUpload}
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 hover:bg-slate-50 text-slate-700 dark:text-slate-250 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Image className="h-3.5 w-3.5" />
                ছবি যোগ করুন
              </button>
              {adminPhotoUrl && (
                <button
                  type="button"
                  onClick={() => setAdminPhotoUrl('')}
                  className="text-[10px] text-red-500 hover:underline"
                >
                  ছবি ডিলিট করুন
                </button>
              )}
            </div>

            {/* Column 2: Public Brand details */}
            <div className="md:col-span-2 space-y-4">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block pb-1 border-b border-slate-100 dark:border-slate-800">১. অফিস পরিচিতি কার্ড তথ্য (সার্বজনীন)</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-305 mb-1 bg-transparent">পরিচালক নাম (Director Name)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><User className="h-4 w-4" /></span>
                    <input 
                      type="text" 
                      value={adminName} 
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-250 dark:border-slate-750 dark:bg-slate-950 dark:text-white rounded-xl text-xs font-sans outline-none focus:ring-1 focus:ring-emerald-500 font-medium" 
                      placeholder="মিজানুর রহমান"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-305 mb-1">অফিস মোবাইল (Active Device Mobile)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Phone className="h-4 w-4" /></span>
                    <input 
                      type="text" 
                      value={adminPhone} 
                      onChange={(e) => setAdminPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-250 dark:border-slate-750 dark:bg-slate-950 dark:text-white rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-500 font-mono" 
                      placeholder="01660179421"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-305 mb-1">অফিস কার্যালয়ের ঠিকানা (Office Address)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><MapPin className="h-4 w-4" /></span>
                    <input 
                      type="text" 
                      value={adminAddress} 
                      onChange={(e) => setAdminAddress(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-250 dark:border-slate-750 dark:bg-slate-950 dark:text-white rounded-xl text-xs font-sans outline-none focus:ring-1 focus:ring-emerald-500 font-medium" 
                      placeholder="গাজীপুর কালিয়াকৈর মৌচাক হুপলুন গেট"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Login Security Credentials */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block pb-2.5 mb-4 border-b border-slate-100 dark:border-slate-800">২. এডমিন ও শেয়ারহোল্ডার লগইন সিকিউরিটি সেটিংস (প্রশাসনিক)</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-305 mb-1">এডমিন পিন নম্বর (Admin Pin)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Key className="h-4 w-4" /></span>
                  <input 
                    type="password" 
                    value={adminPin} 
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-250 dark:border-slate-750 dark:bg-slate-950 dark:text-white rounded-xl text-xs font-mono font-bold text-center tracking-widest outline-none focus:ring-1 focus:ring-emerald-500" 
                    placeholder="1234"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-305 mb-1">সম্মানিত শেয়ারহোল্ডার / অংশীদার মোবাইল</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Phone className="h-4 w-4" /></span>
                  <input 
                    type="text" 
                    value={ownerPhone} 
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-250 dark:border-slate-750 dark:bg-slate-950 dark:text-white rounded-xl text-xs font-semibold font-mono outline-none focus:ring-1 focus:ring-emerald-500" 
                    placeholder="01722222222"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-305 mb-1">শেয়ারহোল্ডার পিন নম্বর</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Key className="h-4 w-4" /></span>
                  <input 
                    type="password" 
                    value={ownerPin} 
                    onChange={(e) => setOwnerPin(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-250 dark:border-slate-750 dark:bg-slate-950 dark:text-white rounded-xl text-xs font-mono font-bold text-center tracking-widest outline-none focus:ring-1 focus:ring-emerald-500" 
                    placeholder="5678"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Notice Board Configuration */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-6">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block pb-2.5 mb-4 border-b border-slate-100 dark:border-slate-800">৩. নোটিশ বোর্ড সেটিংস (Notice Board System)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Member Notice */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">📢 শুধুমাত্র 'সদস্যদের' জন্য নোটিশ (Notice for Members)</label>
                  <textarea
                    value={memberNoticeText}
                    onChange={(e) => setMemberNoticeText(e.target.value)}
                    rows={4}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 dark:border-slate-750 dark:bg-slate-950 dark:text-white rounded-xl text-xs font-sans outline-none focus:ring-1 focus:ring-emerald-500 font-medium leading-relaxed"
                    placeholder="সদস্যরা তাদের ড্যাশবোর্ডে কি নোটিশ দেখতে পাবে তা এখানে লিখুন..."
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">* এই নোটিশটি শুধুমাত্র সাধারণ 'সদস্য' (Members) ড্যাশবোর্ডে দেখতে পাবে।</p>
                </div>

                {/* Shareholder Notice */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">📢 শুধুমাত্র 'শেয়ার হোল্ডারদের' জন্য নোটিশ (Notice for Shareholders)</label>
                  <textarea
                    value={shareholderNoticeText}
                    onChange={(e) => setShareholderNoticeText(e.target.value)}
                    rows={4}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 dark:border-slate-750 dark:bg-slate-950 dark:text-white rounded-xl text-xs font-sans outline-none focus:ring-1 focus:ring-emerald-500 font-medium leading-relaxed"
                    placeholder="শেয়ার হোল্ডাররা তাদের ড্যাশবোর্ডে কি নোটিশ দেখতে পাবে তা এখানে লিখুন..."
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">* এই নোটিশটি শুধুমাত্র 'মালিক/শেয়ারহোল্ডার' (Owners) ড্যাশবোর্ডে দেখতে পাবে।</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-rose-600 dark:text-rose-450 mb-1">⚠️ সাধারণ সবার জন্য জরুরি অ্যালার্ট নোটিশ (General Notice)</label>
              <textarea
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                rows={2}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 dark:border-slate-750 dark:bg-slate-950 dark:text-white rounded-xl text-xs font-sans outline-none focus:ring-1 focus:ring-emerald-500 font-medium leading-relaxed"
                placeholder="সবার জন্য সাধারণ স্থগিত নোটিশ এখানে লিখুন..."
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">* এই নোটিশটি সকল গ্রাহক ও অংশীদারদের লগইন পরবর্তী মূল ড্যাশবোর্ডে জরুরি অ্যালার্ট আকারে প্রচারিত হবে।</p>
            </div>
          </div>

          {/* Form Action save control */}
          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-850 disabled:bg-emerald-450 dark:active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-[0.98]"
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin text-white" /> : <Save className="h-4 w-4 text-white" />}
              {isSaving ? 'সংরক্ষণ করা হচ্ছে...' : 'সেটিংস সেভ করুন (Save Changes)'}
            </button>
          </div>
        </form>
      </div>

      {/* Row 2: Trash and Database backups */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Recycle Bin column - takes 2/3 width */}
        <div className="bg-white md:col-span-2 rounded-2xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800 overflow-hidden flex flex-col text-left">
          <div className="p-4 border-b border-slate-100 dark:border-slate-850 bg-rose-50/40 dark:bg-rose-950/10 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-705 dark:text-slate-200 flex items-center gap-1.5">
              <Trash2 className="h-4.5 w-4.5 text-rose-500" />
              রিসাইকেল বিন (Deleted Items Trash)
            </h3>
            {trash.length > 0 && (
              <button
                onClick={handleClearTrashClick}
                className="text-xs font-bold text-rose-600 hover:text-rose-850 dark:text-rose-400 dark:hover:text-rose-305 hover:underline cursor-pointer"
              >
                বিন খালি করুন
              </button>
            )}
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-b border-slate-100 dark:border-slate-850">
                  <th className="p-3">ধরণ (Type)</th>
                  <th className="p-3">বিবরণ / অবজেক্ট</th>
                  <th className="p-3">ডিলিটের সময়</th>
                  <th className="p-3 text-center">পুনরুদ্ধার</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {trash.length > 0 ? (
                  trash.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30">
                      <td className="p-3 capitalize font-semibold">
                        <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded text-[10px] text-rose-650 dark:text-rose-300">
                          {item.type === 'member' ? 'সদস্য' : item.type === 'installment' ? 'কিস্তি' : 'ঋণ ফাইল'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="max-w-xs block truncate text-slate-800 dark:text-slate-205 font-sans">
                          {item.description}
                        </div>
                      </td>
                      <td className="p-3 text-slate-550 dark:text-slate-400 font-mono">{item.deletedAt}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onRestore(item.id)}
                            className="inline-flex items-center gap-1 p-1 px-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-850 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/80 text-[11px] rounded font-bold border border-emerald-150 dark:border-emerald-900 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            রিস্টোর
                          </button>
                          {onDeleteTrashPermanently && (
                            <button
                              onClick={() => {
                                showConfirm(
                                  'স্থায়ীভাবে মুছে ফেলা',
                                  'আপনি কি নিশ্চিত এই তথ্যটি স্থায়ীভাবে মুছে ফেলতে চান? এটি আর কোনোভাবেই উদ্ধার করা সম্ভব হবে না।',
                                  () => onDeleteTrashPermanently(item.id)
                                );
                              }}
                              className="inline-flex items-center gap-1 p-1 px-2 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-[11px] rounded border border-rose-150 dark:border-rose-900 cursor-pointer"
                              title="স্থায়ীভাবে মুছুন"
                            >
                              মুছুন
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-slate-400 dark:text-slate-500 font-sans">
                      রিসাইকেল বিন খালি রয়েছে। কোনো ডিলিটকৃত তথ্য নেই।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Backup export control column - takes 1/3 width */}
        <div className="space-y-6 text-left">
          {/* Backup Action card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <Database className="h-4.5 w-4.5 text-sky-600" />
              ডাটা ব্যাকআপ ও অফলাইন সিঙ্ক
            </h3>
            
            <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed font-sans">
              ইন্টারনেট সংযোগ না থাকলেও আপনার সকল ডাটা লোকাল ব্রাউজারে সুরক্ষিত রয়েছে। ডাটা হারানোর আজীবন ঝুঁকি এড়াতে প্রতি সপ্তাহে ব্যাকআপ ফাইল ডাউনলোড করে গুগল ড্রাইভে বা মেমোরিতে সংরক্ষণ করুন।
            </p>

            <button
              onClick={handleDownloadBackup}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              ব্যাকআপ ডাউনলোড (JSON Exporter)
            </button>
          </div>

          {/* Restore Action card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-505 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2.5">
              ব্যাকআপ রিস্টোর করুন
            </h3>
            
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              পূর্বে ডাউনলোডকৃত অফিস ব্যাকআপ ফাইল নির্বাচন করে পুনরায় ডাটাবেজ লোড করুন। সতর্কতা: অরিজিনাল ডাটা ওভাররাইট হয়ে যাবে।
            </p>

            <div>
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleUploadBackup}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-750 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-850 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                ফাইল আপলোড করুন (Upload JSON)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Dialog/Modal system (Bypasses iFrame sandboxed constraints beautifully) */}
      {dialog && dialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] text-left">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800 text-slate-805 dark:text-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-2xl ${dialog.type === 'confirm' ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'}`}>
                {dialog.type === 'confirm' ? (
                  <ShieldAlert className="h-6 w-6 shrink-0" />
                ) : (
                  <AlertCircle className="h-6 w-6 shrink-0" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{dialog.title}</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{dialog.type === 'confirm' ? 'অনুমতি নিশ্চিতকরণ খাতা' : 'গুরুত্বপূর্ণ সতর্কতা সিগন্যাল'}</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed mb-6 font-sans">
              {dialog.message}
            </p>

            <div className="flex justify-end gap-2 text-xs">
              {dialog.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => setDialog(null)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 lg:hover:bg-slate-200 dark:lg:hover:bg-slate-700 text-slate-705 dark:text-slate-300 font-bold rounded-xl transition-all cursor-pointer"
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
