import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// Recurring subscriptions via Toss Payments 자동결제(빌링키).
// Raw SQL + CREATE TABLE IF NOT EXISTS, matching the community/payments modules
// (never `prisma db push` — the DB holds tables not in schema.prisma).

const TOSS_BILLING_ISSUE_URL = "https://api.tosspayments.com/v1/billing/authorizations/issue";
const TOSS_BILLING_CHARGE_URL = (billingKey: string) => `https://api.tosspayments.com/v1/billing/${billingKey}`;

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  intervalMonths: number;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  "monthly-pass": {
    id: "monthly-pass",
    name: "월정액 패키지",
    price: 14000,
    intervalMonths: 1,
  },
};

export function getPlan(id: string): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS[id] ?? null;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  billing_key: string;
  customer_key: string;
  amount: number;
  status: string; // ACTIVE | CANCELED | PAST_DUE
  card_company: string | null;
  card_number: string | null;
  current_period_end: Date;
  next_billing_at: Date;
  canceled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Guard against month overflow (e.g. Jan 31 -> Mar 3)
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export async function ensureSubscriptionTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Subscription" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "plan_id" TEXT NOT NULL,
      "billing_key" TEXT NOT NULL,
      "customer_key" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "card_company" TEXT,
      "card_number" TEXT,
      "current_period_end" TIMESTAMP(3) NOT NULL,
      "next_billing_at" TIMESTAMP(3) NOT NULL,
      "canceled_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_user_plan_key"
    ON "Subscription" ("user_id", "plan_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Subscription_due_idx"
    ON "Subscription" ("status", "next_billing_at")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
      "id" TEXT PRIMARY KEY,
      "subscription_id" TEXT NOT NULL REFERENCES "Subscription"("id") ON DELETE CASCADE,
      "order_id" TEXT NOT NULL UNIQUE,
      "payment_key" TEXT,
      "amount" INTEGER NOT NULL,
      "status" TEXT NOT NULL,
      "billed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function tossAuthHeader() {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) throw new Error("TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다.");
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

/** Exchanges an authKey from the billing-auth redirect for a permanent billingKey. */
export async function issueBillingKey(authKey: string, customerKey: string) {
  const response = await fetch(TOSS_BILLING_ISSUE_URL, {
    method: "POST",
    headers: { Authorization: tossAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ authKey, customerKey }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data && (data.message as string)) || "빌링키 발급에 실패했습니다.");
  }
  return data as {
    billingKey: string;
    card?: { company?: string; number?: string };
    [key: string]: unknown;
  };
}

/** Charges a card via its billingKey. */
export async function chargeWithBillingKey(
  billingKey: string,
  input: { customerKey: string; amount: number; orderId: string; orderName: string }
) {
  const response = await fetch(TOSS_BILLING_CHARGE_URL(billingKey), {
    method: "POST",
    headers: { Authorization: tossAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      customerKey: input.customerKey,
      amount: input.amount,
      orderId: input.orderId,
      orderName: input.orderName,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data && (data.message as string)) || "정기결제 승인에 실패했습니다.");
  }
  return data as { paymentKey?: string; [key: string]: unknown };
}

export async function getSubscription(userId: string, planId: string): Promise<SubscriptionRow | null> {
  await ensureSubscriptionTables();
  const rows = await prisma.$queryRawUnsafe<SubscriptionRow[]>(
    `SELECT * FROM "Subscription" WHERE "user_id" = $1 AND "plan_id" = $2 LIMIT 1`,
    userId,
    planId
  );
  return rows[0] ?? null;
}

