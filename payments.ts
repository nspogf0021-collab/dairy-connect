import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, inviteCodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

router.post("/login", async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone) { res.status(400).json({ error: "Phone number required" }); return; }

  // Accept Firebase-verified OTPs (verified client-side via Firebase Phone Auth)
  // or the testing OTP "123456"
  const isFirebaseVerified = otp === "FIREBASE_VERIFIED";
  const isTestOtp = otp === "123456";
  if (!isFirebaseVerified && !isTestOtp) {
    res.status(401).json({ error: "Invalid OTP" });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    const id = randomUUID();
    [user] = await db.insert(usersTable).values({ id, phone }).returning();
  }

  res.json({ userId: user.id, phone: user.phone, name: user.name, role: user.role, isNewUser });
});

router.get("/me", async (req, res) => {
  const userId = req.query["userId"] as string;
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json(user);
});

router.post("/onboard", async (req, res) => {
  const { userId, name, role, inviteCode } = req.body;

  if (!userId || !name || !role) {
    res.status(400).json({ error: "userId, name, and role are required" });
    return;
  }

  if (role === "seller" && !inviteCode) {
    res.status(400).json({ error: "Invite code required for sellers" });
    return;
  }

  let collectorId: string | undefined;
  let autoInviteCode: string | null = null;

  if (role === "seller" && inviteCode) {
    const [code] = await db.select().from(inviteCodesTable).where(eq(inviteCodesTable.code, inviteCode));
    if (!code) { res.status(400).json({ error: "Invalid invite code" }); return; }
    if (code.isUsed) { res.status(400).json({ error: "Invite code already used" }); return; }

    collectorId = code.collectorId;
    await db.update(inviteCodesTable).set({ isUsed: true, usedBySellerId: userId }).where(eq(inviteCodesTable.code, inviteCode));
  }

  const updateData: Record<string, unknown> = { name, role };
  if (collectorId) updateData.collectorId = collectorId;

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, userId)).returning();

  // Auto-generate invite code for collectors on first onboard
  if (role === "collector") {
    const code = generateCode();
    const [newCode] = await db.insert(inviteCodesTable).values({ id: randomUUID(), code, collectorId: userId, isUsed: false }).returning();
    autoInviteCode = newCode.code;
  }

  res.json({ ...user, autoInviteCode });
});

export default router;
