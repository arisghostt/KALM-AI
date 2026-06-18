import { GoogleGenAI } from "@google/genai";

const MODALITIES = [
  { id: 'Scanner', prefixe: 'SC', salle: 'Scanner' },
  { id: 'IRM', prefixe: 'IR', salle: 'IRM' },
  { id: 'Radio', prefixe: 'RD', salle: 'Secteur Radio' },
  { id: 'Échographie', prefixe: 'EC', salle: 'Secteur Écho' },
  { id: 'Panoramique', prefixe: 'DP', salle: 'Panoramique Dentaire' }
];

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lang, exams = [] } = req.body;
  const isFr = lang !== 'EN';

  const waitingExams = exams.filter((e: any) => e.status === 'WAITING' || e.status === 'CALLED' || e.status === 'IN_PROGRESS');
  const completedExams = exams.filter((e: any) => e.status === 'DONE');

  const queueByModality: Record<string, number> = {};
  const priorityCounts: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };

  waitingExams.forEach((ex: any) => {
    queueByModality[ex.modalite] = (queueByModality[ex.modalite] || 0) + 1;
    if (priorityCounts[ex.patientPriority] !== undefined) {
      priorityCounts[ex.patientPriority]++;
    }
  });

  const modalitiesSummary = Object.entries(queueByModality)
    .map(([mod, count]) => `- ${mod}: ${count} patient(s) en attente`)
    .join("\n");

  const systemPrompt = `You are a professional medical healthcare operations advisor sitting at Douala's municipal imaging network coordinating centers. 
Your task is to analyze the active queue and output an objective bottleneck prediction report in the requested language (FR or EN).
Provide concrete, actionable solutions on how to handle the patient flow without delays.`;

  const analyzePrompt = `
Format of response: A beautiful markdown structured report. Use bold summaries. Keep it highly practical for clinical managers.
Current Statistics:
- Total active patients waiting (En attente/Appelé): ${waitingExams.length}
- Total patients completed today (Terminé): ${completedExams.length}
- Urgences Vitales (P1) pending count: ${priorityCounts.P1}
- Urgences Médicales (P2) pending count: ${priorityCounts.P2}
- Rendez-vous (P3) scheduled pending count: ${priorityCounts.P3}
- Patients Normaux (P4) pending count: ${priorityCounts.P4}

Pending patients per modality:
${modalitiesSummary || "- No patients waiting in any modality."}

Task: Write a Bottleneck Prediction Report in ${isFr ? "French" : "English"}.
Provide:
1. **Fluidity Diagnosis**: General speed status (Fluid, Crowded, Overloaded) and approximate wait time projections.
2. **Bottleneck Flag**: Identify the most overloaded modality (Scanner, IRM, Échographie, etc.) based on counts and general durations (typically IRM/Scanner takes longer, around 30-45 mins, whereas Echo/Radio is faster, 10-15 mins).
3. **Queue Optimization Recommendations**: Concrete tips such as reassigning technical staff or warning patients about delays. Mention the bilinguilism aspect in Douala (French and English speaking patients).
4. **FIFO Prioritaire Check**: Mention how the priority system (P1-P4) is safeguarding critical emergencies in Douala's crowded clinical context.
Keep the output professional, scannable, and directly useful. Avoid overly long prose.
`;

  // Try Server-Side Gemini API Key
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY") {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: analyzePrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
        }
      });

      return res.json({
        success: true,
        source: "Gemini AI",
        report: response.text
      });
    } catch (err: any) {
      console.error("Gemini API Error in Vercel Serverless Function:", err);
    }
  }

  // Fallback heuristics report if Gemini API key is missing or fails
  let reportText = "";
  if (isFr) {
    const topModality = Object.entries(queueByModality).reduce((a, b) => a[1] > b[1] ? a : b, ['Aucun', 0]);
    const urgencyWarning = priorityCounts.P1 > 0 
      ? `⚠️ **ALERTE URGENCE** : Il y a ${priorityCounts.P1} urgence(s) vitale(s) (P1) en cours. L'algorithme a automatiquement suspendu la file d'attente d'arrivée normale pour ces modalités.`
      : `✅ **STATUT URGENCE** : Aucune urgence vitale P1 en attente.`;

    reportText = `### 📊 Rapport d'Analyse Opérationnelle Locale (Heuristique Serverless)

${urgencyWarning}

#### 1. Diagnostic de Fluidité & Temps d'Attente Estimés
- **Scanner** : ~${Math.max(15, (queueByModality['Scanner'] || 0) * 20)} minutes d'attente.
- **IRM** : ~${Math.max(20, (queueByModality['IRM'] || 0) * 35)} minutes d'attente.
- **Échographie / Radio** : ~${Math.max(10, (queueByModality['Échographie'] || 0) * 15)} minutes d'attente.
- **Statut Général** : **${waitingExams.length > 5 ? "Surcharge Modérée à Douala" : "Activité Fluide et Maîtrisée"}**

#### 2. Goulot d'Étranglement Principal
- ${topModality[0] !== 'Aucun' && topModality[1] > 0 ? `**Modalité encombrée** : **${topModality[0]}** avec **${topModality[1]}** examens actifs.` : `**Aucun goulot d'étranglement majeur** détecté actuellement.`}
- *Note* : L'IRM et le Scanner restent les plus critiques en raison du temps technique d'acquisition machine (environ 30 min par patient).

#### 3. Recommandations Pratiques pour le Directeur d'Imagerie de Douala
- **Routage Patient** : Orientez temporairement les nouveaux patients vers les examens rapides (Panoramique, Échographie) si possible.
- **Bilinguisme local** : Les alertes vocales en français et anglais ont été adaptées pour fluidifier l'appel des patients n'ayant pas compris les signaux visuels.
- **Optimisation des Effectifs** : Transférer un technicien vers le secteur **${topModality[0] !== 'Aucun' ? topModality[0] : "Scanner"}** pour accélérer le débit.
`;
  } else {
    const topModality = Object.entries(queueByModality).reduce((a, b) => a[1] > b[1] ? a : b, ['None', 0]);
    const urgencyWarning = priorityCounts.P1 > 0
      ? `⚠️ **EMERGENCY REPORT** : ${priorityCounts.P1} active critical case(s) (P1) pending. The prioritizer is overriding default FIFO files automatically.`
      : `✅ **EMERGENCY STATUS** : No critical P1 cases pending.`;

    reportText = `### 📊 Operational Assessment Report (Serverless Heuristics Engine)

${urgencyWarning}

#### 1. Fluidity Status & Estimated Wait Times
- **CT Scanner** : ~${Math.max(15, (queueByModality['Scanner'] || 0) * 20)} minutes estimated delay.
- **MRI** : ~${Math.max(20, (queueByModality['IRM'] || 0) * 35)} minutes estimated delay.
- **Ultrasound / X-Ray** : ~${Math.max(10, (queueByModality['Échographie'] || 0) * 15)} minutes estimated delay.
- **General Assessment** : **${waitingExams.length > 5 ? "Moderately Overloaded Flow" : "Fluid Operations"}**

#### 2. Bottleneck Detection
- ${topModality[0] !== 'None' && topModality[1] > 0 ? `**Heaviest bottleneck** : **${topModality[0]}** with **${topModality[1]}** active patients.` : `**No major queues** detected on modalities right now.`}
- *Insight*: Scanner/MRI machines have high technical overhead (30 mins average), causing faster stack-up compared to ultrasound.

#### 3. Actionable Douala Hospital Directives
- **Staff Reallocation**: Recommend shifting standard clinical technicians from low-demand sectors to **${topModality[0] !== 'None' ? topModality[0] : "Scanner"}**.
- **Bilingual Announcements**: Verify that dual voice alerts (EN/FR) are active on the waiting screen to assist patients from all regions.
`;
  }

  return res.json({
    success: true,
    source: "Engine Interne (Serverless Fallback)",
    report: reportText
  });
}
