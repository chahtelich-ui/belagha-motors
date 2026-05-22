import React, { useState, useEffect, useRef } from 'react';

const initialFleet = [
  { id: "car_1", brand: "Rover", model: "XPHWEP", year: 1993, plateNumber: "03813-193-25", currentMileage: 156200, status: "available", insuranceExpiryDate: "2026-08-15", oilChangeMileage: 160000, technicalControlDate: "2026-09-20" },
  { id: "car_2", brand: "Hyundai", model: "i10", year: 2022, plateNumber: "12345-122-25", currentMileage: 49500, status: "available", insuranceExpiryDate: "2026-06-01", oilChangeMileage: 55000, technicalControlDate: "2026-11-15" },
  { id: "car_3", brand: "PEUGEOT", model: "2024", year: 2024, plateNumber: "2102-124-25", currentMileage: 135200, status: "available", insuranceExpiryDate: "2026-12-30", oilChangeMileage: 140000, technicalControlDate: "2027-02-10" }
];

export default function App() {
  const [fleet, setFleet] = useState(initialFleet);
  const [activeTab, setActiveTab] = useState('new-contract');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('belagha_api_key') || '');
  const [isLoading, setIsLoading] = useState(false);
  const [contractForm, setContractForm] = useState({ tenantName: '', licenseNumber: '', birthDate: '', issueDate: '', pricePerDay: 6000, caution: 50000, startDate: '', endDate: '' });
  const [printedContract, setPrintedContract] = useState(null);

  const licenseInputRef = useRef(null);

  const handleApiKeyChange = (val) => {
    setApiKey(val);
    localStorage.setItem('belagha_api_key', val);
  };

  const processImage = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = (img.height * 800) / img.width;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        executeAI(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const executeAI = async (base64) => {
    if (!apiKey) return alert("أدخل API Key أولاً");
    setIsLoading(true);
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: [
            { type: "text", text: "Extract: tenantName, licenseNumber, birthDate, issueDate. Return JSON." },
            { type: "image_url", image_url: { url: base64 } }
          ]}]
        })
      });
      const data = await resp.json();
      const result = JSON.parse(data.choices[0].message.content.replace(/```json|```/g, ""));
      setContractForm(prev => ({ ...prev, ...result }));
    } catch (e) { alert("خطأ في الاتصال"); }
    finally { setIsLoading(false); }
  };

  return (
    <div style={{direction: 'rtl', padding: '20px', fontFamily: 'sans-serif'}}>
      <div style={{background: '#eee', padding: '10px', marginBottom: '20px'}}>
        <input type="password" placeholder="API Key" value={apiKey} onChange={(e) => handleApiKeyChange(e.target.value)} />
      </div>

      <button onClick={() => setActiveTab('new-contract')}>📝 عقد جديد</button>
      
      {activeTab === 'new-contract' && (
        <div style={{marginTop: '20px'}}>
          <input type="file" ref={licenseInputRef} onChange={(e) => processImage(e.target.files[0])} style={{display:'none'}} />
          <button onClick={() => licenseInputRef.current.click()}>⚡ مسح الرخصة (AI)</button>
          
          <input value={contractForm.tenantName} onChange={e => setContractForm({...contractForm, tenantName: e.target.value})} placeholder="الاسم" />
          <input value={contractForm.licenseNumber} onChange={e => setContractForm({...contractForm, licenseNumber: e.target.value})} placeholder="رقم الرخصة" />
          
          <button onClick={() => { setPrintedContract(contractForm); setTimeout(window.print, 500); }}>🖨️ طباعة</button>
        </div>
      )}

      {/* منطقة الطباعة المحمية */}
      <div className="print-only" style={{display:'none'}}>
        {printedContract && (
          <div style={{pageBreakAfter: 'always'}}>
            <h1>عقد الكراء</h1>
            <p>الاسم: {printedContract.tenantName}</p>
            <p>رقم الرخصة: {printedContract.licenseNumber}</p>
          </div>
        )}
      </div>

      <style>{`@media print { .screen-only { display: none !important; } .print-only { display: block !important; } }`}</style>
    </div>
  );
}
