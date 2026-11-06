import type { CSSProperties } from "react";
import { explanationImageUrl } from "@/lib/problemExplanation";

export default function ProblemExplanation({ explanation, style }: {
  explanation: string;
  style?: CSSProperties;
}) {
  const imageUrl = explanationImageUrl(explanation);
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="문제 해설" style={{ display: "block", width: "100%", height: "auto" }} />
    );
  }
  return <p style={style}>{explanation}</p>;
}
