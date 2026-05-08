const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

setGlobalOptions({
  maxInstances: 10,
  region: "asia-northeast1",
});

exports.summarizeNote = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to use AI summary."
      );
    }

    const noteTitle = request.data?.title || "";
    const noteBody = request.data?.body || "";

    if (!noteBody.trim()) {
      throw new HttpsError("invalid-argument", "Note content is required.");
    }

    logger.info("Summarize note requested", {
      uid: request.auth.uid,
      titleLength: noteTitle.length,
      bodyLength: noteBody.length,
    });

    const shortPreview =
      noteBody.length > 180 ? `${noteBody.slice(0, 180)}...` : noteBody;

    return {
      summary: `AI summary preview: ${shortPreview}`,
      actionItems: [
        "This is a test response from Firebase Functions.",
        "Next step: connect this function to Gemini.",
      ],
    };
  }
);