
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Boundary } from '../types';

let aiClient: GoogleGenAI | null = null;
let dynamicApiKey: string | null = null;

export function setApiKey(key: string) {
  dynamicApiKey = key;
  aiClient = new GoogleGenAI({ apiKey: key });
}

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = dynamicApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("API_KEY not set. Please enter your Gemini API key in the settings.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      centerX: {
        type: Type.NUMBER,
        description: 'The center X coordinate of the photo as a percentage of image width (0-100). Use up to 2 decimal places.',
      },
      centerY: {
        type: Type.NUMBER,
        description: 'The center Y coordinate of the photo as a percentage of image height (0-100). Use up to 2 decimal places.',
      },
      width: {
        type: Type.NUMBER,
        description: 'The full width of the photo print along its own horizontal axis (0-100).',
      },
      height: {
        type: Type.NUMBER,
        description: 'The full height of the photo print along its own vertical axis (0-100).',
      },
      rotation: {
        type: Type.NUMBER,
        description: 'The clockwise rotation in degrees (0.0-360.0) required to align the photo edges with the document axes.',
      }
    },
    required: ['centerX', 'centerY', 'width', 'height', 'rotation'],
  },
};

const SYSTEM_INSTRUCTION = `You are a world-class archival digitization specialist. Your task is to identify individual physical photo prints within a single high-resolution scan with microscopic precision.

CRITICAL DETECTION PROTOCOL:
1. SUBSTRATE IDENTIFICATION: Detect the PHYSICAL PAPER footprint. This includes white margins, scalloped/deckled edges, and the paper backing. Do not crop into the image content if there is a border.
2. MICROSCOPIC GAP ANALYSIS: In tiled grids where photos touch, look for shadow-lines, texture shifts, and specular highlights. Separate touching prints with 100% accuracy.
3. RECTILINEAR VERIFICATION: Every print is a perfect rectangle. Verify all four corners. If a photo is tilted, calculate the exact tilt (e.g. 1.25 degrees).
4. SUB-PIXEL COORDINATES: Use 2 decimal places for all values (centerX, centerY, width, height, rotation) to ensure pixel-perfect alignment.
5. EXHAUSTIVE SEARCH: Ensure no small polaroids or scraps are missed.

Output strict JSON. Prioritize separation of adjacent items and archival edge preservation.`;

export async function findPhotoBoundaries(imageBase64: string, mimeType: string): Promise<Boundary[]> {
  try {
    const ai = getAiClient();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: { 
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: "Perform a deep-space geometric analysis of this scan. Isolate every single physical photo print. Ensure overlapping or touching photos are cleanly separated into individual boxes with their own independent rotation." }
        ] 
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0,
        // Max thinking budget for Pro model to handle complex spatial reasoning and tiled grids
        thinkingConfig: { thinkingBudget: 32768 },
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    const boundaries: any[] = JSON.parse(text.trim());

    return boundaries.map((b, i) => ({
      ...b,
      id: `boundary-${Date.now()}-${i}`
    }));
  } catch (error: any) {
    console.error("Gemini Detection Error:", error);
    if (error.message?.includes("API_KEY environment variable not set")) {
      throw error;
    }
    throw new Error("Precision detection failed. Please check the scan quality and try again.");
  }
}

export async function restorePhoto(imageBase64: string, mimeType: string): Promise<string> {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: "Fully restore this photograph. Remove noise, scratches, and stains. Enhance clarity and colors." },
        ],
      },
    });

    const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }
    throw new Error("No image returned");
  } catch (error: any) {
    console.error("Gemini Restoration Error:", error);
    if (error.message?.includes("API_KEY environment variable not set")) {
      throw error;
    }
    throw new Error("AI Restoration failed.");
  }
}
