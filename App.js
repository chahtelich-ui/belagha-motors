import React, { useState, useEffect, useRef } from 'react';
// استيراد حزمة جوجل للذكاء الاصطناعي
import { GoogleGenerativeAI } from "@google/generative-ai";

// أسطول السيارات المعتمد
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

  // حفظ مفتاح الـ API
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('belagha_gemini_api_key') || '';
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [tenantPhoto, setTenantPhoto] = useState(null);
  const [licensePhoto, setLicensePhoto] = useState(null);
  const [greyCardPhoto, setGreyCardPhoto] = useState(null);

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

  const getExpiryBadge = (dateStr) => {
    if (!dateStr) return { label: "غير محدد", color: "#f3f4f6", text: "#4b5563" };
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    if (days < 0) return { label: "منتهي", color: "#fee2e2", text: "#991b1b" };
    if (days <= 15) return { label: "ينتهي قريبًا", color: "#fef3c7", text: "#92400e" };
    return { label: "ساري", color: "#dcfce7", text: "#166534" };
  };

  const getOilChangeBadge = (current, next) => {
    if (!next) return { label: "غير محدد", color: "#f3f4f6", text: "#4b5563" };
    const rem = Number(next) - Number(current);
    if (rem <= 0) return { label: "متجاوز", color: "#fee2e2", text: "#991b1b" };
    if (rem <= 1000) return { label: "تغيير فوري", color: "#fef3c7", text: "#92400e" };
    return { label: `${rem} كم متبقي`, color: "#e0f2fe", text: "#0369a1" };
  };

  const handleAddCarSubmit = (e) => {
    e.preventDefault();
    setFleet([...fleet, { ...newCarForm, id: "car_" + (fleet.length + 1), currentMileage: Number(newCarForm.currentMileage), nextOilChangeDue: Number(newCarForm.nextOilChangeDue), status: "available" }]);
    setShowAddCarForm(false);
  };

  const startCamera = async (mode) => {
    setCameraMode(mode);
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode === 'tenant' ? 'user' : 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("يرجى تفعيل صلاحية الكاميرا.");
      setCameraMode(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataUrl('image/jpeg');
    if (cameraMode === 'tenant') setTenantPhoto(dataUrl);
    if (cameraMode === 'license') { setLicensePhoto(dataUrl); executeRealTimeOcrScan(dataUrl, 'license'); }
    if (cameraMode === 'greyCard') { setGreyCardPhoto(dataUrl); executeRealTimeOcrScan(dataUrl, 'greyCard'); }
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
      if (mode === 'license') { setLicensePhoto(dataUrl); executeRealTimeOcrScan(dataUrl, 'license'); }
      if (mode === 'greyCard') { setGreyCardPhoto(dataUrl); executeRealTimeOcrScan(dataUrl, 'greyCard'); }
    };
    reader.readAsDataURL(file);
  };

  const executeRealTimeOcrScan = async (base64Image, scanType) => {
    if (!apiKey) {
      alert("⚠️ يرجى إدخال API Key الخاص بـ Gemini أولاً.");
      return;
    }
    setIsLoadingAI(true);
    try {
      const pureBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });

      let prompt = `اقرأ الوثيقة الجزائرية المرفقة واستخرج البيانات على شكل JSON تماماً كالتالي:`;
      if (scanType === 'license') {
        prompt += ` { "tenantName": "الاسم واللقب باللاتينية", "licenseNumber": "رقم الرخصة المكون من 18 رقم", "birthDatePlace": "تاريخ ومكان الميلاد", "licenseIssueDate": "تاريخ الصدور" }`;
      } else {
        prompt += ` { "plateNumber": "رقم اللوحة مثل 03813-193-25" }`;
      }

      const result = await model.generateContent([prompt, { inlineData: { data: pureBase64, mimeType: "image/jpeg" } }]);
      const parsed = JSON.parse((await result.response).text().trim());

      if (scanType === 'license') {
        setContractForm(prev => ({ ...prev, tenantName: parsed.tenantName || prev.tenantName, licenseNumber: parsed.licenseNumber || prev.licenseNumber, birthDatePlace: parsed.birthDatePlace || prev.birthDatePlace, licenseIssueDate: parsed.licenseIssueDate || prev.licenseIssueDate }));
      } else if (scanType === 'greyCard') {
        const matched = fleet.find(c => c.plateNumber.replace(/\s+/g, '') === (parsed.plateNumber || '').replace(/\s+/g, ''));
        if (matched) setContractForm(prev => ({ ...prev, selectedCarId: matched.id }));
      }
    } catch (err) {
      alert("❌ خطأ في مسح المستند، يرجى ملء الحقول يدوياً.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleCreateContractSubmit = (e) => {
    e.preventDefault();
    const targetCar = fleet.find(c => c.id === contractForm.selectedCarId);
    setPrintedContract({ ...contractForm, carDetails: targetCar, days: calculatedDays, total: calculatedTotal, photo: tenantPhoto, dateString: new Date().toLocaleDateString() });
    setFleet(fleet.map(c => c.id === contractForm.selectedCarId ? { ...c, status: 'rented' } : c));
    setTimeout(() => { window.print(); setActiveTab('dashboard'); }, 500);
  };

  return (
    <div style={styles.appContainer} dir="rtl">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0mm !important; }
          body, html, #root { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; font-size: 11px !important; }
          .no-print { display: none !important; }
          .print-container { display: block !important; width: 100% !important; }
          .print-page { display: block !important; page-break-after: always !important; height: 297mm !important; padding: 25px 35px !important; position: relative !important; box-sizing: border-box; }
          .print-page:last-child { page-break-after: avoid !important; }
        }
        @media screen { .print-container { display: none !important; } }
      `}</style>

      <div className="no-print">
        <header style={styles.header}>
          <h2>BELAGHA MOTORS</h2>
          <div>
            <button style={styles.navBtn} onClick={() => setActiveTab('dashboard')}>لوحة الأسطول</button>
            <button style={styles.navBtn} onClick={() => setActiveTab('new-contract')}>+ عقد جديد</button>
          </div>
        </header>

        <div style={styles.apiZone}>
          <label>🔑 Gemini API Key: </label>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} style={styles.input} placeholder="أدخل مفتاح جوجل هنا..."/>
        </div>

        {isLoadingAI && <div style={styles.loadingBanner}>⏳ جاري القراءة التلقائية بالذكاء الاصطناعي...</div>}

        {cameraMode && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <video ref={videoRef} autoPlay playsInline style={{width:'100%', borderRadius:'8px'}}></video>
              <button type="button" onClick={capturePhoto} style={styles.actionBtn}>📸 التقاط</button>
              <button type="button" onClick={() => setCameraMode(null)} style={styles.cancelBtn}>إلغاء</button>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div style={{padding:'20px'}}>
            <button onClick={() => setShowAddCarForm(!showAddCarForm)} style={styles.actionBtn}>➕ إضافة سيارة</button>
            {showAddCarForm && (
              <form onSubmit={handleAddCarSubmit} style={styles.formGrid}>
                <input placeholder="الماركة" onChange={e=>setNewCarForm({...newCarForm, brand:e.target.value})} style={styles.input} required/>
                <input placeholder="الموديل" onChange={e=>setNewCarForm({...newCarForm, model:e.target.value})} style={styles.input} required/>
                <input placeholder="رقم اللوحة" onChange={e=>setNewCarForm({...newCarForm, plateNumber:e.target.value})} style={styles.input} required/>
                <input placeholder="العداد الحلي" type="number" onChange={e=>setNewCarForm({...newCarForm, currentMileage:e.target.value})} style={styles.input} required/>
                <button type="submit" style={styles.actionBtn}>حفظ</button>
              </form>
            )}
            <table style={{width:'100%', marginTop:'20px', background:'white', borderRadius:'8px'}}>
              <thead>
                <tr style={{background:'#f1f5f9'}}>
                  <th style={{padding:'10px'}}>السيارة</th><th style={{padding:'10px'}}>العداد</th><th style={{padding:'10px'}}>الزيت</th><th style={{padding:'10px'}}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {fleet.map(c => (
                  <tr key={c.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                    <td style={{padding:'10px'}}>{c.brand} {c.model} ({c.plateNumber})</td>
                    <td style={{padding:'10px'}}>{c.currentMileage} كم</td>
                    <td style={{padding:'10px'}}>{getOilChangeBadge(c.currentMileage, c.nextOilChangeDue).label}</td>
                    <td style={{padding:'10px'}}>{c.status === 'available' ? 'متاحة' : 'مكراة'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'new-contract' && (
          <div style={{padding:'20px'}}>
            <form onSubmit={handleCreateContractSubmit} style={{background:'white', padding:'20px', borderRadius:'8px'}}>
              <h4>صورة المستأجر</h4>
              <button type="button" onClick={() => startCamera('tenant')} style={styles.actionBtn}>الكاميرا</button>
              <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'tenant')} />

              <h4>رخصة السياقة (مسح ذكي)</h4>
              <button type="button" onClick={() => startCamera('license')} style={styles.actionBtn}>امسح الكاميرا</button>
              <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'license')} />

              <div style={styles.formGrid}>
                <input placeholder="الاسم الكامل" value={contractForm.tenantName} onChange={e=>setContractForm({...contractForm, tenantName:e.target.value})} style={styles.input} required/>
                <input placeholder="رقم الرخصة" value={contractForm.licenseNumber} onChange={e=>setContractForm({...contractForm, licenseNumber:e.target.value})} style={styles.input} required/>
                <input placeholder="الهاتف" value={contractForm.tenantPhone} onChange={e=>setContractForm({...contractForm, tenantPhone:e.target.value})} style={styles.input} required/>
              </div>

              <h4>البطاقة الرمادية</h4>
              <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'greyCard')} />

              <div style={styles.formGrid}>
                <select value={contractForm.selectedCarId} onChange={e=>setContractForm({...contractForm, selectedCarId:e.target.value})} style={styles.input} required>
                  <option value="">اختر السيارة</option>
                  {fleet.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model}</option>)}
                </select>
                <input type="datetime-local" value={contractForm.startDate} onChange={e=>setContractForm({...contractForm, startDate:e.target.value})} style={styles.input} required/>
                <input type="datetime-local" value={contractForm.endDate} onChange={e=>setContractForm({...contractForm, endDate:e.target.value})} style={styles.input} required/>
              </div>

              <button type="submit" style={{...styles.actionBtn, width:'100%', marginTop:'20px'}}>💾 حفظ وتوليد العقد للطباعة</button>
            </form>
          </div>
        )}
      </div>

      {/* نموذج الطباعة الموثق لـ 3 صفحات */}
      {printedContract && (
        <div className="print-container">
          {/* الصفحة 1 */}
          <div className="print-page">
            <div style={{textAlign:'center', borderBottom:'2px solid #000', paddingBottom:'10px'}}>
              <h2>BELAGHA MOTORS</h2>
              <p>Constantine, Algérie | Tél: 0554 28 19 83</p>
            </div>
            <h3>عقد كراء سيارة / CONTRAT DE LOCATION</h3>
            <p><strong>المستأجر:</strong> {printedContract.tenantName}</p>
            <p><strong>رقم الرخصة:</strong> {printedContract.licenseNumber}</p>
            <p><strong>السيارة:</strong> {printedContract.carDetails?.brand} {printedContract.carDetails?.model} ({printedContract.carDetails?.plateNumber})</p>
            <p><strong>المبلغ الإجمالي:</strong> {printedContract.total} دج</p>
            <div style={{position:'absolute', bottom:'20px', left:'50%'}}>1/3</div>
          </div>

          {/* الصفحة 2 */}
          <div className="print-page">
            <h3>الشروط القانونية والجزائية</h3>
            <p>• يلتزم المستأجر بالحفاظ على المركبة وإرجاعها في الوقت المحدد.</p>
            <p>• المسؤولية الكاملة عن المخالفات تقع على عاتق المستأجر.</p>
            <div style={{display:'flex', justifyContent:'space-between', marginTop:'100px'}}>
              <div>توقيع الزبون</div>
              <div>ختم الوكالة</div>
            </div>
            <div style={{position:'absolute', bottom:'20px', left:'50%'}}>2/3</div>
          </div>

          {/* الصفحة 3 */}
          <div className="print-page">
            <h3>QUITTANCE DE PAIEMENT / وصل استلام مالي</h3>
            <p>تم استلام مبلغ {printedContract.total} دج من السيد {printedContract.tenantName} كمنفعة كراء للمركبة المذكورة أعلاه.</p>
            <div style={{position:'absolute', bottom:'20px', left:'50%'}}>3/3</div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: { background:'#f3f4f6', minHeight:'100vh', fontFamily:'sans-serif' },
  header: { background:'#1e293b', color:'white', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' },
  navBtn: { background:'#3b82f6', color:'white', border:'none', padding:'6px 12px', marginRight:'5px', borderRadius:'4px', cursor:'pointer' },
  apiZone: { padding:'10px 20px', background:'#e2e8f0' },
  input: { padding:'8px', border:'1px solid #cbd5e1', borderRadius:'4px', width:'250px' },
  loadingBanner: { background:'#7c3aed', color:'white', textAlign:'center', padding:'10px' },
  formGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'10px', marginTop:'10px' },
  actionBtn: { background:'#166534', color:'white', border:'none', padding:'10px 15px', borderRadius:'4px', cursor:'pointer' },
  cancelBtn: { background:'#b91c1c', color:'white', border:'none', padding:'10px 15px', borderRadius:'4px', cursor:'pointer' },
  overlay: { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 },
  modal: { background:'white', padding:'20px', borderRadius:'8px', width:'400px', textAlign:'center' }
};

export default App;