const { setGlobalOptions } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const geminiApiKey = defineSecret("GEMINI_API_KEY");

setGlobalOptions({
  maxInstances: 10,
  region: "asia-northeast1",
});

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

function cleanText(value) {
  return String(value || "").trim();
}

function getExtension(fileName) {
  const lastDot = String(fileName || "").lastIndexOf(".");
  if (lastDot === -1) return "";
  return String(fileName).slice(lastDot).toLowerCase();
}

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  return request.auth.uid;
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
    enforceAppCheck: true,
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    const uid = requireAuth(request);

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
        uid,
        titleLength: noteTitle.length,
        bodyLength: noteBody.length,
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

      const parsed = extractJson(responseText);

      if (!parsed || typeof parsed.summary !== "string") {
        logger.warn("Gemini returned non-JSON response", { uid });

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

exports.getWorkspaceStats = onCall(
  { enforceAppCheck: true, timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    const uid = requireAuth(request);

    try {
      const userRoot = db.collection("users").doc(uid);

      const [filesSnap, notesSnap, linksSnap, activitySnap] = await Promise.all(
        [
          userRoot.collection("files").get(),
          userRoot.collection("notes").get(),
          userRoot.collection("links").get(),
          userRoot.collection("activity").get(),
        ]
      );

      let totalStorageBytes = 0;
      let importantCount = 0;

      filesSnap.forEach((d) => {
        const data = d.data();
        totalStorageBytes += data.fileSize || 0;
        if (data.isImportant) importantCount += 1;
      });
      notesSnap.forEach((d) => {
        if (d.data().isImportant) importantCount += 1;
      });
      linksSnap.forEach((d) => {
        if (d.data().isImportant) importantCount += 1;
      });

      return {
        filesCount: filesSnap.size,
        notesCount: notesSnap.size,
        linksCount: linksSnap.size,
        activityCount: activitySnap.size,
        importantCount,
        totalStorageBytes,
      };
    } catch (err) {
      logger.error("getWorkspaceStats failed", err);
      throw new HttpsError(
        "internal",
        "Could not load workspace stats right now."
      );
    }
  }
);

exports.validateUpload = onCall(
  { enforceAppCheck: true, timeoutSeconds: 15, memory: "256MiB" },
  async (request) => {
    requireAuth(request);

    const fileName = cleanText(request.data?.fileName);
    const fileSize = Number(request.data?.fileSize) || 0;

    const reasons = [];
    const extension = getExtension(fileName);

    if (!fileName) {
      reasons.push("File name is required.");
    }

    if (fileSize <= 0) {
      reasons.push("File size must be greater than zero.");
    }

    if (fileSize > MAX_UPLOAD_SIZE_BYTES) {
      reasons.push(
        `File exceeds the 10 MB limit (${(fileSize / 1024 / 1024).toFixed(
          1
        )} MB).`
      );
    }

    if (BLOCKED_UPLOAD_EXTENSIONS.includes(extension)) {
      reasons.push(`${extension} files are blocked for safety.`);
    } else if (extension && !ALLOWED_UPLOAD_EXTENSIONS.includes(extension)) {
      reasons.push(`${extension} is not an allowed file type.`);
    } else if (!extension) {
      reasons.push("File must have a recognized extension.");
    }

    return {
      allowed: reasons.length === 0,
      reasons,
      maxUploadSizeBytes: MAX_UPLOAD_SIZE_BYTES,
      allowedExtensions: ALLOWED_UPLOAD_EXTENSIONS,
      blockedExtensions: BLOCKED_UPLOAD_EXTENSIONS,
    };
  }
);

exports.createSupportTicket = onCall(
  { enforceAppCheck: true, timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    const uid = requireAuth(request);

    const subject = cleanText(request.data?.subject);
    const message = cleanText(request.data?.message);

    if (!subject) {
      throw new HttpsError("invalid-argument", "Subject is required.");
    }
    if (subject.length > 120) {
      throw new HttpsError("invalid-argument", "Subject is too long.");
    }
    if (!message) {
      throw new HttpsError("invalid-argument", "Message is required.");
    }
    if (message.length > 2000) {
      throw new HttpsError("invalid-argument", "Message is too long.");
    }

    try {
      const ticketRef = db
        .collection("users")
        .doc(uid)
        .collection("supportTickets")
        .doc();

      await ticketRef.set({
        subject,
        message,
        status: "open",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        ticketId: ticketRef.id,
        message: "Support ticket created. We'll get back to you by email.",
      };
    } catch (err) {
      logger.error("createSupportTicket failed", err);
      throw new HttpsError(
        "internal",
        "Could not create support ticket right now."
      );
    }
  }
);
