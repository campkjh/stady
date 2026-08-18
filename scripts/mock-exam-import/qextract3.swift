import Foundation
import Vision
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// 시험지 PDF → 문항별 크롭 v3.
// v2 에서 사용자가 지적한 문제를 고친다:
//  - 크기/정렬 불일치: 스케일을 "긴 변" 이 아니라 "단 폭" 기준으로 고정(전 크롭 동일 DPI),
//    x 범위를 문항번호 여백 기준으로 고정(전 크롭 동일 폭·좌측 정렬).
//  - 하단 페이지 번호 노출: 푸터(숫자/쪽표시)를 Vision 으로 찾아 그 위에서 자른다.
//  - 문항 잘림: 문항이 다음 단/페이지로 이어지면 세그먼트로 잘라 세로로 이어붙인다.
//  - 헤더 제목: 발문 첫 줄 텍스트("1. 윗글의 내용과 일치하지 않는 것은?")를 뽑아 저장.
// 좌표는 Vision(렌더 이미지 OCR). PDFKit characterBounds 는 한글 PDF 에서 어긋난다.

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: qextract3 <pdf> <outdir> [cropLongPx]\n".data(using: .utf8)!); exit(1)
}
let pdfPath = args[1], outDir = args[2]
let colPx = args.count > 3 ? Double(args[3])! : 1400.0   // 단 폭을 이 픽셀로 렌더(전 크롭 공통)
guard let doc = CGPDFDocument(URL(fileURLWithPath: pdfPath) as CFURL) else { exit(1) }
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

struct Line { let text: String; let x: Double; let xr: Double; let yTop: Double; let yBot: Double }

func renderForOCR(_ page: CGPDFPage) -> CGImage? {
    let box = page.getBoxRect(.mediaBox)
    let scale = 2200.0 / max(box.width, box.height)
    let w = Int((box.width*scale).rounded()), h = Int((box.height*scale).rounded())
    guard let ctx = CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:0,
        space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
    ctx.setFillColor(CGColor(red:1,green:1,blue:1,alpha:1)); ctx.fill(CGRect(x:0,y:0,width:Double(w),height:Double(h)))
    ctx.interpolationQuality = .high; ctx.setShouldAntialias(true); ctx.setShouldSmoothFonts(true)
    ctx.scaleBy(x:scale,y:scale); ctx.drawPDFPage(page)
    return ctx.makeImage()
}
func ocrLines(_ img: CGImage) -> [Line] {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["ko-KR","en-US"]
    req.usesLanguageCorrection = false
    try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    var out: [Line] = []
    for o in (req.results ?? []) {
        guard let c = o.topCandidates(1).first else { continue }
        out.append(Line(text: c.string, x: Double(o.boundingBox.minX), xr: Double(o.boundingBox.maxX),
                        yTop: 1 - Double(o.boundingBox.maxY), yBot: 1 - Double(o.boundingBox.minY)))
    }
    return out
}

// ── 1) 전 페이지 OCR ──
var pageLines: [Int: [Line]] = [:]
var footTop: [Int: Double] = [:]          // 페이지별 푸터(쪽번호) 시작 y
for p in 1...doc.numberOfPages {
    guard let page = doc.page(at: p), let img = renderForOCR(page) else { continue }
    let ls = ocrLines(img)
    pageLines[p] = ls
    // 푸터(쪽번호 "20 / 36" 도형): 하단 12% 안에서 짧은 숫자만 있는 줄. 도형 안의 현재
    // 쪽번호는 Vision 이 못 읽고 총 쪽수("20")만 읽히므로 숫자 1~3자리 단독 줄로 잡는다.
    // 페이지 폭 가운데 부근에 있어야 한다(본문 줄과 구분).
    for l in ls where l.yTop > 0.88 {
        let t = l.text.trimmingCharacters(in: .whitespaces)
        let isNum = t.range(of: "^[0-9]{1,3}([[:space:]]*/[[:space:]]*[0-9]{1,3})?$", options: .regularExpression) != nil
        if isNum && l.x > 0.3 && l.x < 0.7 {
            footTop[p] = min(footTop[p] ?? 1.0, l.yTop)
        }
    }
}
// 쪽번호 도형은 읽힌 숫자보다 위로 더 올라와 있다(박스 위 사선). 넉넉히 0.02 위에서 자른다.
// Vision 이 푸터를 못 읽는 페이지가 실제로 있어(도형 안 숫자), 검출 실패 시에도 문서 전체에서
// 관측된 푸터 위치(최솟값)를 폴백으로 쓴다 — 쪽번호 위치는 시험지 전체에서 같다.
var globalFootTop: Double = 1.0
func colBottom(_ p: Int) -> Double {
    let ft = footTop[p] ?? globalFootTop
    return min(0.94, ft - 0.02)
}
// 페이지 상단 제목 밴드("…학력평가 문제지 / 국어 영역 / 제N교시") 아래가 본문 시작이다.
// 연속 단(다음 페이지로 이어지는 문항/지문)의 시작을 여기로 잡지 않으면 헤더가 크롭에 딸려 들어온다.
var contentTopCache: [Int: Double] = [:]
func contentTop(_ p: Int) -> Double {
    if let v = contentTopCache[p] { return v }
    var top = 0.048
    for l in (pageLines[p] ?? []) where l.yTop < 0.22 {
        let t = l.text
        if t.contains("학력평가") || t.contains("문제지") || t.contains("교시")
            || t.range(of: "^[0-9]?\\s*(국어|수학|영어|한국사|사회탐구|과학탐구|직업탐구|제2외국어)?\\s*영역", options: .regularExpression) != nil {
            top = max(top, l.yBot + 0.012)
        }
    }
    let v = min(top, 0.24)
    contentTopCache[p] = v
    return v
}

