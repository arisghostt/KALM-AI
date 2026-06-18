import { GoogleGenAI } from "@google/genai";

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

export default async function handler(req: any, res: any) {
  const text = req.query.text as string;
  const lang = (req.query.lang as string) || "fr";

  if (!text) {
    return res.status(400).json({ error: "Missing text parameter" });
  }

  // 1. High-fidelity neural voice synthesis proxy from state-of-the-art Gemini 3.1 TTS model (using Server-Side Gemini API Key)
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
        console.warn("Gemini TTS response did not return base64 audio. Trying Google Translate fallback...");
      }
    } catch (err) {
      console.error("Gemini TTS failure in serverless handler, falling back to legacy Google translate TTS:", err);
    }
  }

  // 2. FALLBACK: Google Translate TTS
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
    res.setHeader("Content-Length", buffer.length.toString());
    res.setHeader("Cache-Control", "public, max-age=31536000");
    return res.send(buffer);
  } catch (err) {
    console.error("Vercel Serverless TTS proxy fallback failure:", err);
    return res.status(500).json({ error: "Failed to fetch TTS audio stream" });
  }
}
