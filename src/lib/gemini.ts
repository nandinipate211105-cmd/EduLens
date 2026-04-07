import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = typeof process !== "undefined" ? process.env.GEMINI_API_KEY : "";

function getGenAI(): GoogleGenerativeAI | null {
  if (!apiKey || !String(apiKey).trim()) return null;
  return new GoogleGenerativeAI(apiKey);
}

export function isGeminiConfigured(): boolean {
  return !!apiKey && String(apiKey).trim().length > 0;
}

/** Personalized study plan from weak topics + profile (calls Gemini when API key is set). */
export async function generateStudentLearningGapAdvice(payload: {
  name: string;
  grade?: string;
  score?: number;
  attendance?: number;
  assignments?: number;
  riskLevel?: string;
  weakTopics: { subject: string; topic: string; mastery: number; errorPattern?: string }[];
}): Promise<string> {
  const genAI = getGenAI();
  const weakList = payload.weakTopics
    .slice(0, 12)
    .map(w => `- ${w.subject} → ${w.topic} (${w.mastery}% mastery)${w.errorPattern ? ` — ${w.errorPattern}` : ''}`)
    .join('\n');

  const context = `Student: ${payload.name}${payload.grade ? `, grade ${payload.grade}` : ''}
Overall score: ${payload.score ?? 'n/a'}%, attendance: ${payload.attendance ?? 'n/a'}%, assignments: ${payload.assignments ?? 'n/a'}%
Risk level: ${payload.riskLevel ?? 'n/a'}

Weak topics (Needs Work):
${weakList || '(none listed)'}`;

  if (!genAI) {
    return (
      `**Offline coach (add GEMINI_API_KEY in .env for live AI)**\n\n` +
      (payload.weakTopics.length
        ? payload.weakTopics
            .slice(0, 5)
            .map(
              w =>
                `• Spend 20–30 minutes daily on **${w.topic}** (${w.subject}): redo missed examples, then 5 practice questions without notes.`
            )
            .join('\n') +
          `\n• Block two short review sessions per week and track wrong answers in a simple error log.\n• If attendance or assignments are low, fix routines first so study time is protected.`
        : `• No weak topics flagged yet — keep steady revision across all subjects and take timed practice tests weekly.`)
    );
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction:
      "You are an expert K-12 learning coach. Given a student's weak topics and profile, write concise, actionable advice: 4-6 short bullet points (use plain text lines starting with •). No markdown headings. Be encouraging and specific to the topics named. Under 220 words.",
  });

  const result = await model.generateContent(
    `${context}\n\nGive personalized study advice for this student (bullet lines with • only).`
  );
  return result.response.text();
}

export async function askGemini(prompt: string, context: string = "") {
  const genAI = getGenAI();
  if (!genAI) throw new Error("GEMINI_API_KEY is not set");
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "You are EduLens AI, an intelligent assistant for school administrators and teachers. You specialize in student analytics, learning gap detection, attendance patterns, and personalized education. Keep responses practical, concise, and educator-focused.",
  });

  const result = await model.generateContent(`${context}\n\nUser Question: ${prompt}`);
  return result.response.text();
}

export async function extractQuestionsFromImage(base64Image: string, mimeType: string) {
  const genAI = getGenAI();
  if (!genAI) throw new Error("GEMINI_API_KEY is not set");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = "Extract all questions from this question paper image. Provide them as a clean list with proper numbering. Do not include any other text.";
  
  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Image,
        mimeType: mimeType
      }
    },
    { text: prompt }
  ]);

  const text = result.response.text();
  return text.split('\n').filter(q => q.trim().length > 0);
}

export async function gradeAnswerSheet(base64Image: string, mimeType: string, questions: string[]) {
  const genAI = getGenAI();
  if (!genAI) throw new Error("GEMINI_API_KEY is not set");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `
    You are an expert teacher. Grade this student's answer sheet based on the following questions:
    ${questions.join('\n')}
    
    Provide a structured response in JSON format:
    {
      "feedback": "Detailed feedback for the student",
      "score": 85,
      "maxScore": 100,
      "percentage": 85
    }
  `;
  
  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Image,
        mimeType: mimeType
      }
    },
    { text: prompt }
  ]);

  const text = result.response.text();
  // Extract JSON from the response (Gemini might wrap it in markdown)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error("Failed to parse AI response");
}
