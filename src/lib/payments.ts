import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// Payments use raw SQL + CREATE TABLE IF NOT EXISTS, matching the community
// modules in this codebase. This keeps the DB self-healing and avoids
// `prisma db push` (which would drop other raw-SQL tables not in schema.prisma).

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

export interface PaymentRow {
  id: string;
  order_id: string;
  user_id: string;
  product_id: string;
  amount: number;
  status: string; // PENDING | DONE | FAILED | CANCELED
  payment_key: string | null;
  method: string | null;
  approved_at: Date | null;
  created_at: Date;
}

export async function ensurePaymentTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Payment" (
      "id" TEXT PRIMARY KEY,
      "order_id" TEXT NOT NULL UNIQUE,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "product_id" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "payment_key" TEXT,
      "method" TEXT,
      "approved_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Payment_user_product_idx"
    ON "Payment" ("user_id", "product_id", "status")
  `);
}

export async function createPendingPayment(input: { userId: string; productId: string; amount: number }) {
  await ensurePaymentTable();
  const id = randomUUID();
  const orderId = `stady_${id.replace(/-/g, "")}`.slice(0, 60);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Payment" ("id", "order_id", "user_id", "product_id", "amount", "status")
     VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
    id,
    orderId,
    input.userId,
    input.productId,
    input.amount
  );
  return { id, orderId };
}

export async function getPaymentByOrderId(orderId: string): Promise<PaymentRow | null> {
  await ensurePaymentTable();
  const rows = await prisma.$queryRawUnsafe<PaymentRow[]>(
    `SELECT * FROM "Payment" WHERE "order_id" = $1 LIMIT 1`,
    orderId
  );
  return rows[0] ?? null;
}

export async function markPaymentDone(orderId: string, paymentKey: string, method: string | null) {
  await prisma.$executeRawUnsafe(
    `UPDATE "Payment"
     SET "status" = 'DONE', "payment_key" = $2, "method" = $3, "approved_at" = CURRENT_TIMESTAMP
     WHERE "order_id" = $1`,
    orderId,
    paymentKey,
    method
  );
}

export async function markPaymentFailed(orderId: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "Payment" SET "status" = 'FAILED' WHERE "order_id" = $1 AND "status" = 'PENDING'`,
    orderId
  );
}

export async function hasPurchased(userId: string, productId: string): Promise<boolean> {
  await ensurePaymentTable();
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS "count" FROM "Payment"
     WHERE "user_id" = $1 AND "product_id" = $2 AND "status" = 'DONE'`,
    userId,
    productId
  );
  return Number(rows[0]?.count || 0) > 0;
}

/** Confirms a payment with Toss using the secret key (server-side only). */
export async function confirmTossPayment(input: { paymentKey: string; orderId: string; amount: number }) {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) throw new Error("TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다.");

  // Basic auth: base64(secretKey + ":")
  const auth = Buffer.from(`${secretKey}:`).toString("base64");
  const response = await fetch(TOSS_CONFIRM_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      amount: input.amount,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data && (data.message as string)) || "결제 승인에 실패했습니다.";
    throw new Error(message);
  }
  return data as { method?: string; [key: string]: unknown };
}
