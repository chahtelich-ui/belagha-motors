import React, { useState, useEffect, useRef } from 'react';

const initialFleet = [
  { id: "car_1", brand: "Rover", model: "XPHWEP", year: 1993, plateNumber: "03813-193-25", currentMileage: 156200, status: "available", insuranceExpiryDate: "2026-08-15", oilChangeMileage: 160000, technicalControlDate: "2026-09-20" },
  { id: "car_2", brand: "Hyundai", model: "i10", year: 2022, plateNumber: "12345-122-25", currentMileage: 49500, status: "available", insuranceExpiryDate: "2026-06-01", oilChangeMileage: 55000, technicalControlDate: "2026-11-15" },
  { id: "car_3", brand: "PEUGEOT", model: "2024", year: 2024, plateNumber: "2102-124-25", currentMileage: 135200, status: "available", insuranceExpiryDate: "2026-12-30", oilChangeMileage: 140000, technicalControlDate: "2027-02-10" }
];

export default function App() {
  const [fleet, setFleet] = useState(initialFleet);
  const [activeTab, setActiveTab] = useState('new-contract');
  const [showAddCarForm, setShowAddCarForm] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [cameraMode, setCameraMode] = useState(null);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('belagha_openrouter_secure_key') || '');
  const [showKeyStatus, setShowKeyStatus] = useState(false);

  const [editingCarId, setEditingCarId] = useState(null);
  const [editMileage, setEditMileage] = useState('');
  const [editInsuranceDate, setEditInsuranceDate] = useState('');
  const [editOilMileage, setEditOilMileage] = useState('');
  const [editTechControlDate, setEditTechControlDate] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  // مراجع لحقول رفع الملفات للتحكم بها برمجياً (تخطي مشاكل الـ iPad)
  const tenantFileInputRef = useRef(null);
  const licenseFileInputRef = useRef(null);

  const [tenantPhoto, setTenantPhoto] = useState(null);
  const [licensePhoto, setLicensePhoto] = useState(null);

  const [newCarForm, setNewCarForm] = useState({ brand: '', model: '', year: 2026, plateNumber: '', currentMileage: '', insuranceExpiryDate: '2026-12-31', oilChangeMileage: '', technicalControlDate: '2026-12-31' });
  const [contractForm, setContractForm] = useState({
    tenantName: '', tenantPhone: '', licenseNumber: '', birthDatePlace: '',
    licenseIssueDate: '', tenantAddress: 'ali mendjli', selectedCarId: '',
    startDate: '', endDate: '', pricePerDay: 6000, caution: 50000, fuelStatus: 'ربع خزان'
  });

  const [calculatedDays, setCalculatedDays] = useState(0);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [printedContract, setPrintedContract] = useState(null);

  const handleApiKeyChange = (value) => {
    setApiKey(value);
    localStorage.setItem('belagha_openrouter_secure_key', value);
    setShowKeyStatus(true);
    setTimeout(() => setShowKeyStatus(false), 2500);
  };

  useEffect(() => {
    if (contractForm.startDate && contractForm.endDate) {
      const start = new Date(contractForm.startDate);
      const end = new Date(contractForm.endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
      
      setCalculatedDays(diffDays > 0 ? diffDays : 1);
      setCalculatedTotal((diffDays > 0 ? diffDays : 1) * Number(contractForm.pricePerDay || 0));
    } else {
      setCalculatedDays(0);
      setCalculatedTotal(0);
    }
  }, [contractForm.startDate, contractForm.endDate, contractForm.pricePerDay]);

  const handleAddCarSubmit = (e) => {
    e.preventDefault();
    const addedCar = { id: "car_" + Date.now(), ...newCarForm, currentMileage: Number(newCarForm.currentMileage), oilChangeMileage: Number(newCarForm.oilChangeMileage), status: "available" };
    setFleet([...fleet, addedCar]);
    setShowAddCarForm(false);
  };

  const startEditingCar = (car) => {
    setEditingCarId(car.id);
    setEditMileage(car.currentMileage);
    setEditInsuranceDate(car.insuranceExpiryDate || '');
    setEditOilMileage(car.oilChangeMileage || '');
    setEditTechControlDate(car.technicalControlDate || '');
  };

  const saveCarEdits = (id) => {
    setFleet(fleet.map(car => car.id === id ? { 
      ...car, currentMileage: Number(editMileage), insuranceExpiryDate: editInsuranceDate, oilChangeMileage: Number(editOilMileage), technicalControlDate: editTechControlDate 
    } : car));
    setEditingCarId(null);
  };

  const toggleCarStatus = (id) => setFleet(fleet.map(car => car.id === id ? { ...car, status: car.status === 'available' ? 'rented' : 'available' } : car));

  // فتح الكاميرا ببروتوكول آمن
  const startCamera = async (mode) => {
    setCameraMode(mode);
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode === 'tenant' ? "user" : "environment" } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // ضروري جداً لـ iOS
        videoRef.current.play();
      }
    } catch (err) {
      alert("⚠️ تعذر تشغيل الكاميرا. تأكد من إعطاء الصلاحيات وأن الموقع يعمل برابط آمن (HTTPS).");
      setCameraMode(null);
    }
  };

  const processAndCompressImage = (dataUrl, callback) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1000;
      let width = img.width, height = img.height;
      if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.6)); 
    };
    img.src = dataUrl;
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640; canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataUrl('image/jpeg', 0.85);

    if (cameraMode === 'tenant') setTenantPhoto(dataUrl);
    if (cameraMode === 'license') processAndCompressImage(dataUrl, (compressed) => { setLicensePhoto(compressed); executePureVisionAI(compressed); });
    
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setCameraMode(null);
  };

  // معالجة رفع الملفات بشكل آمن للـ iPad
  const handleFileUpload = (e, mode) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (mode === 'tenant') setTenantPhoto(reader.result);
      if (mode === 'license') {
         processAndCompressImage(reader.result, (compressed) => { 
           setLicensePhoto(compressed); 
           executePureVisionAI(compressed); 
         });
      }
    };
    reader.readAsDataURL(file);
    // تصفير الحقل ليسمح برفع نفس الملف مرة أخرى
    e.target.value = null; 
  };

  const executePureVisionAI = async (base64Image) => {
    if (!apiKey.trim()) return alert("⚠️ يرجى إدخال مفتاح الذكاء الاصطناعي (API KEY) في أعلى الشاشة أولاً.");
    
    setIsLoadingAI(true);
    setContractForm(prev => ({ ...prev, tenantName: "جاري القراءة السحابية...", licenseNumber: "جاري القراءة...", birthDatePlace: "", licenseIssueDate: "" }));

    try {
      const cleanBase64 = base64Image.split(',')[1];
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "You are an expert OCR. Extract data from this Algerian driver license. Return ONLY a pure JSON object (no markdown, no backticks). Keys must be: tenantName (Latin uppercase), licenseNumber (18 digits), birthDate (DD.MM.YYYY), issueDate (DD.MM.YYYY)." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } }
            ]
          }]
        })
      });

      if (response.status === 402) throw new Error("رصيد مفتاح OpenRouter منتهي. يرجى الشحن.");
      if (!response.ok) throw new Error("فشل الاتصال بالخادم.");

      const result = await response.json();
      const aiResponse = result?.choices?.[0]?.message?.content || "";
      const cleanJson = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(cleanJson);

      setContractForm(prev => ({
        ...prev,
        tenantName: data.tenantName || "",
        licenseNumber: data.licenseNumber || "",
        birthDatePlace: data.birthDate ? `${data.birthDate} قسنطينة` : "",
        licenseIssueDate: data.issueDate ? `صادرة بتاريخ: ${data.issueDate}` : ""
      }));
    } catch (err) {
      console.error(err);
      alert(err.message.includes("رصيد") ? err.message : "⚠️ تعذر استخراج البيانات. تأكد من وضوح الصورة وصلاحية المفتاح.");
      setContractForm(prev => ({ ...prev, tenantName: "", licenseNumber: "", birthDatePlace: "", licenseIssueDate: "" }));
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleOriginalPrintSubmit = (e) => {
    e.preventDefault();
    if (!contractForm.selectedCarId) return alert("يرجى اختيار مركبة أولاً.");
    
    const targetCar = fleet.find(car => car.id === contractForm.selectedCarId);
    const activeDays = calculatedDays || 1;
    const newUpdatedMileage = Number(targetCar.currentMileage) + (activeDays * 250);

    setFleet(fleet.map(car => car.id === contractForm.selectedCarId ? { ...car, currentMileage: newUpdatedMileage, status: 'rented' } : car));

    setPrintedContract({
      ...contractForm, carDetails: { ...targetCar, currentMileage: targetCar.currentMileage },
      days: activeDays, total: calculatedTotal, photo: tenantPhoto,
      dateString: new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR')
    });

    // تأخير آمن للـ iPad لضمان رندرة الصفحات
    setTimeout(() => { 
      window.print(); 
      setPrintedContract(null); 
      setActiveTab('dashboard'); 
    }, 1500);
  };

  const getExpiryBadge = (expiryStr) => {
    if (!expiryStr) return { label: "غير محدد", bg: "#f1f5f9", color: "#64748b" };
    const days = Math.ceil((new Date(expiryStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    if (days < 0) return { label: "منتهي ❌", bg: "#fee2e2", color: "#991b1b" };
    if (days <= 30) return { label: "قريب جداً ⚠️", bg: "#fef3c7", color: "#92400e" };
    return { label: "ساري ✅", bg: "#dcfce7", color: "#166534" };
  };

  const getOilStatusBadge = (current, target) => {
    if (!target) return { label: "غير محدد", bg: "#f1f5f9", color: "#64748b" };
    const remaining = target - current;
    if (remaining <= 0) return { label: "تغيير فوري 🚨", bg: "#fee2e2", color: "#991b1b" };
    if (remaining <= 1000) return { label: `وشيك (${remaining} كم)`, bg: "#fef3c7", color: "#92400e" };
    return { label: `${remaining} كم متبقي`, bg: "#e0f2fe", color: "#0369a1" };
  };

  return (
    <div style={styles.appContainer} dir="rtl">
      
      {/* CSS الطباعة السائل للـ iPad لمنع الصفحات البيضاء */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
        * { font-family: 'Tajawal', sans-serif; box-sizing: border-box; }
        
        @media screen {
          .print-only-layout { display: none !important; }
          .screen-only-layout { display: block !important; }
        }
        
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body, html, #root { background: #fff !important; color: #000 !important; margin: 0 !important; padding: 0 !important; width: 100%; height: 100%; }
          .screen-only-layout, .no-print { display: none !important; }
          .print-only-layout { display: block !important; width: 100%; }
          
          /* إزالة القيود الصارمة عن الصفحات ليتنفس الـ Safari */
          .print-page {
            page-break-after: always !important;
            display: block !important;
            width: 100% !important;
            position: relative !important;
            padding: 10px 20px !important;
            min-height: 250mm;
          }
          .print-page:last-child { page-break-after: auto !important; }
          
          /* تبسيط العلامة المائية لتقليل إجهاد المتصفح */
          .watermark-container {
            position: absolute; top: 30%; left: 15%; width: 70%; height: 50%; z-index: -1; opacity: 0.05; pointer-events: none;
            background-image: url('/logo.png'); background-size: contain; background-repeat: no-repeat; background-position: center;
          }
          
          .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; align-items: center; }
          .doc-header p { margin: 2px 0; font-size: 12px; }
          .doc-title { text-align: center; margin: 15px 0; font-size: 18px; text-decoration: underline; font-weight: 900; }
          
          .info-grid { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 20px; }
          .info-box { width: 48%; border: 1px solid #000; border-radius: 8px; padding: 12px; position: relative; }
          .info-box h5 { margin: 0 0 10px 0; border-bottom: 1px solid #000; padding-bottom: 5px; font-size: 14px; }
          .info-box p { margin: 6px 0; font-size: 12px; }
          .tenant-photo-print { position: absolute; left: 10px; top: 35px; width: 80px; height: 100px; border: 1px solid #000; border-radius: 4px; object-fit: cover; }
          
          .terms-title { text-align: center; background: #1e293b !important; color: #fff !important; padding: 8px; font-size: 14px; border-radius: 4px; margin: 15px 0; -webkit-print-color-adjust: exact; }
          .term-item { margin-bottom: 12px; page-break-inside: avoid; }
          .term-header { background: #f1f5f9 !important; border-left: 4px solid #1e293b !important; padding: 6px 10px; font-size: 12px; font-weight: bold; margin-bottom: 5px; -webkit-print-color-adjust: exact; direction: ltr; }
          .term-body { display: flex; justify-content: space-between; font-size: 11px; line-height: 1.5; }
          .term-ar { width: 48%; text-align: justify; direction: rtl;}
          .term-fr { width: 48%; text-align: justify; direction: ltr; border-left: 1px dashed #000; padding-left: 10px; }
          
          .signatures { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; }
          .sig-box { width: 45%; text-align: center; font-size: 13px; font-weight: bold; }
          .sig-space { height: 90px; border: 1px solid #000; border-radius: 6px; margin-top: 10px; background: #f8fafc !important; -webkit-print-color-adjust: exact; }
          
          .receipt-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .receipt-table td { border: 1px solid #000; padding: 12px; font-size: 14px; }
          .receipt-table td.bg-gray { background: #f8fafc !important; font-weight: bold; width: 40%; -webkit-print-color-adjust: exact; }
        }
      `}} />

      <div className="screen-only-layout">
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.logoArea}>
            <span style={{ fontSize: '24px' }}>✨</span>
            <h1 style={styles.mainTitleText}>BELAGHA MOTORS</h1>
          </div>
          <div style={styles.navGroup}>
            <button style={activeTab === 'dashboard' ? styles.navBtnActive : styles.navBtn} onClick={() => setActiveTab('dashboard')}>إدارة الأسطول</button>
            <button style={activeTab === 'new-contract' ? styles.navBtnActive : styles.navBtn} onClick={() => setActiveTab('new-contract')}>+ عقد جديد</button>
          </div>
        </header>

        {/* إعدادات الـ API */}
        <div style={styles.apiZone}>
          <div style={styles.apiFlex}>
            <label style={styles.apiLabel}>مفتاح الذكاء الاصطناعي (OpenRouter API):</label>
            <input type="password" placeholder="sk-or-v1-..." value={apiKey} onChange={(e) => handleApiKeyChange(e.target.value)} style={styles.apiKeyInput} />
            {apiKey.trim() ? <span style={styles.badgeSuccess}>🔒 متصل وآمن</span> : <span style={styles.badgeError}>⚠️ يرجى اللصق للتفعيل</span>}
            {showKeyStatus && <span style={styles.badgeInfo}>🔄 تم الحفظ</span>}
          </div>
        </div>

        {isLoadingAI && <div style={styles.loadingBanner}>⏳ الذكاء الاصطناعي السحابي يعمل... جاري المعالجة!</div>}

        {/* الكاميرا */}
        {cameraMode && (
          <div style={styles.cameraOverlay}>
            <div style={styles.cameraModal}>
              <video ref={videoRef} autoPlay playsInline muted style={styles.videoStreamContainer}></video>
              <div style={styles.cameraActionRow}>
                <button type="button" onClick={capturePhoto} style={styles.btnPrimary}>📸 التقاط</button>
                <button type="button" onClick={() => setCameraMode(null)} style={styles.btnDanger}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        <main style={styles.mainContent}>
          {activeTab === 'dashboard' && (
             // ... (نفس كود جدول الأسطول السابق)
             <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>مراقبة حالة الأسطول والصيانة</h2>
                <button style={styles.btnPrimary} onClick={() => setShowAddCarForm(!showAddCarForm)}>{showAddCarForm ? "✖ إغلاق" : "➕ سيارة جديدة"}</button>
              </div>

              {showAddCarForm && (
                <div style={styles.formSection}>
                  <form onSubmit={handleAddCarSubmit} style={styles.gridForm}>
                    <div style={styles.inputGroup}><label>الماركة:</label><input required value={newCarForm.brand} onChange={e=>setNewCarForm({...newCarForm, brand:e.target.value})} style={styles.input}/></div>
                    <div style={styles.inputGroup}><label>الموديل:</label><input required value={newCarForm.model} onChange={e=>setNewCarForm({...newCarForm, model:e.target.value})} style={styles.input}/></div>
                    <div style={styles.inputGroup}><label>رقم اللوحة:</label><input required value={newCarForm.plateNumber} onChange={e=>setNewCarForm({...newCarForm, plateNumber:e.target.value})} style={styles.input}/></div>
                    <div style={styles.inputGroup}><label>العداد الحالي (كم):</label><input
