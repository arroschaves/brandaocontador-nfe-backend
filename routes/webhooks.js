const express = require("express");
const router = express.Router();
const crypto = require("crypto");

function verifySignature(secret, payload, signature) {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

router.post("/github", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET || "";
    const sig = req.get("X-Hub-Signature-256") || "";
    if (!secret || !sig || !verifySignature(secret, req.body, sig)) {
      return res.status(401).json({ ok: false });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
