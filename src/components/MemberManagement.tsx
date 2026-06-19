import React, { useState, useRef } from 'react';
import { Member, TrashLog, PinRequest } from '../types';
import { Search, UserPlus, FileEdit, Trash2, CreditCard, Check, X, ShieldAlert, Phone, MapPin, Calendar, Heart, Camera, UploadCloud, RefreshCw, AlertCircle, Download, KeyRound } from 'lucide-react';
import { downloadPdf } from '../utils/pdfHelper';

interface MemberManagementProps {
  members: Member[];
  onAddMember: (newMember: Member) => void;
  onUpdateMember: (updatedMember: Member) => void;
  onDeleteMember: (id: string) => void;
  role: 'admin' | 'owner' | 'member';
  pinRequests?: PinRequest[];
  onResolvePinRequest?: (reqId: string, newPin: string, memberId?: string) => void;
}

export default function MemberManagement({ members, onAddMember, onUpdateMember, onDeleteMember, role, pinRequests = [], onResolvePinRequest }: MemberManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMemberIDCard, setSelectedMemberIDCard] = useState<Member | null>(null);

  // Beautiful interactive modal dialog states for iframe compatibility
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

  // PIN resolution states
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
  const [newGeneratedPin, setNewGeneratedPin] = useState('');

  // Form Fields
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [nid, setNid] = useState('');
  const [type, setType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [targetAmount, setTargetAmount] = useState('0');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [photoUrl, setPhotoUrl] = useState('');
  const [memberCategory, setMemberCategory] = useState<'savings_only' | 'borrower' | 'percent_member' | 'percent_borrower'>('savings_only');

  // List filter state
  const [listCategory, setListCategory] = useState<'all' | 'savings_only' | 'borrower' | 'percent_member' | 'percent_or_loan'>('savings_only');

  // Camera & Upload auxiliary states
  const [showWebcam, setShowWebcam] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Search filter with category tabs & safe fallbacks for manually created/modified DB docs
  const filteredMembers = members.filter(m => {
    const memberName = m?.name || '';
    const memberPhone = m?.phone || '';
    const memberId = m?.id || '';
    
    // Check if category matches
    if (listCategory !== 'all') {
      const cat = m.memberCategory || 'borrower';
      if (listCategory === 'percent_or_loan') {
        if (cat !== 'percent_member' && cat !== 'percent_borrower' && cat !== 'borrower') return false;
      } else {
        if (cat !== listCategory) return false;
      }
    }

    return (
      memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memberPhone.includes(searchTerm) ||
      memberId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const resetForm = () => {
    setId('');
    setName('');
    setPhone('');
    setAddress('');
    setNid('');
    setType('weekly');
    setTargetAmount('0');
    setPin('');
    setStatus('active');
    setPhotoUrl('');
    setMemberCategory('savings_only');
    setEditingId(null);
    stopWebcam();
  };

  const triggerResolvePin = (reqId: string) => {
    setResolvingRequestId(reqId);
    // Generate a random 4 digit PIN as a suggestion
    const rPin = Math.floor(1000 + Math.random() * 9000).toString();
    setNewGeneratedPin(rPin);
  };

  const submitResolvePin = () => {
    if (!newGeneratedPin || newGeneratedPin.length < 4) {
      showAlert('ভুল পিন!', 'পিন অবশ্যই ৪-৬ ডিজিটের হতে হবে!');
      return;
    }
    if (onResolvePinRequest && resolvingRequestId) {
      onResolvePinRequest(resolvingRequestId, newGeneratedPin);
      setResolvingRequestId(null);
      setNewGeneratedPin('');
    }
  };

  const startAddMode = () => {
    resetForm();
    // Auto-generate next logical Member ID
    const maxNum = members.reduce((max, m) => {
      const match = m.id.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        return num > max ? num : max;
      }
      return max;
    }, 100);
    setId(`SMS-${maxNum + 1}`);
    setIsAdding(true);
  };

  const handleEditClick = (m: Member) => {
    if (role !== 'admin') {
      showAlert('অ্যাক্সেস ডিনাইড!', 'সদস্য এডিট করার অনুমতি শুধু পরিচালকের রয়েছে!');
      return;
    }
    setId(m.id);
    setName(m.name);
    setPhone(m.phone);
    setAddress(m.address);
    setNid(m.nid);
    setType(m.type);
    setTargetAmount(m.targetInstallmentAmount.toString());
    setPin(m.pin);
    setStatus(m.status);
    setPhotoUrl(m.photoUrl || '');
    setMemberCategory(m.memberCategory || 'borrower');
    setEditingId(m.id);
    setIsAdding(true);
  };

  const startWebcam = async () => {
    setWebcamError(null);
    setShowWebcam(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Webcam start failed:", err);
      setWebcamError("ক্যামেরা চালু করতে সমস্যা হয়েছে! ব্রাউজার অনুমতি চেক করুন বা ফাইল আপলোড অপশনটি ব্যবহার করুন।");
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowWebcam(false);
    setWebcamError(null);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 150;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const video = videoRef.current;
        const size = Math.min(video.videoWidth, video.videoHeight);
        const xOffset = (video.videoWidth - size) / 2;
        const yOffset = (video.videoHeight - size) / 2;
        
        ctx.drawImage(video, xOffset, yOffset, size, size, 0, 0, 150, 150);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoUrl(dataUrl);
        stopWebcam();
      }
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setPhotoUrl(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !nid.trim() || !pin.trim()) {
      showAlert('অসম্পূর্ণ ফরম!', 'দয়া করে সব আবশ্যক ক্ষেত্রগুলো পূরণ করুন!');
      return;
    }

    const memberData: Member = {
      id,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim() || 'উল্লেখ নেই',
      nid: nid.trim(),
      photoUrl: photoUrl || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`, // fallback cute profile
      joinDate: new Date().toISOString().split('T')[0],
      type,
      targetInstallmentAmount: parseFloat(targetAmount) || 0,
      status,
      pin: pin.trim().slice(0, 4),
      memberCategory
    };

    if (editingId) {
      onUpdateMember(memberData);
    } else {
      // Check duplicate phone or NID
      if (members.some(m => m.id === id)) {
        showAlert('ডুপ্লিকেট আইডি!', 'এই সদস্য আইডি ইতিমধ্যে নিবন্ধিত!');
        return;
      }
      onAddMember(memberData);
    }
    setIsAdding(false);
    resetForm();
  };

  const handleDeleteClick = (mid: string, mName: string) => {
    if (role !== 'admin') {
      showAlert('অ্যাক্সেস ডিনাইড!', 'সদস্য ডিলিট করার অনুমতি শুধু পরিচালকের রয়েছে!');
      return;
    }
    showConfirm(
      'সদস্য ডিলিট নিশ্চিতকরণ',
      `আপনি কি নিশ্চিতভাবে সদস্য "${mName}" ডিলিট করতে চান? এটি রি-সাইকেল বিন ডিরেক্টরিতে জমা হবে।`,
      () => onDeleteMember(mid)
    );
  };

  return (
    <div className="space-y-6">
      {/* Top action block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800">সদস্য ব্যবস্থাপনা প্যানেল</h2>
          <p className="text-xs text-slate-500 mt-1">সমিতির নিবন্ধিত গ্রাহকদের তালিকা নিয়ন্ত্রণ, নতুন ডাটা সংযোগ ও আইডিকার্ড প্রিন্ট।</p>
        </div>
        {role === 'admin' && !isAdding && (
          <button
            onClick={startAddMode}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow transition-all duration-200"
          >
            <UserPlus className="h-4 w-4" />
            নতুন সদস্য যোগ করুন
          </button>
        )}
      </div>

      {isAdding ? (
        /* Member Add/Edit Form */
        <div className="bg-white p-6 rounded-2xl shadow border border-slate-100 max-w-2xl mx-auto">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              {editingId ? 'সদস্যের তথ্য সংশোধন করুন' : 'নতুন সদস্য নিবন্ধন ফরম'}
            </h3>
            <button onClick={() => { setIsAdding(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Profile Photo Upload and Webcam Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
              <span className="text-xs font-semibold text-slate-700">সদস্যের প্রোফাইল ছবি আপলোড</span>
              
              <div className="relative">
                <div className="w-24 h-24 rounded-full border border-white shadow bg-white overflow-hidden flex items-center justify-center ring-4 ring-emerald-500/20">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Camera className="h-8 w-8 text-slate-350" />
                      <span className="text-[10px] mt-1 font-sans">ছবি নেই</span>
                    </div>
                  )}
                </div>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    title="ছবি মুছে ফেলুন"
                    className="absolute -top-1 -right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md transition-all cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Upload & Webcam Controls */}
              {!showWebcam ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <label className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all select-none">
                    <UploadCloud className="h-3.5 w-3.5 text-slate-450" />
                    মোবাইল/কম্পিউটার ফাইল
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    type="button"
                    onClick={startWebcam}
                    className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    ক্যামেরা দিয়ে তুলুন
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-sm bg-black rounded-lg overflow-hidden p-2 relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-48 bg-slate-900 rounded-lg object-cover transform -scale-x-100"
                  />
                  {webcamError ? (
                    <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center text-slate-200 text-[11px] space-y-2">
                      <AlertCircle className="h-5 w-5 text-rose-500 animate-pulse" />
                      <p>{webcamError}</p>
                      <button
                        type="button"
                        onClick={stopWebcam}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-white cursor-pointer text-xs"
                      >
                        বন্ধ করুন
                      </button>
                    </div>
                  ) : (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-2.5 shadow-lg flex items-center justify-center cursor-pointer"
                        title="ছবি তুলুন"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={stopWebcam}
                        className="bg-rose-600 hover:bg-rose-700 text-white rounded-full p-2.5 shadow-lg flex items-center justify-center cursor-pointer"
                        title="বন্ধ করুন"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-slate-400 font-sans">
                * ডাটা সঞ্চয় সীমা বজায় রাখার জন্য আপনার ছবি স্বয়ংক্রিয়ভাবে সংকুচিত ও রিসাইজ করা হবে।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">সদস্য আইডি (ID) *</label>
                <input
                  type="text"
                  required
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  readOnly={!!editingId}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">সদস্যের পুরো নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মোঃ রাজিব আহমেদ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">মোবাইল নম্বর *</label>
                <input
                  type="tel"
                  required
                  placeholder="যেমন: 017xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">জাতীয় পরিচয়পত্র নম্বর (NID) *</label>
                <input
                  type="number"
                  required
                  placeholder="যেমন: ৫৪২৩১৬৭৮৯৪৫"
                  value={nid}
                  onChange={(e) => setNid(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">সদস্য লগইন পিন (PIN) *</label>
                <input
                  type="password"
                  required
                  maxLength={4}
                  placeholder="৪ ডিজিটের পিন (যেমন: ১২৩৪)"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">স্ট্যাটাস (Status)</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                >
                  <option value="active">সক্রিয় সদস্য (Active)</option>
                  <option value="inactive">নিষ্ক্রিয় সদস্য (Inactive)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">সদস্যের বিভাগ (Category) *</label>
                <select
                  value={memberCategory}
                  onChange={(e) => setMemberCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-lg text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                >
                  <option value="savings_only">🏠 শুধুমাত্র সঞ্চয়কারী সদস্য (Savings Only)</option>
                  <option value="borrower">💼 ঋণগ্রহীতা সদস্য (Borrower)</option>
                  <option value="percent_member">📈 পারসেন্ট সদস্য (Percent Member)</option>
                  <option value="percent_borrower">📊 পারসেন্ট ও লোন গ্রাহক (Percent & Loan Member)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">সঞ্চয় বা কিস্তির প্রকার (Type) *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                >
                  <option value="daily">দৈনিক সঞ্চয়/কিস্তি (Daily)</option>
                  <option value="weekly">সাপ্তাহিক সঞ্চয়/কিস্তি (Weekly)</option>
                  <option value="monthly">মাসিক সঞ্চয়/কিস্তি (Monthly)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">বর্তমান ঠিকানা</label>
              <textarea
                rows={2}
                placeholder="সদস্যের পূর্ণ ঠিকানা লিখুন"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setIsAdding(false); resetForm(); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                বাতিল করুন
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 lg:hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                {editingId ? 'তথ্য সংরক্ষণ' : 'নিবন্ধন সম্পন্ন'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Member List View Wrapper */
        <div className="space-y-6">
          {/* Active PIN Reset Requests (Admin/Owner control) */}
          {role !== 'member' && pinRequests.filter(r => r.status === 'pending').length > 0 && (
            <div className="bg-rose-50/70 border border-rose-350 bg-rose-50/20 dark:bg-rose-950/10 rounded-2xl p-4 md:p-6 text-left shadow-sm">
              <h3 className="text-sm font-extrabold text-rose-950 dark:text-rose-200 flex items-center gap-2 mb-3">
                <KeyRound className="h-4.5 w-4.5 text-rose-600 animate-bounce" />
                সদস্যদের পিন রিসেট অনুরোধ সংকেত ({pinRequests.filter(r => r.status === 'pending').length})
              </h3>
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-normal mb-4 font-sans">
                সদস্যরা পিন ভুলে যাওয়ায় বা সিকিউরিটি সমস্যার কারণে এই অনুরোধগুলো পাঠিয়েছেন। পিন রি-জেনারেট বা রিসেট করে দিন।
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinRequests.filter(r => r.status === 'pending').map((req) => (
                  <div key={req.id} className="bg-white border border-rose-250 p-4 rounded-xl flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="text-xs font-extrabold text-slate-900">{req.name}</h4>
                        <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">আবেদন পেন্ডিং</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1.5 font-mono">মোবাইল: {req.phone}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-sans">সময়: {new Date(req.requestedAt).toLocaleString('bn-BD')}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                      <button
                        onClick={() => triggerResolvePin(req.id)}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded transition-colors cursor-pointer text-center"
                      >
                        নতুন পিন সেট করুন
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Resolve PIN Popup Modal */}
          {resolvingRequestId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
              <div className="bg-white border border-slate-205 rounded-3xl p-6 w-full max-w-sm text-left shadow-2xl relative animate-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => setResolvingRequestId(null)}
                  className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mb-2 font-sans">
                  <KeyRound className="h-5 w-5 text-emerald-600" />
                  নতুন পিন নিশ্চিত করুন
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  আবেদনকারীর জন্য একটি ৪-৬ ডিজিটের পিন নম্বর লিখুন। "নিশ্চিত করুন" বাটনে চাপ দিলে সরাসরি ডাটাবেজে পিন পরিবর্তন হয়ে যাবে।
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">প্রস্তাবিত নতুন পিন (৪-৬ ডিজিট)</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={newGeneratedPin}
                      onChange={(e) => setNewGeneratedPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center font-mono font-bold tracking-widest outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setResolvingRequestId(null)}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded transition-colors"
                    >
                      বাতিল
                    </button>
                    <button
                      type="button"
                      onClick={submitResolvePin}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors"
                    >
                      নিশ্চিত করুন ➔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Search Table Block */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative max-w-sm w-full">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="সদস্য খুঁজুন (নাম, আইডি বা মোবাইল নং)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="text-xs text-slate-500">
                মোট নিবন্ধিত সদস্য: <span className="font-bold text-slate-800 font-mono">{filteredMembers.length}</span> জন
              </div>
            </div>

            {/* Category Tabs Block ("ঘর আলাদা হবে") */}
            <div className="flex border-b border-slate-100 bg-slate-50/30 px-4 pt-1 flex-wrap gap-2 md:gap-0 font-sans">
              <button
                type="button"
                onClick={() => setListCategory('savings_only')}
                className={`pb-3 pt-2 px-3 text-xs font-bold border-b-2 transition-all relative flex items-center gap-1.5 cursor-pointer ${
                  listCategory === 'savings_only'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>🏠 শুধুমাত্র সঞ্চয়কারী</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black ${
                  listCategory === 'savings_only' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-150 text-slate-600'
                }`}>{members.filter(m => m.memberCategory === 'savings_only').length}</span>
              </button>

              <button
                type="button"
                onClick={() => setListCategory('borrower')}
                className={`pb-3 pt-2 px-3 text-xs font-bold border-b-2 transition-all relative flex items-center gap-1.5 cursor-pointer ${
                  listCategory === 'borrower'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>💼 ঋণগ্রহীতা সদস্য</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black ${
                  listCategory === 'borrower' ? 'bg-blue-100 text-blue-800' : 'bg-slate-150 text-slate-600'
                }`}>{members.filter(m => (m.memberCategory || 'borrower') === 'borrower').length}</span>
              </button>

              <button
                type="button"
                onClick={() => setListCategory('percent_member')}
                className={`pb-3 pt-2 px-3 text-xs font-bold border-b-2 transition-all relative flex items-center gap-1.5 cursor-pointer ${
                  listCategory === 'percent_member'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>📈 পারসেন্ট সদস্য</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black ${
                  listCategory === 'percent_member' ? 'bg-teal-100 text-teal-800' : 'bg-slate-150 text-slate-600'
                }`}>{members.filter(m => m.memberCategory === 'percent_member').length}</span>
              </button>

              <button
                type="button"
                onClick={() => setListCategory('percent_or_loan')}
                className={`pb-3 pt-2 px-4 text-xs font-bold border-b-2 transition-all relative flex items-center gap-1.5 cursor-pointer ${
                  listCategory === 'percent_or_loan'
                    ? 'border-purple-600 text-purple-700 bg-purple-50/45 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="animate-pulse">📂</span>
                  <span>পারসেন্ট ও লোন সদস্য ফোল্ডার</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black ${
                  listCategory === 'percent_or_loan' ? 'bg-purple-100 text-purple-800 animate-pulse' : 'bg-slate-150 text-slate-600'
                }`}>{members.filter(m => {
                  const cat = m.memberCategory || 'borrower';
                  return cat === 'percent_member' || cat === 'percent_borrower' || cat === 'borrower';
                }).length}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/50 text-slate-600 font-medium border-b border-slate-200">
                    <th className="p-4 w-16 text-center">সিরিয়াল নং</th>
                    <th className="p-4">সদস্য আইডি</th>
                    <th className="p-4">সদস্য পরিচিতি</th>
                    <th className="p-4">যোগাযোগ</th>
                    <th className="p-4">কিস্তির ধরন ও টার্গেট</th>
                    <th className="p-4">সদস্য বিভাগ</th>
                    <th className="p-4">অবস্থা (Status)</th>
                    {role === 'admin' && <th className="p-4 text-center">নিয়ন্ত্রণ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((m, index) => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 w-16 text-center text-slate-500 font-semibold font-mono">{index + 1}</td>
                        <td className="p-4 font-mono font-bold text-slate-900">{m.id}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {m.photoUrl ? (
                                <img src={m.photoUrl} alt="Photo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="text-slate-500 font-semibold">{m.name.slice(0,2)}</div>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800 text-sm">{m.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">NID: {m.nid}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 space-y-1">
                          <div className="flex items-center gap-1 text-slate-600 font-mono text-[11px]">
                            <Phone className="h-3 w-3 text-slate-400" /> {m.phone}
                          </div>
                          <div className="flex items-center gap-1 text-slate-500 max-w-xs truncate">
                            <MapPin className="h-3 w-3 text-slate-400" /> {m.address}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              m.type === 'daily' ? 'bg-amber-100 text-amber-800' :
                              m.type === 'weekly' ? 'bg-teal-100 text-teal-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {m.type === 'daily' ? 'দৈনিক' : m.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'}
                            </span>
                            <div className="font-mono text-slate-900 font-semibold">{m.targetInstallmentAmount} ৳</div>
                          </div>
                        </td>
                        <td className="p-4 font-sans">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                            m.memberCategory === 'savings_only'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                              : m.memberCategory === 'percent_member'
                              ? 'bg-teal-50 text-teal-750 border border-teal-150'
                              : m.memberCategory === 'percent_borrower'
                              ? 'bg-purple-50 text-purple-750 border border-purple-150'
                              : 'bg-blue-50 text-blue-700 border border-blue-150'
                          }`}>
                            {m.memberCategory === 'savings_only' ? 'শুধুমাত্র সঞ্চয়কারী' :
                             m.memberCategory === 'percent_member' ? 'পারসেন্ট সদস্য' :
                             m.memberCategory === 'percent_borrower' ? 'পারসেন্ট ও লোন গ্রাহক' : 'ঋণগ্রহীতা সদস্য'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            m.status === 'active' ? 'bg-emerald-150 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${m.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            {m.status === 'active' ? 'চলমান' : 'নিষ্ক্রিয়'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedMemberIDCard(m)}
                              title="আইডি কার্ড প্রিন্ট"
                              className="p-1 px-1.5 bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 rounded flex items-center gap-1 cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              কার্ড
                            </button>
                            {role === 'admin' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(m)}
                                  className="p-1.5 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 rounded transition-all cursor-pointer"
                                >
                                  <FileEdit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(m.id, m.name)}
                                  className="p-1.5 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 rounded transition-all cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center p-8 text-slate-400 font-sans">
                        কোনো সদস্য পাওয়া যায়নি।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Member Digital ID Card Modal */}
      {selectedMemberIDCard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full relative border border-slate-100 animate-in fade-in zoom-in duration-300">
            <button
              onClick={() => setSelectedMemberIDCard(null)}
              className="absolute top-4 right-4 text-slate-400 lg:hover:text-slate-600 p-1 rounded-full bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-4 lg:mb-5">
              <h3 className="text-sm font-extrabold text-slate-700 tracking-wider">স্মার্ট সদস্য আইডি কার্ড</h3>
              <p className="text-[10px] text-slate-400">সমিতি পকেট ভেরিফিকেশন কন্সোল</p>
            </div>

            {/* Printable Frame Area */}
            <div id="printable-id-card" className="w-full bg-gradient-to-br from-emerald-700 to-emerald-900 text-white rounded-2xl overflow-hidden shadow-lg border border-emerald-500 relative">
              
              {/* Card Header Decors */}
              <div className="p-4 pb-2 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h4 className="text-xs font-bold font-sans">ক্ষুদ্র সঞ্চয় সমিতি</h4>
                  <p className="text-[7px] text-emerald-250 font-sans">বাংলাদেশ ক্ষুদ্র সঞ্চয় প্রকল্প অনুমোদিত</p>
                </div>
                <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/30 rounded text-[8px] font-bold border border-emerald-400/30">
                  <Check className="h-2 w-2 text-emerald-300" />
                  সদস্য
                </div>
              </div>

              {/* Card Content body */}
              <div className="p-4 flex gap-4">
                {/* Photo & ID Box */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className="w-16 h-16 rounded-lg ring-2 ring-white/20 bg-emerald-850 overflow-hidden flex items-center justify-center">
                    {selectedMemberIDCard.photoUrl ? (
                      <img src={selectedMemberIDCard.photoUrl} alt="M" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold">{selectedMemberIDCard.name.slice(0,2)}</span>
                    )}
                  </div>
                  <span className="font-mono text-[9px] bg-slate-900/30 px-1 py-0.5 rounded tracking-wide font-semibold text-emerald-200">
                    {selectedMemberIDCard.id}
                  </span>
                </div>

                {/* Details list */}
                <div className="text-left space-y-1.5 text-[10px] font-sans flex-1">
                  <div>
                    <span className="text-emerald-250 text-[8px] block">সদস্যের নাম:</span>
                    <strong className="text-white text-xs">{selectedMemberIDCard.name}</strong>
                  </div>
                  <div>
                    <span className="text-emerald-250 text-[8px] block">যোগাযোগ নং:</span>
                    <strong className="font-mono">{selectedMemberIDCard.phone}</strong>
                  </div>
                  <div>
                    <span className="text-emerald-250 text-[8px] block">জাতীয় পরিচয় নং:</span>
                    <strong className="font-mono">{selectedMemberIDCard.nid}</strong>
                  </div>
                </div>
              </div>

              {/* ID Barcode / Signature Strip */}
              <div className="px-4 py-3 bg-slate-955 text-[8px] border-t border-white/5 flex justify-between items-end bg-emerald-950/60">
                <div className="space-y-1">
                  {/* Barcode Simulator using CSS */}
                  <div className="flex gap-0.5 h-6 bg-white p-1 rounded items-center">
                    {[1,3,2,1,2,4,1,3,1,2,3,1,2,1,4,1,2].map((w, idx) => (
                      <span key={idx} className="bg-slate-900 h-full inline-block" style={{ width: `${w}px` }}></span>
                    ))}
                  </div>
                  <span className="font-mono text-[6px] tracking-widest text-slate-400 block">{selectedMemberIDCard.nid}</span>
                </div>

                <div className="text-right space-y-1">
                  <div className="w-16 border-b border-white/50 text-[7px] italic text-emerald-300 font-mono text-center leading-none">
                    Mizanur
                  </div>
                  <span className="text-[7.5px] text-emerald-200 block text-center">পরিচালকের স্বাক্ষর</span>
                </div>
              </div>
            </div>

            {/* Downloader Trigger block */}
            <div className="mt-5 grid grid-cols-3 gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => downloadPdf('printable-id-card', `সদস্য-কার্ড-${selectedMemberIDCard?.id || 'আইডি'}`, 'সদস্য পরিচিতি আইডি কার্ড')}
                className="py-2.5 px-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow flex items-center justify-center gap-1 cursor-pointer transition-all hover:scale-95 text-center"
              >
                <Download className="h-3 w-3 shrink-0" />
                ডাউনলোড PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  const printContents = document.getElementById('printable-id-card')?.outerHTML;
                  if (printContents) {
                    const printWindow = window.open('', '_blank');
                    printWindow?.document.write(`
                      <html>
                        <head>
                          <title>ID CARD PRINT</title>
                          <script src="https://cdn.tailwindcss.com"></script>
                        </head>
                        <body class="flex items-center justify-center min-h-screen bg-slate-50">
                          <div class="scale-125">${printContents}</div>
                          <script>window.print();</script>
                        </body>
                      </html>
                    `);
                    printWindow?.document.close();
                  }
                }}
                className="py-2.5 px-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow flex items-center justify-center gap-1 cursor-pointer transition-all hover:scale-95 text-center"
              >
                প্রিন্ট করুন
              </button>
              <button
                type="button"
                onClick={() => setSelectedMemberIDCard(null)}
                className="py-2.5 px-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 text-center cursor-pointer transition-all hover:scale-95"
              >
                বন্ধ করুন
              </button>
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