globalFootTop = footTop.values.min() ?? 1.0
// ── 2) 문항번호/지문머리 검출 ──
struct Mark { let num: Int; let num2: Int; let page: Int; let col: Int; let x: Double; let yTop: Double; let isHead: Bool }
let qRe = try! NSRegularExpression(pattern: "^\\s*(\\d{1,2})\\s*[.．]")
// Vision 이 여는 대괄호 "[" 를 "L" 이나 "I" 로 읽는 경우가 있다("L11~12] 다음 자료를…").
let hRe = try! NSRegularExpression(pattern: "^\\s*[\\[LI\\(]\\s*(\\d{1,2})\\s*[~～\\-]\\s*(\\d{1,2})\\s*[\\]\\)]")

func pageTwoCol(_ p: Int) -> Bool {
    guard let page = doc.page(at: p) else { return false }
    let box = page.getBoxRect(.mediaBox)
    if box.width > 700 { return true }
    let xs = (pageLines[p] ?? []).filter { $0.text.count > 8 }.map { $0.x }
    if xs.isEmpty { return false }
    return Double(xs.filter { $0 > 0.45 }.count) / Double(xs.count) > 0.15
}
var rawMarks: [Mark] = []
for p in 1...doc.numberOfPages {
    let two = pageTwoCol(p)
    for l in (pageLines[p] ?? []) {
        let ns = l.text as NSString
        let col = two ? (l.x < 0.45 ? 0 : 1) : 0
        if let m = qRe.firstMatch(in: l.text, range: NSRange(location: 0, length: ns.length)),
           let n = Int(ns.substring(with: m.range(at: 1))), n >= 1, n <= 50 {
            rawMarks.append(Mark(num: n, num2: n, page: p, col: col, x: l.x, yTop: l.yTop, isHead: false))
        }
        if let m = hRe.firstMatch(in: l.text, range: NSRange(location: 0, length: ns.length)),
           let a = Int(ns.substring(with: m.range(at: 1))), let b = Int(ns.substring(with: m.range(at: 2))),
           a >= 1, b > a, b <= 50 {
            rawMarks.append(Mark(num: a, num2: b, page: p, col: col, x: l.x, yTop: l.yTop, isHead: true))
        }
    }
}
// 단별 문항번호 여백 = 최솟값(오탐 'ㄱ.'→'7.' 은 항상 들여쓰여 있다)
var marginByCol: [Int: Double] = [:]
for col in [0, 1] {
    let xs = rawMarks.filter { !$0.isHead && $0.col == col }.map { $0.x }.sorted()
    if let m = xs.first { marginByCol[col] = m }
}
// 단별 본문 오른쪽 끝: 실측(97퍼센타일). 좌우 여백은 대칭이 아니라서 추정하면 잘린다.
var inkRightByCol: [Int: Double] = [:]
do {
    var byCol: [Int: [Double]] = [:]
    for p in 1...doc.numberOfPages {
        let two = pageTwoCol(p)
        for l in (pageLines[p] ?? []) {
            guard l.yTop > 0.13, l.yBot < 0.9, l.text.count > 4 else { continue }
            let col = two ? (l.x < 0.45 ? 0 : 1) : 0
            byCol[col, default: []].append(l.xr)
        }
    }
    for (col, arr) in byCol {
        let sorted = arr.sorted()
        inkRightByCol[col] = sorted[min(sorted.count - 1, sorted.count * 97 / 100)]
    }
}

