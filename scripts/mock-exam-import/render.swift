import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// PDF → 페이지별 JPEG. 인자: <pdf> <출력디렉터리> <목표 긴변 px> <jpeg품질 0~1>
// AppKit 대신 CoreGraphics 직접 사용(헤드리스에서 NSGraphicsContext 가 죽는다).
// 시험지는 원본 해상도가 기능(OCR 크롭·필기 좌표·4배 확대)이라 과하게 줄이지 않는다.
let args = CommandLine.arguments
guard args.count >= 5 else {
    FileHandle.standardError.write("usage: render <pdf> <outdir> <longSidePx> <quality>\n".data(using: .utf8)!)
    exit(1)
}
let url = URL(fileURLWithPath: args[1])
guard let doc = CGPDFDocument(url as CFURL) else {
    FileHandle.standardError.write("cannot open: \(args[1])\n".data(using: .utf8)!); exit(1)
}
let outDir = args[2]
let longSide = Double(args[3])!
let quality = Double(args[4])!
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let space = CGColorSpaceCreateDeviceRGB()
for i in 1...doc.numberOfPages {
    guard let page = doc.page(at: i) else { continue }
    let box = page.getBoxRect(.mediaBox)
    // 페이지 자체 회전(/Rotate)을 반영한 최종 표시 크기
    let rot = page.rotationAngle % 360
    let swapped = (rot == 90 || rot == 270 || rot == -90 || rot == -270)
    let dispW = swapped ? box.height : box.width
    let dispH = swapped ? box.width : box.height
    let scale = longSide / max(dispW, dispH)
    let w = Int((dispW * scale).rounded()), h = Int((dispH * scale).rounded())

    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                              bytesPerRow: 0, space: space,
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { continue }
    // 시험지 배경은 흰색(PDF 는 배경이 투명일 수 있다)
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: Double(w), height: Double(h)))
    ctx.interpolationQuality = .high
    ctx.setShouldAntialias(true)
    ctx.setShouldSmoothFonts(true)
    ctx.scaleBy(x: scale, y: scale)
    // getDrawingTransform 이 회전/박스 오프셋을 한 번에 처리해 준다
    ctx.concatenate(page.getDrawingTransform(.mediaBox,
                    rect: CGRect(x: 0, y: 0, width: dispW, height: dispH), rotate: 0, preserveAspectRatio: true))
    ctx.drawPDFPage(page)

    guard let img = ctx.makeImage() else { continue }
    let name = String(format: "p%03d.jpg", i)
    let dest = URL(fileURLWithPath: outDir).appendingPathComponent(name)
    guard let d = CGImageDestinationCreateWithURL(dest as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { continue }
    CGImageDestinationAddImage(d, img, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    CGImageDestinationFinalize(d)
    let sz = (try? FileManager.default.attributesOfItem(atPath: dest.path)[.size] as? Int) ?? 0
    print("\(name)\t\(w)x\(h)\t\(sz ?? 0)")
}
