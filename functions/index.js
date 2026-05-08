const { setGlobalOptions } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { GoogleGenAI } = require("@google/genai");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

setGlobalOptions({
  maxInstances: 10,
  region: "asia-northeast1",
});

function cleanText(value) {
  return String(value || "").trim();
}

function extractJson(text) {
  const cleaned = cleanText(text)
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      return null;
    }

    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

exports.summarizeNote = onCall(
  {
    secrets: [geminiApiKey],
    enforceAppCheck: false,
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to use AI summary."
      );
    }

    const noteTitle = cleanText(request.data?.title);
    const noteBody = cleanText(request.data?.body);

    if (!noteBody) {
      throw new HttpsError("invalid-argument", "Note content is required.");
    }

    if (noteBody.length > 6000) {
      throw new HttpsError(
        "invalid-argument",
        "This note is too long to summarize right now. Please keep it under 6,000 characters."
      );
    }

    try {
      process.env.GEMINI_API_KEY = geminiApiKey.value();

      logger.info("Gemini note summary requested", {
        uid: request.auth.uid,
        titleLength: noteTitle.length,
        bodyLength: noteBody.length,
        hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      });

      const ai = new GoogleGenAI({});

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `
You are LifeHub AI, a helpful personal productivity assistant.

Summarize the user's private note clearly and safely.

Return ONLY valid JSON with this shape:
{
  "summary": "A short 2-4 sentence summary.",
  "actionItems": ["0-5 short action items"],
  "importantReminders": ["0-5 important reminders"]
}

Rules:
- Do not include markdown.
- Do not invent facts.
- If there are no action items, return an empty array.
- If there are no reminders, return an empty array.
- Keep the language simple and useful.

Note title:
${noteTitle || "Untitled note"}

Note content:
${noteBody}
`,
              },
            ],
          },
        ],
      });

      const responseText = cleanText(response.text);

      logger.info("Gemini response received", {
        uid: request.auth.uid,
        responseLength: responseText.length,
      });

      const parsed = extractJson(responseText);

      if (!parsed || typeof parsed.summary !== "string") {
        logger.warn("Gemini returned non-JSON response", {
          uid: request.auth.uid,
          responseText,
        });

        return {
          summary: responseText || "Gemini could not summarize this note.",
          actionItems: [],
          importantReminders: [],
        };
      }

      return {
        summary: cleanText(parsed.summary),
        actionItems: Array.isArray(parsed.actionItems)
          ? parsed.actionItems.slice(0, 5).map(cleanText).filter(Boolean)
          : [],
        importantReminders: Array.isArray(parsed.importantReminders)
          ? parsed.importantReminders
              .slice(0, 5)
              .map(cleanText)
              .filter(Boolean)
          : [],
      };
    } catch (err) {
      logger.error("Gemini summary failed", err);

      throw new HttpsError(
        "internal",
        "LifeHub AI could not summarize this note right now."
      );
    }
  }
);