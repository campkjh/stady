import Foundation
import PDFKit

// PDF 의 페이지별 텍스트를 그대로 뽑는다(벡터 PDF 전용).
let args = CommandLine.arguments
guard args.count >= 2, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
    FileHandle.standardError.write("usage: pdftext <pdf> [page]\n".data(using: .utf8)!); exit(1)
}
let only = args.count > 2 ? Int(args[2]) : nil
for i in 0..<doc.pageCount {
    if let only, i + 1 != only { continue }
    print("=== PAGE \(i + 1) ===")
    print(doc.page(at: i)?.string ?? "")
}
