import React, { useState } from 'react';
import { Patient, Exam, Language, DICTIONARY, MODALITIES, PriorityLevel, PRIORITY_LABELS } from '../types';
import { UserPlus, Ticket, Printer, CheckCircle, Smartphone, Calendar, FileText, User } from 'lucide-react';

interface ReceptionViewProps {
  lang: Language;
  patients: Patient[];
  exams: Exam[];
  onPatientRegistered: (patient: Patient, exams: Exam[]) => void;
}

export default function ReceptionView({ lang, patients, exams, onPatientRegistered }: ReceptionViewProps) {
  const dictionary = DICTIONARY[lang];
  
  // Form states
  const [nom, setNom] = useState('');
  const [sexe, setSexe] = useState<'M' | 'F'>('M');
  const [age, setAge] = useState('');
  const [telephone, setTelephone] = useState('');
  const [numDossier, setNumDossier] = useState('');
  const [medecinPrescripteur, setMedecinPrescripteur] = useState('');
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [priority, setPriority] = useState<PriorityLevel>('P4');
  
  // Result states for ticket preview/printing
  const [lastRegisteredPatient, setLastRegisteredPatient] = useState<Patient | null>(null);
  const [lastGeneratedExams, setLastGeneratedExams] = useState<Exam[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const toggleModality = (id: string) => {
    if (selectedModalities.includes(id)) {
      setSelectedModalities(selectedModalities.filter(m => m !== id));
    } else {
      setSelectedModalities([...selectedModalities, id]);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !age || selectedModalities.length === 0) {
      alert(lang === 'FR' ? 'Veuillez remplir le nom, l\'âge et choisir au moins un examen.' : 'Please fill out name, age, and select at least one exam.');
      return;
    }

    const fallbackRegistration = () => {
      const patientId = `pat_${Date.now()}`;
      const fallbackPatient: Patient = {
        id: patientId,
        nom,
        sexe,
        age: parseInt(age, 10),
        telephone: telephone || "",
        numDossier: numDossier || `D-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        medecinPrescripteur: medecinPrescripteur || (lang === 'FR' ? "Médecin généraliste" : "General Practitioner"),
        dateCreation: new Date().toISOString()
      };

      const getNextOrderNum = (modVal: string) => {
        const curModObj = MODALITIES.find(m => m.id === modVal);
        const prefix = curModObj ? curModObj.prefixe : "EX";
        const matchRegex = new RegExp(`^${prefix}(\\d+)$`);
        let maxNum = 0;
        exams.forEach(ex => {
          if (ex.modalite === modVal) {
            const match = ex.numeroOrdre.match(matchRegex);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) maxNum = num;
            }
          }
        });
        const nextNum = maxNum + 1;
        const padded = nextNum.toString().padStart(2, '0');
        return `${prefix}${padded}`;
      };

      const fallbackExams: Exam[] = selectedModalities.map((modaliteId) => {
        const numeroOrdre = getNextOrderNum(modaliteId);
        return {
          id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          patientId,
          patientNom: nom,
          patientPriority: priority || 'P4',
          modalite: modaliteId,
          numeroOrdre,
          status: 'WAITING',
          heureCreation: new Date().toISOString()
        };
      });

      onPatientRegistered(fallbackPatient, fallbackExams);

      setLastRegisteredPatient(fallbackPatient);
      setLastGeneratedExams(fallbackExams);

      // Reset form
      setNom('');
      setSexe('M');
      setAge('');
      setTelephone('');
      setNumDossier('');
      setMedecinPrescripteur('');
      setSelectedModalities([]);
      setPriority('P4');

      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    };

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom,
          sexe,
          age,
          telephone,
          numDossier,
          medecinPrescripteur,
          examModalites: selectedModalities,
          priority
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onPatientRegistered(data.patient, data.exams);
        
        // Save for printing preview
        setLastRegisteredPatient(data.patient);
        setLastGeneratedExams(data.exams);
        
        // Reset form
        setNom('');
        setSexe('M');
        setAge('');
        setTelephone('');
        setNumDossier('');
        setMedecinPrescripteur('');
        setSelectedModalities([]);
        setPriority('P4');

        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);
      } else {
        console.warn("Backend server returned error response, switching to local registration fallback (Vercel detected).");
        fallbackRegistration();
      }
    } catch (err) {
      console.warn("Network error connecting to local server, proceeding with local registration fallback (Vercel detected):", err);
      fallbackRegistration();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = (divId: string) => {
    const printContent = document.getElementById(divId);
    if (!printContent) return;
    
    // Create or reuse hidden physical printing iframe to prevent aggressive Vercel/Production popup blockers
    let iframe = document.getElementById('imaging-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'imaging-print-iframe';
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      iframe.style.top = '-1000px';
      iframe.style.left = '-1000px';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write('<html><head><title>Impression Ticket Admissions</title>');
    doc.write('<style>');
    doc.write(`
      @media print {
        @page { size: auto; margin: 15mm 10mm; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      body {
        font-family: 'Courier New', Courier, monospace;
        padding: 15px;
        color: #000 !important;
        background: #fff !important;
        text-align: center;
        font-size: 12px;
        line-height: 1.4;
      }
      .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      .border { border: 2px dashed #000; padding: 15px; border-radius: 8px; margin-bottom: 12px; }
      .text-center { text-align: center; }
      .pb-3 { padding-bottom: 12px; }
      .border-b { border-bottom: 2px dashed #000; }
      .font-bold { font-weight: bold !important; }
      .text-sm { font-size: 13px !important; }
      .text-2xl { font-size: 24px !important; }
      .text-5xl { font-size: 44px !important; }
      .text-6xl { font-size: 54px !important; }
      .uppercase { text-transform: uppercase; }
      .py-3 { padding-top: 10px; padding-bottom: 10px; }
      .pl-4 { padding-left: 15px; }
      .space-y-1 > * + * { margin-top: 4px; }
      .space-y-4 > * + * { margin-top: 16px; }
      .grid { display: grid; }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .p-4 { padding: 12px; }
      .rounded-xl { border-radius: 12px; }
      .bg-slate-950, .bg-slate-900, .bg-slate-100, .bg-slate-50, .bg-slate-50\\/10 {
        background-color: #fff !important;
        color: #000 !important;
        border: 2px solid #000 !important;
        box-shadow: none !important;
      }
      .text-white { color: #000 !important; }
      /* Hide dynamic actions during native browser routing output */
      button, .btn, .no-print { display: none !important; }
    `);
    doc.write('</style></head><body>');
    
    // Copy content and strip action triggers safely
    const printClone = printContent.cloneNode(true) as HTMLElement;
    const actionButtons = printClone.querySelectorAll('button');
    actionButtons.forEach(btn => btn.remove());
    
    doc.write(printClone.innerHTML);
    doc.write('</body></html>');
    doc.close();

    // Small delay to ensure content loading and styles binding
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Iframe printing trigger failed:", err);
      }
    }, 280);
  };

  return (
    <div id="reception_view_panel" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Toast message */}
      {showSuccessToast && (
        <div className="lg:col-span-12 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <p className="font-medium text-sm">{dictionary.ticketPrinted}</p>
          </div>
          <button onClick={() => setShowSuccessToast(false)} className="text-emerald-500 hover:text-emerald-700 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Column 1: Patient registration form */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="p-2.5 bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 rounded-xl">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">{dictionary.registerPatient}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Douala Hospital imaging admission system</p>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">          {/* Patients vital stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{dictionary.patientName} *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="M. Atangana Jean, Mme Etoundi"
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-805 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{dictionary.gender} *</label>
                <select
                  value={sexe}
                  onChange={(e) => setSexe(e.target.value as 'M' | 'F')}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-805 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-white"
                >
                  <option value="M" className="text-slate-800">M ({dictionary.male})</option>
                  <option value="F" className="text-slate-800">F ({dictionary.female})</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{dictionary.age} *</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="125"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Ans/Yrs"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-805 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{dictionary.phone}</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="+237 6..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-805 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{dictionary.fileNum}</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={numDossier}
                  onChange={(e) => setNumDossier(e.target.value)}
                  placeholder="e.g. D-2026-X"
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-805 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{dictionary.prescriber}</label>
              <input
                type="text"
                value={medecinPrescripteur}
                onChange={(e) => setMedecinPrescripteur(e.target.value)}
                placeholder="Dr. Bassong"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-805 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Priority Hierarchy Section */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">{dictionary.priorityLevel}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['P1', 'P3', 'P4'] as PriorityLevel[]).map((pCode) => {
                const label = PRIORITY_LABELS[lang][pCode];
                let colorClass = 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750';
                if (priority === pCode) {
                  if (pCode === 'P1') colorClass = 'border-rose-500 bg-rose-500 text-white';
                  else if (pCode === 'P3') colorClass = 'border-sky-500 bg-sky-500 text-white';
                  else colorClass = 'border-slate-700 bg-slate-800 text-white dark:border-slate-600 dark:bg-slate-700';
                }

                return (
                  <button
                    key={pCode}
                    type="button"
                    onClick={() => setPriority(pCode)}
                    className={`py-2 px-3 border rounded-xl text-left text-xs font-medium cursor-pointer transition-all duration-150 ${colorClass}`}
                  >
                    {label.split('(')[0]} {/* Nice brief labels */}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              {lang === 'FR' 
                ? '💡 Les patients Urgents (P1) passeront automatiquement en tête de file devant les rendez-vous (P3) et consultations normales (P4).'
                : '💡 Urgent patients (P1) automatically jump to the front of their respective modality queues before standard appointments (P3).'}
            </p>
          </div>

          {/* Multi-modality Exams Checkboxes */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">{dictionary.examsRequested} *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {MODALITIES.map((mod) => {
                const isSelected = selectedModalities.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModality(mod.id)}
                    className={`flex items-center justify-between p-3 border rounded-xl text-left cursor-pointer transition-all duration-150 ${
                      isSelected 
                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 ring-1 ring-sky-500 text-sky-800 dark:text-sky-305' 
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{mod.nom}</p>
                      <p className={`text-[10px] ${isSelected ? 'text-sky-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        {mod.prefixe}•{mod.salle}
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 dark:border-slate-700'
                    }`}>
                      {isSelected && <span className="text-[10px] font-bold">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer text-sm shadow-sm hover:shadow-md active:scale-[0.99]"
          >
            {isSubmitting ? (
              <span className="animate-pulse">{lang === 'FR' ? 'Admission en cours...' : 'Registering...'}</span>
            ) : (
              <>
                <Ticket className="w-4 h-4" />
                {dictionary.generateTickets}
              </>
            )}
          </button>
        </form>
      </div>

      {/* Column 2: Ticket Printed Preview */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-sky-600" />
            {lang === 'FR' ? 'Aperçu du Dernier Ticket' : 'Latest Ticket Preview'}
          </h2>

          {lastRegisteredPatient ? (
            <div id="imaging-printable-tickets" className="space-y-4">
              
              {/* Patient and Service Tickets */}
              {(() => {
                const isTicketUrgent = lastGeneratedExams[0]?.patientPriority === 'P1' || lastGeneratedExams[0]?.patientPriority === 'P2';
                return (
                  <div 
                    id="service-ticket-print" 
                    className={`border rounded-xl bg-white dark:bg-slate-950 p-5 text-slate-800 dark:text-slate-200 font-mono text-xs shadow-xs transition-all duration-300 ${
                      isTicketUrgent
                        ? 'border-red-500 border-2 animate-border-blink-red ring-4 ring-rose-500/10'
                        : 'border-dashed border-slate-300 dark:border-slate-705'
                    }`}
                  >
                    <div className="text-center pb-3 border-b border-dashed border-slate-200 dark:border-slate-800">
                      <p className="font-bold text-sm tracking-widest text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                        {isTicketUrgent && <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>}
                        <span>CENTRE D'IMAGERIE DOUALA</span>
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Service Admissions - Networked Live</p>
                    </div>
                    
                    <div className="py-3 space-y-1">
                      <p className="font-semibold text-slate-900 dark:text-white">{dictionary.ticketServiceTitle}</p>
                      <p><b className="font-semibold text-slate-900 dark:text-white uppercase">Patient:</b> {lastRegisteredPatient.nom}</p>
                      <p><b>Age / Sex:</b> {lastRegisteredPatient.age} ans / {lastRegisteredPatient.sexe}</p>
                      <p><b>Dossier:</b> {lastRegisteredPatient.numDossier}</p>
                      <p><b>Prescripteur:</b> {lastRegisteredPatient.medecinPrescripteur}</p>
                      <p className="flex items-center gap-1.5 flex-wrap">
                        <b>Priorité:</b> 
                        <span className={isTicketUrgent ? 'text-red-600 font-extrabold animate-pulse' : ''}>
                          {PRIORITY_LABELS[lang][lastGeneratedExams[0]?.patientPriority]}
                        </span>
                        {isTicketUrgent && (
                          <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded animate-pulse tracking-wider">
                            🚨 {lang === 'FR' ? 'URGENCE' : 'URGENT'}
                          </span>
                        )}
                      </p>
                      <p><b>Examen(s):</b></p>
                      <div className="pl-4 mt-1 space-y-1">
                        {lastGeneratedExams.map(ex => (
                          <p key={ex.id} className="font-bold text-slate-900 dark:text-white text-sm">
                            ➡️ [{ex.numeroOrdre}] - {ex.modalite}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-400">
                      <p>Date: {new Date(lastRegisteredPatient.dateCreation).toLocaleDateString()}</p>
                      <p>Time: {new Date(lastRegisteredPatient.dateCreation).toLocaleTimeString()}</p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handlePrint('service-ticket-print')}
                      className="mt-4 w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <Printer className="w-3 h-3" />
                      {lang === 'FR' ? 'Imprimer Ticket Passage' : 'Print Pass Ticket'}
                    </button>
                  </div>
                );
              })()}

              {/* Consolidated Patient Ticket (Un seul ticket patient regroupant toutes les modalités) */}
              {(() => {
                const isAnyExamUrgent = lastGeneratedExams.some(ex => ex.patientPriority === 'P1' || ex.patientPriority === 'P2');
                return (
                  <div 
                    id="patient-ticket-consolidated-print" 
                    className={`border-2 rounded-xl bg-slate-50/10 dark:bg-slate-950 p-5 text-slate-800 dark:text-slate-200 font-mono text-xs shadow-md transition-all duration-350 ${
                      isAnyExamUrgent
                        ? 'border-red-500 animate-border-blink-red bg-red-500/[0.01]'
                        : 'border-slate-900 dark:border-slate-700 border-dashed'
                    }`}
                  >
                    <div className="text-center pb-2 border-b border-dashed border-slate-350 dark:border-slate-800">
                      <p className="font-bold text-sm text-slate-950 dark:text-white tracking-wider uppercase flex items-center justify-center gap-1.5">
                        {isAnyExamUrgent && <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>}
                        <span>{dictionary.ticketPatientTitle}</span>
                      </p>
                      <p className="text-[10px] text-slate-450 dark:text-slate-400">Gardez ce carton unique / Please keep this card</p>
                    </div>
                    
                    <div className="text-center py-4 space-y-4">
                      {/* Grid of codes and modalities */}
                      <div className={`grid gap-3 justify-center ${lastGeneratedExams.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {lastGeneratedExams.map(ex => {
                          const exUrgent = ex.patientPriority === 'P1' || ex.patientPriority === 'P2';
                          return (
                            <div 
                              key={ex.id}
                              className={`text-white rounded-xl py-3 px-4 inline-block border text-center ${
                                exUrgent
                                  ? 'bg-red-950 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                  : 'bg-slate-950 dark:bg-slate-900 border-slate-800 dark:border-slate-700'
                              }`}
                            >
                              <p className={`text-4xl font-extrabold font-sans tracking-tight leading-none select-none ${exUrgent ? 'text-red-50' : 'text-slate-200 dark:text-white'}`}>
                                {ex.numeroOrdre}
                              </p>
                              <p className={`text-[9px] uppercase font-mono mt-1 font-bold tracking-widest ${exUrgent ? 'text-red-400' : 'text-emerald-400'}`}>
                                {ex.modalite}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="space-y-1 text-slate-700 dark:text-slate-300">
                        <p className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-1 rounded inline-block px-3">
                          Patient: {lastRegisteredPatient.nom}
                        </p>
                        <p className="text-xs">
                          Dossier ID: <span className="font-bold text-slate-900 dark:text-white uppercase">{lastRegisteredPatient.numDossier || 'N/A'}</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 font-sans text-[11px] pt-1">
                          {dictionary.conserveTicket}
                        </p>
                        {isAnyExamUrgent ? (
                          <p className="text-red-600 dark:text-red-400 font-extrabold font-sans text-[11.5px] uppercase animate-pulse">
                            🚨 {lang === 'FR' ? 'URGENCE PRIORITAIRE - VEILLEZ PATIENTER' : 'PRIORITY EMERGENCY - PLEASE WAIT CLOSEBY'}
                          </p>
                        ) : (
                          <p className="text-rose-600 dark:text-rose-400 font-bold font-sans text-[11px]">{dictionary.waitCall}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-slate-300 dark:border-slate-800 text-center text-[10px] text-slate-400">
                      <p>Douala Med Imaging Queue • {new Date(lastRegisteredPatient.dateCreation).toLocaleTimeString()}</p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handlePrint('patient-ticket-consolidated-print')}
                      className="mt-3 w-full bg-slate-950 dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-slate-700 text-white py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition animate-bounce-subtle"
                    >
                      <Printer className="w-3 h-3" />
                      {lang === 'FR' ? `Imprimer Carton Unique Patient` : `Print Consolidated Patient Card`}
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="h-64 border-2 border-placeholder border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center">
              <Ticket className="w-10 h-10 text-slate-350 dark:text-slate-655 stroke-[1.2] mb-2" />
              <p className="text-sm font-medium">{lang === 'FR' ? 'Aucune admission récente' : 'No recent admissions'}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[200px]">
                {lang === 'FR' ? 'Remplissez le formulaire de gauche pour générer des tickets d\'admission.' : 'Submit the left form to produce admission tickets here.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
