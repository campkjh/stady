const DEFAULT_INQUIRY_EMAIL_TO = "Stady0507@gmail.com";
const DEFAULT_INQUIRY_EMAIL_FROM = "Stady <noreply@stady.kr>";

interface InquiryNotificationInput {
  inquiryId: string;
  userId: string | null;
  name: string;
  email: string;
  category: string;
  title: string;
  content: string;
  createdAt: Date;
}

interface InquiryEmailDelivery {
  sent: boolean;
  reason?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function htmlToText(html: string) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function buildInquiryEmailHtml(input: InquiryNotificationInput) {
  const plainContent = htmlToText(input.content);
  const createdAt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(input.createdAt);

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin: 0 0 16px;">Stady 1:1 문의가 접수되었습니다.</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tbody>
          <tr><th align="left" style="padding: 8px; background: #f3f4f6;">접수 ID</th><td style="padding: 8px;">${escapeHtml(input.inquiryId)}</td></tr>
          <tr><th align="left" style="padding: 8px; background: #f3f4f6;">회원 ID</th><td style="padding: 8px;">${escapeHtml(input.userId || "비회원")}</td></tr>
          <tr><th align="left" style="padding: 8px; background: #f3f4f6;">접수일</th><td style="padding: 8px;">${escapeHtml(createdAt)}</td></tr>
          <tr><th align="left" style="padding: 8px; background: #f3f4f6;">분류</th><td style="padding: 8px;">${escapeHtml(input.category)}</td></tr>
          <tr><th align="left" style="padding: 8px; background: #f3f4f6;">이름</th><td style="padding: 8px;">${escapeHtml(input.name)}</td></tr>
          <tr><th align="left" style="padding: 8px; background: #f3f4f6;">이메일</th><td style="padding: 8px;">${escapeHtml(input.email)}</td></tr>
          <tr><th align="left" style="padding: 8px; background: #f3f4f6;">제목</th><td style="padding: 8px;">${escapeHtml(input.title)}</td></tr>
        </tbody>
      </table>
      <h3 style="margin: 24px 0 8px;">문의 내용</h3>
      <pre style="white-space: pre-wrap; word-break: break-word; padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; font-family: Arial, sans-serif;">${escapeHtml(plainContent)}</pre>
    </div>
  `;
}

function buildInquiryEmailText(input: InquiryNotificationInput) {
  return [
    "Stady 1:1 문의가 접수되었습니다.",
    "",
    `접수 ID: ${input.inquiryId}`,
    `회원 ID: ${input.userId || "비회원"}`,
    `분류: ${input.category}`,
    `이름: ${input.name}`,
    `이메일: ${input.email}`,
    `제목: ${input.title}`,
    "",
    "문의 내용:",
    htmlToText(input.content),
  ].join("\n");
}

export async function sendInquiryNotification(input: InquiryNotificationInput): Promise<InquiryEmailDelivery> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("Inquiry notification email skipped: RESEND_API_KEY is not configured.");
    return { sent: false, reason: "missing_resend_api_key" };
  }

  const to = process.env.INQUIRY_NOTIFICATION_TO || DEFAULT_INQUIRY_EMAIL_TO;
  const from = process.env.INQUIRY_NOTIFICATION_FROM || DEFAULT_INQUIRY_EMAIL_FROM;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: input.email,
      subject: `[Stady 1:1 문의] ${input.category} - ${input.title}`,
      html: buildInquiryEmailHtml(input),
      text: buildInquiryEmailText(input),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend inquiry email failed: ${response.status} ${errorText}`);
  }

  return { sent: true };
}