var qMarks = rawMarks.filter { m in
    guard !m.isHead, let mg = marginByCol[m.col] else { return false }
    return m.x - mg < 0.016
}
var bestQ: [Int: Mark] = [:]
for m in qMarks {
    let mg = marginByCol[m.col] ?? m.x
    if let e = bestQ[m.num] {
        let em = marginByCol[e.col] ?? e.x
        if abs(m.x - mg) < abs(e.x - em) { bestQ[m.num] = m }
    } else { bestQ[m.num] = m }
}
let seq = bestQ.values.sorted { $0.num < $1.num }
// 지문 머리([11~12] …)는 "[숫자~숫자]" 형태라 오탐 여지가 거의 없다. 과목에 따라 번호 여백보다
// 오른쪽으로 들여 쓰이기도 해서(정치와 법), 단 안에만 있으면 인정한다 — 여백 조건으로 걸러내면
// 앞 문항이 그 지문을 통째로 물고 내려간다(정법 10번 ⑤ 사고).
let heads = rawMarks.filter { m in
    guard m.isHead, let mg = marginByCol[m.col] else { return false }
    return m.x - mg < 0.12 && m.x - mg > -0.02
}

func readOrder(_ p: Int, _ c: Int, _ y: Double) -> Double { Double(p) * 100 + Double(c) * 10 + y }
var boundaries: [(key: Double, isHead: Bool)] = seq.map { (readOrder($0.page, $0.col, $0.yTop), false) }
boundaries += heads.map { (readOrder($0.page, $0.col, $0.yTop), true) }
// 시험지 끝의 "* 확인 사항" 안내 박스는 어느 문항에도 속하지 않는다 — 경계로 추가해
// 마지막 문항이 그 박스를 물고 내려가지 않게 한다(박스 테두리 몫으로 0.012 위에서 자름).
for p in 1...doc.numberOfPages {
    let two = pageTwoCol(p)
    for l in (pageLines[p] ?? []) {
        guard l.text.contains("확인") && l.text.contains("사항") else { continue }
        let col = two ? (l.x < 0.45 ? 0 : 1) : 0
        boundaries.append((readOrder(p, col, max(0, l.yTop - 0.012)), true))
    }
}
boundaries.sort { $0.key < $1.key }

// 시작점(page,col,y)부터 다음 경계 전까지의 세그먼트 목록
struct Seg { let page: Int; let col: Int; let y0: Double; let y1: Double }
// ownKey: 이 마크 자신의 경계 키. 시작 y 에 위쪽 여유를 두면 자기 경계가 "다음"으로
// 잡히므로, 다음 경계 탐색은 반드시 원래 위치 기준으로 한다.
func segments(fromPage p0: Int, col c0: Int, y y0: Double, ownKey: Double) -> [Seg] {
    let next = boundaries.first { $0.key > ownKey + 0.004 }
    var segs: [Seg] = []
    var p = p0, c = c0, y = y0
    while true {
        let bot = colBottom(p)
        if let nx = next {
            let nxPage = Int(nx.key / 100)
            let nxCol = Int((nx.key - Double(nxPage) * 100) / 10)
            let nxY = nx.key - Double(nxPage) * 100 - Double(nxCol) * 10
            if nxPage == p && nxCol == c {
                segs.append(Seg(page: p, col: c, y0: y, y1: min(nxY, bot)))
                break
            }
        }
        segs.append(Seg(page: p, col: c, y0: y, y1: bot))
        // 다음 단으로
        if pageTwoCol(p) && c == 0 { c = 1 } else { c = 0; p += 1 }
        if p > doc.numberOfPages { break }
        if next == nil { break }               // 마지막 문항: 자기 단까지만
        y = contentTop(p)
    }
    return segs.filter { $0.y1 - $0.y0 > 0.012 }
}

