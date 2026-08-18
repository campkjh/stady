import Foundation
import Vision
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// 해설 PDF → 문항별 해설 크롭. 해설지는 N단(보통 3단) 조판이고 "N. [출제의도]" 마커로 시작한다.
// 지문/선택지 분리가 없어 qextract3 보다 단순: 마커 → 다음 마커(읽기 순서) 전까지를 세그먼트로 잘라 스티칭.
let args = CommandLine.arguments
guard args.count >= 3 else { FileHandle.standardError.write("usage: sextract <pdf> <outdir> [colPx]\n".data(using:.utf8)!); exit(1) }
let pdfPath = args[1], outDir = args[2]
let colPx = args.count > 3 ? Double(args[3])! : 1400.0
guard let doc = CGPDFDocument(URL(fileURLWithPath: pdfPath) as CFURL) else { exit(1) }
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

struct Line { let text: String; let x: Double; let xr: Double; let yTop: Double; let yBot: Double }
func renderForOCR(_ page: CGPDFPage) -> CGImage? {
    let box = page.getBoxRect(.mediaBox)
    let scale = 2400.0 / max(box.width, box.height)
    let w = Int((box.width*scale).rounded()), h = Int((box.height*scale).rounded())
    guard let ctx = CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:0,
        space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
    ctx.setFillColor(CGColor(red:1,green:1,blue:1,alpha:1)); ctx.fill(CGRect(x:0,y:0,width:Double(w),height:Double(h)))
    ctx.interpolationQuality = .high; ctx.setShouldAntialias(true); ctx.setShouldSmoothFonts(true)
    ctx.scaleBy(x:scale,y:scale); ctx.drawPDFPage(page)
    return ctx.makeImage()
}
func ocrLines(_ img: CGImage) -> [Line] {
    let req = VNRecognizeTextRequest(); req.recognitionLevel = .accurate
    req.recognitionLanguages = ["ko-KR","en-US"]; req.usesLanguageCorrection = false
    try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    var out: [Line] = []
    for o in (req.results ?? []) {
        guard let c = o.topCandidates(1).first else { continue }
        out.append(Line(text: c.string, x: Double(o.boundingBox.minX), xr: Double(o.boundingBox.maxX),
                        yTop: 1 - Double(o.boundingBox.maxY), yBot: 1 - Double(o.boundingBox.minY)))
    }
    return out
}

var pageLines: [Int: [Line]] = [:]
for p in 1...doc.numberOfPages { if let pg = doc.page(at: p), let im = renderForOCR(pg) { pageLines[p] = ocrLines(im) } }

// 단 경계: 본문 줄 x 시작점의 군집(0.02 간격 히스토그램 → 큰 봉우리 최대 4개)
func columnStarts(_ p: Int) -> [Double] {
    let xs = (pageLines[p] ?? []).filter { $0.text.count > 6 && $0.yTop > 0.1 && $0.yBot < 0.92 }.map { $0.x }
    guard !xs.isEmpty else { return [0.0] }
    var hist: [Int: Int] = [:]
    for x in xs { hist[Int(x / 0.02), default: 0] += 1 }
    let peaks = hist.filter { $0.value >= max(3, xs.count / 12) }.keys.sorted()
    var starts: [Double] = []
    for k in peaks { let v = Double(k) * 0.02; if let last = starts.last, v - last < 0.12 { continue }; starts.append(v) }
    return starts.isEmpty ? [0.0] : starts
}
func colOf(_ p: Int, _ x: Double) -> Int {
    let s = columnStarts(p); var c = 0
    for (i, st) in s.enumerated() where x >= st - 0.03 { c = i }
    return c
}
func colRange(_ p: Int, _ c: Int) -> (Double, Double) {
    let s = columnStarts(p)
    let l = c < s.count ? s[c] : 0.0
    let r = c + 1 < s.count ? s[c+1] : 1.0
    return (l, r)
}

// 마커
struct Mark { let num: Int; let page: Int; let col: Int; let x: Double; let yTop: Double }
let mRe = try! NSRegularExpression(pattern: "^\\s*(\\d{1,2})\\s*[.．]\\s*\\[?\\s*출제")
var marks: [Mark] = []
for p in 1...doc.numberOfPages {
    for l in (pageLines[p] ?? []) {
        let ns = l.text as NSString
        guard let m = mRe.firstMatch(in: l.text, range: NSRange(location: 0, length: ns.length)),
              let n = Int(ns.substring(with: m.range(at: 1))), n >= 1, n <= 50 else { continue }
        marks.append(Mark(num: n, page: p, col: colOf(p, l.x), x: l.x, yTop: l.yTop))
    }
}
var best: [Int: Mark] = [:]
for m in marks { if best[m.num] == nil { best[m.num] = m } }
let seq = best.values.sorted { $0.num < $1.num }
func key(_ p: Int, _ c: Int, _ y: Double) -> Double { Double(p) * 100 + Double(c) * 10 + y }
let bounds = seq.map { key($0.page, $0.col, $0.yTop) }.sorted()

