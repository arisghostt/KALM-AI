export type Language = 'FR' | 'EN';

export type PriorityLevel = 'P1' | 'P2' | 'P3' | 'P4';

export interface Modality {
  id: string; // e.g. 'Scanner', 'IRM'
  nom: string;
  prefixe: string;
  salle: string;
}

export type ExamStatus = 'WAITING' | 'CALLED' | 'IN_PROGRESS' | 'DONE';

export interface Patient {
  id: string;
  nom: string;
  sexe: 'M' | 'F';
  age: number;
  telephone: string;
  numDossier: string;
  medecinPrescripteur: string;
  dateCreation: string; // ISO string
}

export interface Exam {
  id: string;
  patientId: string;
  patientNom: string; // cached for easy queue rendering
  patientPriority: PriorityLevel;
  modalite: string; // e.g., 'Scanner', 'IRM'
  numeroOrdre: string; // e.g., 'SCAN01', 'I02'
  status: ExamStatus;
  heureCreation: string; // ISO string
  heureAppel?: string;   // ISO string when CALLED
  heureFin?: string;     // ISO string when DONE
}

export interface CallRecord {
  id: string;
  numeroOrdre: string;
  patientNom: string;
  modalite: string;
  salle: string;
  lang: Language;
  heureAppel: string;
}

export interface QueueState {
  patients: Patient[];
  exams: Exam[];
}

export const MODALITIES: Modality[] = [
  { id: 'Scanner', nom: 'Scanner', prefixe: 'SCAN', salle: 'Salle 1' },
  { id: 'IRM', nom: 'IRM', prefixe: 'I', salle: 'Salle 2' },
  { id: 'Radio', nom: 'Radio', prefixe: 'R', salle: 'Salle 3' },
  { id: 'Échographie', nom: 'Échographie', prefixe: 'ECHO', salle: 'Salle 4' },
  { id: 'Panoramique', nom: 'Panoramique', prefixe: 'PANO', salle: 'Salle 5' }
];

export const PRIORITY_LABELS: Record<Language, Record<PriorityLevel, string>> = {
  FR: {
    P1: '🔴 Urgence (P1)',
    P2: '🔴 Urgence (P2)',
    P3: '🔵 Rendez-vous (P3)',
    P4: '⚪ Patient Normal (P4)'
  },
  EN: {
    P1: '🔴 Urgency (P1)',
    P2: '🔴 Urgency (P2)',
    P3: '🔵 Appointment (P3)',
    P4: '⚪ Normal Patient (P4)'
  }
};

