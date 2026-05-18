import React, { useState, useEffect, useRef } from 'react';
// استيراد الحزمة الرسمية المعتمدة والآمنة من شركة Google للذكاء الاصطناعي
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- أسطول السيارات المعتمد بالوكالة بقسنطينة ---
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
  // --- إدارة الحالة المدنية واللوجستية للتطبيق (State Management) ---
  const [fleet, setFleet] = useState(initialFleet);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddCarForm, setShowAddCarForm] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [cameraMode, setCameraMode] = useState(null);

  // إدارة وحفظ مفتاح الـ API ديناميكياً في الـ localStorage لتجاوز قيود النطاقات السحابية
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('belagha_gemini_api_key') || '';
  });

  // مراجع وسائط الكاميرا الحية لجهاز الـ iPad
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ذاكرة تخزين بيانات صور المستندات الملقطة أو المرفوعة
  const [tenantPhoto, setTenantPhoto] = useState(null);
  const [licensePhoto, setLicensePhoto] = useState(null);
  const [greyCardPhoto, setGreyCardPhoto] = useState(null);

  // نموذج إضافة سيارة جديدة للأسطول
  const [newCarForm, setNewCarForm] = useState({
    brand: '', model: '', year: new Date().getFullYear(),
    plateNumber: '', currentMileage: '', nextOilChangeDue: '',
    technicalCheckExpiry: '', insuranceExpiryDate: '', chassisNumber: ''
  });

  // نموذج بيانات العقد الأساسي
  const [contractForm, setContractForm] = useState({
    tenantName: '',
    tenantPhone: '',
    licenseNumber: '',
    birthDatePlace: '',
    licenseIssueDate: '',
    tenantAddress: 'ali mendjli',
    selectedCarId: '',
    startDate: '',
    endDate: '',
    pricePerDay: 6000,
    caution: 50000,
    fuelStatus: 'ربع خزان'
  });

  const [calculatedDays, setCalculatedDays] = useState(0);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [printedContract, setPrintedContract] = useState(null);

  // تحديث وحفظ مفتاح الـ API تلقائياً في المتصفح لمنع ضياعه عند إعادة تحميل الصفحة
  useEffect(() => {
    localStorage.setItem('belagha_gemini_api_key', apiKey);
  }, [apiKey]);

  // الاحتساب التلقائي اللحظي لفترة الكراء والمسائل المالية بمجرد اختيار التواريخ
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

  // --- نظام فحص الفترات الزمنية للمراقبة التقنية والتأمين وزيت المحرك ---
  const getExpiryBadge = (expiryDateString) => {
    if (!expiryDateString) return { label: "غير محدد", color: "#f3f4f6", text: "#4b5563" };
    const expiryDate = new Date(expiryDateString);
    const today = new Date();
    const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysDiff < 0) return { label: `منتهي (${Math.abs(daysDiff)} يوم)`, color: "#fee2e2", text: "#991b1b" };
    if (daysDiff <= 15) return { label: `ينتهي قريبًا (${daysDiff} يوم)`, color: "#fef3c7", text: "#92400e" };
    return { label: "ساري المفعول", color: "#dcfce7", text: "#166534" };
  };

  const getOilChangeBadge = (current, next) => {
    if (!next) return { label: "غير محدد", color: "#f3f4f6", text: "#4b5563" };
    const remaining = Number(next) - Number(current);

    if (remaining <= 0) return { label: `متجاوز بـ (${Math.abs(remaining)} كم)`, color: "#fee2e2", text: "#991b1b" };
    if (remaining <= 1000) return { label: `تغيير فوري (${remaining} كم)`, color: "#fef3c7", text: "#92400e" };
    return { label: `${remaining} كم متبقي`, color: "#e0f2fe", text: "#0369a1" };
  };

  // --- لوجستيات إدارة مركبات الأسطول ---
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
    setNewCarForm({
      brand: '', model: '', year: new Date().getFullYear(), plateNumber: '',
      currentMileage: '', nextOilChangeDue: '', technicalCheckExpiry: '',
      insuranceExpiryDate: '', chassisNumber: ''
    });
  };

  const toggleCarStatus = (id) => {
    setFleet(fleet.map(car => car.id === id ? { ...car, status: car.status === 'available' ? 'rented' : 'available' } : car));
  };

  // --- تشغيل وإدارة ملقط الكاميرا الحية للـ iPad ---
  const startCamera = async (mode) => {
    setCameraMode(mode);
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode === 'tenant' ? 'user' : 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("يرجى تفعيل صلاحية الكاميرا الحية بداخل إعدادات متصفحك الخاص.");
      setCameraMode(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataUrl('image/jpeg');

    if (cameraMode === 'tenant') setTenantPhoto(dataUrl);
    if (cameraMode === 'license') { setLicensePhoto(dataUrl); executeRealTimeOcrScan(dataUrl, 'license'); }
    if (cameraMode === 'greyCard') { setGreyCardPhoto(dataUrl); executeRealTimeOcrScan(dataUrl, 'greyCard'); }

    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setCameraMode(null);
  };

  const handleFileUpload = (e, mode) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (mode === 'tenant') setTenantPhoto(dataUrl);
      if (mode === 'license') { setLicensePhoto(dataUrl); executeRealTimeOcrScan(dataUrl, 'license'); }
      if (mode === 'greyCard') { setGreyCardPhoto(dataUrl); executeRealTimeOcrScan(dataUrl, 'greyCard'); }
    };
    reader.readAsDataURL(file);
  };

  // --- محرك وقارئ الذكاء الاصطناعي الموحد والمثالي المستقر 100% لتغذية الحقول المدنية ---
  const executeRealTimeOcrScan = async (base64Image, scanType) => {
    if (!apiKey) {
      alert("⚠️ تذكير: يرجى نسخ ولصق الـ API Key أولاً في الحقل المخصص أعلى الشاشة لتنشيط المسح التلقائي.");
      return;
    }
    
    setIsLoadingAI(true);
    try {
      const mimeMatch = base64Image.match(/^data:(image\/\w+);base64,/);
      let fileMimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      if (fileMimeType.includes("jfif")) {
        fileMimeType = "image/jpeg";
      }
      
      const pureBase64Content = base64Image.replace(/^data:image\/\w+;base64,/, "");

      // الاتصال البرمجي المباشر والمستقر بحزمة جوغل لمنع الحظر
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" } // فرض المخرجات ككائن JSON نقي ومفكك
      });

      let promptInstruction = `أنت نظام إلكتروني ذكي خبير برخص السياقة والوثائق الجزائرية البيومترية الجديدة. 
      اقرأ الصورة المرفقة بتمعن شديد واستخرج البيانات النصية المكتوبة فيها بدقة بالغة وبدون أي تزييف، وقم بصياغة النتيجة فقط على شكل JSON نظيف ومغلق تماماً كالتالي:`;
      
      if (scanType === 'license') {
        promptInstruction += ` { "tenantName": "اللقب والاسم بالكامل المكتوب بالوثيقة باللغة اللاتينية مثل BENSLIMANE CHOUAIB MOHAMED ELHADI"، "licenseNumber": "رقم رخصة السياقة كاملاً المكون من 18 رقماً مثل 109950887155400004"، "birthDatePlace": "تاريخ الميلاد ومكانه المكتوب مثل 15.12.1995 قسنطينة Gruene"، "licenseIssueDate": "تاريخ صدور رخصة السياقة مثل 17.12.2025" }`;
      } else {
        promptInstruction += ` { "plateNumber": "رقم اللوحة المنجمية النظيف والمكتوب مثل 03813-193-25" }`;
      }

      const imagePayload = {
        inlineData: {
          data: pureBase64Content,
          mimeType: fileMimeType
        }
      };

      const result = await model.generateContent([promptInstruction, imagePayload]);
      const response = await result.response;
      const jsonResponseText = response.text().trim();
      
      const parsedOcrOutput = JSON.parse(jsonResponseText);

      // حقن مخرجات الـ AI داخل خلايا نموذج العقد الجديد صامتاً
      if (scanType === 'license') {
        setContractForm(prev => ({
          ...prev,
          tenantName: parsedOcrOutput.tenantName || prev.tenantName,
          licenseNumber: parsedOcrOutput.licenseNumber || prev.licenseNumber,
          birthDatePlace: parsedOcrOutput.birthDatePlace || prev.birthDatePlace,
          licenseIssueDate: parsedOcrOutput.licenseIssueDate || prev.licenseIssueDate
        }));
      } else if (scanType === 'greyCard') {
        const extractedPlateClean = (parsedOcrOutput.plateNumber || '').replace(/\s+/g, '');
        const autoMatchedCar = fleet.find(car => car.plateNumber.replace(/\s+/g, '') === extractedPlateClean);
        if (autoMatchedCar) {
          setContractForm(prev => ({ ...prev, selectedCarId: autoMatchedCar.id }));
        }
      }
    } catch (err) {
      console.error("Critical Gemini API Error Log:", err);
      alert("❌ تعذر الاستخراج التلقائي للمستند. يرجى التحقق من صحة وصلاحية مفتاح الـ API KEY الخاص بك أو جودة ووضوح الصورة.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleCreateContractSubmit = (e) => {
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
      setTenantPhoto(null); setLicensePhoto(null); setGreyCardPhoto(null);
      setActiveTab('dashboard');
    }, 500);
  };

  return (
    <div style={styles.appContainer} dir="rtl">
      
      {/* ستايل سيادي للتحكم بقواعد صفحات الطباعة ومنع ظهور أي صفحات بيضاء زائدة وإبراز الألوان الحقيقية للشعار */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm !important;
          }
          body, html, #root { 
            background: white !important; 
            color: black !important; 
            direction: rtl !important; 
            margin: 0 !important; 
            padding: 0 !important;
            height: auto !important;
            font-size: 11px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .print-container { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          
          .print-page { 
            display: block !important; 
            box-sizing: border-box !important;
            page-break-after: always !important; 
            page-break-inside: avoid !important;
            height: 297mm !important; 
            max-height: 297mm !important;
            overflow: hidden !important;
            padding: 25px 35px !important;
            margin: 0 !important;
            position: relative !important;
          }
          
          .print-page:last-child { page-break-after: avoid !important; }
          
          .clauses-container {
            display: flex !important;
            justify-content: space-between !important;
            gap: 20px !important;
            width: 100% !important;
            margin-top: 10px !important;
          }
          .clause-column {
            width: 48% !important;
            text-align: justify !important;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .print-table td {
            border: 1px solid #000;
            padding: 12px;
            font-size: 13px;
          }
        }
        @media screen { .print-container { display: none !important; } }
      `}</style>

      {/* واجهة التحكم الإدارية الافتراضية للشاشة */}
      <div className="no-print">
        <header style={styles.header}>
          <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
            <img src="/logo.png" alt="Belagha Motors Logo" style={{ height: '60px', backgroundColor: 'white', padding: '3px', borderRadius: '4px', objectFit: 'contain' }} />
            <div>
              <h1 style={{...styles.logo, margin:0, fontSize:'18px'}}>BELAGHA MOTORS</h1>
              <span style={{fontSize:'11px', color:'#94a3b8', display:'block', marginTop:'2px'}}>MANAGEMENT & FLEET PRO</span>
            </div>
          </div>
          <div style={styles.navButtons}>
            <button style={styles.navBtn} onClick={() => setActiveTab('dashboard')}>لوحة الأسطول</button>
            <button style={styles.navBtn} onClick={() => setActiveTab('new-contract')}>+ عقد جديد</button>
          </div>
        </header>

        {/* كابينة التحكم وحقن الـ API KEY المستقر والآمن */}
        <div style={styles.apiConfigurationZone}>
          <label style={{fontWeight: 'bold', color: '#1e293b'}}>🔑 محرك الـ ذكاء الاصطناعي المستقر (Gemini API Key):</label>
          <input 
            type="password" 
            value={apiKey} 
            onChange={(e) => setApiKey(e.target.value)} 
            placeholder="أدخل مفتاح الـ API KEY المولد هنا لتنشيط القراءة التلقائية الآمنة المستقرة..." 
            style={styles.apiKeyInputStyle}
          />
          {apiKey && <span style={{color: '#16a34a', fontSize: '12px', fontWeight: 'bold'}}>✓ محرك المعالجة الأحادية الآمن نشط</span>}
        </div>

        {isLoadingAI && (
          <div style={{backgroundColor:'#7c3aed', color:'white', textAlign:'center', padding:'12px', fontWeight:'bold', fontSize:'14px'}}>
            ⏳ جاري فحص المستند بالذكاء الاصطناعي وتحديث الحقول تلقائياً في ثوانٍ...
          </div>
        )}

        {cameraMode && (
          <div style={styles.cameraOverlay}>
            <div style={styles.cameraModal}>
              <video ref={videoRef} autoPlay playsInline style={{width:'100%', borderRadius:'8px', backgroundColor:'#000'}}></video>
              <div style={{display:'flex', gap:'10px', marginTop:'15px', justifyContent:'center'}}>
                <button type="button" onClick={capturePhoto} style={styles.cameraBtn}>📸 التقاط الصورة</button>
                <button type="button" onClick={() => { if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop()); setCameraMode(null); }} style={styles.cameraBtn}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <main style={styles.mainContent}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
              <h2 style={styles.sectionTitle}>مراقبة الأسطول وتتبع الصيانة والوثائق</h2>
              <button style={styles.addCarMainBtn} onClick={() => setShowAddCarForm(!showAddCarForm)}>
                {showAddCarForm ? "✖ إغلاق النموذج" : "➕ إضافة سيارة جديدة للوكالة"}
              </button>
            </div>

            {showAddCarForm && (
              <div style={styles.addCarCardContainer}>
                <form onSubmit={handleAddCarSubmit} style={styles.addCarGridForm}>
                  <div style={styles.inputGroup}><label>الماركة (Brand):</label><input type="text" required value={newCarForm.brand} onChange={e=>setNewCarForm({...newCarForm, brand:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>الموديل (Model):</label><input type="text" required value={newCarForm.model} onChange={e=>setNewCarForm({...newCarForm, model:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>سنة الصنع:</label><input type="number" required value={newCarForm.year} onChange={e=>setNewCarForm({...newCarForm, year:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم اللوحة المنجمية:</label><input type="text" required value={newCarForm.plateNumber} onChange={e=>setNewCarForm({...newCarForm, plateNumber:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>العداد الحالي (كم):</label><input type="number" required value={newCarForm.currentMileage} onChange={e=>setNewCarForm({...newCarForm, currentMileage:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>موعد تغيير الزيت (كم):</label><input type="number" required value={newCarForm.nextOilChangeDue} onChange={e=>setNewCarForm({...newCarForm, nextOilChangeDue:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>انتهاء المراقبة التقنية:</label><input type="date" required value={newCarForm.technicalCheckExpiry} onChange={e=>setNewCarForm({...newCarForm, technicalCheckExpiry:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>انتهاء التأمين:</label><input type="date" required value={newCarForm.insuranceExpiryDate} onChange={e=>setNewCarForm({...newCarForm, insuranceExpiryDate:e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>رقم الهيكل (Chassis):</label><input type="text" required value={newCarForm.chassisNumber} onChange={e=>setNewCarForm({...newCarForm, chassisNumber:e.target.value})} style={styles.input}/></div>
                  <button type="submit" style={styles.saveCarBtn}>💾 حفظ وإدراج في الأسطول</button>
                </form>
              </div>
            )}

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>معلومات السيارة</th>
                    <th style={styles.th}>العداد الحالي</th>
                    <th style={styles.th}>تغيير الزيت (Vidange)</th>
                    <th style={styles.th}>المراقبة التقنية</th>
                    <th style={styles.th}>التأمين (Assurance)</th>
                    <th style={styles.th}>حالة المركبة الآن</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.map(car => {
                    const oilBadge = getOilChangeBadge(car.currentMileage, car.nextOilChangeDue);
                    const techBadge = getExpiryBadge(car.technicalCheckExpiry);
                    const insBadge = getExpiryBadge(car.insuranceExpiryDate);
                    return (
                      <tr key={car.id} style={styles.tr}>
                        <td style={styles.td}><strong>{car.brand} {car.model}</strong><div style={{fontSize: '12px', color: '#6b7280'}}>{car.plateNumber}</div></td>
                        <td style={{padding: '14px', fontFamily: 'monospace', fontWeight:'bold'}}>{car.currentMileage} كم</td>
                        <td style={styles.td}><span style={{padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight:'bold', backgroundColor: oilBadge.color, color: oilBadge.text}}>{oilBadge.label}</span></td>
                        <td style={styles.td}><span style={{padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight:'bold', backgroundColor: techBadge.color, color: techBadge.text}}>{techBadge.label}</span></td>
                        <td style={styles.td}><span style={{padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight:'bold', backgroundColor: insBadge.color, color: insBadge.text}}>{insBadge.label}</span></td>
                        <td style={styles.td}>
                          <button type="button" onClick={() => toggleCarStatus(car.id)} style={{border:'none', padding:'4px 10px', borderRadius:'50px', cursor:'pointer', fontWeight:'bold', backgroundColor: car.status === 'available' ? '#dcfce7' : '#fee2e2', color: car.status === 'available' ? '#15803d' : '#b91c1c'}}>
                            {car.status === 'available' ? 'متاحة (اضغط للتغيير)' : 'مكراة (اضغط للتغيير)'}
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
              <form onSubmit={handleCreateContractSubmit}>
                <h3 style={styles.subSectionTitle}>1. صورة المستأجر الحية (صورة الوجه)</h3>
                <div style={styles.cameraBox}>
                  <div style={styles.cameraView}>
                    {tenantPhoto ? <img src={tenantPhoto} alt="الزبون" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <div style={{color:'#9ca3af', fontSize:'12px'}}>لا توجد صورة</div>}
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    <button type="button" onClick={() => startCamera('tenant')} style={styles.cameraBtn}>📷 التقاط صورة بالـ iPad</button>
                    <label style={styles.uploadLabelStandard}>📂 اختيار صورة جاهزة<input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'tenant')} style={{display:'none'}}/></label>
                  </div>
                </div>

                <h3 style={{...styles.subSectionTitle, marginTop:'20px'}}>2. مسح رخصة السياقة بالذكاء الاصطناعي المباشر</h3>
                <div style={styles.cameraBox}>
                  <div style={styles.cameraView}>
                    {licensePhoto ? <img src={licensePhoto} alt="الرخصة" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <div style={{color:'#9ca3af', fontSize:'12px'}}>لم يتم المسح</div>}
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    <button type="button" onClick={() => startCamera('license')} style={styles.cameraBtn}>⚡ مسح الرخصة بالكاميرا</button>
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

                <h3 style={{...styles.subSectionTitle, marginTop:'20px'}}>3. مسح وفحص البطاقة الرمادية للمركبة</h3>
                <div style={styles.cameraBox}>
                  <div style={styles.cameraView}>
                    {greyCardPhoto ? <img src={greyCardPhoto} alt="البطاقة" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <div style={{color:'#9ca3af', fontSize:'12px'}}>لم يتم الفحص</div>}
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    <button type="button" onClick={() => startCamera('greyCard')} style={styles.cameraBtn}>🚗 مسح البطاقة الرمادية</button>
                    <label style={styles.uploadLabelPurple}>📂 رفع ملف البطاقة الرمادية<input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'greyCard')} style={{display:'none'}}/></label>
                  </div>
                </div>

                <div style={styles.formGrid}>
                  <div style={styles.inputGroup}>
                    <label>اختر السيارة للتأجير:</label>
                    <select required value={contractForm.selectedCarId} onChange={e => setContractForm({...contractForm, selectedCarId: e.target.value})} style={styles.input}>
                      <option value="">-- اختر المركبة --</option>
                      {fleet.map(car => (<option key={car.id} value={car.id} disabled={car.status !== 'available'}>{car.brand} {car.model} ({car.plateNumber})</option>))}
                    </select>
                  </div>
                  <div style={styles.inputGroup}><label>تاريخ الاستلام (البدء):</label><input type="datetime-local" required value={contractForm.startDate} onChange={e => setContractForm({...contractForm, startDate: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>تاريخ الإرجاع (النهاية):</label><input type="datetime-local" required value={contractForm.endDate} onChange={e => setContractForm({...contractForm, endDate: e.target.value})} style={styles.input}/></div>
                </div>

                <div style={styles.formGridCombined}>
                  <div style={styles.inputGroup}><label>سعر الكراء لليوم (دج):</label><input type="number" required value={contractForm.pricePerDay} onChange={e => setContractForm({...contractForm, pricePerDay: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>مبلغ الضمان / Caution (دج):</label><input type="number" required value={contractForm.caution} onChange={e => setContractForm({...contractForm, caution: e.target.value})} style={styles.input}/></div>
                  <div style={styles.inputGroup}><label>حالة خزان الوقود:</label><input type="text" required value={contractForm.fuelStatus} onChange={e => setContractForm({...contractForm, fuelStatus: e.target.value})} style={styles.input}/></div>
                </div>

                <button type="submit" style={styles.submitButton}>💾 حفظ وتوليد العقد الموثق للطباعة</button>
              </form>
            </div>
          </main>
        )}
      </div>

      {/* قالب الطباعة الفعلي المستقر والمنظم لـ 3 صفحات حقيقية ومغلقة كلياً */}
      {printedContract && (
        <div className="print-container" style={printStyles.container}>
          
          {/* الصفحة 1 */}
          <div className="print-page" style={printStyles.page}>
            <div style={printStyles.headerZone}>
              <div style={{ width: '100%', textAlign: 'center' }}>
                <img src="/logo.png" alt="Belagha Motors Original Logo" style={{ height: '85px', objectFit: 'contain', maxWidth: '100%' }} />
                <span style={{fontSize:'12px', display: 'block', marginTop: '5px', fontWeight: 'bold'}}>Constantine, Algérie | Tél: 0554 28 19 83</span>
                <span style={{fontSize:'10px', color: '#333'}}>RC: 25/00-038169 A 15 | NIF: 1852501093731100000</span>
              </div>
            </div>
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'15px'}}>
              <h2 style={{fontSize:'18px', margin:0, fontWeight:'bold'}}>عقد كراء سيارة / CONTRAT DE LOCATION</h2>
              <div style={printStyles.photoHolder}>
                {printedContract.photo && <img src={printedContract.photo} alt="الزبون" style={{width:'100%', height:'100%', objectFit:'cover'}} />}
              </div>
            </div>
            
            <h4 style={printStyles.sectionTitle}>1. معلومات المستأجر / Informations du Locataire</h4>
            <div style={printStyles.gridText}>
              <p><strong>الاسم واللقب / Nom et Prénom:</strong> {printedContract.tenantName}</p>
              <p><strong>تاريخ ومكان الميلاد:</strong> {printedContract.birthDatePlace || '15.12.1995 قسنطينة'}</p>
              <p><strong>رقم رخصة السياقة / N° de Permis:</strong> {printedContract.licenseNumber} | <strong>تاريخ الصدور:</strong> {printedContract.licenseIssueDate || '17-12-2025'}</p>
              <p><strong>العنوان / Adresse:</strong> {printedContract.tenantAddress} | <strong>رقم الهاتف / Tél:</strong> {printedContract.tenantPhone}</p>
            </div>

            <h4 style={printStyles.sectionTitle}>2. معلومات السيارة / Informations du Véhicule</h4>
            <div style={printStyles.gridText}>
              <p><strong>النوع والموديل / Marque et Modèle:</strong> {printedContract.carDetails?.brand} {printedContract.carDetails?.model} ({printedContract.carDetails?.year})</p>
              <p><strong>اللوحة المنجمية / Matricule:</strong> {printedContract.carDetails?.plateNumber} | <strong>رقم الهيكل / Châssis:</strong> {printedContract.carDetails?.chassisNumber}</p>
              <p><strong>العداد الحالي للمركبة:</strong> {printedContract.carDetails?.currentMileage} كم | <strong>حالة الوقود:</strong> {printedContract.fuelStatus}</p>
            </div>

            <h4 style={printStyles.sectionTitle}>3. تفاصيل فترة الكراء والدفع / Détails du Contrat</h4>
            <div style={printStyles.gridText}>
              <p><strong>بداية الكراء:</strong> {printedContract.startDate} | <strong>نهاية الكراء:</strong> {printedContract.endDate}</p>
              <p><strong>سعر اليوم المتفق عليه:</strong> {printedContract.pricePerDay} دج | <strong>المبلغ الإجمالي المستحق:</strong> {printedContract.total} دج | <strong>مبلغ الضمان المودع / Caution:</strong> {printedContract.caution} دج</p>
            </div>

            <h4 style={printStyles.sectionTitle}>الشروط القانونية العامة / Conditions Générales de Location</h4>
            <div className="clauses-container" style={{fontSize:'10px', lineHeight:'1.4'}}>
              <div className="clause-column" style={{direction:'rtl'}}>
                <p>• المستأجر يقر أنه استأجر السيارة في حالة جيدة، وفي حالة وقوع حادث يجب إعلام الوكالة فوراً.</p>
                <p>• لا يسمح بكراء السيارة للغير أو قيادتها إلا لمن حرر العقد باسمه الموثق.</p>
                <p>• يُمنع الخروج بالمركبة خارج الحدود الترابية الوطنية الجزائرية إطلاقاً.</p>
                <p>• أي تأخير عن موعد إرجاع السيارة يلزم المستأجر بدفع 1500 دج لجميع الساعات المتأخرة.</p>
                <p>• في حالة ضياع أو سرقة السيارة، يتحمل المستأجر 100% من ثمن السيارة الحالي نقداً.</p>
              </div>
              <div className="clause-column" style={{direction:'ltr'}}>
                <p>• Le locataire reconnaît avoir loué le véhicule en bon état. En cas d'accident, informer l'agence.</p>
                <p>• La sous-location ou la conduite par une tierce personne is strictly interdite.</p>
                <p>• Il est interdit de sortir le véhicule du territoire national algérien.</p>
                <p>• Tout retard dans la restitution entraîne une pénalité de 1500 DA par heure.</p>
                <p>• En cas de perte ou vol, il paie 100% de la valeur marchande du véhicule.</p>
              </div>
            </div>
            
            <div style={{position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign:'center', fontWeight:'bold'}}>1/3</div>
          </div>

          {/* الصفحة 2 */}
          <div className="print-page" style={printStyles.page}>
            <div style={printStyles.headerZone}>
              <div style={{ width: '100%', textAlign: 'center' }}>
                <img src="/logo.png" alt="Belagha Motors Logo" style={{ height: '70px', objectFit: 'contain' }} />
              </div>
            </div>
            
            <h4 style={{...printStyles.sectionTitle, marginTop:'20px'}}>بقية الشروط العامة والمسؤوليات الجزائية المدنية</h4>
            <div className="clauses-container" style={{fontSize:'11px', lineHeight:'1.7'}}>
              <div className="clause-column" style={{direction:'rtl'}}>
                <p><strong>• الأضرار والتصليح:</strong> المستأجر ملزم بدفع تكاليف الإصلاح نقداً وفوراً عند الورشة المعتمدة لدى الوكالة.</p>
                <p><strong>• البطاقة الرمادية:</strong> البطاقة الرمادية الأصلية للمركبة لا تسلم للزبون طوال فترة التأجير.</p>
                <p><strong>• الوقود والنظافة:</strong> إرجاع السيارة بنفس مستوى الوقود وبحالة نظيفة تماماً وإلا تُطبق غرامة مالية لتنظيف المركبة.</p>
                <p><strong>• المخالفات والرادار:</strong> المستأجر مسؤول مدنياً وجزائياً عن جميع المخالفات وتصوير الرادار طوال فترة الكراء.</p>
                <p><strong>• المحشر البلدي:</strong> يتحمل المستأجر تكاليف المحشر (Fourrière) بالكامل مع دفع سعر الأيام المحجوزة فيها السيارة.</p>
              </div>
              <div className="clause-column" style={{direction:'ltr'}}>
                <p><strong>• Accidents & Dégâts:</strong> Le locataire paie les frais de réparation en espèces immédiatement.</p>
                <p><strong>• Documents:</strong> La carte grise originale n'est pas remise au client.</p>
                <p><strong>• Carburant & Propreté:</strong> Restituer avec le même niveau de carburant et propre, sous peine de pénalités.</p>
                <p><strong>• Infractions & Radar:</strong> Le locataire est civilement et pénalement responsable de tous les flashs radars.</p>
                <p><strong>• Fourrière:</strong> En cas de mise en fourrière, le locataire paie tous les frais et les jours de blocage.</p>
              </div>
            </div>
            
            <div style={{...printStyles.footerSign, marginTop:'200px'}}>
              <div style={{textAlign:'center', width:'45%'}}>
                <span>توقيع المستأجر (قرأت ووافقت)</span><br/>
                <span style={{fontSize:'10px', fontWeight:'normal'}}>Lu et approuvé</span>
                <div style={{border:'1px solid #000', height:'90px', marginTop:'10px', borderRadius:'4px'}}></div>
              </div>
              <div style={{textAlign:'center', width:'45%'}}>
                <span>ختم وتوقيع مسير الوكالة</span>
                <div style={{border:'1px solid #000', height:'90px', marginTop:'10px', borderRadius:'4px'}}></div>
              </div>
            </div>
            
            <div style={{position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign:'center', fontWeight:'bold'}}>2/3</div>
          </div>

          {/* الصفحة 3 */}
          <div className="print-page" style={printStyles.page}>
            <div style={printStyles.headerZone}>
              <div style={{ width: '100%', textAlign: 'center' }}>
                <img src="/logo.png" alt="Belagha Motors Logo" style={{ height: '70px', objectFit: 'contain' }} />
              </div>
            </div>
            
            <div style={{marginTop: '30px'}}>
              <h3 style={{textAlign: 'center', margin: '0 0 20px 0', fontWeight:'bold', fontSize:'16px'}}>QUITTANCE DE PAIEMENT / وصل استلام مالي رسمي</h3>
              
              <table className="print-table">
                <tbody>
                  <tr>
                    <td style={{fontWeight:'bold', backgroundColor:'#f8fafc', width:'35%'}}>التاريخ الإداري / Date</td>
                    <td style={{fontFamily:'monospace'}}>{printedContract.dateString ? printedContract.dateString.split(' ')[0] : ''}</td>
                  </tr>
                  <tr>
                    <td style={{fontWeight:'bold', backgroundColor:'#f8fafc'}}>استلمنا من السيد(ة) / Client</td>
                    <td style={{fontWeight:'bold', fontSize:'14px'}}>{printedContract.tenantName}</td>
                  </tr>
                  <tr>
                    <td style={{fontWeight:'bold', backgroundColor:'#f8fafc'}}>المركبة المؤجرة / Véhicule</td>
                    <td>{printedContract.carDetails?.brand} {printedContract.carDetails?.model} ({printedContract.carDetails?.plateNumber})</td>
                  </tr>
                  <tr>
                    <td style={{fontWeight:'bold', backgroundColor:'#f8fafc'}}>مبلغ الكراء الإجمالي المدفوع</td>
                    <td style={{fontSize:'16px', fontWeight:'bold', color:'#111'}}>{printedContract.total} دج</td>
                  </tr>
                  <tr>
                    <td style={{fontWeight:'bold', backgroundColor:'#f8fafc'}}>مبلغ الضمان المودع (Caution)</td>
                    <td>{printedContract.caution} دج</td>
                  </tr>
                </tbody>
              </table>
              
              <div style={{...printStyles.footerSign, marginTop:'180px'}}>
                <div style={{textAlign:'center', width:'45%'}}>
                  <span>توقيع وتأكيد الزبون</span>
                  <div style={{border:'1px solid #000', height:'80px', marginTop:'10px', borderRadius:'4px'}}></div>
                </div>
                <div style={{textAlign:'center', width:'45%'}}>
                  <span>ختم مصلحة الحسابات والمالية</span>
                  <div style={{border:'1px solid #000', height:'80px', marginTop:'10px', borderRadius:'4px'}}></div>
                </div>
              </div>
            </div>
            
            <div style={{position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign:'center', fontWeight:'bold'}}>3/3</div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- التنسيقات الهندسية المعتمدة لمتصفح الشاشة ---
const styles = {
  appContainer: { fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', minHeight: '100vh' },
  header: { backgroundColor: '#1e293b', color: '#fff', padding: '12px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
  logo: { fontSize: '15px', margin: 0, fontWeight: 'bold' },
  navBtn: { color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor:'pointer', fontWeight:'bold', backgroundColor: '#3b82f6', marginRight: '5px' },
  apiConfigurationZone: { padding: '15px 30px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #cbd5e1' },
  apiKeyInputStyle: { padding: '8px 12px', width: '380px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' },
  mainContent: { padding: '30px' },
  sectionTitle: { fontSize: '18px', margin: 0, borderRight: '4px solid #2563eb', paddingRight: '10px', fontWeight:'bold' },
  addCarMainBtn: { backgroundColor: '#1e3a8a', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor:'pointer', fontWeight:'bold' },
  addCarCardContainer: { backgroundColor: '#f8fafc', padding: '20px', marginBottom: '25px', borderRadius: '8px' },
  addCarGridForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' },
  saveCarBtn: { gridColumn: '1 / -1', backgroundColor: '#166534', color: 'white', border: 'none', padding: '12px', cursor:'pointer', fontWeight:'bold', borderRadius: '4px' },
  tableWrapper: { backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'right' },
  thRow: { backgroundColor: '#f1f5f9' },
  th: { padding: '14px', fontWeight:'bold' },
  tr: { borderBottom: '1px solid #edf2f7' },
  td: { padding: '14px' },
  subSectionTitle: { fontSize: '14px', margin: 0, fontWeight: 'bold', color:'#1e293b' },
  cameraBox: { display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#f9fafb', padding: '15px', borderRadius: '6px', marginTop: '5px' },
  cameraView: { width: '100px', height: '115px', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border:'1px dashed #9ca3af', borderRadius:'4px', overflow:'hidden' },
  cameraBtn: { backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '8px 14px', cursor:'pointer', fontWeight:'bold', borderRadius:'4px' },
  
  uploadLabelStandard: { backgroundColor: '#4b5563', color: 'white', padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', display: 'inline-block' },
  uploadLabelBlue: { backgroundColor: '#0284c7', color: 'white', padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', display: 'inline-block' },
  uploadLabelPurple: { backgroundColor: '#7c3aed', color: 'white', padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', display: 'inline-block' },
  
  cameraOverlay: { position:'fixed', top:0, left:0, width:'100%', height:'100%', backgroundColor:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
  cameraModal: { backgroundColor:'white', padding:'20px', borderRadius:'12px', width: '80%', maxWidth: '500px' },
  formCard: { backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginTop: '10px' },
  formGridCombined: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', borderTop: '1px dashed #e5e7eb', paddingTop: '15px', marginTop: '15px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  input: { padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px' },
  submitButton: { width: '100%', backgroundColor: '#166534', color: 'white', padding: '14px', cursor:'pointer', fontWeight:'bold', border:'none', borderRadius:'6px', marginTop:'20px', fontSize:'15px' }
};

const printStyles = {
  container: { width: '100%', padding: '0', backgroundColor: '#fff' },
  page: { padding: '25px 35px', boxSizing: 'border-box', position: 'relative' },
  headerZone: { display: 'flex', justifyContent: 'center', borderBottom: '2px solid black', paddingBottom: '10px', alignItems: 'center' },
  photoHolder: { width: '95px', height: '120px', border: '1px solid black', backgroundColor:'#fafafa', borderRadius:'2px', overflow:'hidden' },
  sectionTitle: { borderBottom: '1px solid #000', paddingBottom: '4px', marginTop: '18px', fontSize:'13px', fontWeight: 'bold' },
  gridText: { fontSize:'13px', lineHeight: '1.6', marginTop: '5px' },
  footerSign: { display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontWeight: 'bold' }
};

export default App;
