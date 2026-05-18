import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

const initialFleet = [
  {
    id: "car_1",
    brand: "Rover",
    model: "XPHWEP",
    year: 1993,
    plateNumber: "03813-193-25",
    currentMileage: 156200,
    status: "available",
    nextOilChangeDue: 157000, 
    technicalCheckExpiry: "2026-05-30",
    insuranceExpiryDate: "2026-08-15",
    chassisNumber: "SAXXPHWEPAD847"
  },
  {
    id: "car_2",
    brand: "Hyundai",
    model: "i10",
    year: 2022,
    plateNumber: "12345-122-25",
    currentMileage: 49500,
    status: "rented",
    nextOilChangeDue: 49000, 
    technicalCheckExpiry: "2026-04-10", 
    insuranceExpiryDate: "2026-06-01",
    chassisNumber: "KMHCT51BMNU038"
  }
];

function App() {
  const [fleet, setFleet] = useState(initialFleet);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddCarForm, setShowAddCarForm] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [cameraMode, setCameraMode] = useState(null);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('belagha_gemini_api_key') || '');
  const [apiStatus, setApiStatus] = useState({ tested: false, success: false, message: '', modelUsed: '' });
  const [isTestingKey, setIsTestingKey] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [tenantPhoto, setTenantPhoto] = useState(null);
  const [licensePhoto, setLicensePhoto] = useState(null);

  const [newCarForm, setNewCarForm] = useState({
    brand: '', model: '', year: 2026, plateNumber: '',
    currentMileage: '', nextOilChangeDue: '', technicalCheckExpiry: '',
    insuranceExpiryDate: '', chassisNumber: ''
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
    localStorage.setItem('belagha_gemini_api_key', apiKey);
  }, [apiKey]);

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
        setCalculatedDays(0);
        setCalculatedTotal(0);
      }
    }
  }, [contractForm.startDate, contractForm.endDate, contractForm.pricePerDay]);

  const handleTestApiKey = async () => {
    if (!apiKey) {
      setApiStatus({ tested: true, success: false, message: 'ERR_EMPTY_KEY', modelUsed: '' });
      return;
    }
    setIsTestingKey(true);
    setApiStatus({ tested: false, success: false, message: '', modelUsed: '' });

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelPro = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const testResult = await modelPro.generateContent("Respond with only OK");
      const responseText = (await testResult.response).text().trim();

      if (responseText.length > 0) {
        setApiStatus({
          tested: true,
          success: true,
          message: 'SUCCESS_PRO',
          modelUsed: 'Gemini 1.5 Pro'
        });
      }
    } catch (proErr) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelFlash = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const testFlash = await modelFlash.generateContent("OK");
        const flashRes = (await testFlash.response).text().trim();

        if (flashRes.length > 0) {
          setApiStatus({
            tested: true,
            success: true,
            message: 'SUCCESS_FLASH',
            modelUsed: 'Gemini 1.5 Flash'
          });
        }
      } catch (flashErr) {
        let errMsg = flashErr.message || '';
        let finalErr = 'ERR_UNKNOWN';
        
        if (errMsg.includes("API key not valid")) {
          finalErr = 'ERR_INVALID_KEY';
        } else if (errMsg.includes("BILLING_LIMIT") || errMsg.includes("quota")) {
          finalErr = 'ERR_BILLING';
        } else if (errMsg.includes("location") || errMsg.includes("not supported")) {
          finalErr = 'ERR_LOCATION';
        }
        setApiStatus({ tested: true, success: false, message: finalErr, modelUsed: '' });
      }
    } finally {
      setIsTestingKey(false);
    }
  };

  const getExpiryBadge = (expiryStr) => {
    if (!expiryStr) return { label: "غير محدد", color: "#f3f4f6", text: "#4b5563" };
    const days = Math.ceil((new Date(expiryStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    if (days < 0) return { label: "منتهي", color: "#fee2e2", text: "#991b1b" };
    if (days <= 15) return { label: "ينتهي قريبًا", color: "#fef3c7", text: "#92400e" };
    return { label: "ساري المفعول", color: "#dcfce7", text: "#166534" };
  };

  const getOilChangeBadge = (current, next) => {
    if (!next) return { label: "غير محدد", color: "#f3f4f6", text: "#4b5563" };
    const remaining = Number(next) - Number(current);
    if (remaining <= 0) return { label: "متجاوز", color: "#fee2e2", text: "#991b1b" };
    if (remaining <= 1000) return { label: "تغيير فوري", color: "#fef3c7", text: "#92400e" };
    return { label: `${remaining} كم متبقي`, color: "#e0f2fe", text: "#0369a1" };
  };

  const handleAddCarSubmit = (e) => {
    e.preventDefault();
    const addedCar = {
      id: "car_" + (fleet.length + 1), ...newCarForm,
      currentMileage: Number(newCarForm.currentMileage),
      nextOilChangeDue: Number(newCarForm.nextOilChangeDue),
      status: "available"
    };
    setFleet([...fleet, addedCar]);
    setShowAddCarForm(false);
  };

  const toggleCarStatus = (id) => {
    setFleet(fleet.map(car => car.id === id ? { ...car, status: car.status === 'available' ? 'rented' : 'available' } : car));
  };

  const startCamera = async (mode) => {
    setCameraMode(mode);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const constraints = {
        video: {
          facingMode: mode === 'tenant' ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play();
      }
    } catch (err) {
      alert("يرجى التأكد من منح التطبيق صلاحية استخدام الكاميرا من إعدادات المتصفح.");
      setCameraMode(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataUrl('image/jpeg', 0.85);

      if (cameraMode === 'tenant') setTenantPhoto(dataUrl);
      if (cameraMode === 'license') { 
        setLicensePhoto(dataUrl); 
        executeRealTimeOcrScan(dataUrl); 
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setCameraMode(null);
    } catch (err) {
      console.error(err);
    }
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
        executeRealTimeOcrScan(dataUrl); 
      }
    };
    reader.readAsDataURL(file);
  };

  const executeRealTimeOcrScan = async (base64Image) => {
    if (!apiKey) {
      alert("⚠️ يرجى إدخال مفتاح الـ API Key أولاً.");
      return;
    }
    
    setIsLoadingAI(true);
    try {
      const mimeMatch = base64Image.match(/^data:(image\/\w+);base64,/);
      let fileMimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      if (fileMimeType.includes("jfif")) fileMimeType = "image/jpeg";
      
      const pureBase64Content = base64Image.replace(/^data:image\/\w+;base64,/, "");

      const genAI = new GoogleGenerativeAI(apiKey);
      
      let modelName = "gemini-1.5-pro";
      if (apiStatus.modelUsed && apiStatus.modelUsed.includes("Flash")) {
        modelName = "gemini-1.5-flash";
      }

      const selectedModelInstance = genAI.getGenerativeModel({ model: modelName });

      const promptInstruction = "أنت نظام محترف لقراءة رخص السياقة الجزائرية البيومترية. استخرج البيانات التالية بدقة كالتالي تماماً بدون أي تفاصيل أخرى:\nالاسم: [الاسم واللقب باللاتينية]\nالرقم: [رقم رخصة السياقة]\nالميلاد: [تاريخ ومكان الميلاد]\nالصدور: [تاريخ صدور الوثيقة]";

      const imagePayload = {
        inlineData: { data: pureBase64Content, mimeType: fileMimeType }
      };

      const result = await selectedModelInstance.generateContent([promptInstruction, imagePayload]);
      const response = await result.response;
      const textOutput = response.text();

      const nameMatch = textOutput.match(/الاسم:\s*(.*)/);
      const numMatch = textOutput.match(/الرقم:\s*(.*)/);
      const birthMatch = textOutput.match(/الميلاد:\s*(.*)/);
      const issueMatch = textOutput.match(/الصدور:\s*(.*)/);

      setContractForm(prev => ({
        ...prev,
        tenantName: nameMatch ? nameMatch[1].trim() : prev.tenantName,
        licenseNumber: numMatch ? numMatch[1].trim() : prev.licenseNumber,
        birthDatePlace: birthMatch ? birthMatch[1].trim() : prev.birthDatePlace,
        licenseIssueDate: issueMatch ? issueMatch[1].trim() : prev.licenseIssueDate
      }));

    } catch (err) {
      console.error(err);
      alert("❌ تعذر استخراج البيانات. تحقق من تفعيل الـ VPN أو صحة المفتاح.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleOriginalPrintSubmit = (e) => {
    e.preventDefault();
    if (!contractForm.selectedCarId || calculatedDays === 0) {
      alert("يرجى مراجعة التواريخ والسيارات أولاً.");
      return;
    }

    const targetCar = fleet.find(car => car.id === contractForm.selectedCarId);
    const compiledData = {
      ...contractForm,
      carDetails: targetCar,
      days: calculatedDays,
      total: calculatedTotal,
      photo: tenantPhoto,
      dateString: new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR')
    };

    setFleet(fleet.map(car => car.id === contractForm.selectedCarId ? { ...car, status: 'rented' } : car));
    setPrintedContract(compiledData);

    setTimeout(() => {
      window.print();
      setContractForm({
        tenantName: '', tenantPhone: '', licenseNumber: '', tenantAddress: 'ali mendjli',
        birthDatePlace: '', licenseIssueDate: '',
        selectedCarId: '', startDate: '', endDate: '', pricePerDay: 6000, caution: 50000, fuelStatus: 'ربع خزان'
      });
      setTenantPhoto(null); setLicensePhoto(null);
      setActiveTab('dashboard');
    }, 500);
  };

  let statusUiColor = '#fee2e2';
  let statusUiTextColor = '#991b1b';
  let statusUiMessage = '';

  if (apiStatus.tested) {
    if (apiStatus.success) {
      statusUiColor = '#dcfce7';
      statusUiTextColor = '#15803d';
      statusUiMessage = apiStatus.message === 'SUCCESS_PRO' 
        ? '🟢 اتصال ناجح! المفتاح مفعّل ويعمل بأعلى كفاءة على خوادم جوغل الاحترافية (Gemini Pro).' 
        : '🟡 المفتاح مستجيب ولكن على النسخة العامة الأساسية (Gemini Flash).';
    } else {
      if (apiStatus.message === 'ERR_EMPTY_KEY') statusUiMessage = '❌ حقل المفتاح فارغ! يرجى لصق الـ API Key أولاً.';
      else if (apiStatus.message === 'ERR_INVALID_KEY') statusUiMessage = '❌ كود المفتاح خاطئ أو تم نسخه بشكل ناقص. أعد النسخ من AI Studio.';
      else if (apiStatus.message === 'ERR_BILLING') statusUiMessage = '❌ الحساب بحاجة لتفعيل الفوترة وربط بطاقة الدفع داخل Google Cloud لمسح الصور.';
      else if (apiStatus.message === 'ERR_LOCATION') statusUiMessage = '❌ حظر جغرافي إقليمي من جوجل على السيرفر (يمكنك كسر الحظر بتشغيل VPN).';
      else statusUiMessage = '❌ السيرفر يرفض الاتصال بالمفتاح الحالي، تأكد من صلاحيته.';
    }
  }

  return (
    <div style={styles.appContainer} dir="rtl">
      <div className="no-print">
        <header style={styles.header}>
          <div style={styles.headerRightContainer}>
            <div style={styles.textLogoContainer}>
              <h1 style={styles.mainTitleText}>✨ BELAGHA MOTORS</h1>
              <span style={styles.subTitleText}>MANAGEMENT & FLEET PRO</span>
            </div>
          </div>
          <div style={{display:'flex', gap:'5px'}}>
            <button style={styles.navBtn} onClick={() => setActiveTab('dashboard')}>الأسطول</button>
            <button style={styles.navBtn} onClick={() => setActiveTab('new-contract')}>+ عقد جديد</button>
          </div>
        </header>

        <div style={styles.apiConfigurationZone}>
          <div style={{display:'flex', alignItems:'center', gap:'10px', width:'100%', flexWrap:'wrap'}}>
            <label style={styles.apiLabel}>🔑 كاشف ومحلل صلاحية الـ Gemini API Key المباشر:</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
              placeholder="ضع كود المفتاح هنا لاكتشافه فوراً..." 
              style={styles.apiKeyInputStyle}
            />
            <button type="button" onClick={handleTestApiKey} disabled={isTestingKey} style={styles.testApiBtn}>
              {isTestingKey ? "⏳..." : "🔍 فحص"}
            </button>
          </div>
          
          {apiStatus.tested && (
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', backgroundColor: statusUiColor, color: statusUiTextColor, border: `1px solid ${statusUiTextColor}` }}>
              <div>{statusUiMessage}</div>
            </div>
          )}
        </div>

        {isLoadingAI && <div style={styles.loadingBanner}>⏳ جاري استخراج نصوص رخصة السياقة الجزائرية وملء الخانات تلقائياً...</div>}

        {cameraMode && (
          <div style={styles.cameraOverlay}>
            <div style={styles.cameraModal}>
              <video ref={videoRef} autoPlay playsInline muted style={styles.videoStreamContainer}></video>
              <div style={styles.cameraActionRow}>
                <button type="button" onClick={capturePhoto} style={styles.cameraBtn}>📸 التقاط الصورة</button>
                <button type="button" onClick={() => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); setCameraMode(null); }} style={styles.cameraCancelBtn}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <main style={styles.mainContent}>
            <div style={styles.sectionHeaderRow}>
              <h2 style={styles.sectionTitle}>مراقبة الأسطول وتتبع الصيانة والوثائق</h2>
              <button style={styles.addCarMainBtn} onClick={() => setShowAddCarForm(!showAddCarForm)}>
                {showAddCarForm ? "✖ إغلاق" : "➕ سيارة جديدة"}
              </button>
            </div>

            {showAddCarForm && (
              <div style={styles.addCarCardContainer}>
                <form onSubmit={handleAddCarSubmit} style={styles.addCarGridForm}>
                  <div style={styles.inputGroup}><label>الماركة:</label><input type="text" required value={newCarForm.brand} onChange={e=>setNewCarForm({...newCarForm, brand:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>الموديل:</label><input type="text" required value={newCarForm.model} onChange={e=>setNewCarForm({...newCarForm, model:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>سنة الصنع:</label><input type="number" required value={newCarForm.year} onChange={e=>setNewCarForm({...newCarForm, year:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم اللوحة:</label><input type="text" required value={newCarForm.plateNumber} onChange={e=>setNewCarForm({...newCarForm, plateNumber:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>العداد الحالي:</label><input type="number" required value={newCarForm.currentMileage} onChange={e=>setNewCarForm({...newCarForm, currentMileage:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>تغيير الزيت التالي:</label><input type="number" required value={newCarForm.nextOilChangeDue} onChange={e=>setNewCarForm({...newCarForm, nextOilChangeDue:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>انتهاء المراقبة التقنية:</label><input type="date" required value={newCarForm.technicalCheckExpiry} onChange={e=>setNewCarForm({...newCarForm, technicalCheckExpiry:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>انتهاء التأمين:</label><input type="date" required value={newCarForm.insuranceExpiryDate} onChange={e=>setNewCarForm({...newCarForm, insuranceExpiryDate:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم الهيكل:</label><input type="text" required value={newCarForm.chassisNumber} onChange={e=>setNewCarForm({...newCarForm, chassisNumber:e.target.value})} style={styles.input}/></div>
                  <button type="submit" style={styles.saveCarBtn}>💾 حفظ في الأسطول</button>
                </form>
              </div>
            )}

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>معلومات السيارة</th>
                    <th style={styles.th}>العداد</th>
                    <th style={styles.th}>Vidange</th>
                    <th style={styles.th}>المراقبة</th>
                    <th style={styles.th}>Assurance</th>
                    <th style={styles.th}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.map(car => {
                    const oilBadge = getOilChangeBadge(car.currentMileage, car.nextOilChangeDue);
                    const techBadge = getExpiryBadge(car.technicalCheckExpiry);
                    const insBadge = getExpiryBadge(car.insuranceExpiryDate);
                    return (
                      <tr key={car.id} style={styles.tr}>
                        <td style={styles.td}><strong>{car.brand} {car.model}</strong><div style={{fontSize: '11px', color: '#6b7280'}}>{car.plateNumber}</div></td>
                        <td style={styles.monospaceTd}>{car.currentMileage} كم</td>
                        <td style={styles.td}><span style={{...styles.badge, backgroundColor: oilBadge.color, color: oilBadge.text}}>{oilBadge.label}</span></td>
                        <td style={styles.td}><span style={{...styles.badge, backgroundColor: techBadge.color, color: techBadge.text}}>{techBadge.label}</span></td>
                        <td style={styles.td}><span style={{...styles.badge, backgroundColor: insBadge.color, color: insBadge.text}}>{insBadge.label}</span></td>
                        <td style={styles.td}>
                          <button type="button" onClick={() => toggleCarStatus(car.id)} style={{...styles.statusToggleBtn, backgroundColor: car.status === 'available' ? '#dcfce7' : '#fee2e2', color: car.status === 'available' ? '#15803d' : '#b91c1c'}}>
                            {car.status === 'available' ? 'متاحة' : 'مكراة'}
                          </button>
                        </td>
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
                <h3 style={styles.subSectionTitle}>1. صورة المستأجر الحية (صورة الوجه)</h3>
                <div style={styles.cameraBox}>
                  <div style={styles.cameraView}>
                    {tenantPhoto ? <img src={tenantPhoto} alt="الزبون" style={styles.fullCoverImage} /> : <div style={styles.placeholderText}>لا توجد صورة</div>}
                  </div>
                  <div style={styles.flexColumnGap10}>
                    <button type="button" onClick={() => startCamera('tenant')} style={styles.cameraBtn}>📷 التقاط صورة</button>
                    <label style={styles.uploadLabelStandard}>📂 اختيار ملف<input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'tenant')} style={{display:'none'}}/></label>
                  </div>
                </div>

                <h3 style={styles.marginTop20SubTitle}>2. مسح رخصة السياقة بالذكاء الاصطناعي</h3>
                <div style={styles.cameraBox}>
                  <div style={styles.cameraView}>
                    {licensePhoto ? <img src={licensePhoto} alt="الرخصة" style={styles.fullCoverImage} /> : <div style={styles.placeholderText}>لم يتم المسح</div>}
                  </div>
                  <div style={styles.flexColumnGap10}>
                    <button type="button" onClick={() => startCamera('license')} style={styles.cameraBtn}>⚡ مسح الرخصة</button>
                    <label style={styles.uploadLabelBlue}>📂 رفع ملف الرخصة<input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'license')} style={{display:'none'}}/></label>
                  </div>
                </div>

                <div style={styles.formGrid}>
                  <div style={styles.inputGroup}><label>الاسم واللقب بالكامل:</label><input type="text" required value={contractForm.tenantName} onChange={e => setContractForm({...contractForm, tenantName: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم رخصة السياقة:</label><input type="text" required value={contractForm.licenseNumber} onChange={e => setContractForm({...contractForm, licenseNumber: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم الهاتف:</label><input type="text" required value={contractForm.tenantPhone} onChange={e => setContractForm({...contractForm, tenantPhone: e.target.value})} style={styles.input}/></div>
                </div>
                <div style={styles.formGrid}>
                  <div style={styles.inputGroup}><label>تاريخ ومكان الميلاد:</label><input type="text" required value={contractForm.birthDatePlace} onChange={e => setContractForm({...contractForm, birthDatePlace: e.target.value})} placeholder="مثال: 15.12.1995 قسنطينة" style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>تاريخ صدور الرخصة:</label><input type="text" required value={contractForm.licenseIssueDate} onChange={e => setContractForm({...contractForm, licenseIssueDate: e.target.value})} placeholder="مثال: 17.12.2025" style={styles.input}/></div>
                </div>

                <div style={styles.formGrid} style={{marginTop:'20px'}}>
                  <div style={styles.inputGroup}>
                    <label>اختر السيارة للتأجير:</label>
                    <select required value={contractForm.selectedCarId} onChange={e => setContractForm({...contractForm, selectedCarId: e.target.value})} style={styles.input}>
                      <option value="">-- اختر المركبة --</option>
                      {fleet.map(car => (<option key={car.id} value={car.id} disabled={car.status !== 'available'}>{car.brand} {car.model}</option>))}
                    </select>
                  </div>
                  <div style={styles.inputGroup}><label>تاريخ الاستلام:</label><input type="datetime-local" required value={contractForm.startDate} onChange={e => setContractForm({...contractForm, startDate: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>تاريخ الإرجاع:</label><input type="datetime-local" required value={contractForm.endDate} onChange={e => setContractForm({...contractForm, endDate: e.target.value})} style={styles.input}/></div>
                </div>

                <div style={styles.formGridCombined}>
                  <div style={styles.inputGroup}><label>السعر لليوم (دج):</label><input type="number" required value={contractForm.pricePerDay} onChange={e => setContractForm({...contractForm, pricePerDay: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>مبلغ الضمان / Caution (دج):</label><input type="number" required value={contractForm.caution} onChange={e => setContractForm({...contractForm, caution: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>حالة خزان الوقود:</label><input type="text" required value={contractForm.fuelStatus} onChange={e => setContractForm({...contractForm, fuelStatus: e.target.value})} style={styles.input}/></div>
                </div>

                <button type="submit" style={styles.submitButton}>💾 حفظ وتوليد العقد الموثق للطباعة</button>
              </form>
            </div>
          </main>
        )}
      </div>

      {printedContract && (
        <div className="print-container" style={{ width: '100%', padding: '0', backgroundColor: '#fff' }}>
          <div className="print-page" style={{ padding: '25px 35px', boxSizing: 'border-box', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '2px solid black', paddingBottom: '10px', alignItems: 'center' }}>
              <div style={{ width: '100%', textAlign: 'center' }}>
                <h2 style={{fontSize: '24px', margin: 0, fontWeight: 'bold', letterSpacing: '1px'}}>BELAGHA MOTORS</h2>
                <span style={{ fontSize: '12px', display: 'block', marginTop: '5px', fontWeight: 'bold' }}>Constantine, Algérie | Tél: 0554 28 19 83</span>
                <span style={{ fontSize: '10px', color: '#333' }}>RC: 25/00-038169 A 15 | NIF: 1852501093731100000</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
              <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold' }}>عقد كراء سيارة / CONTRAT DE LOCATION</h2>
              <div style={{ width: '95px', height: '120px', border: '1px solid #000', backgroundColor: '#fafafa', borderRadius: '2px', overflow: 'hidden' }}>
                {printedContract.photo && <img src={printedContract.photo} alt="الزبون" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
            </div>
            
            <h4 style={{ borderBottom: '1px solid #000', paddingBottom: '4px', marginTop: '18px', fontSize: '13px', fontWeight: 'bold' }}>1. معلومات المستأجر / Informations du Locataire</h4>
            <div style={{ fontSize: '13px', lineHeight: '1.6', marginTop: '5px' }}>
              <p><strong>الاسم واللقب / Nom et Prénom:</strong> {printedContract.tenantName}</p>
              <p><strong>تاريخ ومكان الميلاد:</strong> {printedContract.birthDatePlace || '15.12.1995 قسنطينة'}</p>
              <p><strong>رقم رخصة السياقة / N° de Permis:</strong> {printedContract.licenseNumber} | <strong>تاريخ الصدور:</strong> {printedContract.licenseIssueDate || '17-12-2025'}</p>
              <p><strong>العنوان / Adresse:</strong> {printedContract.tenantAddress} | <strong>رقم الهاتف / Tél:</strong> {printedContract.tenantPhone}</p>
            </div>

            <h4 style={{ borderBottom: '1px solid #000', paddingBottom: '4px', marginTop: '18px', fontSize: '13px', fontWeight: 'bold' }}>2. معلومات السيارة / Informations du Véhicule</h4>
            <div style={{ fontSize: '13px', lineHeight: '1.6', marginTop: '5px' }}>
              <p><strong>النوع والموديل / Marque et Modèle:</strong> {printedContract.carDetails?.brand} {printedContract.carDetails?.model} ({printedContract.carDetails?.year})</p>
              <p><strong>اللوحة المنجمية / Matricule:</strong> {printedContract.carDetails?.plateNumber} | <strong>رقم الهيكل / Châssis:</strong> {printedContract.carDetails?.chassisNumber}</p>
              <p><strong>العداد الحالي للمركبة:</strong> {printedContract.carDetails?.currentMileage} كم | <strong>حالة الوقود:</strong> {printedContract.fuelStatus}</p>
            </div>

            <h4 style={{ borderBottom: '1px solid #000', paddingBottom: '4px', marginTop: '18px', fontSize: '13px', fontWeight: 'bold' }}>3. تفاصيل العقد والمالية / Détails du Contrat</h4>
            <div style={{ fontSize: '13px', lineHeight: '1.6', marginTop: '5px' }}>
              <p><strong>بداية العقد:</strong> {printedContract.startDate} | <strong>نهاية العقد:</strong> {printedContract.endDate}</p>
              <p><strong>سعر اليوم المتفق عليه:</strong> {printedContract.pricePerDay} دج | <strong>المبلغ الإجمالي المستحق:</strong> {printedContract.total} دج | <strong>مبلغ الضمان المودع / Caution:</strong> {printedContract.caution} دج</p>
            </div>

            <h4 style={{ borderBottom: '1px solid #000', paddingBottom: '4px', marginTop: '18px', fontSize: '13px', fontWeight: 'bold' }}>الشروط القانونية العامة / Conditions Générales de Location</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', width: '100%', marginTop: '10px', fontSize: '10px', lineHeight: '1.4' }}>
              <div style={{ width: '48%', textAlign: 'justify', direction: 'rtl' }}>
                <p>• المستأجر يقر أنه استأجر السيارة في حالة جيدة، وفي حالة وقوع حادث يجب إعلام الوكالة فوراً.</p>
                <p>• لا يسمح بكراء السيارة للغير أو قيادتها إلا لمن حرر العقد باسمه الموثق.</p>
                <p>• يُمنع الخروج بالمركبة خارج الحدود الترابية الوطنية الجزائرية إطلاقاً.</p>
                <p>• أي تأخير عن موعد إرجاع السيارة يلزم المستأجر بدفع 1500 دج لجميع الساعات المتأخرة.</p>
                <p>• في حالة ضياع أو سرقة السيارة، يتحمل المستأجر 100% من ثمن السيارة الحالي نقداً.</p>
              </div>
              <div style={{ width: '48%', textAlign: 'justify', direction: 'ltr' }}>
                <p>• Le locataire reconnaît avoir loué le véhicule en bon état. En cas d'accident, informer l'agence.</p>
                <p>• La sous-location ou la conduite par une tierce personne is strictly interdite.</p>
                <p>• Il est interdit de sortir le véhicule du territoire national algérien.</p>
                <p>• Tout retard dans la restitution entraîne une pénalité de 1500 DA par heure.</p>
                <p>• En cas de perte ou vol, il paie 100% de la valeur marchande du véhicule.</p>
              </div>
            </div>
            
            <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign: 'center', fontWeight: 'bold' }}>1/3</div>
          </div>

          <div className="print-page" style={{ padding: '25px 35px', boxSizing: 'border-box', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '2px solid black', paddingBottom: '10px', alignItems: 'center' }}>
              <div style={{ width: '100%', textAlign: 'center' }}>
                <h2 style={{fontSize: '20px', margin: 0, fontWeight: 'bold'}}>BELAGHA MOTORS</h2>
              </div>
            </div>
            
            <h4 style={{ borderBottom: '1px solid #000', paddingBottom: '4px', fontSize: '13px', fontWeight: 'bold', marginTop: '20px' }}>بقية الشروط العامة والمسؤوليات الجزائية المدنية</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', width: '100%', marginTop: '10px', fontSize: '11px', lineHeight: '1.7' }}>
              <div style={{ width: '48%', textAlign: 'justify', direction: 'rtl' }}>
                <p><strong>• الأضرار والتصليح:</strong> المستأجر ملزم بدفع تكاليف الإصلاح نقداً وفوراً عند الورشة المعتمدة لدى الوكالة.</p>
                <p><strong>• البطاقة الرمادية:</strong> البطاقة الرمادية الأصلية للمركبة لا تسلم للزبون طوال فترة التأجير.</p>
                <p><strong>• الوقود والنظافة:</strong> إرجاع السيارة بنفس مستوى الوقود وبحالة نظيفة تماماً وإلا تُطبق غرامة مالية لتنظيف المركبة.</p>
                <p><strong>• المخالفات والرادار:</strong> المستأجر مسؤول مدنياً وجزائياً عن جميع المخالفات وتصوير الرادار طوال فترة الكراء.</p>
                <p><strong>• المحشر البلدي:</strong> يتحمل المستأجر تكاليف المحشر (Fourrière) بالكامل مع دفع سعر الأيام المحجوزة فيها السيارة.</p>
              </div>
              <div style={{ width: '48%', textAlign: 'justify', direction: 'ltr' }}>
                <p><strong>• Accidents & Dégâts:</strong> Le locataire paie les frais de réparation en espèces immédiatement.</p>
                <p><strong>• Documents:</strong> La carte grise originale n'est pas remise au client.</p>
                <p><strong>• Carburant & Propreté:</strong> Restituer avec le même niveau de carburant et propre, sous peine de pénalités.</p>
                <p><strong>• Infractions & Radar:</strong> Le locataire is civilement et pénalement responsable de tous les flashs radars.</p>
                <p><strong>• Fourrière:</strong> En cas de mise en fourrière, le locataire paie tous les frais et les jours de blocage.</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '200px', fontWeight: 'bold' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <span>توقيع المستأجر (قرأت ووافقت)</span><br/>
                <span style={{ fontSize: '10px', fontWeight: 'normal' }}>Lu et approuvé</span>
                <div style={{ border: '1px solid #000', height: '90px', marginTop: '10px', borderRadius: '4px' }}></div>
              </div>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <span>ختم وتوقيع مسير الوكالة</span>
                <div style={{ border: '1px solid #000', height: '90px', marginTop: '10px', borderRadius: '4px' }}></div>
              </div>
            </div>
            
            <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign: 'center', fontWeight: 'bold' }}>2/3</div>
          </div>

          <div className="print-page" style={{ padding: '25px 35px', boxSizing: 'border-box', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '2px solid black', paddingBottom: '10px', alignItems: 'center' }}>
              <div style={{ width: '100%', textAlign: 'center' }}>
                <h2 style={{fontSize: '20px', margin: 0, fontWeight: 'bold'}}>BELAGHA MOTORS</h2>
              </div>
            </div>
            
            <div style={{ marginTop: '30px' }}>
              <h3 style={{ textAlign: 'center', margin: '0 0 20px 0', fontWeight: 'bold', fontSize: '16px' }}>QUITTANCE DE PAIEMENT / وصل استلام مالي رسمي</h3>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', width: '35%', border: '1px solid #000', padding: '12px', fontSize: '13px' }}>التاريخ الإداري / Date</td>
                    <td style={{ fontFamily: 'monospace', border: '1px solid #000', padding: '12px', fontSize: '13px' }}>{printedContract.dateString ? printedContract.dateString.split(' ')[0] : ''}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', width: '35%', border: '1px solid #000', padding: '12px', fontSize: '13px' }}>استلمنا من السيد(ة) / Client</td>
                    <td style={{ border: '1px solid #000', padding: '12px', fontSize: '13px' }}>{printedContract.tenantName}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', width: '35%', border: '1px solid #000', padding: '12px', fontSize: '13px' }}>المركبة المؤجرة / Véhicule</td>
                    <td style={{ border: '1px solid #000', padding: '12px', fontSize: '13px' }}>{printedContract.carDetails?.brand} {printedContract.carDetails?.model} ({printedContract.carDetails?.plateNumber})</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', width: '35%', border: '1px solid #000', padding: '12px', fontSize: '13px' }}>مبلغ الكراء الإجمالي المدفوع</td>
                    <td style={{ fontSize: '16px', fontWeight: 'bold', color: '#111', border: '1px solid #000', padding: '12px' }}>{printedContract.total} دج</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', width: '35%', border: '1px solid #000', padding: '12px', fontSize: '13px' }}>مبلغ الضمان المودع (Caution)</td>
                    <td style={{ border: '1px solid #000', padding: '12px', fontSize: '13px' }}>{printedContract.caution} دج</td>
                  </tr>
                </tbody>
              </table>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '180px', fontWeight: 'bold' }}>
                <div style={{ textAlign: 'center', width: '45%' }}>
                  <span>توقيع وتأكيد الزبون</span>
                  <div style={{ border: '1px solid #000', height: '80px', marginTop: '10px', borderRadius: '4px' }}></div>
                </div>
                <div style={{ textAlign: 'center', width: '45%' }}>
                  <span>ختم مصلحة الحسابات والمالية</span>
                  <div style={{ border: '1px solid #000', height: '80px', marginTop: '10px', borderRadius: '4px' }}></div>
                </div>
              </div>
            </div>
            
            <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign: 'center', fontWeight: 'bold' }}>3/3</div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: { fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', minHeight: '100vh' },
  header: { backgroundColor: '#1e293b', color: '#fff', padding: '12px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
  headerRightContainer: { display: 'flex', alignItems: 'center', gap: '15px' },
  textLogoContainer: { display: 'flex', flexDirection: 'column' },
  mainTitleText: { fontSize: '18px', margin: 0, fontWeight: 'bold', color: '#fff' },
  subTitleText: { fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '2px' },
  navBtn: { color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#3b82f6' },
  apiConfigurationZone: { padding: '15px 30px', backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1' },
  apiLabel: { fontWeight: 'bold', color: '#1e293b' },
  apiKeyInputStyle: { padding: '8px 12px', width: '300px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' },
  testApiBtn: { backgroundColor: '#1e3a8a', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' },
  loadingBanner: { backgroundColor: '#7c3aed', color: 'white', textAlign: 'center', padding: '12px', fontWeight: 'bold', fontSize: '14px' },
  cameraOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  cameraModal: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '500px' },
  videoStreamContainer: { width: '100%', height: 'auto', borderRadius: '8px', backgroundColor: '#000' },
  cameraActionRow: { display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'center' },
  cameraCancelBtn: { border: 'none', padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#b91c1c', color: 'white' },
  mainContent: { padding: '20px' },
  sectionHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  sectionTitle: { fontSize: '18px', margin: 0, borderRight: '4px solid #2563eb', paddingRight: '10px', fontWeight: 'bold' },
  addCarMainBtn: { backgroundColor: '#1e3a8a', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  addCarCardContainer: { backgroundColor: '#f8fafc', padding: '20px', marginBottom: '25px', borderRadius: '8px' },
  addCarGridForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' },
  saveCarBtn: { gridColumn: '1 / -1', backgroundColor: '#166534', color: 'white', border: 'none', padding: '12px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' },
  tableWrapper: { backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'right' },
  thRow: { backgroundColor: '#f1f5f9' },
  th: { padding: '12px', fontWeight: 'bold', fontSize: '13px' },
  tr: { borderBottom: '1px solid #edf2f7' },
  td: { padding: '12px', fontSize: '13px' },
  monospaceTd: { padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px' },
  badge: { padding: '4px 8px', borderRadius: '50px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' },
  statusToggleBtn: { border: 'none', padding: '4px 8px', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' },
  subSectionTitle: { fontSize: '14px', margin: 0, fontWeight: 'bold', color: '#1e293b' },
  cameraBox: { display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#f9fafb', padding: '15px', borderRadius: '6px', marginTop: '5px' },
  cameraView: { width: '100px', height: '115px', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #9ca3af', borderRadius: '4px', overflow: 'hidden' },
  placeholderText: { color: '#9ca3af', fontSize: '11px' },
  fullCoverImage: { width: '100%', height: '100%', objectFit: 'cover' },
  flexColumnGap10: { display: 'flex', flexDirection: 'column', gap: '10px' },
  cameraBtn: { backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', fontSize: '13px' },
  uploadLabelStandard: { backgroundColor: '#4b5563', color: 'white', padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', display: 'inline-block', fontSize: '13px', textAlign: 'center' },
  uploadLabelBlue: { backgroundColor: '#0284c7', color: 'white', padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', display: 'inline-block', fontSize: '13px', textAlign: 'center' },
  marginTop20SubTitle: { fontSize: '14px', margin: 0, fontWeight: 'bold', color: '#1e293b', marginTop: '20px' },
  formCard: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '10px' },
  formGridCombined: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', borderTop: '1px dashed #e5e7eb', paddingTop: '15px', marginTop: '15px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  input: { padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' },
  submitButton: { width: '100%', backgroundColor: '#166534', color: 'white', padding: '14px', cursor: 'pointer', fontWeight: 'bold', border: 'none', borderRadius: '6px', marginTop: '20px', fontSize: '15px' }
};

const printStyles = {
  signatureColumn: { textAlign: 'center', width: '45%' },
  quittanceTitle: { textAlign: 'center', margin: '0 0 20px 0', fontWeight: 'bold', fontSize: '16px' },
  pageNumber: { position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign: 'center', fontWeight: 'bold' }
};

export default App;
