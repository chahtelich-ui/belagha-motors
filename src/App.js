import React, { useState, useEffect, useRef } from 'react';

const initialFleet = [
  { id: "car_1", brand: "Rover", model: "XPHWEP", year: 1993, plateNumber: "03813-193-25", currentMileage: 156200, status: "available", insuranceExpiryDate: "2026-08-15", oilChangeMileage: 160000, technicalControlDate: "2026-09-20" },
  { id: "car_2", brand: "Hyundai", model: "i10", year: 2022, plateNumber: "12345-122-25", currentMileage: 49500, status: "available", insuranceExpiryDate: "2026-06-01", oilChangeMileage: 55000, technicalControlDate: "2026-11-15" },
  { id: "car_3", brand: "PEUGEOT", model: "2024", year: 2024, plateNumber: "2102-124-25", currentMileage: 135200, status: "available", insuranceExpiryDate: "2026-12-30", oilChangeMileage: 140000, technicalControlDate: "2027-02-10" }
];

function App() {
  const [fleet, setFleet] = useState(initialFleet);
  const [activeTab, setActiveTab] = useState('new-contract');
  const [showAddCarForm, setShowAddCarForm] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [cameraMode, setCameraMode] = useState(null);
  const [isOcrReady, setIsOcrReady] = useState(false);

  const [editingCarId, setEditingCarId] = useState(null);
  const [editMileage, setEditMileage] = useState('');
  const [editInsuranceDate, setEditInsuranceDate] = useState('');
  const [editOilMileage, setEditOilMileage] = useState('');
  const [editTechControlDate, setEditTechControlDate] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const tesseractWorkerRef = useRef(null);

  const [tenantPhoto, setTenantPhoto] = useState(null);
  const [licensePhoto, setLicensePhoto] = useState(null);

  const [newCarForm, setNewCarForm] = useState({ 
    brand: '', model: '', year: 2026, plateNumber: '', currentMileage: '', 
    insuranceExpiryDate: '2026-12-31', oilChangeMileage: '', technicalControlDate: '2026-12-31' 
  });
  
  const [contractForm, setContractForm] = useState({
    tenantName: '', tenantPhone: '', licenseNumber: '', birthDatePlace: '',
    licenseIssueDate: '', tenantAddress: 'ali mendjli', selectedCarId: '',
    startDate: '', endDate: '', pricePerDay: 6000, caution: 50000, fuelStatus: 'ربع خزان'
  });

  const [calculatedDays, setCalculatedDays] = useState(0);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [printedContract, setPrintedContract] = useState(null);

  // تهيئة المحرك مسبقاً مع تصفير الـ Cache
  useEffect(() => {
    async function initOcr() {
      try {
        if (window.Tesseract) {
          const worker = await window.Tesseract.createWorker({
            cacheMethod: 'none', // منع المتصفح من حفظ الكاش القديم للبيانات
            logger: m => console.log(m)
          });
          await worker.loadLanguage('eng+fra');
          await worker.initialize('eng+fra');
          tesseractWorkerRef.current = worker;
          setIsOcrReady(true);
        }
      } catch (err) {
        console.error("عطل في تهيئة المحرك مسبقاً:", err);
      }
    }
    initOcr();

    return () => {
      if (tesseractWorkerRef.current) {
        tesseractWorkerRef.current.terminate();
      }
    };
  }, []);

  useEffect(() => {
    if (contractForm.startDate && contractForm.endDate) {
      const start = new Date(contractForm.startDate);
      const end = new Date(contractForm.endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
      
      if (diffDays > 0) {
        setCalculatedDays(diffDays);
        setCalculatedTotal(diffDays * Number(contractForm.pricePerDay || 0));
      } else {
        setCalculatedDays(1);
        setCalculatedTotal(1 * Number(contractForm.pricePerDay || 0));
      }
    } else {
      setCalculatedDays(0);
      setCalculatedTotal(0);
    }
  }, [contractForm.startDate, contractForm.endDate, contractForm.pricePerDay]);

  const handleAddCarSubmit = (e) => {
    e.preventDefault();
    const addedCar = { 
      id: "car_" + (fleet.length + 1), 
      ...newCarForm, 
      currentMileage: Number(newCarForm.currentMileage),
      oilChangeMileage: Number(newCarForm.oilChangeMileage),
      status: "available" 
    };
    setFleet([...fleet, addedCar]);
    setShowAddCarForm(false);
    setNewCarForm({ brand: '', model: '', year: 2026, plateNumber: '', currentMileage: '', insuranceExpiryDate: '2026-12-31', oilChangeMileage: '', technicalControlDate: '2026-12-31' });
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
      ...car, 
      currentMileage: Number(editMileage), 
      insuranceExpiryDate: editInsuranceDate,
      oilChangeMileage: Number(editOilMileage),
      technicalControlDate: editTechControlDate
    } : car));
    setEditingCarId(null);
  };

  const toggleCarStatus = (id) => {
    setFleet(fleet.map(car => car.id === id ? { ...car, status: car.status === 'available' ? 'rented' : 'available' } : car));
  };

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
      alert("صلاحية الكاميرا مطلوبة.");
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
    if (cameraMode === 'license') { 
      setLicensePhoto(dataUrl); 
      executeLocalOcrScan(dataUrl); 
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setCameraMode(null);
  };

  const handleFileUpload = (e, mode) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (mode === 'tenant') setTenantPhoto(dataUrl);
      if (mode === 'license') { 
        setLicensePhoto(dataUrl); 
        executeLocalOcrScan(dataUrl); 
      }
    };
    reader.readAsDataURL(file);
  };

  // دالة المسح الذكي بعد التصفير الإجباري والكامل لمنع تداخل البيانات القديمة
  const executeLocalOcrScan = async (base64Image) => {
    setIsLoadingAI(true);
    
    // خطوة ذهبية: تصفير حقول المستأجر فوراً لمنع بقاء أي بيانات قديمة على الشاشة
    setContractForm(prev => ({
      ...prev,
      tenantName: "جاري القراءة...",
      licenseNumber: "جاري القراءة...",
      birthDatePlace: "",
      licenseIssueDate: ""
    }));

    try {
      if (!tesseractWorkerRef.current) {
        alert("المحرك الذكي ما زال يستعد في الخلفية، انتظر ثانيتين وارفع الصورة مجدداً.");
        setIsLoadingAI(false);
        return;
      }

      const { data: { text } } = await tesseractWorkerRef.current.recognize(base64Image);
      let rawText = text ? text.toUpperCase() : "";

      let cleanLicense = "";
      let cleanName = "";
      let cleanBirth = "";
      let cleanIssue = "";

      const numMatches = rawText.match(/\b\d{5,18}\b/g);
      if (numMatches && numMatches.length > 0) {
        cleanLicense = numMatches[0];
      }

      const lines = rawText.split('\n');
      const standardKeywords = ["MINISTERE", "PERMIS", "REPUBLIQUE", "CONDUITE", "ALGERIENNE", "DEMOCRATIQUE", "DRIVING", "LICENSE", "ROUTIERE"];

      for (let line of lines) {
        let trimmed = line.trim().toUpperCase();

        const dateMatch = trimmed.match(/\d{2}[\.\/-]\d{2}[\.\/-]\d{4}/);
        if (dateMatch) {
          if (trimmed.includes("1.") || trimmed.includes("3.") || trimmed.includes("NAISSANCE") || trimmed.includes("MILAD")) {
            cleanBirth = dateMatch[0];
          } else if (trimmed.includes("4A.") || trimmed.includes("DELIVRE") || trimmed.includes("صدور")) {
            cleanIssue = dateMatch[0];
          }
        }

        let alphabeticalClean = trimmed.replace(/[^A-Z\s\-]/g, "").trim();
        if (alphabeticalClean.length > 6 && !cleanName) {
          const isForbidden = standardKeywords.some((keyword) => alphabeticalClean.includes(keyword));
          if (!isForbidden) {
            cleanName = alphabeticalClean;
          }
        }
      }

      // تحديث الحقول بالقيم الجديدة النظيفة فقط، وإذا كانت فارغة يتم تركها للمستخدم ليكتبها بنفسه
      setContractForm(prev => ({
        ...prev,
        tenantName: cleanName || "",
        licenseNumber: cleanLicense || "",
        birthDatePlace: cleanBirth ? `${cleanBirth} قسنطينة` : "",
        licenseIssueDate: cleanIssue ? `صادرة بتاريخ: ${cleanIssue}` : ""
      }));

    } catch (err) {
      console.error("عطل بالمعالجة الحية لـ Tesseract:", err);
      // في حال حدوث خطأ، نقوم بتنظيف خانات النص حتى لا تبقى معلقة
      setContractForm(prev => ({
        ...prev,
        tenantName: "",
        licenseNumber: "",
        birthDatePlace: "",
        licenseIssueDate: ""
      }));
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleOriginalPrintSubmit = (e) => {
    e.preventDefault();
    if (!contractForm.selectedCarId) {
      alert("يرجى اختيار مركبة أولاً.");
      return;
    }
    const targetCar = fleet.find(car => car.id === contractForm.selectedCarId);
    const activeDays = calculatedDays || 1;
    
    const drivenDistance = activeDays * 250;
    const newUpdatedMileage = Number(targetCar.currentMileage) + drivenDistance;

    setFleet(fleet.map(car => 
      car.id === contractForm.selectedCarId 
        ? { ...car, currentMileage: newUpdatedMileage, status: 'rented' } 
        : car
    ));

    setPrintedContract({
      ...contractForm, 
      carDetails: { ...targetCar, currentMileage: targetCar.currentMileage },
      days: activeDays, 
      total: calculatedTotal || contractForm.pricePerDay, 
      photo: tenantPhoto,
      dateString: new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR')
    });

    setTimeout(() => { 
      window.print(); 
      setPrintedContract(null); 
      setActiveTab('dashboard'); 
    }, 2000);
  };

  const getExpiryBadge = (expiryStr, type = "date") => {
    if (!expiryStr) return { label: "غير محدد", color: "#f3f4f6", text: "#4b5563" };
    if (type === "date") {
      const days = Math.ceil((new Date(expiryStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      if (days < 0) return { label: "منتهي ❌", color: "#fee2e2", text: "#991b1b" };
      if (days <= 30) return { label: "قريب جداً ⚠️", color: "#fef3c7", text: "#92400e" };
      return { label: "ساري ✅", color: "#dcfce7", text: "#166534" };
    }
    return { label: "ساري ✅", color: "#dcfce7", text: "#166534" };
  };

  const getOilStatusBadge = (current, target) => {
    if (!target) return { label: "غير محدد", color: "#f3f4f6", text: "#4b5563" };
    const remaining = target - current;
    if (remaining <= 0) return { label: "تغيير فوري 🚨", color: "#fee2e2", text: "#991b1b" };
    if (remaining <= 1000) return { label: `وشيك (${remaining} كم) ⚠️`, color: "#fef3c7", text: "#92400e" };
    return { label: `${remaining} كم متبقي`, color: "#e0f2fe", text: "#0369a1" };
  };

  return (
    <div style={styles.appContainer} dir="rtl">
      
      <style dangerouslySetInnerHTML={{__html: `
        @media screen {
          .print-only-layout { display: none !important; }
          .screen-only-layout { display: block !important; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0mm !important; }
          html, body, #root {
            background: #ffffff !important; color: #000000 !important;
            margin: 0 !important; padding: 0 !important; width: 100% !important; height: auto !important;
          }
          .screen-only-layout, .no-print { display: none !important; }
          .print-only-layout { display: block !important; width: 100% !important; }
          
          .print-page {
            display: block !important; box-sizing: border-box !important; page-break-after: always !important;
            page-break-inside: avoid !important; width: 210mm !important; height: 297mm !important;
            max-height: 297mm !important; overflow: hidden !important; padding: 25px 35px !important;
            position: relative !important; background: #ffffff !important; color: #000000 !important;
          }
          
          .print-page::before {
            content: "" !important; position: absolute !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%, -50%) !important; width: 420px !important; height: 420px !important;
            background-image: url('/logo.png') !important; background-size: contain !important;
            background-repeat: no-repeat !important; background-position: center !important;
            opacity: 0.05 !important; z-index: 0 !important; pointer-events: none !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          
          .print-page * { color: #000000 !important; background: transparent !important; z-index: 1 !important; }
          .print-page:last-child { page-break-after: avoid !important; }
          
          .document-title {
            text-align: center; background-color: #1a365d !important; color: white !important;
            padding: 8px; font-size: 14px; font-weight: bold; margin: 12px 0; border-radius: 4px;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .law-section { margin-bottom: 12px; page-break-inside: avoid; }
          .section-title {
            background-color: #f1f5f9 !important; border-right: 4px solid #1a365d !important;
            padding: 6px 12px; font-size: 12px; font-weight: bold; color: #1a365d !important; margin: 0 0 6px 0;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .bilingual-box { display: flex !important; justify-content: space-between; gap: 15px; width: 100%; }
          .column-ar { width: 50%; direction: rtl; text-align: justify; font-size: 11px; font-weight: bold; line-height: 1.4; }
          .column-fr { width: 50%; direction: ltr; text-align: justify; font-size: 10.5px; border-left: 1px dashed #cbd5e1; padding-left: 10px; line-height: 1.4; }
          
          .signatures-table { display: flex !important; justify-content: space-between; margin-top: 35px; page-break-inside: avoid; }
          .signature-cell { width: 48%; text-align: center; }
          .signature-box { border: 1px solid #a0aec0; height: 95px; width: 90%; margin: 8px auto 0 auto; border-radius: 4px; background-color: #f8fafc !important; }
          .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .print-table td { border: 1px solid #000000 !important; padding: 10px; font-size: 13px; color: black !important; }
          
          .contract-grid-main { display: flex !important; justify-content: space-between; gap: 20px; margin-top: 15px; }
          .contract-block { width: 48%; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; position: relative; }
          .contract-block h5 { margin: 0 0 8px 0; font-size: 13px; border-bottom: 1px solid #000; padding-bottom: 4px; }
          .contract-block p { margin: 5px 0; font-size: 12px; line-height: 1.5; }
          
          .photo-inside-tenant { position: absolute; left: 12px; top: 40px; width: 85px; height: 110px; border: 1px solid #000; overflow: hidden; border-radius: 4px; }
        }
      `}} />

      <div className="screen-only-layout">
        <header style={styles.header}>
          <h1 style={styles.mainTitleText}>✨ BELAGHA MOTORS</h1>
          <div>
            <button style={styles.navBtn} onClick={() => setActiveTab('dashboard')}>إدارة الأسطول</button>
            <button style={styles.navBtn} onClick={() => setActiveTab('new-contract')}>+ عقد جديد</button>
          </div>
        </header>

        <div style={styles.apiConfigurationZone}>
          <span style={{ color: isOcrReady ? '#166534' : '#b91c1c', fontWeight: 'bold', fontSize: '14px' }}>
            {isOcrReady ? "✅ تم تنشيط محرك المسح الفوري المحدث وحماية الذاكرة من الكاش المؤقت!" : "⏳ جاري إيقاظ وتدريب المحرك الداخلي للطباعة والمسح الفوري..."}
          </span>
        </div>

        {isLoadingAI && <div style={styles.loadingBanner}>⏳ جاري تنظيف الحقول القديمة واستخلاص نصوص الوثيقة الجديدة حياً...</div>}

        {cameraMode && (
          <div style={styles.cameraOverlay}>
            <div style={styles.cameraModal}>
              <video ref={videoRef} autoPlay playsInline muted style={styles.videoStreamContainer}></video>
              <div style={styles.cameraActionRow}>
                <button type="button" onClick={capturePhoto} style={styles.cameraBtn}>📸 التقاط</button>
                <button type="button" onClick={() => setCameraMode(null)} style={styles.cameraCancelBtn}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <main style={styles.mainContent}>
            <div style={styles.sectionHeaderRow}>
              <h2>مراقبة الأسطول وتتبع الصيانة والتأمين الدورية</h2>
              <button style={styles.addCarMainBtn} onClick={() => setShowAddCarForm(!showAddCarForm)}>{showAddCarForm ? "✖" : "➕ إضافة سيارة"}</button>
            </div>

            {showAddCarForm && (
              <div style={styles.addCarCardContainer}>
                <form onSubmit={handleAddCarSubmit} style={styles.addCarGridForm}>
                  <div style={styles.inputGroup}><label>الماركة:</label><input type="text" required value={newCarForm.brand} onChange={e=>setNewCarForm({...newCarForm, brand:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>الموديل:</label><input type="text" required value={newCarForm.model} onChange={e=>setNewCarForm({...newCarForm, model:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم اللوحة:</label><input type="text" required value={newCarForm.plateNumber} onChange={e=>setNewCarForm({...newCarForm, plateNumber:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>العداد الحالي (كم):</label><input type="number" required value={newCarForm.currentMileage} onChange={e=>setNewCarForm({...newCarForm, currentMileage:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>تاريخ انتهاء التأمين:</label><input type="date" required value={newCarForm.insuranceExpiryDate} onChange={e=>setNewCarForm({...newCarForm, insuranceExpiryDate:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>عداد تغيير الزيت القادم:</label><input type="number" required value={newCarForm.oilChangeMileage} onChange={e=>setNewCarForm({...newCarForm, oilChangeMileage:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>موعد المراقبة التقنية:</label><input type="date" required value={newCarForm.technicalControlDate} onChange={e=>setNewCarForm({...newCarForm, technicalControlDate:e.target.value})} style={styles.input}/></div>
                  <button type="submit" style={styles.saveCarBtn}>💾 حفظ وإضافة السيارة</button>
                </form>
              </div>
            )}

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th>السيارة والمعلومات</th>
                    <th>العداد الحالي</th>
                    <th>التأمين (Assurance)</th>
                    <th>تغيير الزيت (Vidange)</th>
                    <th>المراقبة التقنية (Contrôle Technique)</th>
                    <th>خيارات التحكم</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.map(car => {
                    const insBadge = getExpiryBadge(car.insuranceExpiryDate, "date");
                    const techBadge = getExpiryBadge(car.technicalControlDate, "date");
                    const oilBadge = getOilStatusBadge(car.currentMileage, car.oilChangeMileage);
                    const isEditing = editingCarId === car.id;

                    return (
                      <tr key={car.id} style={styles.tr}>
                        <td style={styles.td}><strong>{car.brand} {car.model}</strong><br/><span style={{fontSize:'12px', color:'#64748b'}}>{car.plateNumber}</span></td>
                        
                        <td style={styles.monospaceTd}>
                          {isEditing ? (
                            <input type="number" value={editMileage} onChange={(e) => setEditMileage(e.target.value)} style={styles.inlineInput} />
                          ) : (
                            `${car.currentMileage} كم`
                          )}
                        </td>
                        
                        <td style={styles.td}>
                          {isEditing ? (
                            <input type="date" value={editInsuranceDate} onChange={(e) => setEditInsuranceDate(e.target.value)} style={styles.inlineInput} />
                          ) : (
                            <div>
                              <span style={{...styles.badge, backgroundColor: insBadge.color, color: insBadge.text}}>{insBadge.label}</span>
                              <div style={{fontSize:'11px', marginTop:'2px'}}>{car.insuranceExpiryDate}</div>
                            </div>
                          )}
                        </td>
                        
                        <td style={styles.td}>
                          {isEditing ? (
                            <input type="number" value={editOilMileage} onChange={(e) => setEditOilMileage(e.target.value)} style={styles.inlineInput} />
                          ) : (
                            <div>
                              <span style={{...styles.badge, backgroundColor: oilBadge.color, color: oilBadge.text}}>{oilBadge.label}</span>
                              <div style={{fontSize:'11px', marginTop:'2px', color:'#475569'}}>المستهدف: {car.oilChangeMileage} كم</div>
                            </div>
                          )}
                        </td>

                        <td style={styles.td}>
                          {isEditing ? (
                            <input type="date" value={editTechControlDate} onChange={(e) => setEditTechControlDate(e.target.value)} style={styles.inlineInput} />
                          ) : (
                            <div>
                              <span style={{...styles.badge, backgroundColor: techBadge.color, color: techBadge.text}}>{techBadge.label}</span>
                              <div style={{fontSize:'11px', marginTop:'2px'}}>{car.technicalControlDate}</div>
                            </div>
                          )}
                        </td>

                        <td style={styles.td}>
                          {isEditing ? (
                            <button type="button" onClick={() => saveCarEdits(car.id)} style={styles.actionSaveBtn}>حفظ 💾</button>
                          ) : (
                            <button type="button" onClick={() => startEditingCar(car)} style={styles.actionEditBtn}>تعديل ⚙️</button>
                          )}
                        </td>

                        <td style={styles.td}><button type="button" onClick={() => toggleCarStatus(car.id)} style={{...styles.statusToggleBtn, backgroundColor: car.status === 'available' ? '#dcfce7' : '#fee2e2', color: car.status === 'available' ? '#166534' : '#991b1b'}}>{car.status === 'available' ? 'متاحة' : 'مكراة'}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </main>
        )}

        {activeTab === 'new-contract' && (
          <main style={styles.mainContent}>
            <div style={styles.formCard}>
              <form onSubmit={handleOriginalPrintSubmit}>
                <h3>1. صورة وجه المستأجر الحية</h3>
                <div style={styles.cameraBox}>
                  <div style={styles.cameraView}>{tenantPhoto ? <img src={tenantPhoto} alt="الزبون" style={styles.fullCoverImage} /> : "لا توجد صورة"}</div>
                  <button type="button" onClick={() => startCamera('tenant')} style={styles.cameraBtn}>📷 تشغيل الكاميرا</button>
                  <label style={styles.uploadLabelStandard}>📂 اختيار ملف جاهز<input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'tenant')} style={{display:'none'}}/></label>
                </div>

                <h3 style={{marginTop:'20px'}}>2. قراءة رخصة السياقة بالذكاء الاصطناعي (محدث ومحمي)</h3>
                <div style={styles.cameraBox}>
                  <div style={styles.cameraView}>{licensePhoto ? <img src={licensePhoto} alt="الرخصة" style={styles.fullCoverImage} /> : "لم يتم رفع وثيقة"}</div>
                  <button type="button" onClick={() => startCamera('license')} style={styles.cameraBtn}>⚡ مسح بالكاميرا</button>
                  <label style={styles.uploadLabelBlue}>📂 رفع ملف الرخصة الجديد</label>
                  <input type="file" accept="image/*" onClick={(e) => { e.target.value = null }} onChange={(e) => handleFileUpload(e, 'license')} style={{display:'none'}} id="license-file-input"/>
                </div>

                <div style={styles.formGrid}>
                  <div style={styles.inputGroup}><label>الاسم واللقب بالكامل:</label><input type="text" required value={contractForm.tenantName} onChange={e => setContractForm({...contractForm, tenantName: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم رخصة السياقة:</label><input type="text" required value={contractForm.licenseNumber} onChange={e => setContractForm({...contractForm, licenseNumber: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم الهاتف المعتمد:</label><input type="text" required value={contractForm.tenantPhone} onChange={e => setContractForm({...contractForm, tenantPhone: e.target.value})} style={styles.input}/></div>
                </div>
                <div style={styles.formGrid}>
                  <div style={styles.inputGroup}><label>تاريخ ومكان الميلاد:</label><input type="text" required value={contractForm.birthDatePlace} onChange={e => setContractForm({...contractForm, birthDatePlace: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>تاريخ صدور الرخصة:</label><input type="text" required value={contractForm.licenseIssueDate} onChange={e => setContractForm({...contractForm, licenseIssueDate: e.target.value})} style={styles.input}/></div>
                </div>

                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop:'20px'}}>
                  <div style={styles.inputGroup}>
                    <label>اختر السيارة للكراء:</label>
                    <select required value={contractForm.selectedCarId} onChange={e => setContractForm({...contractForm, selectedCarId: e.target.value})} style={styles.input}>
                      <option value="">-- اختر المركبة المتاحة --</option>
                      {fleet.map(car => (<option key={car.id} value={car.id} disabled={car.status !== 'available'}>{car.brand} {car.model} ({car.plateNumber})</option>))}
                    </select>
                  </div>
                  <div style={styles.inputGroup}><label>تاريخ الاستلام:</label><input type="datetime-local" required value={contractForm.startDate} onChange={e => setContractForm({...contractForm, startDate: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>تاريخ الإرجاع وعودة المركبة:</label><input type="datetime-local" required value={contractForm.endDate} onChange={e => setContractForm({...contractForm, endDate: e.target.value})} style={styles.input}/></div>
                </div>

                <div style={styles.formGridCombined}>
                  <div style={styles.inputGroup}><label>السعر لليوم (دج):</label><input type="number" required value={contractForm.pricePerDay} onChange={e => setContractForm({...contractForm, pricePerDay: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>مبلغ الضمان / Caution (دج):</label><input type="number" required value={contractForm.caution} onChange={e => setContractForm({...contractForm, caution: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>حالة خزان الوقود:</label><input type="text" required value={contractForm.fuelStatus} onChange={e => setContractForm({...contractForm, fuelStatus: e.target.value})} style={styles.input}/></div>
                </div>

                <button type="submit" style={styles.submitButton}>💾 توليد وحفظ عقد الكراء النهائي للطباعة</button>
              </form>
            </div>
          </main>
        )}
      </div>

      <div className="print-only-layout">
          {printedContract && (
            <>
              {/* الورقة 1 */}
              <div className="print-page">
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '12px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right', fontSize: '12px', color: 'black' }}>
                    <p>📍 Constantine, Algérie &nbsp;|&nbsp; 📞 0554 28 19 83</p>
                    <p>RC: 25/00-038169 A 15 &nbsp;|&nbsp; NIF: 1852501093731100000</p>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '20px' }}>BELAGHA MOTORS</div>
                </div>
                
                <h3 style={{ textDecoration: 'underline', textAlign: 'center', margin: '10px 0', fontSize: '16px', fontWeight: 'bold' }}>عقد كراء سيارة</h3>
                
                <div className="contract-grid-main">
                  <div className="contract-block" style={{ paddingLeft: '105px' }}>
                    <h5>1. معلومات المستأجر</h5>
                    <p><strong>الاسم واللقب:</strong> {printedContract.tenantName}</p>
                    <p><strong>تاريخ ومكان الميلاد:</strong> {printedContract.birthDatePlace}</p>
                    <p><strong>رخصة سياقة رقم:</strong> {printedContract.licenseNumber}</p>
                    <p><strong>صادرة في:</strong> {printedContract.licenseIssueDate}</p>
                    <p><strong>العنوان:</strong> {printedContract.tenantAddress}</p>
                    <p><strong>رقم الهاتف:</strong> {printedContract.tenantPhone}</p>
                    <div className="photo-inside-tenant">
                      {printedContract.photo && <img src={printedContract.photo} alt="الزبون" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                  </div>

                  <div className="contract-block">
                    <h5>2. معلومات السيارة والكراء</h5>
                    <p><strong>النوع والموديل:</strong> {printedContract.carDetails?.brand} {printedContract.carDetails?.model}</p>
                    <p><strong>اللوحة المنجمية:</strong> {printedContract.carDetails?.plateNumber} | <strong>الوقود:</strong> {printedContract.fuelStatus}</p>
                    <p><strong>تاريخ الاستلام:</strong> {printedContract.startDate}</p>
                    <p><strong>تاريخ الإرجاع:</strong> {printedContract.endDate}</p>
                    <p><strong>السعر لليوم:</strong> {printedContract.pricePerDay} دج | <strong>المدة:</strong> {printedContract.days} يوم</p>
                    <p><strong>الإجمالي:</strong> {printedContract.total} دج | <strong>الضمان:</strong> {printedContract.caution} دج</p>
                  </div>
                </div>

                <div className="document-title" style={{ marginTop: '15px' }}>الشروط القانونية والتزامات المستأجر (الجزء الأول)</div>

                <div className="law-section">
                  <div className="section-title">1. حالة السيارة والحوادث / État du Véhicule & Accidents</div>
                  <div className="bilingual-box">
                    <div className="column-ar">المستأجر يقر أنه استأجر السيارة في حالة جيدة وبها كامل لوازمها، وفي حالة وقوع أي حادث أو عطب يجب إعلام الوكالة فوراً دون أي تأخير. في حالة حادث أو تحطم، المستأجر ملزم بدفع تكاليف الإصلاح نقداً وفوراً. في حال التضرر الكبير، يتحمل دفع قيمة السيارة بالكامل.</div>
                    <div className="column-fr">Le locataire reconnaît avoir loué le véhicule en bon état et avec tous ses accessoires. En cas d'accident ou de panne, il doit informer l'agence immédiatement. En cas d'accident, le locataire paie les frais de réparation en espèces. Si le dommage est majeur, il est redevable de la valeur totale du véhicule.</div>
                  </div>
                </div>

                <div className="law-section">
                  <div className="section-title">2. القيادة والمسؤولية / Conduite & Responsabilité</div>
                  <div className="bilingual-box">
                    <div className="column-ar">لا يسمح بكراء السيارة للغير أو قيادتها من طرف شخص آخر إلا لمن حرر عقد الإيجار باسمه. وفي حالة المخالفة، يحق للوكالة استرجاع السيارة فوراً مع إلغاء العقد ودون إرجاع أي تعويض مالي. كما أنه يمنع منعاً باتاً خروج المركبة خارج التراب الوطني الجزائري.</div>
                    <div className="column-fr">La sous-location ou la conduite du véhicule par une tierce personne non mentionnée dans le présent contrat est strictly interdite. En cas d'infraction, l'agence se réserve le droit de récupérer le véhicule immédiatement sans aucun remboursement.</div>
                  </div>
                </div>

                <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign: 'center', fontWeight: 'bold' }}>1/3</div>
              </div>

              {/* الورقة 2 */}
              <div className="print-page">
                <div className="document-title">تتمة الالتزامات والشروط القانونية (الجزء الثاني) / CONDITIONS GÉNÉRALES</div>

                <div className="law-section">
                  <div className="section-title">3. التأخير في الإرجاع / Retard de Restitution</div>
                  <div className="bilingual-box">
                    <div className="column-ar">يلتزم المستأجر بإعادة المركبة في الوقت والتاريخ المحددين في العقد. أي تأخير عن موعد إرجاع السيارة يلزم المستأجر تلقائياً بدفع غرامة تأخير قدرها 1500 دج عن كل ساعة تأخير إضافية.</div>
                    <div className="column-fr">Tout retard dans la restitution entraîne automatiquement une pénalité de 1500 DA par heure de retard.</div>
                  </div>
                </div>

                <div className="law-section">
                  <div className="section-title">4. السرقة أو الضياع / Perte ou Vol</div>
                  <div className="bilingual-box">
                    <div className="column-ar">في حالة ضياع المركبة أو تعرضها للسرقة، تقع المسؤولية المدنية والكاملة على عاتق المستأجر، حيث يلزم قانوناً بدفع 100% من القيمة المالية الحالية الإجمالية للمركبة للوكالة.</div>
                    <div className="column-fr">En cas de perte ou de vol du véhicule, le locataire est tenu pour seul responsable et doit rembourser 100% de la valeur totale et réelle du véhicule à l'agence.</div>
                  </div>
                </div>

                <div className="law-section">
                  <div className="section-title">5. وثائق ومواقيت العمل / Documents & Heures de Travail</div>
                  <div className="bilingual-box">
                    <div className="column-ar">البطاقة الرمادية الأصلية للمركبة لا تسلم للزبون نهائياً ويتم تسليمه نسخة مصدقة فقط. أوقات العمل الرسمية للوكالة لاستلام وإرجاع المركبات تكون من الساعة (08:00 صباحاً إلى غاية 18:00 مساءً).</div>
                    <div className="column-fr">La carte grise originale du véhicule n'est pas remise au client. Les heures de travail officielles de l'agence pour la réception et la restitution sont de (08:00 à 18:00).</div>
                  </div>
                </div>

                <div className="law-section">
                  <div className="section-title">6. الوقود والنظافة / Carburant & Propreté</div>
                  <div className="bilingual-box">
                    <div className="column-ar">يجب على المستأجر إعادة المركبة بنفس مستوى الوقود الذي استلمها به، وأن تكون نظيفة داخلياً وخارجياً. في حالة الإخلال بنظافة السيارة، تطبق على المستأجر رسوم غسيل وتنظيف إضافية قيمتها 2000 دج.</div>
                    <div className="column-fr">Le locataire doit restituer le véhicule avec le même niveau de carburant qu'à la livraison et dans un état propre. À défaut, des frais de lavage applicables de 2000 DA seront facturés.</div>
                  </div>
                </div>

                <div className="law-section">
                  <div className="section-title">7. المخالفات والمحشر / Infractions & Fourrière</div>
                  <div className="bilingual-box">
                    <div className="column-ar">المستأجر مسؤول مسؤولية مدنية وجزائية كاملة عن جميع المخالفات المرورية وفلاشات الرادار الملتقطة خلال فترة إيجاره للمركبة. وفي حالة وضع المركبة في المحشر البلدي، يتحمل المستأجر وحده جميع مصاريف استخراجها بالإضافة إلى دفع مستحقات أيام التوقف كاملة للوكالة.</div>
                    <div className="column-fr">Le locataire est pénalement et civilement responsable de toutes les infractions routières et flashs radar durant la période de location. En cas de mise en fourrière, le locataire paie la totalité des frais de récupération ainsi que le montant des jours d'immobilisation du véhicule.</div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '10px', border: '1px dashed #a0aec0', borderRadius: '4px', fontSize: '11px', marginTop: '15px' }}>
                  <strong>إقرار وقبول المستأجر:</strong> يقر المستأجر بأنه قد اطلع على كافة الشروط والالتزامات الواردة أعلاه باللغتين العربية والفرنسية، ويوافق عليها موافقة تامة ويلتزم بتطبيقها دون قيد أو شرط بمجرد توقيعه.
                </div>

                <div className="signatures-table">
                  <div className="signature-cell">
                    <strong>توقيع وبصمة المستأجر</strong>
                    <div className="signature-box"></div>
                  </div>
                  <div className="signature-cell">
                    <strong>ختم وتوقيع الوكالة المعتمد</strong>
                    <div className="signature-box"></div>
                  </div>
                </div>
                
                <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign: 'center', fontWeight: 'bold' }}>2/3</div>
              </div>

              {/* الورقة 3 */}
              <div className="print-page">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '2px solid black', paddingBottom: '10px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '18px' }}>BELAGHA MOTORS FINANCE</div>
                  <span style={{ fontSize: '11px' }}>وصل استلام مالي رسمي موثق للعميل</span>
                </div>
                
                <div style={{ marginTop: '40px' }}>
                  <h3 style={{ textAlign: 'center', margin: '0 0 25px 0', fontWeight: 'bold', fontSize: '15px', color: 'black' }}>QUITTANCE DE PAIEMENT / وصل استلام مالي رسمي</h3>
                  <table className="print-table">
                    <tbody>
                      <tr><td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', width: '35%' }}>التاريخ والوقت الإداري / Date</td><td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{printedContract.dateString}</td></tr>
                      <tr><td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>استلمنا من السيد(ة) / Client</td><td style={{ fontWeight: 'bold', fontSize: '14px' }}>{printedContract.tenantName}</td></tr>
                      <tr><td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>المركبة المؤجرة ومواصفاتها</td><td>{printedContract.carDetails?.brand} {printedContract.carDetails?.model} ({printedContract.carDetails?.plateNumber})</td></tr>
                      <tr><td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>مبلغ الكراء الإجمالي المدفوع نقداً</td><td style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a365d' }}>{printedContract.total} دج</td></tr>
                      <tr><td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>مبلغ الضمان المودع للوكالة (Caution)</td><td style={{ fontWeight: 'bold', fontSize: '14px' }}>{printedContract.caution} دج</td></tr>
                    </tbody>
                  </table>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '220px', fontWeight: 'bold', color: 'black' }}>
                    <div className="signature-cell"><span>توقيع وتأكيد الزبون المستلم</span><div style={{ border: '1px solid #000', height: '85px', marginTop: '10px', borderRadius: '4px', backgroundColor: '#f8fafc' }}></div></div>
                    <div className="signature-cell"><span>ختم وإمضاء مصلحة الحسابات والمالية</span><div style={{ border: '1px solid #000', height: '85px', marginTop: '10px', borderRadius: '4px', backgroundColor: '#f8fafc' }}></div></div>
                  </div>
                </div>
                <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign: 'center', fontWeight: 'bold' }}>3/3</div>
              </div>
            </>
          )}
      </div>
    </div>
  );
}

const styles = {
  appContainer: { fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', minHeight: '100vh' },
  header: { backgroundColor: '#1e293b', color: '#fff', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  mainTitleText: { fontSize: '20px', margin: 0, fontWeight: 'bold' },
  navBtn: { color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#3b82f6', marginLeft: '5px', fontWeight: 'bold' },
  apiConfigurationZone: { padding: '15px 30px', backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1', textAlign: 'center' },
  loadingBanner: { backgroundColor: '#7c3aed', color: 'white', textAlign: 'center', padding: '12px', fontWeight: 'bold', fontSize: '14px' },
  cameraOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  cameraModal: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '500px' },
  videoStreamContainer: { width: '100%', height: 'auto', borderRadius: '8px', backgroundColor: '#000' },
  cameraActionRow: { display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'center' },
  cameraCancelBtn: { backgroundColor: '#b91c1c', color: 'white', padding: '8px 14px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
  mainContent: { padding: '20px' },
  sectionHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  addCarMainBtn: { backgroundColor: '#1e3a8a', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  addCarCardContainer: { backgroundColor: '#f8fafc', padding: '20px', marginBottom: '25px', borderRadius: '8px' },
  addCarGridForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  saveCarBtn: { gridColumn: '1 / -1', backgroundColor: '#166534', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  tableWrapper: { backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'right' },
  thRow: { backgroundColor: '#f1f5f9' },
  tr: { borderBottom: '1px solid #edf2f7' },
  td: { padding: '12px', verticalAlign: 'middle' },
  monospaceTd: { padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', verticalAlign: 'middle' },
  inlineInput: { width: '100px', padding: '5px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' },
  actionEditBtn: { backgroundColor: '#1e3a8a', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  actionSaveBtn: { backgroundColor: '#166534', color: 'white', padding: '5px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  badge: { padding: '4px 8px', borderRadius: '50px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' },
  statusToggleBtn: { border: 'none', padding: '5px 10px', borderRadius: '50px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' },
  cameraBox: { display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#f9fafb', padding: '15px', borderRadius: '6px', marginTop: '5px' },
  cameraView: { width: '100px', height: '115px', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #9ca3af', borderRadius: '4px', overflow: 'hidden', color: '#6b7280', fontSize: '12px' },
  fullCoverImage: { width: '100%', height: '100%', objectFit: 'cover' },
  cameraBtn: { backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  uploadLabelStandard: { backgroundColor: '#4b5563', color: 'white', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  uploadLabelBlue: { backgroundColor: '#0284c7', color: 'white', padding: '8px 14px', cursor: 'pointer', display: 'inline-block', fontWeight: 'bold', fontSize: '13px', borderRadius: '4px' },
  formCard: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '10px' },
  formGridCombined: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', borderTop: '1px dashed #e5e7eb', paddingTop: '15px', marginTop: '15px' },
  input: { padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' },
  submitButton: { width: '100%', backgroundColor: '#166534', color: 'white', padding: '14px', border: 'none', borderRadius: '6px', marginTop: '20px', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }
};

export default App;
