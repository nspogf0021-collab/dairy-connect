import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, milkEntriesTable, paymentsTable, inviteCodesTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function entryAmount(entry: { liters: number; rate: number | null }): number {
  return entry.liters * (entry.rate ?? 0);
}

router.get("/seller/:userId", async (req, res) => {
  const { userId } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const allEntries = await db
    .select()
    .from(milkEntriesTable)
    .where(eq(milkEntriesTable.sellerId, userId))
    .orderBy(milkEntriesTable.timestamp);

  const today = startOfToday();
  const todayEntries = allEntries.filter((e) => new Date(e.timestamp) >= today);
  const todayLiters = todayEntries.reduce((sum, e) => sum + e.liters, 0);
  const totalLiters = allEntries.reduce((sum, e) => sum + e.liters, 0);
  const totalEarned = allEntries.reduce((sum, e) => sum + entryAmount(e), 0);

  const allPayments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.sellerId, userId))
    .orderBy(paymentsTable.createdAt);
  const totalPaid = allPayments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const pendingPayment = Math.max(0, totalEarned - totalPaid);
  const totalReceived = totalPaid;

  const recentEntries = allEntries.slice(-10).reverse();
  const recentPayments = allPayments.slice(-10).reverse();

  // Get collector info
  let collectorName: string | null = null;
  let collectorInviteCode: string | null = null;
  if (user.collectorId) {
    const [collector] = await db.select().from(usersTable).where(eq(usersTable.id, user.collectorId));
    collectorName = collector?.name ?? null;
    const [code] = await db.select().from(inviteCodesTable).where(eq(inviteCodesTable.collectorId, user.collectorId));
    collectorInviteCode = code?.code ?? null;
  }

  res.json({
    user,
    todayLiters,
    totalLiters,
    totalEarned,
    pendingPayment,
    totalReceived,
    collectorName,
    collectorInviteCode,
    recentEntries: recentEntries.map((e) => ({ ...e, sellerName: user.name, amount: entryAmount(e) })),
    recentPayments,
  });
});

router.get("/collector/:userId", async (req, res) => {
  const { userId } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const sellers = await db.select().from(usersTable).where(eq(usersTable.collectorId, userId));
  const sellerIds = sellers.map((s) => s.id);

  let allEntries: typeof milkEntriesTable.$inferSelect[] = [];
  if (sellerIds.length > 0) {
    allEntries = await db
      .select()
      .from(milkEntriesTable)
      .where(inArray(milkEntriesTable.sellerId, sellerIds))
      .orderBy(milkEntriesTable.timestamp);
  }

  const today = startOfToday();
  const todayEntries = allEntries.filter((e) => new Date(e.timestamp) >= today);
  const todayTotalLiters = todayEntries.reduce((sum, e) => sum + e.liters, 0);

  // Calculate per-seller stats
  const sellerStats = sellers.map((seller) => {
    const entries = allEntries.filter((e) => e.sellerId === seller.id);
    const todaySellerEntries = entries.filter((e) => new Date(e.timestamp) >= today);
    const todayLiters = todaySellerEntries.reduce((sum, e) => sum + e.liters, 0);
    const totalLiters = entries.reduce((sum, e) => sum + e.liters, 0);
    const totalOwed = entries.reduce((sum, e) => sum + entryAmount(e), 0);
    const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    return {
      ...seller,
      todayLiters,
      totalLiters,
      totalOwed,
      latestEntry: latestEntry ? { ...latestEntry, amount: entryAmount(latestEntry) } : null,
    };
  });

  const totalOwed = sellerStats.reduce((sum, s) => sum + s.totalOwed, 0);

  // Invite codes
  const inviteCodes = await db
    .select()
    .from(inviteCodesTable)
    .where(eq(inviteCodesTable.collectorId, userId))
    .orderBy(inviteCodesTable.createdAt);

  const enrichedCodes = await Promise.all(
    inviteCodes.map(async (c) => {
      let usedBySellerName = null;
      if (c.usedBySellerId) {
        const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, c.usedBySellerId));
        usedBySellerName = seller?.name ?? null;
      }
      return { ...c, usedBySellerName };
    })
  );

  const enrichedEntries = allEntries.slice(-20).reverse().map((entry) => {
    const seller = sellers.find((s) => s.id === entry.sellerId);
    return { ...entry, sellerName: seller?.name ?? null, amount: entryAmount(entry) };
  });

  res.json({
    user,
    totalSellers: sellers.length,
    todayTotalLiters,
    totalOwed,
    sellers: sellerStats,
    recentEntries: enrichedEntries,
    inviteCodes: enrichedCodes,
  });
});

router.get("/distributor/:userId", async (req, res) => {
  const { userId } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const collectors = await db.select().from(usersTable).where(eq(usersTable.role, "collector"));
  const allEntries = await db.select().from(milkEntriesTable).orderBy(milkEntriesTable.timestamp);
  const today = startOfToday();
  const todayEntries = allEntries.filter((e) => new Date(e.timestamp) >= today);
  const todayTotalLiters = todayEntries.reduce((sum, e) => sum + e.liters, 0);
  const avgFat = allEntries.length > 0 ? allEntries.reduce((sum, e) => sum + e.fat, 0) / allEntries.length : 0;
  const snfEntries = allEntries.filter((e) => e.snf != null);
  const avgSnf = snfEntries.length > 0 ? snfEntries.reduce((sum, e) => sum + (e.snf ?? 0), 0) / snfEntries.length : 0;
  const totalOwed = allEntries.reduce((sum, e) => sum + entryAmount(e), 0);

  const weeklyTrend = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = daysAgo(i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayEntries = allEntries.filter((e) => {
      const t = new Date(e.timestamp);
      return t >= dayStart && t < dayEnd;
    });
    const liters = dayEntries.reduce((sum, e) => sum + e.liters, 0);
    const fat = dayEntries.length > 0 ? dayEntries.reduce((sum, e) => sum + e.fat, 0) / dayEntries.length : 0;
    weeklyTrend.push({ date: dayStart.toISOString().split("T")[0], liters, fat: Math.round(fat * 100) / 100 });
  }

  const sellers = await db.select().from(usersTable).where(eq(usersTable.role, "seller"));
  const recentEntries = allEntries.slice(-20).reverse().map((entry) => {
    const seller = sellers.find((s) => s.id === entry.sellerId);
    return { ...entry, sellerName: seller?.name ?? null, amount: entryAmount(entry) };
  });

  res.json({
    user,
    totalCollectors: collectors.length,
    todayTotalLiters,
    avgFat: Math.round(avgFat * 100) / 100,
    avgSnf: Math.round(avgSnf * 100) / 100,
    totalOwed,
    recentEntries,
    weeklyTrend,
  });
});

router.get("/admin", async (req, res) => {
  const allUsers = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  const sellers = allUsers.filter((u) => u.role === "seller");
  const collectors = allUsers.filter((u) => u.role === "collector");
  const distributors = allUsers.filter((u) => u.role === "distributor");
  const allEntries = await db.select().from(milkEntriesTable);
  const today = startOfToday();
  const todayLiters = allEntries.filter((e) => new Date(e.timestamp) >= today).reduce((sum, e) => sum + e.liters, 0);

  res.json({
    totalUsers: allUsers.length,
    totalSellers: sellers.length,
    totalCollectors: collectors.length,
    totalDistributors: distributors.length,
    totalMilkEntries: allEntries.length,
    totalLitersToday: todayLiters,
    recentUsers: allUsers.slice(-10).reverse(),
  });
});

export default router;
