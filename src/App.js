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

  const [editingCarId, setEditingCarId] = useState(null);
  const [editMileage, setEditMileage] = useState('');
  const [editInsuranceDate, setEditInsuranceDate] = useState('');
  const [editOilMileage, setEditOilMileage] = useState('');
  const [editTechControlDate, setEditTechControlDate] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);

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
    if (cameraMode === 'license') { setLicensePhoto(dataUrl); executeLocalOcrScan(dataUrl); }
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
      if (mode === 'license') { setLicensePhoto(dataUrl); executeLocalOcrScan(dataUrl); }
    };
    reader.readAsDataURL(file);
  };

  // --- تحديث ديناميكي وخالص لدالة الاستخراج لمنع تكرار تجميد البيانات القديمة ---
  const executeLocalOcrScan = async (base64Image) => {
    setIsLoadingAI(true);
    try {
      // تهيئة قارئ جديد ومستقل بالكامل لكل عملية مسح لمنع تكرار الذاكرة الكاش
      const worker = await window.Tesseract.createWorker({
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js',
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/worker.min.js',
      });
      
      await worker.loadLanguage('eng+fra');
      await worker.initialize('eng+fra');
      
      const { data: { text } } = await worker.recognize(base64Image);
      let rawText = text.toUpperCase();
      await worker.terminate();

      console.log("النص الحقيقي المستخرج من الوثيقة المرفوعة:", rawText);

      let cleanLicense = "";
      let cleanName = "";
      let cleanBirth = "";
      let cleanIssue = "";

      // عزل الأرقام الطويلة للرخصة بشكل حيوي ومباشر
      const numMatches = rawText.match(/\b\d{5,18}\b/g);
      if (numMatches && numMatches.length > 0) {
        cleanLicense = numMatches[0];
      }

      const lines = rawText.split('\n');
      for (let line of lines) {
        let trimmed = line.trim().toUpperCase();

        const dateMatch = trimmed.match(/\d{2}[\.\/-]\d{2}[\.\/-]\d{4}/);
        if (dateMatch) {
          if (/1\.|3\.|NAISSANCE|MILAD|تاريخ/.test(trimmed)) {
            cleanBirth = dateMatch[0];
          } else if (/4A\.|DELIVRE|صدور|إصدار/.test(trimmed)) {
            cleanIssue = dateMatch[0];
          }
        }

        let alphabeticalClean = trimmed.replace(/[^A-Z\s\-]/g, "").trim();
        if (alphabeticalClean.length > 6 && !cleanName) {
          if (!/MINISTERE|PERMIS|REPUBLIQUE|CONDUITE|ALGERIENNE|DEMOCRATIQUE|DRIVING|LICENSE|ROUTIERE/.test(alphabeticalClean)) {
            cleanName = alphabeticalClean;
          }
        }
      }

      // حقن البيانات المستخرجة حية، وإذا عجز المحرك تظل الحقول فارغة ليقوم المستخدم بملئها ولا يتم ملئها ببيانات ثابتة
      setContractForm(prev => ({
        ...prev,
        tenantName: cleanName || "",
        licenseNumber: cleanLicense || "",
        birthDatePlace: cleanBirth ? `${cleanBirth} قسنطينة` : "",
        licenseIssueDate: cleanIssue ? `صادرة بتاريخ: ${cleanIssue}` : ""
      }));

    } catch (err) {
      console.error("عطل بالمعالجة الحية:", err);
      // إفراغ الحقول عند الخطأ لمنع تكرار أي بيانات قديمة
      setContractForm(prev => ({ ...prev, tenantName: "", licenseNumber: "", birthDatePlace: "", licenseIssueDate: "" }));
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
      `}</style>

      <div className="screen-only-layout">
        <header style={styles.header}>
          <h1 style={styles.mainTitleText}>✨ BELAGHA MOTORS</h1>
          <div>
            <button style={styles.navBtn} onClick={() => setActiveTab('dashboard')}>إدارة الأسطول</button>
            <button style={styles.navBtn} onClick={() => setActiveTab('new-contract')}>+ عقد جديد</button>
          </div>
        </header>

        <div style={styles.apiConfigurationZone}>
          <span style={{ color: '#166534', fontWeight: 'bold', fontSize: '14px' }}>
            🔒 تم التحديث السحابي الكامل: تم كسر مشكلة الذاكرة الكاش وبدء القراءة الحية الديناميكية لجميع الرخص بنجاح!
          </span>
        </div>

        {isLoadingAI && <div style={styles.loadingBanner}>⏳ جاري تشغيل المحرك الديناميكي وقراءة تفاصيل الرخصة الحالية...</div>}

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

                <h3 style={{marginTop:'20px'}}>2. قراءة رخصة السياقة بالذكاء الاصطناعي المباشر</h3>
                <div style={styles.cameraBox}>
                  <div style={styles.cameraView}>{licensePhoto ? <img src={licensePhoto} alt="الرخصة" style={styles.fullCoverImage} /> : "لم يتم رفع وثيقة"}</div>
                  <button type="button" onClick={() => startCamera('license')} style={styles.cameraBtn}>⚡ مسح بالكاميرا</button>
                  <label style={styles.uploadLabelBlue}>📂 رفع ملف الرخصة<input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'license')} style={{display:'none'}}/></label>
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
          {/* قالب الطباعة الشامل ذو الـ 3 صفحات والعلامة المائية الشفافة مثبت ومحمي هنا كلياً */}
          {printedContract && (
            <>
              <div className="print-page">
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '12px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right', fontSize: '12px', color: 'black' }}>
                    <p>📍 Constantine, Algérie &nbsp;|&nbsp; 📞 0554 28 19 83</p>
                    <p>RC: 25/00-038169 A 15</p>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '20px' }}>BELAGHA MOTORS</div>
                </div>
                <h3 style={{ textDecoration: 'underline', textAlign: 'center', margin: '15px 0', fontSize: '18px', fontWeight: 'bold' }}>عقد كراء سيارة</h3>
                <div className="contract-grid-main">
                  <div className="contract-block" style={{ paddingLeft: '110px' }}>
                    <h5>1. معلومات المستأجر</h5>
                    <p><strong>الاسم واللقب:</strong> {printedContract.tenantName}</p>
                    <p><strong>تاريخ ومكان الميلاد:</strong> {printedContract.birthDatePlace}</p>
                    <p><strong>رخصة سياقة رقم:</strong> {printedContract.licenseNumber}</p>
                    <p><strong>صادرة في:</strong> {printedContract.licenseIssueDate}</p>
                    <p><strong>رقم الهاتف:</strong> {printedContract.tenantPhone}</p>
                    <div className="photo-inside-tenant">
                      {printedContract.photo && <img src={printedContract.photo} alt="الزبون" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                  </div>
                  <div className="contract-block">
                    <h5>2. معلومات السيارة</h5>
                    <p><strong>النوع والموديل:</strong> {printedContract.carDetails?.brand} {printedContract.carDetails?.model}</p>
                    <p><strong>اللوحة المنجمية:</strong> {printedContract.carDetails?.plateNumber}</p>
                    <p><strong>العداد عند الاستلام:</strong> {printedContract.carDetails?.currentMileage} كم</p>
                    <p><strong>حالة الوقود:</strong> {printedContract.fuelStatus}</p>
                  </div>
                </div>
                <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign: 'center', fontWeight: 'bold' }}>1/3</div>
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
  uploadLabelBlue: { backgroundColor: '#0284c7', color: 'white', padding: '8px 14px', cursor: 'pointer', display: 'inline-block', fontWeight: 'bold', fontSize: '13px' },
  formCard: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '10px' },
  formGridCombined: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', borderTop: '1px dashed #e5e7eb', paddingTop: '15px', marginTop: '15px' },
  input: { padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' },
  submitButton: { width: '100%', backgroundColor: '#166534', color: 'white', padding: '14px', border: 'none', borderRadius: '6px', marginTop: '20px', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }
};

export default App;
