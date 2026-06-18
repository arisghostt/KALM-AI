import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { SAMPLE_PATIENTS, SAMPLE_EXAMS, SAMPLE_CALLS, Patient, Exam, CallRecord, MODALITIES } from "./src/types.js";

// Load environment variables
dotenv.config();

// Global memory state for our local hospital server simulation
let patientsList: Patient[] = [...SAMPLE_PATIENTS];
let examsList: Exam[] = [...SAMPLE_EXAMS];
let callsList: CallRecord[] = [...SAMPLE_CALLS];

// Helper to construct next order number for a modality
function getNextOrderNumber(modalite: string): string {
  const currentMod = MODALITIES.find(m => m.id === modalite);
  if (!currentMod) return "00";
  
  const prefix = currentMod.prefixe;
  const matchRegex = new RegExp(`^${prefix}(\\d+)$`);
  
  // Find highest number currently in the list (including completed ones)
  let maxNum = 0;
  examsList.forEach(ex => {
    if (ex.modalite === modalite) {
      const match = ex.numeroOrdre.match(matchRegex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
  });

  const nextNum = maxNum + 1;
  const padded = nextNum.toString().padStart(2, '0');
  return `${prefix}${padded}`;
}

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function parseMimeType(mimeType: string): WavConversionOptions {
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
  const [_, format] = fileType.split('/');

  const options: Partial<WavConversionOptions> = {
    numChannels: 1,
  };

  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  if (!options.sampleRate) {
    options.sampleRate = 24000; // Default sample rate for Gemini TTS
  }
  if (!options.bitsPerSample) {
    options.bitsPerSample = 16; // Default bit depth
  }

  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim());
    if (key === 'rate') {
      options.sampleRate = parseInt(value, 10);
    }
  }

  return options as WavConversionOptions;
}

function createWavHeader(dataLength: number, options: WavConversionOptions): Buffer {
  const {
    numChannels,
    sampleRate,
    bitsPerSample,
  } = options;

  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);                      // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4);     // ChunkSize
  buffer.write('WAVE', 8);                      // Format
  buffer.write('fmt ', 12);                     // Subchunk1ID
  buffer.writeUInt32LE(16, 16);                 // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20);                  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);        // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);         // SampleRate
  buffer.writeUInt32LE(byteRate, 28);           // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);         // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);      // BitsPerSample
  buffer.write('data', 36);                     // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40);         // Subchunk2Size

  return buffer;
}