export const DICTIONARY = {
  FR: {
    appTitle: "Gestion Intelligente de File d'Attente - Imagerie Médicale",
    tagline: "Hôpitaux de Douala - Système FIFO Prioritaire Multimodal",
    langSelect: "Langue",
    generalTab: "🏠 Page Générale",
    receptionTab: "📋 Accueil & Réception",
    modalityTab: "⚡ Service Imagerie",
    boardTab: "📺 Salle d'Attente (TV)",
    dashboardTab: "📊 Tableau de Bord & IA",
    
    // Reception
    registerPatient: "Enregistrer un Patient",
    patientName: "Nom Complet",
    gender: "Sexe",
    age: "Âge",
    phone: "Numéro de Téléphone",
    fileNum: "N° Dossier",
    prescriber: "Médecin Prescripteur",
    examsRequested: "Examens Demandés",
    priorityLevel: "Niveau de Priorité",
    generateTickets: "Générer les Tickets d'Ordre",
    ticketPrinted: "Tickets Générés avec Succès !",
    ticketPatientTitle: "TICKET PATIENT",
    ticketServiceTitle: "TICKET DE PASSAGE",
    conserveTicket: "Conservez précieusement ce ticket.",
    waitCall: "Veuillez attendre votre appel vocal dans la salle d'attente.",
    dateLabel: "Date du jour",
    male: "Masculin",
    female: "Féminin",
    
    // Modality Workstation
    modalitySelect: "Sélectionner la modalité de travail",
    activeQueue: "Liste d'Attente Actuelle",
    noPatients: "Aucun patient dans cette file,",
    colOrder: "Ordre",
    colPatient: "Patient",
    colPriority: "Priorité",
    colStatus: "Statut",
    colActions: "Actions",
    
    // Statuses
    statusWAITING: "En attente",
    statusCALLED: "Appelé",
    statusIN_PROGRESS: "En cours",
    statusDONE: "Terminé",
    
    // Action buttons
    btnCall: "Appeler",
    btnStart: "Début Examen",
    btnFinish: "Terminer",
    
    // Waiting Room Board
    callingNow: "PATIENT APPELÉ",
    proceedTo: "Veuillez vous présenter à la",
    recentCalls: "Historique des derniers appels",
    screenWaitingMsg: "Veuillez attendre patiemment votre tour.",
    
    // Dashboard & AI
    dashboardTitle: "Statistiques en Temps Réel",
    todayStats: "Examens d'Aujourd'hui",
    avgWaitTime: "Temps d'attente moyen",
    patientsInQueue: "Patients en attente",
    patientsCompleted: "Patients terminés",
    aiPredictionTitle: "Prédiction Intelligente des Goulots d'Étranglement (IA Gemini)",
    aiAnalyzeBtn: "Lancer l'analyse du flux de patients",
    aiAnalyzing: "Analyse en cours par l'IA...",
    aiReportPlaceholder: "Cliquez sur le bouton ci-dessus pour obtenir des prédictions préventives, identifier les modalités surchargées et optimiser le routage du personnel en temps réel.",
    aiDisclaimer: "Analyse générée par IA locale sur le flux actif d'imagerie.",
    
    // Simulated Server Notifications
    serverLabel: "Statut Réseau",
    serverConnected: "Simulateur Serveur Local : Actif (127.0.0.1)",
    resetBtn: "Réinitialiser les files",
    clearConfirm: "Êtes-vous sûr de vouloir réinitialiser toutes les files d'attente ?"
  },
  EN: {
    appTitle: "Intelligent Queue Management - Medical Imaging",
    tagline: "Douala Hospitals - Multimodal Prioritized FIFO System",
    langSelect: "Language",
    generalTab: "🏠 General Page",
    receptionTab: "📋 Reception & Admission",
    modalityTab: "⚡ Imaging Stations",
    boardTab: "📺 Waiting Room TV",
    dashboardTab: "📊 Stats & Smart AI",
    
    // Reception
    registerPatient: "Register New Patient",
    patientName: "Full Name",
    gender: "Gender",
    age: "Age",
    phone: "Phone Number",
    fileNum: "Dossier N°",
    prescriber: "Referring MD",
    examsRequested: "Requested Exams",
    priorityLevel: "Priority Level",
    generateTickets: "Generate Order Tickets",
    ticketPrinted: "Tickets Generated Successfully!",
    ticketPatientTitle: "PATIENT TICKET",
    ticketServiceTitle: "DEPARTMENT TICKET",
    conserveTicket: "Please keep this ticket with you.",
    waitCall: "Please wait to be called in the waiting area.",
    dateLabel: "Today's Date",
    male: "Male",
    female: "Female",
    
    // Modality Workstation
    modalitySelect: "Select Working Modality",
    activeQueue: "Current Pending Queue",
    noPatients: "No patients currently in this queue.",
    colOrder: "Order",
    colPatient: "Patient",
    colPriority: "Priority",
    colStatus: "Status",
    colActions: "Actions",
    
    // Statuses
    statusWAITING: "Waiting",
    statusCALLED: "Called",
    statusIN_PROGRESS: "In Progress",
    statusDONE: "Completed",
    
    // Action buttons
    btnCall: "Call",
    btnStart: "Begin Exam",
    btnFinish: "Complete",
    
    // Waiting Room Board
    callingNow: "CURRENTLY CALLING",
    proceedTo: "Please proceed to the",
    recentCalls: "Recent Call History",
    screenWaitingMsg: "Please wait patiently for your number.",
    
    // Dashboard & AI
    dashboardTitle: "Real-time Operations Analytics",
    todayStats: "Today's Active Exams",
    avgWaitTime: "Average Waiting Time",
    patientsInQueue: "Patients Waiting",
    patientsCompleted: "Patients Completed",
    aiPredictionTitle: "Intelligent Bottleneck & Wait Time Predictions (Gemini AI)",
    aiAnalyzeBtn: "Analyze Facility Patient Flow",
    aiAnalyzing: "AI is analyzing operational flow...",
    aiReportPlaceholder: "Click the button above to run proactive projections, flag overloaded modalities, and optimize resource schedules based on live patient count.",
    aiDisclaimer: "Automated analysis generated using local patient queues.",
    
    // Simulated Server Notifications
    serverLabel: "Network Status",
    serverConnected: "Simulated Local Server: Active (127.0.0.1)",
    resetBtn: "Reset All Queues",
    clearConfirm: "Are you sure you want to clear and reset all queues?"
  }
};

