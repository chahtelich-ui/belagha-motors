import React, { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';

const initialFleet = [
  { id: "car_1", brand: "Rover", model: "XPHWEP", year: 1993, plateNumber: "03813-193-25", currentMileage: 156200, status: "available", insuranceExpiryDate: "2026-08-15", oilChangeMileage: 160000, technicalControlDate: "2026-09-20" },
  { id: "car_2", brand: "Hyundai", model: "i10", year: 2022, plateNumber: "12345-122-25", currentMileage: 49500, status: "available", insuranceExpiryDate: "2026-06-01", oilChangeMileage: 55000, technicalControlDate: "2026-11-15" }
];

export default function App() {
  const [fleet, setFleet] = useState(initialFleet);
  const [activeTab, setActiveTab] = useState('new-contract');
  const [isLoading, setIsLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [cameraMode, setCameraMode] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const licenseFileInputRef = useRef(null);
  const tenantFileInputRef = useRef(null);

  const [tenantPhoto, setTenantPhoto] = useState(null);
  const [licensePhoto, setLicensePhoto] = useState(null);

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
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      setCalculatedDays(diffDays > 0 ? diffDays : 1);
      setCalculatedTotal((diffDays > 0 ? diffDays : 1) * Number(contractForm.pricePerDay || 0));
    }
  }, [contractForm.startDate, contractForm.endDate, contractForm.pricePerDay]);

  // --- محرك التصحيح المحلي الذكي (Algerian License Heuristics) ---
  const applySmartHeuristics = (rawText) => {
    let extractedName = "";
    let extractedLicense = "";
    let extractedBirthDate = "";
    let extractedIssueDate = "";

    // 1. استخراج رقم الرخصة (18 رقم)
    const licenseRegex = /\b\d{18}\b/;
    const licenseMatch = rawText.match(licenseRegex);
    if (licenseMatch) extractedLicense = licenseMatch[0];

    // 2. استخراج التواريخ
    const dateRegex = /\b\d{2}[./-]\d{2}[./-]\d{4}\b/g;
    const datesMatch = rawText.match(dateRegex);
    if (datesMatch && datesMatch.length >= 1) {
      extractedBirthDate = datesMatch[0].replace(/-/g, '.'); // تاريخ الميلاد غالباً هو الأول
      if (datesMatch.length >= 2) {
        extractedIssueDate = datesMatch[1].replace(/-/g, '.'); // تاريخ الإصدار غالباً هو الثاني
      }
    }

    // 3. استخراج الاسم (تجاهل الكلمات الإدارية الجزائرية)
    const ignoreWords = ["REPUBLIQUE", "ALGERIENNE", "DEMOCRATIQUE", "POPULAIRE", "PERMIS", "CONDUITE", "MINISTERE", "TRANSPORTS", "WILAYA", "DAIRA", "COMMUNE", "NOM", "PRENOM", "NE", "LE", "A", "FAIT", "VALABLE"];
    const lines = rawText.toUpperCase().split('\n');
    const validNameLines = [];

    lines.forEach(line => {
      // تنظيف السطر من الرموز والأرقام
      let cleanLine = line.replace(/[^A-Z\s]/g, '').trim();
      if (cleanLine.length > 3) {
        let isAdministrative = false;
        ignoreWords.forEach(word => { if (cleanLine.includes(word)) isAdministrative = true; });
        if (!isAdministrative) validNameLines.push(cleanLine);
      }
    });

    // دمج أول سطرين صالحين كاسم ولقب
    if (validNameLines.length > 0) extractedName = validNameLines.slice(0, 2).join(' ');

    setContractForm(prev => ({
      ...prev,
      tenantName: extractedName || prev.tenantName,
      licenseNumber: extractedLicense || prev.licenseNumber,
      birthDatePlace: extractedBirthDate ? `${extractedBirthDate} قسنطينة` : prev.birthDatePlace,
      licenseIssueDate: extractedIssueDate ? `صادرة بتاريخ: ${extractedIssueDate}` : prev.licenseIssueDate
    }));
  };

  // --- محرك القراءة المحلي (Tesseract.js) ---
  const executeLocalOCR = async (imageSrc) => {
    setIsLoading(true);
    setOcrStatus('جاري تحميل المحرك المحلي...');
    try {
      setOcrStatus('جاري قراءة وتحليل الصورة...');
      const worker = await Tesseract.createWorker('fra+eng');
      const { data: { text } } = await worker.recognize(imageSrc);
      await worker.terminate();
      
      setOcrStatus('جاري تطبيق خوارزمية التصحيح الذكية...');
      applySmartHeuristics(text);
      
    } catch (error) {
      console.error(error);
      alert("⚠️ حدث خطأ أثناء القراءة المحلية. يرجى إدخال البيانات يدوياً.");
    } finally {
      setIsLoading(false);
      setOcrStatus('');
    }
  };

  // --- دوال الكاميرا والرفع ---
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
    } catch (err) { alert("⚠️ يجب السماح بالكاميرا."); setCameraMode(null); }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640; canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataUrl('image/jpeg', 0.85);

    if (cameraMode === 'tenant') setTenantPhoto(dataUrl);
    if (cameraMode === 'license') { setLicensePhoto(dataUrl); executeLocalOCR(dataUrl); }
    
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setCameraMode(null);
  };

  const handleFileUpload = (e, mode) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (mode === 'tenant') setTenantPhoto(reader.result);
      if (mode === 'license') { setLicensePhoto(reader.result); executeLocalOCR(reader.result); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePrint = (e) => {
    e.preventDefault();
    if (!contractForm.selectedCarId) return alert("يرجى اختيار مركبة.");
    const targetCar = fleet.find(car => car.id === contractForm.selectedCarId);
    
    setPrintedContract({
      ...contractForm, carDetails: targetCar, days: calculatedDays || 1, total: calculatedTotal, photo: tenantPhoto,
      dateString: new Date().toLocaleDateString('fr-FR')
    });
    
    setTimeout(() => { window.print(); setPrintedContract(null); setActiveTab('dashboard'); }, 2000);
  };

  return (
    <div style={styles.appContainer} dir="rtl">
      
      {/* ستايل الطباعة الآمن لأبل */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
        * { font-family: 'Tajawal', sans-serif; box-sizing: border-box; }
        @media screen { .print-only-layout { display: none !important; } .screen-only-layout { display: block !important; } }
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body, html, #root { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .screen-only-layout { display: none !important; }
          .print-only-layout { display: block !important; }
          .print-page { display: block !important; page-break-after: always !important; page-break-inside: avoid !important; padding: 10px; }
          .print-page:last-child { page-break-after: auto !important; }
          .receipt-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
          .receipt-table td { border: 1px solid #000; padding: 12px; font-size: 14px; }
        }
      `}} />

      <div className="screen-only-layout">
        <header style={styles.header}>
          <h1 style={styles.logo}>BELAGHA MOTORS</h1>
          <div>
            <button style={activeTab === 'dashboard' ? styles.btnNavActive : styles.btnNav} onClick={() => setActiveTab('dashboard')}>الأسطول</button>
            <button style={activeTab === 'new-contract' ? styles.btnNavActive : styles.btnNav} onClick={() => setActiveTab('new-contract')}>+ عقد جديد</button>
          </div>
        </header>

        {isLoading && <div style={styles.loadingBanner}>⏳ {ocrStatus}</div>}

        {cameraMode && (
          <div style={styles.cameraOverlay}>
            <div style={styles.cameraModal}>
              <video ref={videoRef} autoPlay playsInline muted style={{width: '100%', borderRadius: '10px'}}></video>
              <div style={{display:'flex', gap:'10px', marginTop:'15px', justifyContent:'center'}}>
                <button onClick={capturePhoto} style={styles.btnAction}>📸 التقاط</button>
                <button onClick={() => setCameraMode(null)} style={styles.btnCancel}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        <main style={styles.main}>
          {activeTab === 'new-contract' && (
            <div style={styles.card}>
              <form onSubmit={handlePrint}>
                <div style={styles.grid}>
                  <div style={styles.mediaBox}>
                    <h3 style={styles.mediaTitle}>1. صورة المستأجر</h3>
                    <div style={{display:'flex', gap:'15px'}}>
                      <div style={styles.imgPreview}>{tenantPhoto ? <img src={tenantPhoto} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="زبون"/> : "لا توجد"}</div>
                      <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                        <button type="button" onClick={()=>startCamera('tenant')} style={styles.btnAction}>📷 كاميرا</button>
                        <input type="file" ref={tenantFileInputRef} onChange={(e)=>handleFileUpload(e,'tenant')} style={{display:'none'}} />
                        <button type="button" onClick={()=>tenantFileInputRef.current.click()} style={styles.btnUpload}>📂 ملف جاهز</button>
                      </div>
                    </div>
                  </div>

                  <div style={styles.mediaBox}>
                    <h3 style={styles.mediaTitle}>2. رخصة السياقة (قراءة محلية ذكية)</h3>
                    <div style={{display:'flex', gap:'15px'}}>
                      <div style={styles.imgPreview}>{licensePhoto ? <img src={licensePhoto} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="رخصة"/> : "لا توجد"}</div>
                      <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                        <button type="button" onClick={()=>startCamera('license')} style={styles.btnAction}>⚡ مسح بالكاميرا</button>
                        <input type="file" ref={licenseFileInputRef} onChange={(e)=>handleFileUpload(e,'license')} style={{display:'none'}} />
                        <button type="button" onClick={()=>licenseFileInputRef.current.click()} style={styles.btnUploadAI}>🤖 قراءة محلية</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.grid} style={{marginTop:'20px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'15px'}}>
                  <div><label style={styles.label}>الاسم واللقب:</label><input required value={contractForm.tenantName} onChange={e=>setContractForm({...contractForm, tenantName: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>رقم الرخصة:</label><input required value={contractForm.licenseNumber} onChange={e=>setContractForm({...contractForm, licenseNumber: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>الميلاد:</label><input required value={contractForm.birthDatePlace} onChange={e=>setContractForm({...contractForm, birthDatePlace: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>الإصدار:</label><input required value={contractForm.licenseIssueDate} onChange={e=>setContractForm({...contractForm, licenseIssueDate: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>الهاتف:</label><input required value={contractForm.tenantPhone} onChange={e=>setContractForm({...contractForm, tenantPhone: e.target.value})} style={styles.inputField}/></div>
                  
                  <div>
                    <label style={styles.label}>المركبة:</label>
                    <select required value={contractForm.selectedCarId} onChange={e=>setContractForm({...contractForm, selectedCarId: e.target.value})} style={styles.inputField}>
                      <option value="">-- اختر سيارة --</option>
                      {fleet.map(car => <option key={car.id} value={car.id}>{car.brand} {car.model}</option>)}
                    </select>
                  </div>
                  <div><label style={styles.label}>الاستلام:</label><input type="datetime-local" required value={contractForm.startDate} onChange={e=>setContractForm({...contractForm, startDate: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>الإرجاع:</label><input type="datetime-local" required value={contractForm.endDate} onChange={e=>setContractForm({...contractForm, endDate: e.target.value})} style={styles.inputField}/></div>
                </div>

                <button type="submit" style={styles.btnSubmitFinal}>💾 طباعة العقد (محلياً بالكامل)</button>
              </form>
            </div>
          )}
          
          {activeTab === 'dashboard' && (
             <div style={styles.card}><h2 style={{textAlign:'center'}}>إدارة الأسطول (تم إخفاؤها مؤقتاً للتركيز على العقد)</h2></div>
          )}
        </main>
      </div>

      {/* منطقة الطباعة المحمية */}
      <div className="print-only-layout">
        {printedContract && (
          <div className="print-page">
            <h1 style={{textAlign:'center', fontSize:'24px', borderBottom:'2px solid #000', paddingBottom:'10px'}}>BELAGHA MOTORS - عقد كراء سيارة</h1>
            <table style={{width:'100%', marginTop:'20px'}}>
              <tbody>
                <tr>
                  <td style={{width:'50%', border:'1px solid #000', padding:'15px', verticalAlign:'top'}}>
                    <h3>1. المستأجر</h3>
                    <p>الاسم: <strong>{printedContract.tenantName}</strong></p>
                    <p>الرخصة: <strong>{printedContract.licenseNumber}</strong></p>
                    <p>الميلاد: <strong>{printedContract.birthDatePlace}</strong></p>
                    {printedContract.photo && <img src={printedContract.photo} style={{width:'100px', height:'120px', border:'1px solid #000', marginTop:'10px'}} alt="الزبون" />}
                  </td>
                  <td style={{width:'50%', border:'1px solid #000', padding:'15px', verticalAlign:'top'}}>
                    <h3>2. المركبة</h3>
                    <p>السيارة: <strong>{printedContract.carDetails?.brand} {printedContract.carDetails?.model}</strong></p>
                    <p>الاستلام: <strong>{printedContract.startDate}</strong></p>
                    <p>الإرجاع: <strong>{printedContract.endDate}</strong></p>
                    <p>الإجمالي: <strong>{printedContract.total} دج</strong></p>
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{marginTop:'50px', display:'flex', justifyContent:'space-around', fontWeight:'bold'}}>
              <div>توقيع المستأجر<br/><br/><br/>...................</div>
              <div>ختم الوكالة<br/><br/><br/>...................</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  appContainer: { background: '#f8fafc', minHeight: '100vh', paddingBottom: '40px', color: '#0f172a' },
  header: { background: '#ffffff', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
  logo: { fontSize: '24px', margin: 0, fontWeight: '900', color: '#0f172a' },
  btnNav: { background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginLeft:'10px' },
  btnNavActive: { background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginLeft:'10px' },
  loadingBanner: { background: '#8b5cf6', color: 'white', textAlign: 'center', padding: '12px', fontWeight: 'bold' },
  main: { padding: '20px', maxWidth: '1000px', margin: '0 auto' },
  card: { background: '#ffffff', padding: '25px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' },
  mediaBox: { background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #cbd5e1' },
  mediaTitle: { fontSize: '15px', margin: '0 0 15px 0' },
  imgPreview: { width: '80px', height: '100px', background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', overflow: 'hidden' },
  btnAction: { background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnUpload: { background: '#64748b', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnUploadAI: { background: '#10b981', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnCancel: { background: '#ef4444', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  label: { display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' },
  inputField: { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' },
  btnSubmitFinal: { background: '#0f172a', color: '#fff', border: 'none', padding: '15px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', width: '100%', marginTop: '20px', cursor: 'pointer' },
  cameraOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  cameraModal: { background: '#fff', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '500px' },
};
