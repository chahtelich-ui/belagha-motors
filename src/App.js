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

  const applySmartHeuristics = (rawText) => {
    let extractedName = "";
    let extractedLicense = "";
    let extractedBirthDate = "";
    let extractedIssueDate = "";

    const licenseRegex = /\b\d{18}\b/;
    const licenseMatch = rawText.match(licenseRegex);
    if (licenseMatch) extractedLicense = licenseMatch[0];

    const dateRegex = /\b\d{2}[./-]\d{2}[./-]\d{4}\b/g;
    const datesMatch = rawText.match(dateRegex);
    if (datesMatch && datesMatch.length >= 1) {
      extractedBirthDate = datesMatch[0].replace(/-/g, '.');
      if (datesMatch.length >= 2) {
        extractedIssueDate = datesMatch[1].replace(/-/g, '.');
      }
    }

    const ignoreWords = ["REPUBLIQUE", "ALGERIENNE", "DEMOCRATIQUE", "POPULAIRE", "PERMIS", "CONDUITE", "MINISTERE", "TRANSPORTS", "WILAYA", "DAIRA", "COMMUNE", "NOM", "PRENOM", "NE", "LE", "A", "FAIT", "VALABLE", "DZ"];
    const lines = rawText.toUpperCase().split('\n');
    const validNameLines = [];

    lines.forEach(line => {
      let cleanLine = line.replace(/[^A-Z\s]/g, '').trim();
      if (cleanLine.length > 3) {
        let isAdministrative = false;
        ignoreWords.forEach(word => { if (cleanLine.includes(word)) isAdministrative = true; });
        if (!isAdministrative) validNameLines.push(cleanLine);
      }
    });

    if (validNameLines.length > 0) extractedName = validNameLines.slice(0, 2).join(' ');

    setContractForm(prev => ({
      ...prev,
      tenantName: extractedName || prev.tenantName,
      licenseNumber: extractedLicense || prev.licenseNumber,
      birthDatePlace: extractedBirthDate ? `${extractedBirthDate} قسنطينة` : prev.birthDatePlace,
      licenseIssueDate: extractedIssueDate ? `صادرة بتاريخ: ${extractedIssueDate}` : prev.licenseIssueDate
    }));
  };

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
      alert("⚠️ حدث خطأ أثناء القراءة المحلية.");
    } finally {
      setIsLoading(false);
      setOcrStatus('');
    }
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
    
    setFleet(fleet.map(car => car.id === contractForm.selectedCarId ? { ...car, status: 'rented' } : car));

    setPrintedContract({
      ...contractForm, 
      carDetails: targetCar, 
      days: calculatedDays || 1, 
      total: calculatedTotal, 
      photo: tenantPhoto,
      dateString: new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
    });
    
    setTimeout(() => { window.print(); setPrintedContract(null); setActiveTab('dashboard'); }, 2000);
  };

  return (
    <div style={styles.appContainer} dir="rtl">
      
      {/* CSS الطباعة الأصلي الفخم المكون من 3 صفحات */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
        * { font-family: 'Tajawal', sans-serif; box-sizing: border-box; }
        @media screen { .print-only-layout { display: none !important; } .screen-only-layout { display: block !important; } }
        
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body, html, #root { background: #fff !important; color: #000 !important; margin: 0 !important; padding: 0 !important; }
          .screen-only-layout, .no-print { display: none !important; }
          .print-only-layout { display: block !important; width: 100%; }
          
          .print-page { display: block !important; page-break-after: always !important; page-break-inside: avoid !important; position: relative !important; padding: 15px !important; min-height: 270mm; }
          .print-page:last-child { page-break-after: auto !important; }
          
          .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; align-items: center; }
          .doc-header p { margin: 2px 0; font-size: 11px; font-weight: bold; }
          .doc-title { text-align: center; margin: 10px 0 20px 0; font-size: 18px; text-decoration: underline; font-weight: 900; }
          
          .info-grid { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 15px; }
          .info-box { width: 48%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; position: relative; }
          .info-box h5 { margin: 0 0 8px 0; border-bottom: 1px solid #000; padding-bottom: 4px; font-size: 13px; }
          .info-box p { margin: 5px 0; font-size: 12px; }
          .tenant-photo-print { position: absolute; left: 10px; top: 30px; width: 75px; height: 95px; border: 1px solid #000; border-radius: 4px; object-fit: cover; }
          
          .terms-title { text-align: center; background: #1e293b !important; color: #fff !important; padding: 6px; font-size: 13px; border-radius: 4px; margin: 15px 0; -webkit-print-color-adjust: exact; }
          .term-item { margin-bottom: 10px; page-break-inside: avoid; }
          .term-header { background: #f1f5f9 !important; border-right: 4px solid #1e293b !important; padding: 4px 8px; font-size: 11px; font-weight: bold; margin-bottom: 4px; -webkit-print-color-adjust: exact; }
          .term-body { display: flex; justify-content: space-between; font-size: 10px; line-height: 1.4; }
          .term-ar { width: 48%; text-align: justify; }
          .term-fr { width: 48%; text-align: justify; direction: ltr; border-left: 1px dashed #cbd5e1; padding-left: 8px; }
          
          .signatures { display: flex; justify-content: space-between; margin-top: 25px; page-break-inside: avoid; }
          .sig-box { width: 45%; text-align: center; font-size: 12px; font-weight: bold; }
          .sig-space { height: 80px; border: 1px solid #94a3b8; border-radius: 4px; margin-top: 8px; background: #f8fafc !important; -webkit-print-color-adjust: exact; }
          
          .receipt-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .receipt-table td { border: 1px solid #000; padding: 10px; font-size: 13px; }
          .receipt-table td.bg-gray { background: #f8fafc !important; font-weight: bold; width: 40%; -webkit-print-color-adjust: exact; }
          .page-num { position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 11px; font-weight: bold; }
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

                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'15px', marginTop:'20px'}}>
                  <div><label style={styles.label}>الاسم واللقب:</label><input required value={contractForm.tenantName} onChange={e=>setContractForm({...contractForm, tenantName: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>رقم الرخصة:</label><input required value={contractForm.licenseNumber} onChange={e=>setContractForm({...contractForm, licenseNumber: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>الميلاد:</label><input required value={contractForm.birthDatePlace} onChange={e=>setContractForm({...contractForm, birthDatePlace: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>الإصدار:</label><input required value={contractForm.licenseIssueDate} onChange={e=>setContractForm({...contractForm, licenseIssueDate: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>الهاتف:</label><input required value={contractForm.tenantPhone} onChange={e=>setContractForm({...contractForm, tenantPhone: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>العنوان:</label><input required value={contractForm.tenantAddress} onChange={e=>setContractForm({...contractForm, tenantAddress: e.target.value})} style={styles.inputField}/></div>
                  
                  <div>
                    <label style={styles.label}>المركبة:</label>
                    <select required value={contractForm.selectedCarId} onChange={e=>setContractForm({...contractForm, selectedCarId: e.target.value})} style={styles.inputField}>
                      <option value="">-- اختر سيارة --</option>
                      {fleet.map(car => <option key={car.id} value={car.id} disabled={car.status !== 'available'}>{car.brand} {car.model} ({car.plateNumber})</option>)}
                    </select>
                  </div>
                  <div><label style={styles.label}>الاستلام:</label><input type="datetime-local" required value={contractForm.startDate} onChange={e=>setContractForm({...contractForm, startDate: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>الإرجاع:</label><input type="datetime-local" required value={contractForm.endDate} onChange={e=>setContractForm({...contractForm, endDate: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>سعر اليوم (دج):</label><input type="number" required value={contractForm.pricePerDay} onChange={e=>setContractForm({...contractForm, pricePerDay: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>الضمان / Caution:</label><input type="number" required value={contractForm.caution} onChange={e=>setContractForm({...contractForm, caution: e.target.value})} style={styles.inputField}/></div>
                  <div><label style={styles.label}>حالة الوقود:</label><input required value={contractForm.fuelStatus} onChange={e=>setContractForm({...contractForm, fuelStatus: e.target.value})} style={styles.inputField}/></div>
                </div>

                <div style={{background:'#ecfdf5', color:'#064e3b', padding:'15px', borderRadius:'8px', textAlign:'center', marginTop:'20px', fontWeight:'bold', border:'1px solid #10b981'}}>
                  الإجمالي: {calculatedTotal} دج | المدة: {calculatedDays} يوم
                </div>

                <button type="submit" style={styles.btnSubmitFinal}>💾 طباعة العقد النهائي</button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* ==============================================================
          منطقة الطباعة الاحترافية (3 صفحات) المرجعة بالكامل
      ============================================================== */}
      <div className="print-only-layout">
        {printedContract && (
          <>
            {/* الصفحة الأولى: العقد */}
            <div className="print-page">
              <div className="doc-header">
                <div><h1 style={{margin:0, fontSize:'22px', fontWeight:'900'}}>BELAGHA MOTORS</h1><p>LOCATION DE VOITURES</p></div>
                <div style={{textAlign:'right'}}>
                  <p>📍 Constantine, Algérie</p><p>📞 0554 28 19 83</p><p>RC: 25/00-038169 A 15 | NIF: 1852501093731100000</p>
                </div>
              </div>
              
              <h2 className="doc-title">عقد كراء سيارة / CONTRAT DE LOCATION</h2>
              
              <div className="info-grid">
                <div className="info-box" style={{paddingLeft: '95px'}}>
                  <h5>1. معلومات المستأجر / Locataire</h5>
                  <p><strong>الاسم واللقب:</strong> {printedContract.tenantName}</p>
                  <p><strong>تاريخ ومكان الميلاد:</strong> {printedContract.birthDatePlace}</p>
                  <p><strong>رقم الرخصة:</strong> {printedContract.licenseNumber}</p>
                  <p><strong>صادرة في:</strong> {printedContract.licenseIssueDate}</p>
                  <p><strong>العنوان:</strong> {printedContract.tenantAddress}</p>
                  <p><strong>رقم الهاتف:</strong> {printedContract.tenantPhone}</p>
                  {printedContract.photo && <img src={printedContract.photo} className="tenant-photo-print" alt="الزبون" />}
                </div>
                <div className="info-box">
                  <h5>2. معلومات السيارة / Véhicule</h5>
                  <p><strong>النوع والموديل:</strong> {printedContract.carDetails?.brand} {printedContract.carDetails?.model}</p>
                  <p><strong>اللوحة المنجمية:</strong> {printedContract.carDetails?.plateNumber}</p>
                  <p><strong>العداد الحالي:</strong> {printedContract.carDetails?.currentMileage} كم</p>
                  <p><strong>تاريخ الاستلام:</strong> {printedContract.startDate}</p>
                  <p><strong>تاريخ الإرجاع:</strong> {printedContract.endDate}</p>
                  <p><strong>السعر لليوم:</strong> {printedContract.pricePerDay} دج | <strong>المدة:</strong> {printedContract.days} يوم</p>
                  <p><strong>الضمان (Caution):</strong> {printedContract.caution} دج | <strong>الوقود:</strong> {printedContract.fuelStatus}</p>
                  <p><strong>المبلغ الإجمالي:</strong> {printedContract.total} دج</p>
                </div>
              </div>

              <div className="terms-title">الشروط القانونية والتزامات المستأجر / Conditions Générales (1/2)</div>
              
              <div className="term-item">
                <div className="term-header">1. حالة السيارة والحوادث / État du Véhicule & Accidents</div>
                <div className="term-body">
                  <div className="term-ar">المستأجر يقر أنه استأجر السيارة في حالة جيدة. في حالة وقوع حادث أو تحطم المستأجر ملزم بدفع تكاليف الإصلاح نقداً وفوراً. في حال التضرر الكبير يدفع ثمن السيارة بالكامل.</div>
                  <div className="term-fr">Le locataire reconnaît avoir loué le véhicule en bon état. En cas d'accident, le locataire paie les frais de réparation en espèces. Si majeur, la valeur totale.</div>
                </div>
              </div>

              <div className="term-item">
                <div className="term-header">2. القيادة / Conduite</div>
                <div className="term-body">
                  <div className="term-ar">لا يسمح بكراء السيارة للغير أو قيادتها إلا لمن حرر العقد باسمه. يحق للوكالة استرجاع السيارة دون أي تعويض. لا يسمح بوجود السيارة خارج التراب الوطني.</div>
                  <div className="term-fr">La sous-location ou la conduite par une tierce personne est interdite. L'agence peut récupérer le véhicule sans remboursement. Il est strictement interdit de sortir du territoire national.</div>
                </div>
              </div>

              <div className="term-item">
                <div className="term-header">3. التأخير في الإرجاع / Retard de Restitution</div>
                <div className="term-body">
                  <div className="term-ar">أي تأخير عن موعد إرجاع السيارة يلزم المستأجر بدفع 1500 دج للساعة الواحدة.</div>
                  <div className="term-fr">Tout retard dans la restitution entraîne une pénalité de 1500 DA par heure.</div>
                </div>
              </div>

              <div className="page-num">1 / 3</div>
            </div>

            {/* الصفحة الثانية: الشروط */}
            <div className="print-page">
              <div className="doc-header"><h1 style={{margin:0, fontSize:'18px'}}>BELAGHA MOTORS</h1><p>21/04/2026</p></div>
              <div className="terms-title">تتمة الالتزامات والشروط القانونية / Conditions Générales (2/2)</div>

              <div className="term-item">
                <div className="term-header">4. السرقة أو الضياع / Perte ou Vol</div>
                <div className="term-body">
                  <div className="term-ar">في حالة ضياع أو سرقة السيارة، تقع المسؤولية كاملة على المستأجر وهو ملزم بدفع 100% من ثمنها.</div>
                  <div className="term-fr">En cas de perte ou vol, le locataire est responsable et doit payer 100% de la valeur du véhicule.</div>
                </div>
              </div>

              <div className="term-item">
                <div className="term-header">5. وثائق ومواقيت العمل / Documents & Heures</div>
                <div className="term-body">
                  <div className="term-ar">البطاقة الرمادية الأصلية لا تسلم للزبون. أوقات العمل: 08:00 صباحاً إلى 18:00 مساء.</div>
                  <div className="term-fr">La carte grise originale n'est pas remise. Heures de travail: (08:00 à 18:00).</div>
                </div>
              </div>

              <div className="term-item">
                <div className="term-header">6. الوقود والنظافة / Carburant & Propreté</div>
                <div className="term-body">
                  <div className="term-ar">إرجاع السيارة بنفس مستوى الوقود وبحالة نظيفة. وإلا يدفع رسوم غسيل (مثال: 2000 دج).</div>
                  <div className="term-fr">Restituer avec le même niveau de carburant et propre. Sinon, frais de lavage applicables.</div>
                </div>
              </div>

              <div className="term-item">
                <div className="term-header">7. المخالفات والمحشر / Infractions & Fourrière</div>
                <div className="term-body">
                  <div className="term-ar">المستأجر مسؤول مدنياً وجزائياً عن جميع المخالفات وتصوير الرادار خلال فترة الكراء. في حال وضع السيارة في المحشر، يتحمل المستأجر تكاليف استخراجها وثمن أيام توقفها.</div>
                  <div className="term-fr">Le locataire est responsable de toutes les infractions et flashs radar. En cas de mise en fourrière, le locataire paie les frais de récupération et les jours.</div>
                </div>
              </div>

              <div style={{background:'#f8fafc', padding:'10px', border:'1px dashed #cbd5e1', borderRadius:'4px', fontSize:'11px', marginTop:'15px', textAlign:'center'}}>
                <strong>إقرار وقبول المستأجر:</strong> يقر المستأجر بأنه قد اطلع على كافة الشروط والالتزامات الواردة أعلاه باللغتين العربية والفرنسية، ويوافق عليها موافقة تامة (مسبوق بعبارة قرأت ووافقت / Lu et approuvé).
              </div>

              <div className="signatures">
                <div className="sig-box">توقيع المستأجر / Signature<div className="sig-space"></div></div>
                <div className="sig-box">ختم وتوقيع الوكالة / Cachet<div className="sig-space"></div></div>
              </div>
              <div className="page-num">2 / 3</div>
            </div>

            {/* الصفحة الثالثة: الوصل المالي */}
            <div className="print-page">
              <div className="doc-header" style={{textAlign:'center', display:'block', borderBottom:'none'}}>
                <h1 style={{margin:0, fontSize:'24px', fontWeight:'900'}}>BELAGHA MOTORS FINANCE</h1>
                <p style={{margin:'5px 0', fontSize:'12px'}}>QUITTANCE DE PAIEMENT / وصل استلام مالي</p>
              </div>

              <table className="receipt-table" style={{marginTop:'40px'}}>
                <tbody>
                  <tr><td className="bg-gray">التاريخ والوقت / Date</td><td>{printedContract.dateString}</td></tr>
                  <tr><td className="bg-gray">استلمنا من السيد(ة) / Client</td><td>{printedContract.tenantName}</td></tr>
                  <tr><td className="bg-gray">السيارة / Véhicule</td><td>{printedContract.carDetails?.brand} {printedContract.carDetails?.model} ({printedContract.carDetails?.plateNumber})</td></tr>
                  <tr><td className="bg-gray">الضمان (Caution)</td><td>{printedContract.caution} دج</td></tr>
                  <tr><td className="bg-gray" style={{fontSize:'16px', color:'#1e3a8a'}}>مبلغ الكراء الإجمالي</td><td style={{fontSize:'18px', fontWeight:'900', color:'#1e3a8a'}}>{printedContract.total} دج</td></tr>
                </tbody>
              </table>

              <div className="signatures" style={{marginTop:'120px'}}>
                <div className="sig-box">توقيع الزبون<div className="sig-space" style={{background:'transparent', border:'none', borderTop:'1px dashed #000', height:'60px'}}></div></div>
                <div className="sig-box">ختم وتوقيع الوكالة<div className="sig-space" style={{background:'transparent', border:'none', borderTop:'1px dashed #000', height:'60px'}}></div></div>
              </div>
              <div className="page-num">3 / 3</div>
            </div>
          </>
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
