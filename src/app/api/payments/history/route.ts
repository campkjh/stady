import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensurePaymentTable } from "@/lib/payments";
import { ensureSubscriptionTables, SUBSCRIPTION_PLANS } from "@/lib/subscriptions";
import { STORE_PRODUCTS } from "@/lib/products";

export const dynamic = "force-dynamic";

interface HistoryItem {
  type: "product" | "subscription";
  name: string;
  amount: number;
  status: string;
  date: string;
}

// Unified payment history for 결제로그: one-time product purchases (Payment) +
// recurring subscription charges (SubscriptionPayment).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, items: [] });
    }

    await ensurePaymentTable();
    await ensureSubscriptionTables();

    const products = await prisma.$queryRawUnsafe<
      { product_id: string; amount: number; status: string; approved_at: Date | null; created_at: Date }[]
    >(
      `SELECT "product_id", "amount", "status", "approved_at", "created_at"
       FROM "Payment" WHERE "user_id" = $1 AND "status" = 'DONE'`,
      user.id
    );

    const subs = await prisma.$queryRawUnsafe<
      { plan_id: string; amount: number; status: string; billed_at: Date }[]
    >(
      `SELECT s."plan_id", sp."amount", sp."status", sp."billed_at"
       FROM "SubscriptionPayment" sp
       JOIN "Subscription" s ON s."id" = sp."subscription_id"
       WHERE s."user_id" = $1`,
      user.id
    );

    const items: HistoryItem[] = [
      ...products.map((p) => ({
        type: "product" as const,
        name: STORE_PRODUCTS[p.product_id]?.title ?? p.product_id,
        amount: Number(p.amount),
        status: p.status,
        date: (p.approved_at ?? p.created_at).toISOString(),
      })),
      ...subs.map((s) => ({
        type: "subscription" as const,
        name: SUBSCRIPTION_PLANS[s.plan_id]?.name ?? "월정액 패키지",
        amount: Number(s.amount),
        status: s.status,
        date: new Date(s.billed_at).toISOString(),
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ authenticated: true, items });
  } catch (error) {
    console.error("payment history error:", error);
    return NextResponse.json({ error: "결제 내역을 불러오지 못했습니다." }, { status: 500 });
  }
}