function convertToWav(rawDataBase64: string, mimeType: string): Buffer {
  const options = parseMimeType(mimeType);
  const buffer = Buffer.from(rawDataBase64, 'base64');
  const wavHeader = createWavHeader(buffer.length, options);

  return Buffer.concat([wavHeader, buffer]);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // 1. API Endpoints
  
  // Get active state
  app.get("/api/state", (req, res) => {
    res.json({
      patients: patientsList,
      exams: examsList,
      calls: callsList
    });
  });

  // Register new patient
  app.post("/api/patients", (req, res) => {
    const { nom, sexe, age, telephone, numDossier, medecinPrescripteur, examModalites, priority } = req.body;
    
    if (!nom || !sexe || !age || !examModalites || examModalites.length === 0) {
      return res.status(400).json({ error: "Missing required fields or exams" });
    }

    const patientId = `pat_${Date.now()}`;
    const newPatient: Patient = {
      id: patientId,
      nom,
      sexe,
      age: parseInt(age, 10),
      telephone: telephone || "",
      numDossier: numDossier || `D-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      medecinPrescripteur: medecinPrescripteur || "Médecin généraliste",
      dateCreation: new Date().toISOString()
    };

    patientsList.push(newPatient);

    // Create tickets/exams for each selected modality
    const newExams: Exam[] = [];
    examModalites.forEach((modaliteId: string) => {
      const numeroOrdre = getNextOrderNumber(modaliteId);
      const newExam: Exam = {
        id: `ex_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        patientId,
        patientNom: nom,
        patientPriority: priority || 'P4',
        modalite: modaliteId,
        numeroOrdre,
        status: 'WAITING',
        heureCreation: new Date().toISOString()
      };
      newExams.push(newExam);
      examsList.push(newExam);
    });

    res.status(201).json({
      patient: newPatient,
      exams: newExams
    });
  });

  // Update status of an exam
  app.post("/api/exams/status", (req, res) => {
    const { examId, status } = req.body;
    if (!examId || !status) {
      return res.status(400).json({ error: "Missing examId or status" });
    }

    const examIndex = examsList.findIndex(e => e.id === examId);
    if (examIndex === -1) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const oldStatus = examsList[examIndex].status;
    examsList[examIndex].status = status;

    if (status === 'CALLED') {
      examsList[examIndex].heureAppel = new Date().toISOString();
      
      // Auto register a voice call event in history
      const modObj = MODALITIES.find(m => m.id === examsList[examIndex].modalite);
      const newCall: CallRecord = {
        id: `call_${Date.now()}`,
        numeroOrdre: examsList[examIndex].numeroOrdre,
        patientNom: examsList[examIndex].patientNom,
        modalite: examsList[examIndex].modalite,
        salle: modObj ? modObj.salle : "Salle d'examen",
        lang: req.body.lang || "FR",
        heureAppel: new Date().toISOString()
      };
      callsList.unshift(newCall); // add to top of history
      if (callsList.length > 30) {
        callsList.pop(); // limit size
      }
    } else if (status === 'DONE') {
      examsList[examIndex].heureFin = new Date().toISOString();
    }

    res.json({
      success: true,
      exam: examsList[examIndex],
      calls: callsList
    });
  });

  // Trigger voice call explicitly / Repeat voice call
  app.post("/api/calls", (req, res) => {
    const { numeroOrdre, patientNom, modalite, salle, lang } = req.body;
    if (!numeroOrdre || !patientNom || !modalite) {
      return res.status(400).json({ error: "Missing required call details" });
    }

    const newCall: CallRecord = {
      id: `call_${Date.now()}`,
      numeroOrdre,
      patientNom,
      modalite,
      salle: salle || "Salle d'examen",
      lang: lang || "FR",
      heureAppel: new Date().toISOString()
    };

    callsList.unshift(newCall);
    if (callsList.length > 30) {
      callsList.pop();
    }

    res.json({
      success: true,
      call: newCall,
      calls: callsList
    });
  });

  // Reset database state back to preset samples
  app.post("/api/state/reset", (req, res) => {
    patientsList = [...SAMPLE_PATIENTS];
    examsList = [...SAMPLE_EXAMS];
    callsList = [...SAMPLE_CALLS];
    res.json({ success: true, patients: patientsList, exams: examsList, calls: callsList });
  });

  // High-fidelity neural voice synthesis proxy from state-of-the-art Gemini 3.1 TTS model
  app.get("/api/tts", async (req, res) => {
    const text = req.query.text as string;
    const lang = req.query.lang as string || "fr";
    if (!text) {
      return res.status(400).json({ error: "Missing text parameter" });
    }

    // Check if we have a valid Gemini API key
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

        const isEn = lang.toLowerCase() === "en";
        const audioProfile = isEn 
          ? "a warm, reassuring, soft and professional English female voice"
          : "une voix francaise rassurante douce et feminine";

        const directorsNote = "Style: Intimate, breathy, close-to-mic proximity effect. Pace: Natural conversational pace. Accent: Neutral.";

        const promptText = `Read the following transcript based on the audio profile and director's note.

# Audio Profile
${audioProfile}

# Director's note
${directorsNote}

## Transcript:
${text}`;

        const config = {
          temperature: 1.0,
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                // Callirrhoe is the ultra-realistic high-fidelity voice adapted by the user
                voiceName: 'Callirrhoe',
              }
            }
          },
        };

        const gResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          config,
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
        });

        const part = gResponse.candidates?.[0]?.content?.parts?.[0];
        const base64Audio = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType || 'audio/pcm;rate=24000';

        if (base64Audio) {
          const wavBuffer = convertToWav(base64Audio, mimeType);
          res.setHeader("Content-Type", "audio/wav");
          res.setHeader("Content-Length", wavBuffer.length);
          res.setHeader("Cache-Control", "public, max-age=31536000");
          return res.send(wavBuffer);
        } else {
          console.warn("Gemini TTS response did not return base64 audio data. Falling back to Google translate TTS");
        }
      } catch (err) {
        console.error("Gemini TTS failure, falling back to legacy Google translate TTS:", err);
      }
    }

    // FALLBACK: Legacy Google Translate TTS
    try {
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
      const response = await fetch(googleTtsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`Google TTS responded with status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.send(buffer);
    } catch (err) {
      console.error("TTS proxy fallback failure:", err);
      res.status(500).json({ error: "Failed to fetch TTS audio stream" });
    }
  });

  // Gemini smart prediction service
  app.post("/api/gemini/predict", async (req, res) => {
    const { lang } = req.body;
    const isFr = lang !== 'EN';

    // Extract active metrics for context
    const waitingExams = examsList.filter(e => e.status === 'WAITING' || e.status === 'CALLED');
    const completedExams = examsList.filter(e => e.status === 'DONE');
    
    // Group waiting counts by modality
    const queueByModality: Record<string, number> = {};
    const priorityCounts: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
    
    waitingExams.forEach(ex => {
      queueByModality[ex.modalite] = (queueByModality[ex.modalite] || 0) + 1;
      priorityCounts[ex.patientPriority] = (priorityCounts[ex.patientPriority] || 0) + 1;
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

    // Attempt to query Gemini SDK using Server-Side
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

        const textResult = response.text;
        return res.json({
          success: true,
          source: "Gemini AI",
          report: textResult
        });
      } catch (err: any) {
        console.error("Gemini API Error:", err);
        // Fall back to local procedural report if API request fails
      }
    }

    // Heuristic Fallback Analysis generator (when key is missing or calls fail)
    // Generate beautiful bilingual reports in code dynamically based on queue sizes!
    let reportText = "";

    if (isFr) {
      const topModality = Object.entries(queueByModality).reduce((a, b) => a[1] > b[1] ? a : b, ['Aucun', 0]);
      const urgencyWarning = priorityCounts.P1 > 0 
        ? `⚠️ **ALERTE URGENCE** : Il y a ${priorityCounts.P1} urgence(s) vitale(s) (P1) en cours. L'algorithme a automatiquement suspendu la file d'attente d'arrivée normale pour ces modalités.`
        : `✅ **STATUT URGENCE** : Aucune urgence vitale P1 en attente.`;

      reportText = `### 📊 Rapport d'Analyse Opérationnelle Locale (Algorithme Heuristique)

${urgencyWarning}

#### 1. Diagnostic de Flidité & Temps d'Attente Estimés
- **Scanner** : ~${Math.max(15, (queueByModality['Scanner'] || 0) * 20)} minutes d'attente.
- **IRM** : ~${Math.max(20, (queueByModality['IRM'] || 0) * 35)} minutes d'attente.
- **Échographie / Radio** : ~${Math.min(10, (queueByModality['Échographie'] || 0) * 15)} minutes d'attente.
- **Statut Général** : **${waitingExams.length > 5 ? "Surcharge Modérée à Douala" : "Activité Fluide et Maîtrisée"}**

#### 2. Goulot d'Étranglement Principal
- ${topModality[0] !== 'Aucun' && topModality[1] > 0 ? `**Modalité encombrée** : **${topModality[0]}** avec **${topModality[1]}** patients actifs.` : `**Aucun goulot d'étranglement majeur** détecté actuellement.`}
- *Note* : L'IRM et le Scanner restent les plus critiques en raison du temps technique d'acquisition machine (environ 30 min par patient).

#### 3. Recommandations Pratiques pour le Directeur d'Imagerie de Douala
- **Routage Patient** : Orientez temporairement les nouveaux patients vers les examens rapides (Panoramique, Échographie) si possible.
- **Bilinguisme local** : Les alertes vocales en français et anglais ont été broadcastées dans la salle d'attente pour fluidifier l'appel des patients n'ayant pas compris les signaux visuels.
- **Optimisation des Effectifs** : Transférer un technicien de la Radio vers le secteur **${topModality[0] !== 'Aucun' ? topModality[0] : "Scanner"}** pour accélérer le débit.
`;
    } else {
      const topModality = Object.entries(queueByModality).reduce((a, b) => a[1] > b[1] ? a : b, ['None', 0]);
      const urgencyWarning = priorityCounts.P1 > 0
        ? `⚠️ **EMERGENCY REPORT** : ${priorityCounts.P1} active critical case(s) (P1) pending. The prioritizer is overriding default FIFO files automatically.`
        : `✅ **EMERGENCY STATUS** : No critical P1 cases pending.`;

      reportText = `### 📊 Operational Assessment Report (Local Heuristics Engine)

${urgencyWarning}

#### 1. Fluidity Status & Estimated Wait Times
- **CT Scanner** : ~${Math.max(15, (queueByModality['Scanner'] || 0) * 20)} minutes estimated delay.
- **MRI** : ~${Math.max(20, (queueByModality['IRM'] || 0) * 35)} minutes estimated delay.
- **Ultrasound / X-Ray** : ~${Math.min(10, (queueByModality['Échographie'] || 0) * 15)} minutes estimated delay.
- **General Assessment** : **${waitingExams.length > 5 ? "Moderately Overloaded Flow" : "Fluid Operations"}**

#### 2. Bottleneck Detection
- ${topModality[0] !== 'None' && topModality[1] > 0 ? `**Heaviest bottleneck** : **${topModality[0]}** with **${topModality[1]}** active patients.` : `**No major queues** detected on modalities right now.`}
- *Insight*: Scanner/MRI machines have high technical overhead (30 mins average), causing faster stack-up compared to ultrasound.

#### 3. Actionable Douala Hospital Directives
- **Staff Reallocation**: Recommend shifting standard clinical technicians from low-demand sectors to **${topModality[0] !== 'None' ? topModality[0] : "Scanner"}**.
- **Bilingual Announcements**: Verify that dual voice alerts (EN/FR) are active on the waiting screen to assist both English-speaking and French-speaking patients from Southwest/Littoral regions.
- **Multi-Exam Prioritization**: Patients with multi-exams are taking scanner first which is optimized by our multimodal prioritizer.
`;
    }

    res.json({
      success: true,
      source: "Engine Interne",
      report: reportText
    });
  });

  // 2. Vite and Static Asset Serving Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Douala Imaging Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
