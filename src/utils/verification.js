const crypto = require("crypto");

function verifySlackSignature(rawBody, signature, timestamp, signingSecret) {
  if (!signature || !timestamp || !signingSecret) return false;

  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestamp) > 300) return false;

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const mySignature = "v0=" + crypto.createHmac("sha256", signingSecret).update(sigBaseString, "utf8").digest("hex");

  return crypto.timingSafeEqual(Buffer.from(mySignature, "utf8"), Buffer.from(signature, "utf8"));
}

module.exports = { verifySlackSignature };