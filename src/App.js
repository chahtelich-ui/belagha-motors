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

  const startCamera = async (mode) => {
    setCameraMode(mode);
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode === 'tenant' ? "user" : "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play();
      }
    } catch (err) {
      alert("⚠️ يرجى منح صلاحية الكاميرا للمتصفح.");
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

  const handleFileUpload = (e, mode) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (mode === 'tenant') setTenantPhoto(reader.result);
      if (mode === 'license') processAndCompressImage(reader.result, (compressed) => { setLicensePhoto(compressed); executePureVisionAI(compressed); });
    };
    reader.readAsDataURL(file);
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

    // تأخير آمن للـ iPad لضمان رندرة الصفحات والصور
    setTimeout(() => { 
      window.print(); 
      setPrintedContract(null); 
      setActiveTab('dashboard'); 
    }, 2000);
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
      
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
        * { font-family: 'Tajawal', sans-serif; box-sizing: border-box; }
        
        @media screen {
          .print-only-layout { display: none !important; }
          .screen-only-layout { display: block !important; }
        }
        
        /* CSS الطباعة الهندسي الخاص بأجهزة iOS و Safari لمنع الصفحات البيضاء */
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body, html, #root { background: #fff !important; color: #000 !important; margin: 0 !important; padding: 0 !important; }
          .screen-only-layout, .no-print { display: none !important; }
          .print-only-layout { display: block !important; width: 100%; }
          
          .print-page {
            page-break-after: always !important;
            page-break-inside: avoid !important;
            display: block !important;
            width: 100% !important;
            position: relative !important;
            padding: 20px !important;
            min-height: 250mm; /* ترك الارتفاع مرناً للـ Safari */
          }
          .print-page:last-child { page-break-after: auto !important; }
          
          /* العلامة المائية */
          .watermark-container {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 400px; height: 400px; z-index: -1; opacity: 0.05; pointer-events: none;
            background-image: url('/logo.png'); background-size: contain; background-repeat: no-repeat; background-position: center;
          }
          
          .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; align-items: center; }
          .doc-header p { margin: 2px 0; font-size: 12px; }
          .doc-title { text-align: center; margin: 15px 0; font-size: 18px; text-decoration: underline; font-weight: 900; }
          
          .info-grid { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 20px; }
          .info-box { width: 48%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; position: relative; }
          .info-box h5 { margin: 0 0 10px 0; border-bottom: 1px solid #000; padding-bottom: 5px; font-size: 14px; }
          .info-box p { margin: 6px 0; font-size: 12px; }
          .tenant-photo-print { position: absolute; left: 10px; top: 35px; width: 80px; height: 100px; border: 1px solid #000; border-radius: 4px; object-fit: cover; }
          
          .terms-title { text-align: center; background: #1e293b !important; color: #fff !important; padding: 8px; font-size: 14px; border-radius: 4px; margin: 15px 0; -webkit-print-color-adjust: exact; }
          .term-item { margin-bottom: 12px; page-break-inside: avoid; }
          .term-header { background: #f1f5f9 !important; border-right: 4px solid #1e293b !important; padding: 6px 10px; font-size: 12px; font-weight: bold; margin-bottom: 5px; -webkit-print-color-adjust: exact; }
          .term-body { display: flex; justify-content: space-between; font-size: 11px; line-height: 1.5; }
          .term-ar { width: 48%; text-align: justify; }
          .term-fr { width: 48%; text-align: justify; direction: ltr; border-left: 1px dashed #cbd5e1; padding-left: 10px; }
          
          .signatures { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; }
          .sig-box { width: 45%; text-align: center; font-size: 13px; font-weight: bold; }
          .sig-space { height: 90px; border: 1px solid #94a3b8; border-radius: 6px; margin-top: 10px; background: #f8fafc !important; -webkit-print-color-adjust: exact; }
          
          .receipt-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .receipt-table td { border: 1px solid #000; padding: 12px; font-size: 14px; }
          .receipt-table td.bg-gray { background: #f8fafc !important; font-weight: bold; width: 40%; -webkit-print-color-adjust: exact; }
          .page-num { position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 12px; font-weight: bold; }
        }
      `}} />

      <div className="screen-only-layout">
        {/* Header عصري */}
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

        {isLoadingAI && <div style={styles.loadingBanner}>⏳ الذكاء الاصطناعي السحابي يعمل... جاري معالجة الوثيقة بدقة فائقة!</div>}

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
                    <div style={styles.inputGroup}><label>العداد الحالي (كم):</label><input type="number" required value={newCarForm.currentMileage} onChange={e=>setNewCarForm({...newCarForm, currentMileage:e.target.value})} style={styles.input}/></div>
                    <div style={styles.inputGroup}><label>تاريخ التأمين:</label><input type="date" required value={newCarForm.insuranceExpiryDate} onChange={e=>setNewCarForm({...newCarForm, insuranceExpiryDate:e.target.value})} style={styles.input}/></div>
                    <div style={styles.inputGroup}><label>مستهدف الزيت (كم):</label><input type="number" required value={newCarForm.oilChangeMileage} onChange={e=>setNewCarForm({...newCarForm, oilChangeMileage:e.target.value})} style={styles.input}/></div>
                    <div style={styles.inputGroup}><label>المراقبة التقنية:</label><input type="date" required value={newCarForm.technicalControlDate} onChange={e=>setNewCarForm({...newCarForm, technicalControlDate:e.target.value})} style={styles.input}/></div>
                    <button type="submit" style={{...styles.btnSuccess, gridColumn: '1 / -1'}}>💾 حفظ السيارة</button>
                  </form>
                </div>
              )}

              <div style={styles.tableResponsive}>
                <table style={styles.table}>
                  <thead>
                    <tr><th>المركبة</th><th>العداد</th><th>التأمين</th><th>الزيت (Vidange)</th><th>المراقبة التقنية</th><th>تحكم</th><th>الحالة</th></tr>
                  </thead>
                  <tbody>
                    {fleet.map(car => {
                      const ins = getExpiryBadge(car.insuranceExpiryDate);
                      const tech = getExpiryBadge(car.technicalControlDate);
                      const oil = getOilStatusBadge(car.currentMileage, car.oilChangeMileage);
                      const isEd = editingCarId === car.id;

                      return (
                        <tr key={car.id}>
                          <td><strong style={{color:'#1e293b'}}>{car.brand} {car.model}</strong><br/><span style={{fontSize:'12px', color:'#64748b'}}>{car.plateNumber}</span></td>
                          <td>{isEd ? <input type="number" value={editMileage} onChange={(e)=>setEditMileage(e.target.value)} style={styles.inputSmall} /> : <span style={styles.monoText}>{car.currentMileage} كم</span>}</td>
                          <td>{isEd ? <input type="date" value={editInsuranceDate} onChange={(e)=>setEditInsuranceDate(e.target.value)} style={styles.inputSmall} /> : <div><span style={{...styles.badge, background:ins.bg, color:ins.color}}>{ins.label}</span></div>}</td>
                          <td>{isEd ? <input type="number" value={editOilMileage} onChange={(e)=>setEditOilMileage(e.target.value)} style={styles.inputSmall} /> : <div><span style={{...styles.badge, background:oil.bg, color:oil.color}}>{oil.label}</span></div>}</td>
                          <td>{isEd ? <input type="date" value={editTechControlDate} onChange={(e)=>setEditTechControlDate(e.target.value)} style={styles.inputSmall} /> : <div><span style={{...styles.badge, background:tech.bg, color:tech.color}}>{tech.label}</span></div>}</td>
                          <td>{isEd ? <button onClick={()=>saveCarEdits(car.id)} style={styles.btnSuccessSmall}>حفظ</button> : <button onClick={()=>startEditingCar(car)} style={styles.btnPrimarySmall}>تعديل</button>}</td>
                          <td><button onClick={() => toggleCarStatus(car.id)} style={{...styles.badgeBtn, background: car.status === 'available' ? '#dcfce7' : '#fee2e2', color: car.status === 'available' ? '#166534' : '#991b1b'}}>{car.status === 'available' ? 'متاحة ✅' : 'مكراة 🚗'}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'new-contract' && (
            <div style={styles.card}>
              <form onSubmit={handleOriginalPrintSubmit}>
                <div style={styles.photoGrid}>
                  {/* قسم المستأجر */}
                  <div style={styles.photoSection}>
                    <h3 style={styles.sectionTitle}>1. وجه المستأجر</h3>
                    <div style={styles.photoBox}>
                      <div style={styles.imgPreview}>{tenantPhoto ? <img src={tenantPhoto} style={styles.coverImg} alt="الزبون" /> : <span>لا توجد صورة</span>}</div>
                      <div style={styles.photoActions}>
                        <button type="button" onClick={()=>startCamera('tenant')} style={styles.btnPrimary}>📷 كاميرا</button>
                        <label style={styles.btnSecondary}>📂 ملف<input type="file" accept="image/*" onChange={(e)=>handleFileUpload(e,'tenant')} hidden/></label>
                      </div>
                    </div>
                  </div>
                  {/* قسم الرخصة والـ AI */}
                  <div style={styles.photoSection}>
                    <h3 style={styles.sectionTitle}>2. رخصة السياقة (AI)</h3>
                    <div style={styles.photoBox}>
                      <div style={styles.imgPreview}>{licensePhoto ? <img src={licensePhoto} style={styles.coverImg} alt="الرخصة" /> : <span>لا توجد وثيقة</span>}</div>
                      <div style={styles.photoActions}>
                        <button type="button" onClick={()=>startCamera('license')} style={styles.btnPrimary}>⚡ مسح ذكي</button>
                        <label style={styles.btnSecondary}>📂 رفع للـ AI<input type="file" accept="image/*" onClick={e=>e.target.value=null} onChange={(e)=>handleFileUpload(e,'license')} hidden/></label>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.divider}></div>

                <div style={styles.gridForm}>
                  <div style={styles.inputGroup}><label>الاسم واللقب:</label><input required value={contractForm.tenantName} onChange={e=>setContractForm({...contractForm, tenantName: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم الرخصة:</label><input required value={contractForm.licenseNumber} onChange={e=>setContractForm({...contractForm, licenseNumber: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم الهاتف:</label><input required value={contractForm.tenantPhone} onChange={e=>setContractForm({...contractForm, tenantPhone: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>تاريخ/مكان الميلاد:</label><input required value={contractForm.birthDatePlace} onChange={e=>setContractForm({...contractForm, birthDatePlace: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>تاريخ الإصدار:</label><input required value={contractForm.licenseIssueDate} onChange={e=>setContractForm({...contractForm, licenseIssueDate: e.target.value})} style={styles.input}/></div>
                </div>

                <div style={styles.divider}></div>

                <div style={styles.gridForm}>
                  <div style={styles.inputGroup}>
                    <label>المركبة:</label>
                    <select required value={contractForm.selectedCarId} onChange={e=>setContractForm({...contractForm, selectedCarId: e.target.value})} style={styles.input}>
                      <option value="">-- اختر --</option>
                      {fleet.map(car => <option key={car.id} value={car.id} disabled={car.status !== 'available'}>{car.brand} {car.model} ({car.plateNumber})</option>)}
                    </select>
                  </div>
                  <div style={styles.inputGroup}><label>الاستلام:</label><input type="datetime-local" required value={contractForm.startDate} onChange={e=>setContractForm({...contractForm, startDate: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>الإرجاع:</label><input type="datetime-local" required value={contractForm.endDate} onChange={e=>setContractForm({...contractForm, endDate: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>السعر/يوم (دج):</label><input type="number" required value={contractForm.pricePerDay} onChange={e=>setContractForm({...contractForm, pricePerDay: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>الضمان (دج):</label><input type="number" required value={contractForm.caution} onChange={e=>setContractForm({...contractForm, caution: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>الوقود:</label><input required value={contractForm.fuelStatus} onChange={e=>setContractForm({...contractForm, fuelStatus: e.target.value})} style={styles.input}/></div>
                </div>

                <div style={styles.summaryBox}>
                  📊 المدة: <strong>{calculatedDays} يوم</strong> &nbsp;|&nbsp; الإجمالي: <strong>{calculatedTotal} دج</strong> &nbsp;|&nbsp; زيادة العداد الآلية: <strong>{calculatedDays * 250} كم</strong>
                </div>

                <button type="submit" style={styles.btnSubmit}>💾 توليد وحفظ عقد الكراء للطباعة</button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* ==============================================================
          بيئة الطباعة المعزولة 100% الموجهة لحل مشكلة الـ iPad والصفحات البيضاء 
      ============================================================== */}
      <div className="print-only-layout">
        {printedContract && (
          <>
            {/* 📄 الصفحة الأولى: العقد */}
            <div className="print-page">
              <div className="watermark-container"></div>
              <div className="doc-header">
                <div><h1 style={{margin:0, fontSize:'22px', fontWeight:'900'}}>BELAGHA MOTORS</h1><p>Location de Voitures</p></div>
                <div style={{textAlign:'right', fontWeight:'bold'}}>
                  <p>📍 Constantine, Algérie</p><p>📞 0554 28 19 83</p><p>RC: 25/00-038169 A 15 | NIF: 1852501093731100000</p>
                </div>
              </div>
              <h2 className="doc-title">عقد كراء سيارة / CONTRAT DE LOCATION</h2>
              
              <div className="info-grid">
                <div className="info-box" style={{paddingLeft: '110px'}}>
                  <h5>1. المستأجر / Locataire</h5>
                  <p><strong>الاسم واللقب:</strong> {printedContract.tenantName}</p>
                  <p><strong>الميلاد:</strong> {printedContract.birthDatePlace}</p>
                  <p><strong>الرخصة:</strong> {printedContract.licenseNumber}</p>
                  <p><strong>الإصدار:</strong> {printedContract.licenseIssueDate}</p>
                  <p><strong>الهاتف:</strong> {printedContract.tenantPhone}</p>
                  <p><strong>العنوان:</strong> {printedContract.tenantAddress}</p>
                  {printedContract.photo && <img src={printedContract.photo} className="tenant-photo-print" alt="زبون" />}
                </div>
                <div className="info-box">
                  <h5>2. المركبة والتفاصيل / Véhicule & Détails</h5>
                  <p><strong>السيارة:</strong> {printedContract.carDetails?.brand} {printedContract.carDetails?.model}</p>
                  <p><strong>اللوحة:</strong> {printedContract.carDetails?.plateNumber}</p>
                  <p><strong>الاستلام:</strong> {printedContract.startDate}</p>
                  <p><strong>الإرجاع:</strong> {printedContract.endDate}</p>
                  <p><strong>المدة:</strong> {printedContract.days} يوم | <strong>السعر:</strong> {printedContract.pricePerDay} دج/يوم</p>
                  <p><strong>الإجمالي:</strong> {printedContract.total} دج | <strong>الوقود:</strong> {printedContract.fuelStatus}</p>
                </div>
              </div>

              <div className="terms-title">الشروط والالتزامات (الجزء 1) / CONDITIONS GÉNÉRALES</div>
              
              <div className="term-item">
                <div className="term-header">1. حالة السيارة والحوادث / État & Accidents</div>
                <div className="term-body">
                  <div className="term-ar">يقر المستأجر باستلام السيارة بحالة جيدة. في حال الحادث، يدفع تكاليف الإصلاح نقداً، وإذا كان الضرر كبيراً يتحمل القيمة الكاملة للمركبة.</div>
                  <div className="term-fr">Le locataire reçoit le véhicule en bon état. En cas d'accident, il paie les réparations en espèces. Si dommage majeur, il rembourse sa valeur totale.</div>
                </div>
              </div>
              <div className="term-item">
                <div className="term-header">2. القيادة / Conduite</div>
                <div className="term-body">
                  <div className="term-ar">يمنع كراء السيارة للغير أو قيادتها من شخص غير مصرح. يمنع منعاً باتاً خروج المركبة خارج التراب الوطني.</div>
                  <div className="term-fr">Sous-location interdite. La conduite par une tierce personne est strictement interdite, tout comme la sortie du territoire national.</div>
                </div>
              </div>
              <div className="term-item">
                <div className="term-header">3. التأخير / Retard</div>
                <div className="term-body">
                  <div className="term-ar">يلتزم المستأجر بإرجاع السيارة في الوقت المحدد. أي تأخير يترتب عليه غرامة 1500 دج عن كل ساعة.</div>
                  <div className="term-fr">Restitution à l'heure convenue. Tout retard entraîne une pénalité automatique de 1500 DA par heure.</div>
                </div>
              </div>

              <div className="page-num">Page 1 / 3</div>
            </div>

            {/* 📄 الصفحة الثانية: الشروط */}
            <div className="print-page">
              <div className="watermark-container"></div>
              <div className="doc-header"><h1 style={{margin:0, fontSize:'18px'}}>BELAGHA MOTORS</h1></div>
              <div className="terms-title">تتمة الشروط (الجزء 2) / CONDITIONS GÉNÉRALES (SUITE)</div>

              <div className="term-item">
                <div className="term-header">4. السرقة / Vol</div>
                <div className="term-body">
                  <div className="term-ar">في حالة ضياع أو سرقة المركبة، تقع المسؤولية الكاملة على المستأجر ويلزم بدفع 100% من القيمة الإجمالية للوكالة.</div>
                  <div className="term-fr">En cas de vol, le locataire est seul responsable et doit rembourser 100% de la valeur réelle du véhicule.</div>
                </div>
              </div>
              <div className="term-item">
                <div className="term-header">5. الوثائق / Documents</div>
                <div className="term-body">
                  <div className="term-ar">البطاقة الرمادية الأصلية لا تسلم. أوقات العمل للوكالة هي من 08:00 إلى 18:00.</div>
                  <div className="term-fr">La carte grise originale n'est pas remise. Heures d'ouverture: 08:00 à 18:00.</div>
                </div>
              </div>
              <div className="term-item">
                <div className="term-header">6. النظافة والوقود / Propreté & Carburant</div>
                <div className="term-body">
                  <div className="term-ar">يجب إعادة السيارة نظيفة وبنفس مستوى الوقود. غرامة التنظيف 2000 دج.</div>
                  <div className="term-fr">Restitution avec le même carburant et propre. Frais de lavage de 2000 DA si non respecté.</div>
                </div>
              </div>
              <div className="term-item">
                <div className="term-header">7. المخالفات والمحشر / Infractions & Fourrière</div>
                <div className="term-body">
                  <div className="term-ar">المستأجر مسؤول عن كل الرادارات والمخالفات. في حالة المحشر، يتحمل مصاريف التوقف والاستخراج.</div>
                  <div className="term-fr">Responsabilité totale pour les radars. En cas de fourrière, le locataire paie tous les frais d'immobilisation.</div>
                </div>
              </div>

              <div style={{background:'#f8fafc', padding:'15px', border:'1px dashed #cbd5e1', borderRadius:'8px', marginTop:'20px', fontSize:'13px', fontWeight:'bold', textAlign:'center'}}>
                إقرار: يوافق المستأجر موافقة تامة على جميع الشروط أعلاه ويلتزم بها.<br/>Lu et approuvé.
              </div>

              <div className="signatures">
                <div className="sig-box">توقيع المستأجر<div className="sig-space"></div></div>
                <div className="sig-box">ختم وتوقيع الوكالة<div className="sig-space"></div></div>
              </div>

              <div className="page-num">Page 2 / 3</div>
            </div>

            {/* 📄 الصفحة الثالثة: الوصل المالي */}
            <div className="print-page">
              <div className="watermark-container"></div>
              <div className="doc-header"><h1 style={{margin:0, fontSize:'18px'}}>BELAGHA MOTORS FINANCE</h1></div>
              <h2 className="doc-title" style={{marginTop:'40px'}}>وصل استلام مالي / QUITTANCE DE PAIEMENT</h2>
              
              <table className="receipt-table">
                <tbody>
                  <tr><td className="bg-gray">التاريخ / Date</td><td>{printedContract.dateString}</td></tr>
                  <tr><td className="bg-gray">المستأجر / Client</td><td>{printedContract.tenantName}</td></tr>
                  <tr><td className="bg-gray">المركبة / Véhicule</td><td>{printedContract.carDetails?.brand} {printedContract.carDetails?.model} ({printedContract.carDetails?.plateNumber})</td></tr>
                  <tr><td className="bg-gray">الضمان / Caution</td><td>{printedContract.caution} دج</td></tr>
                  <tr><td className="bg-gray" style={{fontSize:'16px', color:'#1e3a8a'}}>المبلغ الإجمالي المستلم</td><td style={{fontSize:'18px', fontWeight:'900', color:'#1e3a8a'}}>{printedContract.total} دج</td></tr>
                </tbody>
              </table>

              <div className="signatures" style={{marginTop:'150px'}}>
                <div className="sig-box">إمضاء المستلم<div className="sig-space"></div></div>
                <div className="sig-box">ختم الحسابات<div className="sig-space"></div></div>
              </div>

              <div className="page-num">Page 3 / 3</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- CSS-in-JS (Modern, Clean, Tailwind-inspired) ---
const styles = {
  appContainer: { backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '40px' },
  header: { backgroundColor: '#0f172a', color: '#fff', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  logoArea: { display: 'flex', alignItems: 'center', gap: '10px' },
  mainTitleText: { fontSize: '22px', margin: 0, fontWeight: '900', letterSpacing: '1px' },
  navGroup: { display: 'flex', gap: '10px' },
  navBtn: { backgroundColor: 'transparent', color: '#cbd5e1', border: '1px solid #334155', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' },
  navBtnActive: { backgroundColor: '#3b82f6', color: '#fff', border: '1px solid #3b82f6', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 0 10px rgba(59,130,246,0.5)' },
  
  apiZone: { backgroundColor: '#fff', padding: '12px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' },
  apiFlex: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: '#f8fafc', padding: '8px 20px', borderRadius: '50px', border: '1px solid #cbd5e1' },
  apiLabel: { fontWeight: 'bold', fontSize: '13px', color: '#475569' },
  apiKeyInput: { padding: '6px 12px', width: '280px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', direction: 'ltr', outline: 'none' },
  badgeSuccess: { color: '#059669', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' },
  badgeError: { color: '#dc2626', fontSize: '12px', fontWeight: 'bold' },
  badgeInfo: { color: '#2563eb', fontSize: '12px', fontWeight: 'bold' },
  
  loadingBanner: { backgroundColor: '#6366f1', color: 'white', textAlign: 'center', padding: '12px', fontWeight: 'bold', fontSize: '14px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' },
  
  mainContent: { padding: '30px', maxWidth: '1200px', margin: '0 auto' },
  card: { backgroundColor: '#fff', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px' },
  cardTitle: { fontSize: '20px', color: '#0f172a', margin: 0, fontWeight: 'bold' },
  
  btnPrimary: { backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' },
  btnSuccess: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnDanger: { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnSecondary: { backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-block' },
  btnSubmit: { width: '100%', backgroundColor: '#0f172a', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', marginTop: '25px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.4)' },
  
  btnPrimarySmall: { backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  btnSuccessSmall: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  badgeBtn: { border: 'none', padding: '6px 12px', borderRadius: '50px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  
  formSection: { background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #e2e8f0' },
  gridForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  input: { padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', transition: 'border 0.2s', backgroundColor: '#fdfdfd' },
  inputSmall: { width: '110px', padding: '6px', border: '1px solid #94a3b8', borderRadius: '6px', fontSize: '13px' },
  
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' },
  photoSection: { background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px dashed #cbd5e1' },
  sectionTitle: { fontSize: '16px', color: '#334155', marginBottom: '15px', marginTop: 0 },
  photoBox: { display: 'flex', alignItems: 'center', gap: '20px' },
  imgPreview: { width: '100px', height: '120px', background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#64748b', fontSize: '12px', border: '1px solid #cbd5e1' },
  coverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  photoActions: { display: 'flex', flexDirection: 'column', gap: '10px' },
  
  divider: { height: '1px', background: '#e2e8f0', margin: '30px 0' },
  summaryBox: { background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', padding: '15px', borderRadius: '8px', textAlign: 'center', marginTop: '25px', fontSize: '14px' },
  
  tableResponsive: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' },
  badge: { padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' },
  monoText: { fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px', color: '#334155' },
  
  cameraOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' },
  cameraModal: { background: '#fff', padding: '20px', borderRadius: '16px', width: '90%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' },
  videoStreamContainer: { width: '100%', borderRadius: '12px', background: '#000' },
  cameraActionRow: { display: 'flex', gap: '15px', marginTop: '20px', justifyContent: 'center' }
};
