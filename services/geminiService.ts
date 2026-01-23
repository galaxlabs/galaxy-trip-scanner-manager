
import { GoogleGenAI, Type } from "@google/genai";

// Strictly use environment variable
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ExtractedPassenger {
  name: string;
  passport: string;
  nationality: string;
  document_type?: string;
  expiry_date?: string;
  contact?: string;
}

export const extractPassengerInfo = async (base64Image: string): Promise<ExtractedPassenger[]> => {
  const model = 'gemini-3-flash-preview';
  
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image.split(',')[1] || base64Image
          }
        },
        {
          text: `Extract all passenger details from this document. Provide JSON array.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            passport: { type: Type.STRING },
            nationality: { type: Type.STRING },
            document_type: { type: Type.STRING },
            expiry_date: { type: Type.STRING },
            contact: { type: Type.STRING }
          },
          required: ["name", "passport", "nationality"]
        }
      }
    }
  });

  try {
    const jsonStr = (response.text || "").trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("Gemini parse failed", err);
    return [];
  }
};

export const extractTripInfo = async (base64Image: string): Promise<any> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] || base64Image
              }
            },
            {
              text: "Extract vehicle and trip info."
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
                reg_no: { type: Type.STRING },
                compny: { type: Type.STRING },
                phone: { type: Type.STRING },
                model: { type: Type.STRING }
            }
          }
        }
      });
      
      try {
        return JSON.parse(response.text || "{}");
      } catch (e) {
        return {};
      }
}
