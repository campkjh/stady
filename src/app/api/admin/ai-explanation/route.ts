import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. Vercel 환경변수에 추가해주세요." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { questionImage, choicesImage, answer, questionText } = body;

    if (!questionImage && !questionText) {
      return NextResponse.json({ error: "문제 이미지나 텍스트가 필요합니다." }, { status: 400 });
    }
    if (!answer) {
      return NextResponse.json({ error: "정답이 필요합니다." }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const content: Anthropic.Messages.ContentBlockParam[] = [];

    if (questionImage) {
      content.push({
        type: "image",
        source: { type: "url", url: questionImage },
      });
    }
    if (choicesImage) {
      content.push({
        type: "image",
        source: { type: "url", url: choicesImage },
      });
    }

    const parts: string[] = [];
    if (questionText) parts.push(`문제 텍스트: ${questionText}`);
    parts.push(`정답: ${answer}번`);
    parts.push(
      "위 문제의 정답이 왜 그 번호인지, 학생이 이해할 수 있도록 한국어로 명확한 해설을 3~5문장으로 작성해주세요. " +
      "오답 선택지가 왜 틀렸는지도 간단히 포함해주세요. " +
      "해설 외 다른 말(예: '해설:', '알겠습니다' 같은 서두)은 넣지 마세요. " +
      "본문만 그대로 출력해주세요."
    );

    content.push({ type: "text", text: parts.join("\n\n") });

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1000,
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const explanation = textBlock && "text" in textBlock ? textBlock.text.trim() : "";

    return NextResponse.json({
      explanation,
      usage: { input: response.usage?.input_tokens, output: response.usage?.output_tokens },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("AI explanation error:", error);
    const msg = error instanceof Error ? error.message : "AI 해설 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