// Seed some realistic data for presentation
export const SAMPLE_PATIENTS: Patient[] = [
  {
    id: 'pat_1',
    nom: 'Samuel Etoo',
    sexe: 'M',
    age: 42,
    telephone: '+237 699 88 77 66',
    numDossier: 'D-2026-098',
    medecinPrescripteur: 'Dr. Kamga',
    dateCreation: new Date(Date.now() - 3600000 * 2.5).toISOString() // 2.5 hours ago
  },
  {
    id: 'pat_2',
    nom: 'Marie-Therese Assiga',
    sexe: 'F',
    age: 65,
    telephone: '+237 677 11 22 33',
    numDossier: 'D-2026-147',
    medecinPrescripteur: 'Dr. Mbarga',
    dateCreation: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  },
  {
    id: 'pat_3',
    nom: 'Yvana Ngoumou',
    sexe: 'F',
    age: 12,
    telephone: '+237 655 44 33 22',
    numDossier: 'D-2026-210',
    medecinPrescripteur: 'Dr. Bello',
    dateCreation: new Date(Date.now() - 3600000 * 1).toISOString() // 1 hour ago
  },
  {
    id: 'pat_4',
    nom: 'Jean-Baptiste Bell',
    sexe: 'M',
    age: 71,
    telephone: '+237 691 55 44 33',
    numDossier: 'D-2026-250',
    medecinPrescripteur: 'Dr. Nguidjol',
    dateCreation: new Date(Date.now() - 600000).toISOString() // 10 mins ago
  }
];

export const SAMPLE_EXAMS: Exam[] = [
  // Samuel Etoo has Scanner P4 and IRM P4
  {
    id: 'ex_1',
    patientId: 'pat_1',
    patientNom: 'Samuel Etoo',
    patientPriority: 'P4',
    modalite: 'Scanner',
    numeroOrdre: 'SCAN01',
    status: 'DONE',
    heureCreation: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    heureAppel: new Date(Date.now() - 3600000 * 2.2).toISOString(),
    heureFin: new Date(Date.now() - 3600000 * 1.8).toISOString()
  },
  {
    id: 'ex_2',
    patientId: 'pat_1',
    patientNom: 'Samuel Etoo',
    patientPriority: 'P4',
    modalite: 'IRM',
    numeroOrdre: 'I01',
    status: 'CALLED',
    heureCreation: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    heureAppel: new Date(Date.now() - 60000).toISOString() // called 1 min ago
  },
  // Marie-Therese has IRM P3 (Appointment)
  {
    id: 'ex_3',
    patientId: 'pat_2',
    patientNom: 'Marie-Therese Assiga',
    patientPriority: 'P3',
    modalite: 'IRM',
    numeroOrdre: 'I02',
    status: 'IN_PROGRESS',
    heureCreation: new Date(Date.now() - 3600000 * 2).toISOString(),
    heureAppel: new Date(Date.now() - 3600000 * 0.5).toISOString()
  },
  // Yvana has Échographie P1 (Urgency)
  {
    id: 'ex_4',
    patientId: 'pat_3',
    patientNom: 'Yvana Ngoumou',
    patientPriority: 'P1',
    modalite: 'Échographie',
    numeroOrdre: 'ECHO01',
    status: 'WAITING',
    heureCreation: new Date(Date.now() - 3600000 * 1).toISOString()
  },
  // Jean-Baptiste has Scanner P1 (Critical Vitale)
  {
    id: 'ex_5',
    patientId: 'pat_4',
    patientNom: 'Jean-Baptiste Bell',
    patientPriority: 'P1',
    modalite: 'Scanner',
    numeroOrdre: 'SCAN02',
    status: 'WAITING',
    heureCreation: new Date(Date.now() - 600000).toISOString()
  }
];

export const SAMPLE_CALLS: CallRecord[] = [
  {
    id: 'call_1',
    numeroOrdre: 'I01',
    patientNom: 'Samuel Etoo',
    modalite: 'IRM',
    salle: 'Salle 2',
    lang: 'FR',
    heureAppel: new Date(Date.now() - 60000).toISOString()
  }
];
