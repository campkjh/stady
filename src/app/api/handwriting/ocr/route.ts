import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";

// Recognizes handwriting from a canvas snapshot using Claude vision.
// The client sends a PNG data URL ("data:image/png;base64,...") and gets back
// the transcribed text, which is inserted into the memo area.
export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "문자 인식 기능이 설정되지 않았습니다. (ANTHROPIC_API_KEY)" },
        { status: 500 }
      );
    }

    const { image } = await request.json();
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "이미지 데이터가 올바르지 않습니다." }, { status: 400 });
    }

    const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "이미지 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const mediaType = match[1] as "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    const data = match[2];

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            {
              type: "text",
              text:
                "이 이미지는 사용자가 손으로 쓴 필기입니다. 한국어/영어/숫자/수식이 섞여 있을 수 있습니다. " +
                "필기 내용을 그대로 텍스트로 옮겨 적어주세요. 줄바꿈은 보존하고, 설명이나 머리말 없이 인식된 텍스트만 출력하세요. " +
                "읽을 수 없으면 빈 문자열을 반환하세요.",
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Handwriting OCR error:", error);
    return NextResponse.json({ error: "문자 인식 중 오류가 발생했습니다." }, { status: 500 });
  }
}
