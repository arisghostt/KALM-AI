import React, { useState } from 'react';
import { Exam, Language, MODALITIES } from '../types';
import { BarChart, TrendingUp, Calendar, Info, HelpCircle, FileText, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

// Math/arc helper to draw precise SVG donut sectors for our monthly single-modality Pie charts
function getDonutSlicePath(
  cx: number, cy: number,
  rOuter: number, rInner: number,
  startAngle: number, endAngle: number
): string {
  let angleDiff = endAngle - startAngle;
  if (angleDiff >= 360) {
    angleDiff = 359.999;
  }
  const adjustedEndAngle = startAngle + angleDiff;

  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((adjustedEndAngle - 90) * Math.PI) / 180;

  const x1Outer = cx + rOuter * Math.cos(startRad);
  const y1Outer = cy + rOuter * Math.sin(startRad);
  const x2Outer = cx + rOuter * Math.cos(endRad);
  const y2Outer = cy + rOuter * Math.sin(endRad);

  const x1Inner = cx + rInner * Math.cos(endRad);
  const y1Inner = cy + rInner * Math.sin(endRad);
  const x2Inner = cx + rInner * Math.cos(startRad);
  const y2Inner = cy + rInner * Math.sin(startRad);

  const largeArcFlag = angleDiff > 180 ? 1 : 0;

  return [
    `M ${x1Outer} ${y1Outer}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}`,
    `L ${x1Inner} ${y1Inner}`,
    `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x2Inner} ${y2Inner}`,
    `Z`
  ].join(' ');
}

interface MonthlyModalityChartProps {
  lang: Language;
  exams: Exam[];
}

interface MonthlyData {
  monthFr: string;
  monthEn: string;
  Scanner: number;
  IRM: number;
  Radio: number;
  Échographie: number;
  Panoramique: number;
}

// Solid baseline historical monthly values for year 2026 leading up to June
const HISTORICAL_BASE_DATA: Omit<MonthlyData, 'monthFr' | 'monthEn'>[] = [
  { Scanner: 118, IRM: 74, Radio: 195, Échographie: 122, Panoramique: 38 }, // Jan
  { Scanner: 125, IRM: 81, Radio: 210, Échographie: 135, Panoramique: 42 }, // Feb
  { Scanner: 154, IRM: 102, Radio: 238, Échographie: 168, Panoramique: 51 }, // Mar
  { Scanner: 140, IRM: 95, Radio: 215, Échographie: 150, Panoramique: 46 }, // Apr
  { Scanner: 168, IRM: 114, Radio: 262, Échographie: 182, Panoramique: 58 }  // May
];

const MONTHS_MAP = {
  FR: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
  EN: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
};

const FULL_MONTHS_MAP = {
  FR: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'],
  EN: ['January', 'February', 'March', 'April', 'May', 'June']
};

export default function MonthlyModalityChart({ lang, exams }: MonthlyModalityChartProps) {
  const isFr = lang !== 'EN';
  const [selectedModalityFilter, setSelectedModalityFilter] = useState<string>('ALL');
  const [hoveredSliceIdx, setHoveredSliceIdx] = useState<number | null>(null);
  const [allHistogramStyle, setAllHistogramStyle] = useState<'stacked' | 'grouped'>('stacked');
  const [hoveredData, setHoveredData] = useState<{
    monthName: string;
    metrics: { name: string; value: number; color: string }[];
    x: number;
    y: number;
  } | null>(null);

  const [pdfPeriod, setPdfPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Exquisite colors assigned to Jan-Jun respectively for single-modality Pie segments
  const monthlyColors = [
    '#64748b', // Jan - Slate-500
    '#c084fc', // Feb - Purple-400
    '#38bdf8', // Mar - Sky-400
    '#2dd4bf', // Apr - Teal-400
    '#fbbf24', // May - Amber-400
    '#10b981'  // Jun - Emerald-500
  ];

  // June active counts: Baseline + any live completed exams to reflect realtime worker logs!
  const liveScannerDone = exams.filter(e => e.modalite === 'Scanner' && e.status === 'DONE').length;
  const liveIrmDone = exams.filter(e => e.modalite === 'IRM' && e.status === 'DONE').length;
  const liveRadioDone = exams.filter(e => e.modalite === 'Radio' && e.status === 'DONE').length;
  const liveEchoDone = exams.filter(e => e.modalite === 'Échographie' && e.status === 'DONE').length;
  const livePanoDone = exams.filter(e => e.modalite === 'Panoramique' && e.status === 'DONE').length;

  const juneData: Omit<MonthlyData, 'monthFr' | 'monthEn'> = {
    Scanner: 182 + liveScannerDone,
    IRM: 120 + liveIrmDone,
    Radio: 271 + liveRadioDone,
    Échographie: 198 + liveEchoDone,
    Panoramique: 64 + livePanoDone
  };

  // Compile data
  const data: MonthlyData[] = [
    ...HISTORICAL_BASE_DATA.map((d, i) => ({
      monthFr: FULL_MONTHS_MAP.FR[i],
      monthEn: FULL_MONTHS_MAP.EN[i],
      ...d
    })),
    {
      monthFr: FULL_MONTHS_MAP.FR[5],
      monthEn: FULL_MONTHS_MAP.EN[5],
      ...juneData
    }
  ];

  const handleGeneratePdf = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const todayString = new Date().toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Header Bar - Slate Dark Theme
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 38, 'F');

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text("KALM IMAGERIE MEDICALE", 15, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(isFr ? "RAPPORT D'AFFLUENCE ET CHARGE OPERATIONNELLE" : "PATIENT FLOW & WORKLOAD STATISTICAL REPORT", 15, 21);
      doc.text(isFr ? "Hôpitaux de Douala — Système FIFO Prioritaire" : "Douala Hospitals — Priority FIFO System", 15, 26);

      // Top-right Stamp Area
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(145, 10, 50, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text("RAPPORT CERTIFIE", 170, 16, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(52, 211, 153); // emerald-400
      doc.text("STATUS: EN SERVICE", 170, 23, { align: 'center' });

      // Reset text states
      doc.setTextColor(30, 41, 59);

      // Metadata Description Area
      let titleLabel = "";
      let descLabel = "";
      if (pdfPeriod === 'day') {
        titleLabel = isFr ? "SITUATION JOURNALIERE" : "DAILY INFLOW SNAPSHOT";
        descLabel = isFr ? `Bilan complet des examens et flux de patients pour ce ${todayString}` : `Full summary of exams and patient logs recorded on ${todayString}`;
      } else if (pdfPeriod === 'week') {
        titleLabel = isFr ? "ANALYSE HEBDOMADAIRE" : "WEEKLY WORKLOAD ANALYSIS";
        descLabel = isFr ? "Évaluation de la charge d'affluence des 7 derniers jours glissants." : "Workload distribution and statistics across the last 7 sliding days.";
      } else {
        titleLabel = isFr ? "BILAN ANALYTIQUE MENSUEL" : "MONTHLY WORKLOAD REPORT";
        descLabel = isFr ? "Rapport consolidé d'affluence sur le semestre de l'année 2026." : "Consolidated historical statistics from January up to June 2026.";
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(titleLabel, 15, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(descLabel, 15, 55);

      // Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(15, 60, 195, 60);

      // KPIs Section
      const completedCount = exams.filter(e => e.status === 'DONE').length;
      const waitingCount = exams.filter(e => e.status === 'WAITING').length;
      const totalCount = exams.length;

      // KPI Card 1
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(15, 66, 55, 20, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, 66, 55, 20, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(isFr ? "TOTAL ENREGISTREMENTS" : "TOTAL REGISTERED", 19, 72);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(String(totalCount), 19, 81);

      // KPI Card 2
      doc.setFillColor(240, 253, 250); // green-50
      doc.rect(75, 66, 55, 20, 'F');
      doc.setDrawColor(204, 251, 241);
      doc.rect(75, 66, 55, 20, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(13, 148, 136); // teal-600
      doc.text(isFr ? "EXAMENS TERMINES" : "COMPLETED EXAMS", 79, 72);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(`${completedCount}`, 79, 81);

      // KPI Card 3
      doc.setFillColor(255, 251, 235); // amber-50
      doc.rect(135, 66, 60, 20, 'F');
      doc.setDrawColor(254, 243, 199);
      doc.rect(135, 66, 60, 20, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(217, 119, 6); // amber-600
      doc.text(isFr ? "PATIENTS EN SALLE" : "PATIENTS IN QUEUE", 139, 72);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(`${waitingCount}`, 139, 81);

      // Section 2 Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(isFr ? "CHARGE DE TRAVAIL PAR MODALITE" : "WORKLOAD BY MODALITY TYPE", 15, 96);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.line(15, 99, 195, 99);

      // Modalities mini-table
      const modHeaders = isFr 
        ? ["Modalite", "Salle assignee", "Pre-enregistrement", "En cours", "Termines", "Charge Globale"] 
        : ["Modality", "Assigned Room", "Pre-registered", "In Progress", "Completed", "Load Level"];
      
      let tableY = 104;
      doc.setFillColor(15, 23, 42); // Header
      doc.rect(15, tableY, 180, 6.5, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      
      // Draw headings
      const colX = [18, 52, 85, 115, 140, 168];
      modHeaders.forEach((h, idx) => {
        doc.text(h, colX[idx], tableY + 4.5);
      });

      // Data Rows for Modalities
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      
      MODALITIES.forEach((mod, idx) => {
        const rowY = tableY + 6.5 + (idx * 6.5);
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, rowY, 180, 6.5, 'F');
        }
        doc.setDrawColor(241, 245, 249);
        doc.rect(15, rowY, 180, 6.5, 'S');

        const currentModId = mod.id;
        const waitingForMod = exams.filter(e => e.modalite === currentModId && e.status === 'WAITING').length;
        const progressForMod = exams.filter(e => e.modalite === currentModId && e.status === 'IN_PROGRESS').length;
        const doneForMod = exams.filter(e => e.modalite === currentModId && e.status === 'DONE').length;

        const totalModExams = waitingForMod + progressForMod + doneForMod;
        let loadLabel = isFr ? "Fluide" : "Fluid";
        if (totalModExams > 4) loadLabel = isFr ? "Moyen" : "Moderate";
        if (totalModExams > 7) loadLabel = isFr ? "Sature" : "High Saturated";

        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(mod.nom, colX[0], rowY + 4.5);
        
        doc.setFont('helvetica', 'normal');
        doc.text(mod.salle, colX[1], rowY + 4.5);
        doc.text(`${waitingForMod}`, colX[2], rowY + 4.5);
        doc.text(`${progressForMod}`, colX[3], rowY + 4.5);
        doc.text(`${doneForMod}`, colX[4], rowY + 4.5);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(totalModExams > 7 ? 219 : 30, totalModExams > 7 ? 68 : 41, totalModExams > 7 ? 85 : 59);
        doc.text(loadLabel, colX[5], rowY + 4.5);
      });

      // Section 3: Detailed Logs or Historical depending on choice
      let nextBaseY = tableY + 6.5 + (MODALITIES.length * 6.5) + 8; // reaches ~151

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);

      if (pdfPeriod === 'day' || pdfPeriod === 'week') {
        doc.text(isFr ? "HISTORIQUE DES EXAMENS TERMINES (PATIENTS TRAITES)" : "COMPLETED EXAMS HISTORICAL LOG (PATIENTS TREATED)", 15, nextBaseY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(148, 163, 184);
        doc.line(15, nextBaseY + 3, 195, nextBaseY + 3);

        const recordHeaders = isFr
          ? ["Ticket", "Identite Patient", "Modalite", "Priorite", "Heure Enreg.", "Statut"]
          : ["Ticket ID", "Patient Name", "Modality", "Priority Level", "Time", "Status"];
        
        let subTableY = nextBaseY + 6;
        doc.setFillColor(30, 41, 59); // slate-800
        doc.rect(15, subTableY, 180, 6.5, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        
        const subColX = [18, 48, 92, 122, 148, 172];
        recordHeaders.forEach((h, idx) => {
          doc.text(h, subColX[idx], subTableY + 4.5);
        });

        const completedExams = exams.filter(ex => ex.status === 'DONE');
        const maxDisplayRows = 14;
        const displayedExams = completedExams.slice(0, maxDisplayRows);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        
        displayedExams.forEach((ex, rIdx) => {
          const rY = subTableY + 6.5 + (rIdx * 6);
          if (rIdx % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, rY, 180, 6, 'F');
          }
          doc.setDrawColor(241, 245, 249);
          doc.rect(15, rY, 180, 6, 'S');

          doc.setTextColor(30, 41, 59);
          doc.setFont('helvetica', 'bold');
          doc.text(ex.numeroOrdre, subColX[0], rY + 4);
          
          doc.setFont('helvetica', 'normal');
          doc.text(ex.patientNom.substring(0, 24), subColX[1], rY + 4);
          doc.text(ex.modalite, subColX[2], rY + 4);
          
          const pLabel = ex.patientPriority;
          doc.text(pLabel, subColX[3], rY + 4);
          
          let parsedTime = "—";
          try {
            if (ex.heureCreation) {
              parsedTime = new Date(ex.heureCreation).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          } catch {
            parsedTime = "—";
          }
          doc.text(parsedTime, subColX[4], rY + 4);
          
          // Status styled
          let readableStatus: string = ex.status;
          if (isFr) {
            if (ex.status === 'WAITING') readableStatus = "En Attente";
            if (ex.status === 'CALLED') readableStatus = "Patient Appele";
            if (ex.status === 'IN_PROGRESS') readableStatus = "Examen en cours";
            if (ex.status === 'DONE') readableStatus = "Termine";
          }
          
          doc.setFont('helvetica', 'bold');
          if (ex.status === 'DONE') {
            doc.setTextColor(16, 185, 129); // emerald green
          } else if (ex.status === 'IN_PROGRESS') {
            doc.setTextColor(99, 102, 241); // indigo
          } else {
            doc.setTextColor(100, 116, 139); // slate
          }
          doc.text(readableStatus, subColX[5], rY + 4);
        });

        if (completedExams.length > maxDisplayRows) {
          const remCount = completedExams.length - maxDisplayRows;
          const overflowY = subTableY + 6.5 + (maxDisplayRows * 6) + 4;
          doc.setFont('helvetica', 'oblique');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(isFr ? `... et ${remCount} autres dossiers terminés archivés non affichés sur cette page.` : `... and ${remCount} other completed file logs archived from this sheet.`, 17, overflowY);
        }

      } else {
        // MONTHLY HISTORICAL CUMULATIVE LOG (SEMSTRIAL RECAP 2026)
        doc.text(isFr ? "LOG ACCOMPLI MENSUEL SUR L'ANNEE 2026" : "2026 CUMULATIVE MONTHLY ACTIVITY LOG", 15, nextBaseY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(148, 163, 184);
        doc.line(15, nextBaseY + 3, 195, nextBaseY + 3);

        const recHeaders = isFr
          ? ["Mois d'activite", "Scanner CT", "IRM Resonance", "Radio Standard", "Echographie US", "Panoramique Dent.", "Total Organisme"]
          : ["Activity Month", "Scanner CT", "MRI Resonance", "Standard X-Ray", "Ultrasound US", "Dental Pano", "Grand Month Total"];
        
        let subTableY = nextBaseY + 6;
        doc.setFillColor(30, 41, 59); // slate-800
        doc.rect(15, subTableY, 180, 6.5, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        
        const subColX = [18, 52, 78, 105, 132, 158, 180];
        recHeaders.forEach((h, idx) => {
          doc.text(h, subColX[idx], subTableY + 4.5, { align: idx > 0 ? 'right' : 'left' });
        });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);

        let totalScanner = 0;
        let totalIrm = 0;
        let totalRadio = 0;
        let totalEcho = 0;
        let totalPano = 0;
        let totalAllGlobal = 0;

        data.forEach((d, mIdx) => {
          const rY = subTableY + 6.5 + (mIdx * 6.5);
          if (mIdx % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, rY, 180, 6.5, 'F');
          }
          doc.setDrawColor(241, 245, 249);
          doc.rect(15, rY, 180, 6.5, 'S');

          const scVal = d.Scanner;
          const irVal = d.IRM;
          const rxVal = d.Radio;
          const ecVal = d.Échographie;
          const paVal = d.Panoramique;
          const monthSum = scVal + irVal + rxVal + ecVal + paVal;

          totalScanner += scVal;
          totalIrm += irVal;
          totalRadio += rxVal;
          totalEcho += ecVal;
          totalPano += paVal;
          totalAllGlobal += monthSum;

          doc.setTextColor(30, 41, 59);
          doc.setFont('helvetica', 'bold');
          doc.text(isFr ? d.monthFr : d.monthEn, subColX[0], rY + 4.5);
          
          doc.setFont('helvetica', 'normal');
          doc.text(String(scVal), subColX[1], rY + 4.5, { align: 'right' });
          doc.text(String(irVal), subColX[2], rY + 4.5, { align: 'right' });
          doc.text(String(rxVal), subColX[3], rY + 4.5, { align: 'right' });
          doc.text(String(ecVal), subColX[4], rY + 4.5, { align: 'right' });
          doc.text(String(paVal), subColX[5], rY + 4.5, { align: 'right' });
          
          doc.setFont('helvetica', 'bold');
          doc.text(String(monthSum), subColX[6], rY + 4.5, { align: 'right' });
        });

        // Bottom horizontal summary row
        const totalRowY = subTableY + 6.5 + (data.length * 6.5);
        doc.setFillColor(241, 245, 249);
        doc.rect(15, totalRowY, 180, 7, 'F');
        doc.setDrawColor(15, 23, 42);
        doc.line(15, totalRowY, 195, totalRowY);
        doc.line(15, totalRowY + 7, 195, totalRowY + 7);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text("TOTAL CUMULE 2026", subColX[0], totalRowY + 5);
        doc.text(String(totalScanner), subColX[1], totalRowY + 5, { align: 'right' });
        doc.text(String(totalIrm), subColX[2], totalRowY + 5, { align: 'right' });
        doc.text(String(totalRadio), subColX[3], totalRowY + 5, { align: 'right' });
        doc.text(String(totalEcho), totalRowY + 5, subColX[4] || totalRowY + 5, { align: 'right' });
        doc.text(String(totalEcho), subColX[4], totalRowY + 5, { align: 'right' });
        doc.text(String(totalPano), subColX[5], totalRowY + 5, { align: 'right' });
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(99, 102, 241); // Indigo theme for final number
        doc.text(String(totalAllGlobal), subColX[6], totalRowY + 5, { align: 'right' });
      }

      // Draw bottom stamp
      const bottomY = 286;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(isFr ? `Imprimé automatiquement le ${new Date().toLocaleString()} local` : `Auto-printed on ${new Date().toLocaleString()} local`, 15, bottomY);
      doc.text("KALM INC (Douala) — SYSTEM SYSTEM CONTROL", 195, bottomY, { align: 'right' });

      // Save File
      const filename = `Rapport_Affluence_${pdfPeriod}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);

    } catch (err) {
      console.error("Error generating PDF:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Modality Theme specs
  const themesByModality: Record<string, { color: string; labelFr: string; labelEn: string; hex: string; bgSoft: string }> = {
    Scanner: { color: 'sky', labelFr: 'Scanner', labelEn: 'CT Scanner', hex: '#0ea5e9', bgSoft: 'bg-sky-50 border-sky-200 text-sky-700' },
    IRM: { color: 'indigo', labelFr: 'IRM', labelEn: 'MRI', hex: '#6366f1', bgSoft: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    Radio: { color: 'amber', labelFr: 'Radiographie', labelEn: 'X-Ray', hex: '#f59e0b', bgSoft: 'bg-amber-50 border-amber-200 text-amber-700' },
    Échographie: { color: 'emerald', labelFr: 'Échographie', labelEn: 'Ultrasound', hex: '#10b981', bgSoft: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    Panoramique: { color: 'rose', labelFr: 'Panoramique Dentaire', labelEn: 'Dental Panoramic', hex: '#f43f5e', bgSoft: 'bg-rose-50 border-rose-200 text-rose-700' }
  };

  // Math dimensions for SVG
  const width = 640;
  const height = 280;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Maximum value for scaling the chart correctly
  let maxValue = 300;
  if (selectedModalityFilter === 'ALL') {
    if (allHistogramStyle === 'stacked') {
      const monthlyTotals = data.map(d => Number(d.Scanner) + Number(d.IRM) + Number(d.Radio) + Number(d.Échographie) + Number(d.Panoramique));
      maxValue = Math.max(800, ...monthlyTotals) + 50;
    } else {
      const allVals = data.flatMap(d => [d.Scanner, d.IRM, d.Radio, d.Échographie, d.Panoramique]);
      maxValue = Math.max(300, ...allVals) + 20;
    }
  } else {
    const key = selectedModalityFilter as keyof MonthlyData;
    const vals = data.map(d => Number(d[key]) || 0);
    maxValue = Math.max(100, ...vals) + 15;
  }

  // Helper coordinate conversions
  const getX = (index: number) => paddingLeft + (index / 5) * plotWidth;
  const getY = (val: number) => height - paddingBottom - (val / maxValue) * plotHeight;

  // Grid lines
  const gridLinesY = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
              <BarChart className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm md:text-base tracking-tight">
              {isFr ? 'Statistiques d\'Affluence Historique' : 'Historical Patient Inflow'}
            </h3>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            {isFr 
              ? 'Analyses du flux consolidé d\'examens terminés par modalité et par mois.' 
              : 'Consolidated count of patient examinations completed per modality by month.'}
          </p>
        </div>

        {/* Modality Filter Buttons */}
        <div className="flex flex-wrap gap-1.5 bg-slate-50 border border-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setSelectedModalityFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
              selectedModalityFilter === 'ALL'
                ? 'bg-white shadow-xs text-slate-900 border border-slate-150'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {isFr ? 'Tous' : 'All'}
          </button>
          {MODALITIES.map(mod => {
            const isSel = selectedModalityFilter === mod.id;
            const theme = themesByModality[mod.id];
            return (
              <button
                key={mod.id}
                onClick={() => setSelectedModalityFilter(mod.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  isSel
                    ? `bg-white shadow-xs border border-slate-150`
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                style={{ color: isSel ? theme.hex : undefined }}
              >
                {mod.nom}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-navigation style selectors for ALL modalities */}
      {selectedModalityFilter === 'ALL' && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
          <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 pl-1">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            {isFr ? 'Format d\'affichage de l\'histogramme :' : 'Histogram representation style:'}
          </span>
          <div className="inline-flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            <button
              onClick={() => setAllHistogramStyle('stacked')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 px-3 py-1.5 cursor-pointer ${
                allHistogramStyle === 'stacked'
                  ? 'bg-white shadow-2xs text-slate-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span>
              {isFr ? 'Piliers Empilés' : 'Stacked Pillars'}
            </button>
            <button
              onClick={() => setAllHistogramStyle('grouped')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 px-3 py-1.5 cursor-pointer ${
                allHistogramStyle === 'grouped'
                  ? 'bg-white shadow-2xs text-slate-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex gap-[2px] items-end h-2.5">
                <span className="w-1 h-1.5 rounded-2xs bg-indigo-400"></span>
                <span className="w-1 h-2.5 rounded-2xs bg-amber-400"></span>
              </div>
              {isFr ? 'Colonnes Groupées' : 'Grouped Columns'}
            </button>
          </div>
        </div>
      )}

      {/* Main Chart SVG Board */}
      <div className="relative w-full overflow-hidden select-none" style={{ minHeight: '280px' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          onMouseLeave={() => setHoveredData(null)}
        >
          {/* Defs for glossy line gradient fills */}
          <defs>
            {Object.entries(themesByModality).map(([id, t]) => (
              <linearGradient key={id} id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.hex} stopOpacity={0.4} />
                <stop offset="90%" stopColor={t.hex} stopOpacity={0.0} />
              </linearGradient>
            ))}
            <linearGradient id="grid-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f1f5f9" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#f8fafc" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          {/* Grid lines and horizontal Y guides (Only for Histogram view of All) */}
          {selectedModalityFilter === 'ALL' && gridLinesY.map((ratio, index) => {
            const val = Math.round(ratio * maxValue);
            const yCoord = getY(val);
            return (
              <g key={index} className="opacity-70">
                <line
                  x1={paddingLeft}
                  y1={yCoord}
                  x2={width - paddingRight}
                  y2={yCoord}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={yCoord + 4}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-slate-400 font-bold"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Render SVG Pie/Donut view when a single modality is isolated */}
          {selectedModalityFilter !== 'ALL' && (() => {
            const modId = selectedModalityFilter;
            const theme = themesByModality[modId];
            const key = modId as keyof MonthlyData;

            const totalPatients = data.reduce((acc, d) => acc + (Number(d[key]) || 0), 0);

            // Compute cumulative segments for the selected modality
            let currentAngle = 0;
            const slices = data.map((d, index) => {
              const val = Number(d[key]) || 0;
              const percentage = totalPatients > 0 ? (val / totalPatients) * 100 : 0;
              const angleDelta = totalPatients > 0 ? (val / totalPatients) * 360 : 0;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angleDelta;
              currentAngle = endAngle;

              return {
                index,
                val,
                percentage,
                startAngle,
                endAngle,
                color: monthlyColors[index],
                monthName: isFr ? d.monthFr : d.monthEn
              };
            });

            // Pie/Donut core geometry limits
            const cx = 190;
            const cy = 135;
            const rOuter = 100;
            const rInner = 55;

            return (
              <g>
                {/* Render Donut arcs */}
                {slices.map((slice) => {
                  const slicePath = getDonutSlicePath(cx, cy, rOuter, rInner, slice.startAngle, slice.endAngle);
                  const isHovered = hoveredSliceIdx === slice.index;
                  
                  // Arc translation displacement on hover
                  const midAngleRad = ((slice.startAngle + slice.endAngle) / 2 - 90) * Math.PI / 180;
                  const hoverDx = isHovered ? Math.cos(midAngleRad) * 4 : 0;
                  const hoverDy = isHovered ? Math.sin(midAngleRad) * 4 : 0;

                  return (
                    <path
                      key={slice.index}
                      d={slicePath}
                      fill={slice.color}
                      className="transition-all duration-200 cursor-pointer hover:opacity-95"
                      transform={`translate(${hoverDx}, ${hoverDy})`}
                      onMouseEnter={() => {
                        setHoveredSliceIdx(slice.index);
                        setHoveredData({
                          monthName: slice.monthName,
                          metrics: [{ name: isFr ? theme.labelFr : theme.labelEn, value: slice.val, color: slice.color }],
                          x: cx + rOuter * 0.75 * Math.cos(midAngleRad) + hoverDx,
                          y: cy + rOuter * 0.75 * Math.sin(midAngleRad) + hoverDy
                        });
                      }}
                      onMouseLeave={() => {
                        setHoveredSliceIdx(null);
                      }}
                    />
                  );
                })}

                {/* Central circular display block */}
                <circle cx={cx} cy={cy} r={rInner - 2} fill="#ffffff" stroke="#f1f5f9" strokeWidth="2" />
                <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-400 font-sans font-bold text-[9px] uppercase tracking-wider">
                  Total
                </text>
                <text x={cx} y={cy + 12} textAnchor="middle" className="font-extrabold text-slate-900 text-base font-mono">
                  {totalPatients}
                </text>

                {/* Bicultural SVG Legends table on the Right side */}
                <g transform="translate(355, 25)">
                  {/* Headers */}
                  <text x="0" y="0" className="font-bold text-[10px] fill-slate-400 uppercase tracking-wider">
                    {isFr ? 'Mois' : 'Month'}
                  </text>
                  <text x="110" y="0" textAnchor="end" className="font-bold text-[10px] fill-slate-400 uppercase tracking-wider">
                    {isFr ? 'Patients' : 'Patients'}
                  </text>
                  <text x="190" y="0" textAnchor="end" className="font-bold text-[10px] fill-slate-400 uppercase tracking-wider">
                    Part (%)
                  </text>

                  {/* Divider line under headers */}
                  <line x1="-15" y1="8" x2="200" y2="8" stroke="#f1f5f9" strokeWidth="1.5" />

                  {/* Slices item rows */}
                  {slices.map((slice, i) => {
                    const rowY = 32 + i * 27;
                    const isHovered = hoveredSliceIdx === slice.index;

                    return (
                      <g
                        key={slice.index}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => {
                          setHoveredSliceIdx(slice.index);
                          const midAngleRad = ((slice.startAngle + slice.endAngle) / 2 - 90) * Math.PI / 180;
                          setHoveredData({
                            monthName: slice.monthName,
                            metrics: [{ name: isFr ? theme.labelFr : theme.labelEn, value: slice.val, color: slice.color }],
                            x: cx + rOuter * 0.75 * Math.cos(midAngleRad),
                            y: cy + rOuter * 0.75 * Math.sin(midAngleRad)
                          });
                        }}
                        onMouseLeave={() => {
                          setHoveredSliceIdx(null);
                        }}
                      >
                        {/* Interactive hovered highlighted backdrop row */}
                        <rect
                          x="-15"
                          y={rowY - 17}
                          width="215"
                          height="23"
                          rx="6"
                          className={`transition-colors duration-150 ${
                            isHovered ? 'fill-slate-50' : 'fill-transparent'
                          }`}
                        />

                        {/* Color circular label */}
                        <circle cx="0" cy={rowY - 4} r="5.5" fill={slice.color} />

                        {/* Month text label */}
                        <text
                          x="16"
                          y={rowY}
                          className={`text-xs font-sans transition-all ${
                            isHovered ? 'font-bold text-slate-900' : 'text-slate-600 font-medium'
                          }`}
                        >
                          {slice.monthName}
                        </text>

                        {/* Patient headcount absolute value */}
                        <text
                          x="110"
                          y={rowY}
                          textAnchor="end"
                          className={`font-mono text-xs transition-all ${
                            isHovered ? 'font-bold text-slate-950' : 'text-slate-500 font-medium'
                          }`}
                        >
                          {slice.val}
                        </text>

                        {/* Part percentage value */}
                        <text
                          x="190"
                          y={rowY}
                          textAnchor="end"
                          className={`font-mono text-xs ${
                            isHovered ? 'text-indigo-600 font-bold' : 'text-slate-400 font-semibold'
                          }`}
                        >
                          {slice.percentage.toFixed(1)}%
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>
            );
          })()}

          {/* Beautiful dynamic columns when "ALL" modality filter is active */}
          {selectedModalityFilter === 'ALL' && data.map((d, monthIdx) => {
            const groupX = getX(monthIdx);
            const items = MODALITIES.map(m => {
              const theme = themesByModality[m.id];
              return {
                id: m.id,
                value: Number(d[m.id as keyof MonthlyData]) || 0,
                color: theme.hex,
                label: isFr ? theme.labelFr : theme.labelEn
              };
            });

            const monthTotal = items.reduce((sum, it) => sum + it.value, 0);

            if (allHistogramStyle === 'stacked') {
              const barWidth = 26;
              let accumulatedY = height - paddingBottom;

              const segmentBlocks = items.map(it => {
                const blockH = (it.value / maxValue) * plotHeight;
                const blockY = accumulatedY - blockH;
                accumulatedY = blockY;
                return {
                  ...it,
                  y: blockY,
                  height: blockH
                };
              });

              return (
                <g key={monthIdx}>
                  {/* Subtle invisible hover card for entire month */}
                  <rect
                    x={groupX - 35}
                    y={paddingTop}
                    width="70"
                    height={plotHeight}
                    className="fill-transparent hover:fill-slate-500/5 cursor-pointer transition-all"
                    onMouseEnter={() => {
                      const monthName = isFr ? d.monthFr : d.monthEn;
                      setHoveredData({
                        monthName,
                        metrics: [
                          ...items.map(it => ({ name: it.label, value: it.value, color: it.color })),
                          { name: isFr ? 'Total Cumulé' : 'Cumulative Total', value: monthTotal, color: '#1e293b' }
                        ],
                        x: groupX,
                        y: accumulatedY
                      });
                    }}
                  />

                  {/* Layered segments within the single stacked column */}
                  {segmentBlocks.map((blk) => (
                    blk.height > 1 && (
                      <rect
                        key={blk.id}
                        x={groupX - barWidth / 2}
                        y={blk.y}
                        width={barWidth}
                        height={blk.height}
                        rx="3"
                        fill={blk.color}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="transition-all duration-300 hover:brightness-105"
                      />
                    )
                  ))}

                  {/* Workload Total Number Label on top of the stacked column */}
                  <text
                    x={groupX}
                    y={accumulatedY - 6}
                    textAnchor="middle"
                    className="font-mono text-[9px] font-extrabold fill-slate-700 bg-white/80 px-1 py-0.5 rounded"
                  >
                    {monthTotal}
                  </text>
                </g>
              );
            } else {
              // Grouped side-by-side view representation
              const totalGroupWidth = 54;
              const barWidth = 8;
              const barGap = 2;

              return (
                <g key={monthIdx}>
                  {/* Subtle invisible hover card for entire month */}
                  <rect
                    x={groupX - 35}
                    y={paddingTop}
                    width="70"
                    height={plotHeight}
                    className="fill-transparent hover:fill-slate-500/5 cursor-pointer transition-all"
                    onMouseEnter={() => {
                      const monthName = isFr ? d.monthFr : d.monthEn;
                      setHoveredData({
                        monthName,
                        metrics: items.map(it => ({ name: it.label, value: it.value, color: it.color })),
                        x: groupX,
                        y: Math.min(...items.map(it => getY(it.value)))
                      });
                    }}
                  />

                  {/* Individual side-by-side columns */}
                  {items.map((it, itemIdx) => {
                    const barH = (it.value / maxValue) * plotHeight;
                    const bX = groupX - (totalGroupWidth / 2) + itemIdx * (barWidth + barGap);
                    const bY = height - paddingBottom - barH;

                    return (
                      <rect
                        key={it.id}
                        x={bX}
                        y={bY}
                        width={barWidth}
                        height={Math.max(2, barH)}
                        rx="2.5"
                        fill={it.color}
                        className="transition-all duration-300 hover:brightness-115"
                      />
                    );
                  })}
                </g>
              );
            }
          })}

          {/* Calendar Months Labels on X-axis (Only for Histogram view of All) */}
          {selectedModalityFilter === 'ALL' && data.map((d, index) => {
            const x = getX(index);
            const mLabel = isFr ? MONTHS_MAP.FR[index] : MONTHS_MAP.EN[index];
            const isCurrentMonth = index === 5; // June is the live active slot

            return (
              <g key={index}>
                <text
                  x={x}
                  y={height - 15}
                  textAnchor="middle"
                  className={`text-[11px] font-sans transition-all ${
                    isCurrentMonth ? 'font-bold fill-slate-900 border-b border-sky-500' : 'fill-slate-500 font-medium'
                  }`}
                >
                  {mLabel}
                </text>
                {/* Tiny active marker for current month */}
                {isCurrentMonth && (
                  <circle cx={x} cy={height - 6} r="2.5" className="fill-sky-500" />
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Information Tooltip Overlay */}
        {hoveredData && (
          <div
            className="absolute bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700/60 pointer-events-none transition-all duration-150 z-20 w-48"
            style={{
              left: `${Math.min(width - 200, Math.max(10, (hoveredData.x / width) * 100))}%`,
              top: `${Math.max(10, Math.min(height - 130, hoveredData.y - 120))}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="flex items-center gap-1 border-b border-white/10 pb-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-bold text-slate-100 uppercase tracking-wide text-[10px]">
                {hoveredData.monthName}
              </span>
            </div>
            
            <div className="space-y-1.5">
              {hoveredData.metrics.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-[100px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }}></span>
                    <span className="text-slate-300 font-medium truncate max-w-[85px] text-[10.5px]">
                      {m.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-white text-[11px] bg-white/5 px-1 py-0.2 rounded">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Real-time Indicator Footer message */}
      <div className="mt-4 flex items-start gap-2 bg-slate-50 border border-slate-150 rounded-xl p-3 text-[11px] text-slate-500">
        <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
        <p className="leading-normal">
          {isFr ? (
            <>
              <strong>Données de juin actives :</strong> le graphique compile les examens du jour enregistrés en temps réel (<strong>+{liveScannerDone + liveIrmDone + liveRadioDone + liveEchoDone + livePanoDone} examens</strong> terminés aujourd'hui intégrés au graphe).
            </>
          ) : (
            <>
              <strong>June Live Feed:</strong> Current month analytics sync with today's completed workflow dynamically (<strong>+{liveScannerDone + liveIrmDone + liveRadioDone + liveEchoDone + livePanoDone} exams</strong> integrated live).
            </>
          )}
        </p>
      </div>

      {/* SECTION DE TÉLÉCHARGEMENT DE RAPPORT PDF */}
      <div className="mt-6 pt-6 border-t border-slate-150">
        <div className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                {isFr ? "Export de Rapports d'Affluence" : "Inflow Report Export"}
              </h4>
              <p className="text-slate-400 text-[11px] mt-1">
                {isFr 
                  ? "Téléchargez un rapport d'activité certifié (PDF) pour le jour, la semaine ou le mois." 
                  : "Generate a certified clinical PDF of the daily, weekly, or monthly activity statistics."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPdfPeriod('day')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    pdfPeriod === 'day' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {isFr ? 'Journalier' : 'Daily'}
                </button>
                <button
                  type="button"
                  onClick={() => setPdfPeriod('week')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    pdfPeriod === 'week' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {isFr ? 'Hebdomadaire' : 'Weekly'}
                </button>
                <button
                  type="button"
                  onClick={() => setPdfPeriod('month')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    pdfPeriod === 'month' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {isFr ? 'Mensuel' : 'Monthly'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="bg-slate-900 hover:bg-slate-850 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all duration-150 cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isFr ? 'Télécharger PDF' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
