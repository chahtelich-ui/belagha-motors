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

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('belagha_api_key') || '');
  const [showKeyStatus, setShowKeyStatus] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Refs لضمان عمل أزرار الرفع على iPad
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
    localStorage.setItem('belagha_api_key', value);
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

  // --- دوال الكاميرا والرفع المدرعة لأبل ---
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
        videoRef.current.setAttribute("playsinline", "true"); // إجباري للآيباد
        videoRef.current.play();
      }
    } catch (err) {
      console.error(err);
      alert("⚠️ المتصفح يمنع الكاميرا. تأكد أنك على رابط HTTPS، أو اذهب لإعدادات Safari واسمح بالكاميرا.");
      setCameraMode(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataUrl('image/jpeg', 0.85);

    if (cameraMode === 'tenant') setTenantPhoto(dataUrl);
    if (cameraMode === 'license') processAndCompressImage(dataUrl, (comp) => { setLicensePhoto(comp); executeAI(comp); });
    
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setCameraMode(null);
  };

  const handleFileClick = (mode) => {
    // طريقة احترافية لإجبار Safari على فتح نافذة الملفات
    if (mode === 'tenant' && tenantFileInputRef.current) tenantFileInputRef.current.click();
    if (mode === 'license' && licenseFileInputRef.current) licenseFileInputRef.current.click();
  };

  const handleFileUpload = (e, mode) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (mode === 'tenant') setTenantPhoto(reader.result);
      if (mode === 'license') processAndCompressImage(reader.result, (comp) => { setLicensePhoto(comp); executeAI(comp); });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // تصفير آمن
  };

  const processAndCompressImage = (dataUrl, callback) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1000;
      let w = img.width, h = img.height;
      if (w > MAX_WIDTH) { h = Math.round((h * MAX_WIDTH) / w); w = MAX_WIDTH; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.6)); 
    };
    img.src = dataUrl;
  };

  // --- محرك الذكاء الاصطناعي السحابي (بدون Tesseract) ---
  const executeAI = async (base64Image) => {
    if (!apiKey.trim()) return alert("⚠️ يرجى إدخال مفتاح الـ API KEY الخاص بك في أعلى الشاشة أولاً.");
    
    setIsLoadingAI(true);
    setContractForm(prev => ({ ...prev, tenantName: "جاري القراءة السحابية...", licenseNumber: "جاري الفحص...", birthDatePlace: "", licenseIssueDate: "" }));

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
              { type: "text", text: "You are an Algerian driver license OCR. Extract data and fix any reflection typos. Return ONLY a valid JSON object matching these exact keys: tenantName (Latin uppercase clean name), licenseNumber (18 digits), birthDate (DD.MM.YYYY), issueDate (DD.MM.YYYY). Do not use Markdown backticks." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } }
            ]
          }]
        })
      });

      if (response.status === 402) throw new Error("رصيد مفتاح OpenRouter منتهي. يرجى الشحن.");
      if (!response.ok) throw new Error("فشل الاتصال بالذكاء الاصطناعي.");

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
      alert(err.message.includes("رصيد") ? err.message : "⚠️ تعذر استخراج البيانات. تأكد من وضوح الصورة وتوفر الانترنت.");
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

    // مهلة 3 ثواني للآيباد لضمان بناء الـ DOM للطباعة
    setTimeout(() => { 
      window.print(); 
      setPrintedContract(null); 
      setActiveTab('dashboard'); 
    }, 3000);
  };

  const getExpiryBadge = (expiryStr) => {
    if (!expiryStr) return { label: "غير محدد", bg: "#f1f5f9", color: "#64748b" };
    const days = Math.ceil((new Date(expiryStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    if (days < 0) return { label: "منتهي ❌", bg: "#fee2e2", color: "#991b1b" };
    if (days <= 30) return { label: "قريب جداً ⚠️", bg: "#fef3c7", color: "#92400e" };
    return { label: "ساري ✅", bg: "#dcfce7", color: "#166534" };
  };

  return (
    <div style={styles.appContainer} dir="rtl">
      
      {/* هندسة الـ CSS للطباعة:
        مصممة خصيصاً لتفادي انهيار الـ iPad. تم تحويل الحاويات إلى display:block
        مع استخدام page-break-after: always لفرض قطع الورقة بشكل طبيعي.
      */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
        * { font-family: 'Tajawal', sans-serif; box-sizing: border-box; }
        
        @media screen {
          .print-only-layout { display: none !important; }
          .screen-only-layout { display: block !important; }
        }
        
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body, html, #root { 
            background: white !important; 
            color: black !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            height: auto !important; 
            overflow: visible !important;
          }
          .screen-only-layout, .no-print { display: none !important; }
          .print-only-layout { display: block !important; }
          
          .print-page {
            display: block !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            position: relative;
            padding: 10px;
          }
          .print-page:last-child { page-break-after: auto !important; }
          
          .print-header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .print-title { text-align: center; font-size: 18px; font-weight: 900; text-decoration: underline; margin-bottom: 20px; }
          
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table td { border: 1px solid #000; padding: 10px; vertical-align: top; width: 50%; }
          .info-table h4 { margin: 0 0 10px 0; border-bottom: 1px solid #000; padding-bottom: 5px; }
          .info-table p { margin: 5px 0; font-size: 12px; }
          
          .law-section { margin-bottom: 15px; }
          .law-title { background: #e2e8f0 !important; font-weight: bold; padding: 5px; font-size: 12px; border-right: 3px solid #000; -webkit-print-color-adjust: exact; }
          .law-body { font-size: 11px; margin-top: 5px; text-align: justify; }
          
          .signature-area { margin-top: 40px; text-align: center; }
          .signature-box { border: 1px solid #000; height: 100px; margin-top: 10px; }
          
          .receipt-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
          .receipt-table td { border: 1px solid #000; padding: 12px; font-size: 14px; }
          .receipt-bg { background: #f1f5f9 !important; font-weight: bold; -webkit-print-color-adjust: exact; }
          
          .photo-print { display: block; width: 80px; height: 100px; border: 1px solid #000; object-fit: cover; margin-top: 10px; }
        }
      `}} />

      {/* --- واجهة المستخدم (التصميم العصري) --- */}
      <div className="screen-only-layout">
        
        {/* شريط الإعدادات العلوي */}
        <div style={styles.topBar}>
          <label style={{fontSize: '13px', fontWeight: 'bold'}}>🔑 مفتاح الـ API (OpenRouter):</label>
          <input type="password" placeholder="أدخل المفتاح لتفعيل الذكاء الاصطناعي" value={apiKey} onChange={(e) => handleApiKeyChange(e.target.value)} style={styles.topInput} />
          {apiKey ? <span style={{color: '#10b981', fontSize: '12px'}}>✅ متصل</span> : <span style={{color: '#ef4444', fontSize: '12px'}}>❌ غير متصل</span>}
          {showKeyStatus && <span style={{color: '#3b82f6', fontSize: '12px'}}>🔄 تم الحفظ</span>}
        </div>

        {/* الهيدر الفخم */}
        <header style={styles.header}>
          <h1 style={styles.logo}>BELAGHA MOTORS</h1>
          <div style={styles.nav}>
            <button style={activeTab === 'dashboard' ? styles.btnNavActive : styles.btnNav} onClick={() => setActiveTab('dashboard')}>📊 الأسطول</button>
            <button style={activeTab === 'new-contract' ? styles.btnNavActive : styles.btnNav} onClick={() => setActiveTab('new-contract')}>📝 عقد جديد</button>
          </div>
        </header>

        {isLoadingAI && <div style={styles.loading}>⏳ جاري تحليل بيانات الرخصة سحابياً عبر الذكاء الاصطناعي...</div>}

        {/* الكاميرا المدمجة */}
        {cameraMode && (
          <div style={styles.cameraOverlay}>
            <div style={styles.cameraModal}>
              <video ref={videoRef} autoPlay playsInline muted style={{width: '100%', borderRadius: '10px', backgroundColor: '#000'}}></video>
              <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px'}}>
                <button type="button" onClick={capturePhoto} style={styles.btnAction}>📸 التقاط</button>
                <button type="button" onClick={() => setCameraMode(null)} style={styles.btnCancel}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        <main style={styles.main}>
          {activeTab === 'dashboard' && (
            <div style={styles.card}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2 style={{margin:0, color:'#1e293b'}}>إدارة ومراقبة الأسطول</h2>
                <button style={styles.btnAction} onClick={() => setShowAddCarForm(!showAddCarForm)}>{showAddCarForm ? "✖ إغلاق" : "➕ إضافة سيارة"}</button>
              </div>

              {showAddCarForm && (
                <div style={styles.addForm}>
                  <form onSubmit={handleAddCarSubmit} style={styles.grid}>
                    <input required placeholder="الماركة" value={newCarForm.brand} onChange={e=>setNewCarForm({...newCarForm, brand:e.target.value})} style={styles.inputField}/>
                    <input required placeholder="الموديل" value={newCarForm.model} onChange={e=>setNewCarForm({...newCarForm, model:e.target.value})} style={styles.inputField}/>
                    <input required placeholder="رقم اللوحة" value={newCarForm.plateNumber} onChange={e=>setNewCarForm({...newCarForm, plateNumber:e.target.value})} style={styles.inputField}/>
                    <input required type="number" placeholder="العداد الحالي" value={newCarForm.currentMileage} onChange={e=>setNewCarForm({...newCarForm, currentMileage:e.target.value})} style={styles.inputField}/>
                    <input required type="date" placeholder="انتهاء التأمين" value={newCarForm.insuranceExpiryDate} onChange={e=>setNewCarForm({...newCarForm, insuranceExpiryDate:e.target.value})} style={styles.inputField}/>
                    <input required type="number" placeholder="هدف الزيت القادم" value={newCarForm.oilChangeMileage} onChange={e=>setNewCarForm({...newCarForm, oilChangeMileage:e.target.value})} style={styles.inputField}/>
                    <input required type="date" placeholder="المراقبة التقنية" value={newCarForm.technicalControlDate} onChange={e=>setNewCarForm({...newCarForm, technicalControlDate:e.target.value})} style={styles.inputField}/>
                    <button type="submit" style={styles.btnSuccess}>حفظ المركبة</button>
                  </form>
                </div>
              )}

              <div style={{overflowX: 'auto'}}>
                <table style={styles.table}>
                  <thead><tr style={{background:'#f1f5f9'}}><th>السيارة</th><th>العداد</th><th>التأمين</th><th>الزيت</th><th>المراقبة التقنية</th><th>تحكم</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {fleet.map(car => {
                      const ins = getExpiryBadge(car.insuranceExpiryDate), tech = getExpiryBadge(car.technicalControlDate), oil = getOilStatusBadge(car.currentMileage, car.oilChangeMileage);
                      const isEd = editingCarId === car.id;
                      return (
                        <tr key={car.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                          <td style={{padding:'10px'}}><strong>{car.brand} {car.model}</strong><br/><span style={{fontSize:'12px', color:'#64748b'}}>{car.plateNumber}</span></td>
                          <td style={{padding:'10px'}}>{isEd ? <input type="number" value={editMileage} onChange={(e)=>setEditMileage(e.target.value)} style={{width:'80px'}} /> : <span style={{fontFamily:'monospace', fontWeight:'bold'}}>{car.currentMileage} كم</span>}</td>
                          <td style={{padding:'10px'}}>{isEd ? <input type="date" value={editInsuranceDate} onChange={(e)=>setEditInsuranceDate(e.target.value)} /> : <span style={{padding:'4px 8px', borderRadius:'12px', fontSize:'11px', background:ins.bg, color:ins.color}}>{ins.label}</span>}</td>
                          <td style={{padding:'10px'}}>{isEd ? <input type="number" value={editOilMileage} onChange={(e)=>setEditOilMileage(e.target.value)} /> : <span style={{padding:'4px 8px', borderRadius:'12px', fontSize:'11px', background:oil.bg, color:oil.color}}>{oil.label}</span>}</td>
                          <td style={{padding:'10px'}}>{isEd ? <input type="date" value={editTechControlDate} onChange={(e)=>setEditTechControlDate(e.target.value)} /> : <span style={{padding:'4px 8px', borderRadius:'12px', fontSize:'11px', background:tech.bg, color:tech.color}}>{tech.label}</span>}</td>
                          <td style={{padding:'10px'}}>{isEd ? <button onClick={()=>saveCarEdits(car.id)} style={styles.btnSuccessSmall}>حفظ</button> : <button onClick={()=>startEditingCar(car)} style={styles.btnActionSmall}>تعديل</button>}</td>
                          <td style={{padding:'10px'}}><button onClick={() => toggleCarStatus(car.id)} style={{border:'none', padding:'5px 10px', borderRadius:'12px', cursor:'pointer', fontWeight:'bold', background: car.status === 'available' ? '#dcfce7' : '#fee2e2', color: car.status === 'available' ? '#166534' : '#991b1b'}}>{car.status === 'available' ? 'متاحة' : 'مكراة'}</button></td>
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
                
                {/* قسم رفع الصور المحسن والمدرع لـ iPad */}
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'20px', marginBottom:'30px'}}>
                  
                  <div style={styles.mediaBox}>
                    <h3 style={styles.mediaTitle}>1. صورة وجه المستأجر</h3>
                    <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                      <div style={styles.imgPreview}>{tenantPhoto ? <img src={tenantPhoto} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="زبون" /> : "لا توجد"}</div>
                      <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                        <button type="button" onClick={()=>startCamera('tenant')} style={styles.btnAction}>📷 فتح الكاميرا</button>
                        {/* استخدام Refs لحل مشكلة السفاري */}
                        <input type="file" accept="image/*" ref={tenantFileInputRef} onChange={(e)=>handleFileUpload(e,'tenant')} style={{display: 'none'}} />
                        <button type="button" onClick={()=>handleFileClick('tenant')} style={styles.btnUpload}>📂 رفع ملف جاهز</button>
                      </div>
                    </div>
                  </div>

                  <div style={styles.mediaBox}>
                    <h3 style={styles.mediaTitle}>2. رخصة السياقة (قراءة سحابية)</h3>
                    <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                      <div style={styles.imgPreview}>{licensePhoto ? <img src={licensePhoto} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="رخصة" /> : "لا توجد"}</div>
                      <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                        <button type="button" onClick={()=>startCamera('license')} style={styles.btnAction}>⚡ مسح بالكاميرا</button>
                        <input type="file" accept="image/*" ref={licenseFileInputRef} onChange={(e)=>handleFileUpload(e,'license')} style={{display: 'none'}} />
                        <button type="button" onClick={()=>handleFileClick('license')} style={styles.btnUploadAI}>🤖 رفع واستخراج (AI)</button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* الحقول (Inputs) */}
                <div style={styles.grid}>
                  <div><label style={styles.label}>الاسم واللقب:</label><input required value={contractForm.tenantName} onChange={e=>setContractForm({...contractForm, tenantName: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>رقم الرخصة:</label><input required value={contractForm.licenseNumber} onChange={e=>setContractForm({...contractForm, licenseNumber: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>رقم الهاتف:</label><input required value={contractForm.tenantPhone} onChange={e=>setContractForm({...contractForm, tenantPhone: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>تاريخ ومكان الميلاد:</label><input required value={contractForm.birthDatePlace} onChange={e=>setContractForm({...contractForm, birthDatePlace: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>تاريخ الإصدار:</label><input required value={contractForm.licenseIssueDate} onChange={e=>setContractForm({...contractForm, licenseIssueDate: e.target.value})} style={styles.inputField}/></div>
                </div>

                <div style={{height:'1px', background:'#e2e8f0', margin:'25px 0'}}></div>

                <div style={styles.grid}>
                  <div>
                    <label style={styles.label}>اختر المركبة:</label>
                    <select required value={contractForm.selectedCarId} onChange={e=>setContractForm({...contractForm, selectedCarId: e.target.value})} style={styles.inputField}>
                      <option value="">-- يرجى الاختيار --</option>
                      {fleet.map(car => <option key={car.id} value={car.id} disabled={car.status !== 'available'}>{car.brand} {car.model} ({car.plateNumber})</option>)}
                    </select>
                  </div>
                  <div><label style={styles.label}>تاريخ الاستلام:</label><input type="datetime-local" required value={contractForm.startDate} onChange={e=>setContractForm({...contractForm, startDate: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>تاريخ الإرجاع:</label><input type="datetime-local" required value={contractForm.endDate} onChange={e=>setContractForm({...contractForm, endDate: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>السعر لليوم (دج):</label><input type="number" required value={contractForm.pricePerDay} onChange={e=>setContractForm({...contractForm, pricePerDay: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>الضمان (Caution):</label><input type="number" required value={contractForm.caution} onChange={e=>setContractForm({...contractForm, caution: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>حالة الوقود:</label><input required value={contractForm.fuelStatus} onChange={e=>setContractForm({...contractForm, fuelStatus: e.target.value})} style={styles.inputField}/></div>
                </div>

                <div style={{background:'#ecfdf5', border:'1px solid #10b981', color:'#064e3b', padding:'15px', borderRadius:'10px', textAlign:'center', marginTop:'25px', fontWeight:'bold'}}>
                  الإجمالي: {calculatedTotal} دج | المدة: {calculatedDays} يوم | الزيادة المتوقعة للعداد: {calculatedDays * 250} كم
                </div>

                <button type="submit" style={styles.btnSubmitFinal}>💾 إنشاء العقد وطباعة الأوراق</button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* ==============================================================
          تنسيق الطباعة (المصمم خصيصاً لعبور نظام الحماية في Safari)
      ============================================================== */}
      <div className="print-only-layout">
        {printedContract && (
          <>
            {/* --- الورقة 1: العقد --- */}
            <div className="print-page">
              <div className="print-header" style={{display:'flex', justifyContent:'space-between'}}>
                <div>
                  <h1 style={{margin:0, fontSize:'24px', fontWeight:'900'}}>BELAGHA MOTORS</h1>
                  <p style={{margin:'5px 0', fontSize:'14px'}}>Agence de Location de Voitures</p>
                </div>
                <div style={{textAlign:'left', fontSize:'12px', fontWeight:'bold', lineHeight:'1.5'}}>
                  📍 Constantine, Algérie<br/>📞 0554 28 19 83<br/>NIF: 1852501093731100000
                </div>
              </div>
              
              <div className="print-title">CONTRAT DE LOCATION / عقد كراء سيارة</div>

              <table className="info-table">
                <tbody>
                  <tr>
                    <td>
                      <h4>1. المستأجر / Locataire</h4>
                      <p><strong>الاسم:</strong> {printedContract.tenantName}</p>
                      <p><strong>الميلاد:</strong> {printedContract.birthDatePlace}</p>
                      <p><strong>رقم الرخصة:</strong> {printedContract.licenseNumber}</p>
                      <p><strong>الإصدار:</strong> {printedContract.licenseIssueDate}</p>
                      <p><strong>الهاتف:</strong> {printedContract.tenantPhone}</p>
                      {printedContract.photo && <img src={printedContract.photo} className="photo-print" alt="Photo" />}
                    </td>
                    <td>
                      <h4>2. المركبة / Véhicule</h4>
                      <p><strong>السيارة:</strong> {printedContract.carDetails?.brand} {printedContract.carDetails?.model}</p>
                      <p><strong>اللوحة المنجمية:</strong> {printedContract.carDetails?.plateNumber}</p>
                      <p><strong>تاريخ الاستلام:</strong> {printedContract.startDate}</p>
                      <p><strong>تاريخ الإرجاع:</strong> {printedContract.endDate}</p>
                      <p><strong>المدة:</strong> {printedContract.days} Jours | <strong>السعر:</strong> {printedContract.pricePerDay} DA/J</p>
                      <p><strong>الإجمالي:</strong> {printedContract.total} DA | <strong>الضمان:</strong> {printedContract.caution} DA</p>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="law-section">
                <div className="law-title">1. حالة السيارة والحوادث / État & Accidents</div>
                <div className="law-body">يقر المستأجر باستلام السيارة بحالة جيدة. في حال الحادث، يدفع تكاليف الإصلاح نقداً، وإذا كان الضرر كبيراً يتحمل القيمة الكاملة للمركبة. / Le locataire reçoit le véhicule en bon état. En cas d'accident, il paie les réparations en espèces.</div>
              </div>
              
              <div className="law-section">
                <div className="law-title">2. القيادة / Conduite</div>
                <div className="law-body">يمنع كراء السيارة للغير أو قيادتها من شخص غير مصرح. يمنع منعاً باتاً خروج المركبة خارج التراب الوطني الجزائري. / Sous-location interdite. La conduite par une tierce personne non autorisée est interdite.</div>
              </div>
              
              <div className="law-section">
                <div className="law-title">3. التأخير / Retard</div>
                <div className="law-body">يلتزم المستأجر بإرجاع السيارة في الوقت المحدد. أي تأخير يترتب عليه غرامة 1500 دج عن كل ساعة. / Tout retard dans la restitution entraîne une pénalité de 1500 DA par heure.</div>
              </div>
            </div>

            {/* --- الورقة 2: الشروط --- */}
            <div className="print-page">
              <div className="print-header">
                <h1 style={{margin:0, fontSize:'18px', fontWeight:'900'}}>BELAGHA MOTORS - CONDITIONS GÉNÉRALES</h1>
              </div>

              <div className="law-section" style={{marginTop:'20px'}}>
                <div className="law-title">4. السرقة أو الضياع / Perte ou Vol</div>
                <div className="law-body">في حالة ضياع أو سرقة المركبة، تقع المسؤولية الكاملة على المستأجر ويلزم بدفع 100% من القيمة الإجمالية للوكالة. / En cas de vol, le locataire est seul responsable et doit rembourser 100% de la valeur du véhicule.</div>
              </div>

              <div className="law-section">
                <div className="law-title">5. الوثائق ومواقيت العمل / Documents & Heures</div>
                <div className="law-body">البطاقة الرمادية الأصلية للمركبة لا تسلم للزبون نهائياً. أوقات العمل للوكالة هي من 08:00 إلى 18:00. / La carte grise originale n'est pas remise. Heures d'ouverture: 08:00 à 18:00.</div>
              </div>

              <div className="law-section">
                <div className="law-title">6. النظافة والوقود / Propreté & Carburant</div>
                <div className="law-body">يجب إعادة السيارة نظيفة وبنفس مستوى الوقود. غرامة التنظيف والتأخير تطبق قيمتها 2000 دج. / Restitution avec le même carburant et propre. Frais de lavage de 2000 DA applicables.</div>
              </div>

              <div className="law-section">
                <div className="law-title">7. المخالفات والمحشر / Infractions & Fourrière</div>
                <div className="law-body">المستأجر مسؤول عن كل الرادارات والمخالفات. في حالة المحشر، يتحمل مصاريف التوقف والاستخراج. / Responsabilité totale pour les radars et infractions. En cas de fourrière, le locataire paie tous les frais.</div>
              </div>

              <div style={{border:'2px solid #000', padding:'15px', marginTop:'30px', textAlign:'center', fontWeight:'bold'}}>
                يقر المستأجر بقراءة وفهم جميع الشروط والموافقة عليها التامة.<br/>Lu et approuvé par le locataire.
              </div>

              <table style={{width:'100%', marginTop:'40px', textAlign:'center'}}>
                <tbody>
                  <tr>
                    <td style={{width:'50%', fontWeight:'bold'}}>توقيع وبصمة المستأجر<br/><div className="signature-box"></div></td>
                    <td style={{width:'50%', fontWeight:'bold'}}>ختم وتوقيع الوكالة<br/><div className="signature-box"></div></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* --- الورقة 3: الوصل --- */}
            <div className="print-page">
              <div className="print-header" style={{textAlign:'center', borderBottom:'none'}}>
                <h1 style={{margin:0, fontSize:'24px', fontWeight:'900'}}>BELAGHA MOTORS FINANCE</h1>
                <p style={{margin:'5px 0', fontSize:'14px'}}>وصل استلام مالي / QUITTANCE DE PAIEMENT</p>
              </div>

              <table className="receipt-table">
                <tbody>
                  <tr><td className="receipt-bg">التاريخ والوقت / Date</td><td>{printedContract.dateString}</td></tr>
                  <tr><td className="receipt-bg">استلمنا من السيد(ة) / Client</td><td>{printedContract.tenantName}</td></tr>
                  <tr><td className="receipt-bg">المركبة / Véhicule</td><td>{printedContract.carDetails?.brand} {printedContract.carDetails?.model} ({printedContract.carDetails?.plateNumber})</td></tr>
                  <tr><td className="receipt-bg">الضمان / Caution</td><td>{printedContract.caution} دج</td></tr>
                  <tr><td className="receipt-bg" style={{fontSize:'16px'}}>المبلغ الكلي المستلم / Total Payé</td><td style={{fontSize:'18px', fontWeight:'900'}}>{printedContract.total} دج</td></tr>
                </tbody>
              </table>

              <table style={{width:'100%', marginTop:'100px', textAlign:'center'}}>
                <tbody>
                  <tr>
                    <td style={{width:'50%', fontWeight:'bold'}}>إمضاء المستلم<br/><div className="signature-box" style={{border:'none', borderTop:'1px dashed #000'}}></div></td>
                    <td style={{width:'50%', fontWeight:'bold'}}>ختم مصلحة الحسابات<br/><div className="signature-box" style={{border:'none', borderTop:'1px dashed #000'}}></div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- تصميم CSS-in-JS عصري واحترافي ---
const styles = {
  appContainer: { background: '#f8fafc', minHeight: '100vh', paddingBottom: '40px', color: '#0f172a' },
  topBar: { background: '#1e293b', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', borderBottom: '2px solid #334155' },
  topInput: { padding: '6px 12px', borderRadius: '6px', border: 'none', width: '280px', outline: 'none', color: '#000', direction: 'ltr' },
  header: { background: '#ffffff', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
  logo: { fontSize: '24px', margin: 0, fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px' },
  nav: { display: 'flex', gap: '10px' },
  btnNav: { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' },
  btnNavActive: { background: '#2563eb', color: '#fff', border: '1px solid #2563eb', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(37,99,235,0.3)' },
  loading: { background: '#6366f1', color: 'white', textAlign: 'center', padding: '12px', fontWeight: 'bold', fontSize: '14px' },
  main: { padding: '30px', maxWidth: '1100px', margin: '0 auto' },
  card: { background: '#ffffff', padding: '25px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  
  btnAction: { background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnUpload: { background: '#64748b', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnUploadAI: { background: '#8b5cf6', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnCancel: { background: '#ef4444', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnSuccess: { background: '#10b981', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', gridColumn: '1 / -1' },
  btnSubmitFinal: { background: '#0f172a', color: '#fff', border: 'none', padding: '16px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', width: '100%', marginTop: '20px', cursor: 'pointer' },
  btnActionSmall: { background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  btnSuccessSmall: { background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  
  mediaBox: { background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' },
  mediaTitle: { fontSize: '16px', color: '#334155', marginTop: '0', marginBottom: '15px' },
  imgPreview: { width: '85px', height: '100px', background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#94a3b8', overflow: 'hidden' },
  
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' },
  addForm: { background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #cbd5e1' },
  label: { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold', color: '#475569' },
  inputField: { width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none' },
  
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' },
  
  cameraOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  cameraModal: { background: '#fff', padding: '20px', borderRadius: '16px', width: '90%', maxWidth: '500px' },
};