// 푸터/컬럼 하한
func colBottom(_ p: Int, _ c: Int) -> Double {
    let (l, r) = colRange(p, c)
    var maxY = 0.0
    for ln in (pageLines[p] ?? []) where ln.x >= l - 0.03 && ln.x < r - 0.02 && ln.yBot < 0.93 && ln.text.count > 3 { maxY = max(maxY, ln.yBot) }
    return min(0.945, maxY > 0.5 ? maxY + 0.004 : 0.93)
}
func contentTop(_ p: Int) -> Double {
    var top = 0.05
    for l in (pageLines[p] ?? []) where l.yTop < 0.2 && (l.text.contains("정답 및 해설") || l.text.contains("학력평가") || l.text.contains("영역")) { top = max(top, l.yBot + 0.01) }
    return min(top, 0.22)
}
struct Seg { let page: Int; let col: Int; let y0: Double; let y1: Double }
func segments(_ m: Mark) -> [Seg] {
    let own = key(m.page, m.col, m.yTop)
    let next = bounds.first { $0 > own + 0.004 }
    var segs: [Seg] = []; var p = m.page, c = m.col, y = max(0, m.yTop - 0.005)
    while true {
        let bot = colBottom(p, c)
        if let nx = next {
            let np = Int(nx / 100), nc = Int((nx - Double(np)*100) / 10), ny = nx - Double(np)*100 - Double(nc)*10
            if np == p && nc == c { segs.append(Seg(page: p, col: c, y0: y, y1: min(ny, bot))); break }
        }
        segs.append(Seg(page: p, col: c, y0: y, y1: bot))
        let ncount = columnStarts(p).count
        if c + 1 < ncount { c += 1 } else { c = 0; p += 1 }
        if p > doc.numberOfPages || next == nil { break }
        y = contentTop(p)
    }
    return segs.filter { $0.y1 - $0.y0 > 0.012 }
}

func renderSeg(_ s: Seg) -> CGImage? {
    guard let page = doc.page(at: s.page) else { return nil }
    let box = page.getBoxRect(.mediaBox)
    let (l, r) = colRange(s.page, s.col)
    // 단 안의 실측 잉크 오른쪽 끝
    var inkR = l + 0.05
    for ln in (pageLines[s.page] ?? []) where ln.x >= l - 0.03 && ln.x < r - 0.02 && ln.yTop > 0.1 { inkR = max(inkR, ln.xr) }
    // 왼쪽은 이 단의 실측 잉크 시작(마커 x)에서 조금만 왼쪽으로. 단 시작 추정값(l)보다
    // 이웃 단 글자가 걸리지 않게 잉크 기준을 우선한다.
    var inkL = r
    for ln in (pageLines[s.page] ?? []) where ln.x >= l - 0.03 && ln.x < r - 0.02 && ln.yTop > 0.1 && ln.text.count > 3 { inkL = min(inkL, ln.x) }
    let x0 = box.minX + max(l - 0.006, inkL - 0.008) * box.width
    let x1 = box.minX + min(r - 0.004, inkR + 0.008) * box.width
    let scale = colPx / (x1 - x0)
    let yTopPt = box.maxY - s.y0 * box.height, yBotPt = box.maxY - s.y1 * box.height
    let h = Int(((yTopPt - yBotPt) * scale).rounded()); let w = Int(colPx.rounded())
    guard h > 4, let ctx = CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:0,
        space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
    ctx.setFillColor(CGColor(red:1,green:1,blue:1,alpha:1)); ctx.fill(CGRect(x:0,y:0,width:Double(w),height:Double(h)))
    ctx.interpolationQuality = .high; ctx.setShouldAntialias(true); ctx.setShouldSmoothFonts(true)
    ctx.scaleBy(x: scale, y: scale); ctx.translateBy(x: -x0, y: -yBotPt); ctx.drawPDFPage(page)
    return ctx.makeImage()
}
func vtrim(_ img: CGImage) -> CGImage {
    guard let data = img.dataProvider?.data, let ptr = CFDataGetBytePtr(data) else { return img }
    let bpr = img.bytesPerRow, w = img.width, h = img.height
    func blank(_ r: Int) -> Bool { var x = 4; while x < w - 4 { let o = r*bpr + x*4; if ptr[o] < 235 || ptr[o+1] < 235 || ptr[o+2] < 235 { return false }; x += 3 }; return true }
    var top = 0; while top < h-1 && blank(top) { top += 1 }
    var bot = h-1; while bot > top && blank(bot) { bot -= 1 }
    let y0 = max(0, top-14), y1 = min(h-1, bot+14)
    guard y1 > y0 + 8 else { return img }
    return img.cropping(to: CGRect(x: 0, y: y0, width: w, height: y1-y0+1)) ?? img
}
func stitch(_ segs: [Seg], _ name: String) -> Bool {
    let imgs = segs.compactMap { renderSeg($0) }
    guard !imgs.isEmpty else { return false }
    let w = imgs[0].width, H = imgs.reduce(0) { $0 + $1.height }
    guard let ctx = CGContext(data:nil,width:w,height:H,bitsPerComponent:8,bytesPerRow:0,
        space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue) else { return false }
    ctx.setFillColor(CGColor(red:1,green:1,blue:1,alpha:1)); ctx.fill(CGRect(x:0,y:0,width:Double(w),height:Double(H)))
    var y = H; for im in imgs { y -= im.height; ctx.draw(im, in: CGRect(x:0, y:Double(y), width:Double(w), height:Double(im.height))) }
    guard let joined = ctx.makeImage() else { return false }
    let dest = URL(fileURLWithPath: outDir).appendingPathComponent(name)
    guard let d = CGImageDestinationCreateWithURL(dest as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { return false }
    CGImageDestinationAddImage(d, vtrim(joined), [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary)
    return CGImageDestinationFinalize(d)
}

var out: [[String: Any]] = []
for m in seq {
    let name = String(format: "s%02d.jpg", m.num)
    if stitch(segments(m), name) { out.append(["number": m.num, "file": name]) }
}
try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted])
    .write(to: URL(fileURLWithPath: outDir).appendingPathComponent("_solutions.json"))
print("해설 \(out.count)개: \(out.compactMap { $0["number"] as? Int }.map(String.init).joined(separator: ","))")
