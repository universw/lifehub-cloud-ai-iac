// Map raw Firebase / Firestore error messages to user-friendly text.

export function friendlyFirebaseError(err, fallback = "Something went wrong.") {
  if (!err) return fallback;

  const message = typeof err === "string" ? err : err.message || "";
  const code = err.code || "";

  if (code === "permission-denied" || /insufficient permissions/i.test(message)) {
    return "Saved data was rejected by the server. The Firebase security rules may need to be redeployed (firebase deploy --only firestore:rules).";
  }

  if (code === "unauthenticated" || /unauthenticated/i.test(message)) {
    return "Your session has expired. Please sign in again.";
  }

  if (code === "unavailable" || /unavailable/i.test(message)) {
    return "Could not reach Firebase. Check your internet connection and try again.";
  }

  if (/quota/i.test(message)) {
    return "A Firebase quota was exceeded. Please try again later.";
  }

  if (/not-found/i.test(message)) {
    return "The requested resource could not be found.";
  }

  return message || fallback;
}