/** Subscribes a user: issues billingKey, charges the first cycle, stores the subscription. */
export async function activateSubscription(input: {
  userId: string;
  planId: string;
  authKey: string;
  customerKey: string;
}) {
  await ensureSubscriptionTables();
  const plan = getPlan(input.planId);
  if (!plan) throw new Error("요금제를 찾을 수 없습니다.");

  const issued = await issueBillingKey(input.authKey, input.customerKey);
  const billingKey = issued.billingKey;

  const orderId = `sub_${randomUUID().replace(/-/g, "")}`.slice(0, 60);
  const charge = await chargeWithBillingKey(billingKey, {
    customerKey: input.customerKey,
    amount: plan.price,
    orderId,
    orderName: plan.name,
  });

  const now = new Date();
  const periodEnd = addMonths(now, plan.intervalMonths);
  const id = randomUUID();
  const cardCompany = issued.card?.company ?? null;
  const cardNumber = issued.card?.number ?? null;

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "Subscription"
        ("id","user_id","plan_id","billing_key","customer_key","amount","status","card_company","card_number","current_period_end","next_billing_at","canceled_at","updated_at")
      VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8,$9,$9,NULL,CURRENT_TIMESTAMP)
      ON CONFLICT ("user_id","plan_id") DO UPDATE SET
        "billing_key" = EXCLUDED."billing_key",
        "customer_key" = EXCLUDED."customer_key",
        "amount" = EXCLUDED."amount",
        "status" = 'ACTIVE',
        "card_company" = EXCLUDED."card_company",
        "card_number" = EXCLUDED."card_number",
        "current_period_end" = EXCLUDED."current_period_end",
        "next_billing_at" = EXCLUDED."next_billing_at",
        "canceled_at" = NULL,
        "updated_at" = CURRENT_TIMESTAMP
    `,
    id,
    input.userId,
    plan.id,
    billingKey,
    input.customerKey,
    plan.price,
    cardCompany,
    cardNumber,
    periodEnd
  );

  const sub = await getSubscription(input.userId, plan.id);
  if (sub) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SubscriptionPayment" ("id","subscription_id","order_id","payment_key","amount","status")
       VALUES ($1,$2,$3,$4,$5,'DONE')`,
      randomUUID(),
      sub.id,
      orderId,
      (charge.paymentKey as string) ?? null,
      plan.price
    );
  }
  return sub;
}

export async function cancelSubscription(userId: string, planId: string) {
  await ensureSubscriptionTables();
  await prisma.$executeRawUnsafe(
    `UPDATE "Subscription"
     SET "status" = 'CANCELED', "canceled_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
     WHERE "user_id" = $1 AND "plan_id" = $2 AND "status" = 'ACTIVE'`,
    userId,
    planId
  );
}

/** Charges every ACTIVE subscription whose next billing date has arrived. For the cron job. */
export async function chargeDueSubscriptions() {
  await ensureSubscriptionTables();
  const due = await prisma.$queryRawUnsafe<SubscriptionRow[]>(
    `SELECT * FROM "Subscription" WHERE "status" = 'ACTIVE' AND "next_billing_at" <= CURRENT_TIMESTAMP`
  );

  let charged = 0;
  let failed = 0;
  for (const sub of due) {
    const plan = getPlan(sub.plan_id);
    if (!plan) continue;
    const orderId = `sub_${randomUUID().replace(/-/g, "")}`.slice(0, 60);
    try {
      const charge = await chargeWithBillingKey(sub.billing_key, {
        customerKey: sub.customer_key,
        amount: Number(sub.amount),
        orderId,
        orderName: plan.name,
      });
      const periodEnd = addMonths(new Date(sub.next_billing_at), plan.intervalMonths);
      await prisma.$executeRawUnsafe(
        `UPDATE "Subscription"
         SET "current_period_end" = $2, "next_billing_at" = $2, "status" = 'ACTIVE', "updated_at" = CURRENT_TIMESTAMP
         WHERE "id" = $1`,
        sub.id,
        periodEnd
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SubscriptionPayment" ("id","subscription_id","order_id","payment_key","amount","status")
         VALUES ($1,$2,$3,$4,$5,'DONE')`,
        randomUUID(),
        sub.id,
        orderId,
        (charge.paymentKey as string) ?? null,
        Number(sub.amount)
      );
      charged++;
    } catch {
      await prisma.$executeRawUnsafe(
        `UPDATE "Subscription" SET "status" = 'PAST_DUE', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1`,
        sub.id
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SubscriptionPayment" ("id","subscription_id","order_id","payment_key","amount","status")
         VALUES ($1,$2,$3,NULL,$4,'FAILED')`,
        randomUUID(),
        sub.id,
        orderId,
        Number(sub.amount)
      );
      failed++;
    }
  }
  return { processed: due.length, charged, failed };
}
