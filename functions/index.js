const { setGlobalOptions } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const adminDb = admin.firestore();

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
  ".md",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
];
const BLOCKED_UPLOAD_EXTENSIONS = [
  ".env",
  ".js",
  ".ts",
  ".json",
  ".py",
  ".conf",
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".crt",
  ".cer",
  ".config",
  ".yml",
  ".yaml",
];

setGlobalOptions({
  maxInstances: 10,
  region: "asia-northeast1",
});

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to use this feature."
    );
  }
  return request.auth.uid;
}

function getFileExtension(name) {
  const value = String(name || "").toLowerCase();
  const lastDot = value.lastIndexOf(".");
  return lastDot === -1 ? "" : value.slice(lastDot);
}

async function countCollection(uid, name) {
  const snapshot = await adminDb
    .collection("users")
    .doc(uid)
    .collection(name)
    .count()
    .get();
  return snapshot.data().count;
}

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

exports.getWorkspaceStats = onCall(async (request) => {
  const uid = requireAuth(request);

  try {
    const [filesCount, notesCount, linksCount, activityCount] =
      await Promise.all([
        countCollection(uid, "files"),
        countCollection(uid, "notes"),
        countCollection(uid, "links"),
        countCollection(uid, "activity"),
      ]);

    const filesSnapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("files")
      .get();

    let totalStorageBytes = 0;
    let importantFiles = 0;
    filesSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      totalStorageBytes += Number(data.fileSize || 0);
      if (data.isImportant) importantFiles += 1;
    });

    const notesSnapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("notes")
      .where("isImportant", "==", true)
      .get();
    const linksSnapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("links")
      .where("isImportant", "==", true)
      .get();

    return {
      filesCount,
      notesCount,
      linksCount,
      activityCount,
      importantCount:
        importantFiles + notesSnapshot.size + linksSnapshot.size,
      totalStorageBytes,
    };
  } catch (err) {
    logger.error("getWorkspaceStats failed", err);
    throw new HttpsError("internal", "Could not load workspace stats.");
  }
});

exports.validateUpload = onCall((request) => {
  requireAuth(request);

  const fileName = String(request.data?.fileName || "sample-document.pdf");
  const fileSize = Number(request.data?.fileSize || 0);
  const reasons = [];

  const extension = getFileExtension(fileName);

  if (BLOCKED_UPLOAD_EXTENSIONS.includes(extension)) {
    reasons.push(`${extension} files are blocked from normal uploads.`);
  } else if (extension && !ALLOWED_UPLOAD_EXTENSIONS.includes(extension)) {
    reasons.push(`${extension} is not in the allowed extension list.`);
  }

  if (fileSize > MAX_UPLOAD_SIZE_BYTES) {
    reasons.push("File exceeds the 10MB upload limit.");
  }

  return {
    allowed: reasons.length === 0,
    extension,
    maxUploadSizeBytes: MAX_UPLOAD_SIZE_BYTES,
    allowedExtensions: ALLOWED_UPLOAD_EXTENSIONS,
    blockedExtensions: BLOCKED_UPLOAD_EXTENSIONS,
    reasons,
  };
});

exports.createSupportTicket = onCall(async (request) => {
  const uid = requireAuth(request);

  const subject = String(request.data?.subject || "").trim();
  const message = String(request.data?.message || "").trim();

  if (!subject || subject.length > 120) {
    throw new HttpsError(
      "invalid-argument",
      "Subject is required and must be 120 characters or fewer."
    );
  }

  if (!message || message.length > 2000) {
    throw new HttpsError(
      "invalid-argument",
      "Message is required and must be 2,000 characters or fewer."
    );
  }

  try {
    const ticketRef = await adminDb
      .collection("users")
      .doc(uid)
      .collection("supportTickets")
      .add({
        subject,
        message,
        status: "open",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    await adminDb
      .collection("users")
      .doc(uid)
      .collection("activity")
      .add({
        action: "support_ticket_created",
        itemType: "account",
        message: "Created a support ticket",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return {
      ticketId: ticketRef.id,
      status: "open",
    };
  } catch (err) {
    logger.error("createSupportTicket failed", err);
    throw new HttpsError("internal", "Could not create support ticket.");
  }
});