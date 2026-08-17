import Foundation
import PDFKit

// 인자로 받은 PDF 들의 페이지 수/크기/텍스트 유무를 보고한다.
for path in CommandLine.arguments.dropFirst() {
    guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else {
        print("ERROR\t\(path)"); continue
    }
    let n = doc.pageCount
    var w = 0.0, h = 0.0, textChars = 0
    if let p0 = doc.page(at: 0) {
        let b = p0.bounds(for: .mediaBox)
        w = b.width; h = b.height
    }
    // 앞 3페이지 텍스트 길이 → 벡터(텍스트) PDF 인지 스캔 이미지인지 판별
    for i in 0..<min(3, n) { textChars += doc.page(at: i)?.string?.count ?? 0 }
    let name = (path as NSString).lastPathComponent
    print("\(n)\t\(Int(w))x\(Int(h))\t\(textChars)\t\(name)")
}