// ── 3) 렌더(단 폭 기준 고정 스케일 + 고정 x 범위) ──
func colGeom(_ p: Int, _ c: Int) -> (x0: Double, x1: Double, scale: Double, box: CGRect)? {
    guard let page = doc.page(at: p) else { return nil }
    let box = page.getBoxRect(.mediaBox)
    let two = pageTwoCol(p)
    let colW = two ? box.width / 2 : box.width
    let colX0 = box.minX + (two ? Double(c) * colW : 0)
    // 문항번호 여백 기준으로 좌우 대칭 크롭 → 전 크롭 동일 폭·좌측 정렬
    let inkL = box.minX + (marginByCol[c] ?? 0.06) * box.width
    let inkR = box.minX + (inkRightByCol[c] ?? 0.94) * box.width
    // 단 사이 세로 구분선이 크롭에 걸리지 않게 단 시작점 안쪽으로 클램프.
    let x0 = max(colX0 + 5, inkL - 7)
    let x1 = min(colX0 + colW - 3, inkR + 8)
    let scale = colPx / (x1 - x0)
    return (x0, x1, scale, box)
}
func renderSeg(_ s: Seg) -> CGImage? {
    guard let g = colGeom(s.page, s.col), let page = doc.page(at: s.page) else { return nil }
    let yTopPt = g.box.maxY - s.y0 * g.box.height
    let yBotPt = g.box.maxY - s.y1 * g.box.height
    let hPt = yTopPt - yBotPt
    guard hPt > 4 else { return nil }
    let w = Int(colPx.rounded()), h = Int((hPt * g.scale).rounded())
    guard h > 4, let ctx = CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:0,
        space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
    ctx.setFillColor(CGColor(red:1,green:1,blue:1,alpha:1)); ctx.fill(CGRect(x:0,y:0,width:Double(w),height:Double(h)))
    ctx.interpolationQuality = .high; ctx.setShouldAntialias(true); ctx.setShouldSmoothFonts(true)
    ctx.scaleBy(x: g.scale, y: g.scale)
    ctx.translateBy(x: -g.x0, y: -yBotPt)
    ctx.drawPDFPage(page)
    return ctx.makeImage()
}
// 세그먼트들을 세로로 이어붙이고 위아래 여백을 잘라 저장
func stitchAndSave(_ segs: [Seg], _ name: String) -> Bool {
    let imgs = segs.compactMap { renderSeg($0) }
    guard !imgs.isEmpty else { return false }
    let w = imgs[0].width
    let totalH = imgs.reduce(0) { $0 + $1.height }
    guard let ctx = CGContext(data:nil,width:w,height:totalH,bitsPerComponent:8,bytesPerRow:0,
        space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue) else { return false }
    ctx.setFillColor(CGColor(red:1,green:1,blue:1,alpha:1)); ctx.fill(CGRect(x:0,y:0,width:Double(w),height:Double(totalH)))
    var y = totalH
    for im in imgs { y -= im.height; ctx.draw(im, in: CGRect(x: 0, y: Double(y), width: Double(w), height: Double(im.height))) }
    guard let joined = ctx.makeImage() else { return false }
    let trimmed = vtrim(joined) ?? joined
    let dest = URL(fileURLWithPath: outDir).appendingPathComponent(name)
    guard let d = CGImageDestinationCreateWithURL(dest as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { return false }
    CGImageDestinationAddImage(d, trimmed, [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary)
    return CGImageDestinationFinalize(d)
}
// 위/아래 흰 여백 제거(패드 14px)
func vtrim(_ img: CGImage) -> CGImage? {
    guard let data = img.dataProvider?.data, let ptr = CFDataGetBytePtr(data) else { return nil }
    let bpr = img.bytesPerRow, w = img.width, h = img.height
    func rowBlank(_ r: Int) -> Bool {
        var x = 4
        while x < w - 4 {
            let o = r * bpr + x * 4
            if ptr[o] < 235 || ptr[o+1] < 235 || ptr[o+2] < 235 { return false }
            x += 3
        }
        return true
    }
    var top = 0; while top < h - 1 && rowBlank(top) { top += 1 }
    var bot = h - 1; while bot > top && rowBlank(bot) { bot -= 1 }
    let pad = 14
    let y0 = max(0, top - pad), y1 = min(h - 1, bot + pad)
    guard y1 > y0 + 8 else { return img }
    return img.cropping(to: CGRect(x: 0, y: y0, width: w, height: y1 - y0 + 1))
}

// ── 4) u-공간(세그먼트 이어붙인 좌표)에서 선택지/제목 찾기 ──
let CIRCLED: [Character] = ["①","②","③","④","⑤"]
struct ULine { let text: String; let u: Double }
func uLines(_ segs: [Seg]) -> [ULine] {
    var base = 0.0
    var out: [ULine] = []
    for s in segs {
        for l in (pageLines[s.page] ?? []) {
            let two = pageTwoCol(s.page)
            let lc = two ? (l.x < 0.45 ? 0 : 1) : 0
            guard lc == s.col, l.yTop >= s.y0 - 0.003, l.yTop < s.y1 - 0.003 else { continue }
            out.append(ULine(text: l.text, u: base + (l.yTop - s.y0)))
        }
        base += s.y1 - s.y0
    }
    return out.sorted { $0.u < $1.u }
}
// u 구간을 세그먼트별 y 구간으로 변환
func slice(_ segs: [Seg], _ uA: Double, _ uB: Double) -> [Seg] {
    var base = 0.0
    var out: [Seg] = []
    for s in segs {
        let h = s.y1 - s.y0
        let a = max(0, uA - base), b = min(h, uB - base)
        if b - a > 0.008 { out.append(Seg(page: s.page, col: s.col, y0: s.y0 + a, y1: s.y0 + b)) }
        base += h
    }
    return out
}

// ── 5) 본 작업 ──
var out: [[String: Any]] = []
var splitCount = 0
for q in seq {
    let segs = segments(fromPage: q.page, col: q.col, y: max(0, q.yTop - 0.006),
                        ownKey: readOrder(q.page, q.col, q.yTop))
    guard !segs.isEmpty else { continue }
    let fullName = String(format: "q%02d.jpg", q.num)
    guard stitchAndSave(segs, fullName) else { continue }
    var entry: [String: Any] = ["number": q.num, "file": fullName]

    let lines = uLines(segs)
    // 제목: 번호 줄부터 '?' 가 나올 때까지 최대 3줄
    var title = ""
    var titleDone = false
    for l in lines.prefix(4) {
        if title.isEmpty {
            guard l.text.range(of: "^\\s*\\d{1,2}\\s*[.．]", options: .regularExpression) != nil else { continue }
            title = l.text.trimmingCharacters(in: .whitespaces)
        } else if !titleDone {
            title += " " + l.text.trimmingCharacters(in: .whitespaces)
        }
        if title.contains("?") { titleDone = true }
    }
    if !title.isEmpty { entry["title"] = title }

    // 선택지: ①~⑤ 가 각각 제 줄에서 시작하고 u 오름차순일 때만 분리
    var markerU: [Character: Double] = [:]
    var inline = false
    for l in lines {
        guard let f = l.text.trimmingCharacters(in: .whitespaces).first, CIRCLED.contains(f) else { continue }
        if l.text.filter({ CIRCLED.contains($0) }).count >= 2 { inline = true }
        markerU[f] = max(markerU[f] ?? 0, l.u)
    }
    let us = CIRCLED.compactMap { markerU[$0] }
    let totalU = segs.reduce(0.0) { $0 + ($1.y1 - $1.y0) }
    if !inline && us.count == 5 && zip(us, us.dropFirst()).allSatisfy({ $0 < $1 }) {
        let stemName = String(format: "q%02d_s.jpg", q.num)
        let stemOK = stitchAndSave(slice(segs, 0, us[0] - 0.004), stemName)
        var names: [String] = []
        for k in 0..<5 {
            let uA = us[k] - 0.004
            let uB = k == 4 ? totalU : us[k+1] - 0.004
            let nm = String(format: "q%02d_c%d.jpg", q.num, k+1)
            if stitchAndSave(slice(segs, uA, uB), nm) { names.append(nm) }
        }
        if stemOK && names.count == 5 {
            entry["stem"] = stemName
            entry["choices"] = names
            splitCount += 1
        }
    }
    out.append(entry)
}

// 지문
var passages: [[String: Any]] = []
for h in heads {
    let segs = segments(fromPage: h.page, col: h.col, y: max(0, h.yTop - 0.004),
                        ownKey: readOrder(h.page, h.col, h.yTop))
    let totalU = segs.reduce(0.0) { $0 + ($1.y1 - $1.y0) }
    guard totalU > 0.14 else { continue }
    let name = String(format: "p%02d-%02d.jpg", h.num, h.num2)
    if stitchAndSave(segs, name) {
        passages.append(["from": h.num, "to": h.num2, "file": name])
    }
}
try! JSONSerialization.data(withJSONObject: passages, options: [.prettyPrinted])
    .write(to: URL(fileURLWithPath: outDir).appendingPathComponent("_passages.json"))
try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted])
    .write(to: URL(fileURLWithPath: outDir).appendingPathComponent("_questions.json"))
let nums = out.compactMap { $0["number"] as? Int }
print("문항 \(out.count)개(분리 \(splitCount), 지문 \(passages.count)): \(nums.map(String.init).joined(separator: ","))")
