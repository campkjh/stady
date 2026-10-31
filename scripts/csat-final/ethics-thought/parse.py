# 윤리와 사상 사상가별 고난도 선지(해설 PDF) → items.json
#   python3 parse.py <해설.pdf>
# 글자 크기: 14.5 단원 / 12.5 사상가 / 9.0 'N개' / 10.4 'n. 선지 〔O|X〕' / 8.3 출처|정답률 / 9.6 해설
# 정답은 PDF 1~5쪽 정답지와 전부 대조한다. 줄바꿈이 낱말 중간에서 일어나서, 이어 붙일 때
# 붙인 낱말이 PDF 어딘가에 실제로 있으면 붙이고, 앞뒤가 각각 온전한 낱말이면 띄운다.
import fitz, sys, re, json, unicodedata
from collections import Counter, OrderedDict

d = fitz.open(sys.argv[1])
lines = []
for pi in range(d.page_count):
    for b in d[pi].get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = unicodedata.normalize('NFC', ''.join(s['text'] for s in l['spans'])).strip()
            if t:
                lines.append(dict(p=pi + 1, size=round(l['spans'][0]['size'], 1), x=l['bbox'][0], t=t))

clean = lambda w: re.sub(r"[.,()\[\]'\"’‘“”?!·:;〔〕]", '', w)
corpus = Counter(clean(w) for L in lines for w in L['t'].split())

def join(parts):
    out = ''
    for t in parts:
        if not out:
            out = t; continue
        last, first = out.split(' ')[-1], t.split(' ')[0]
        cat = clean(last + first)
        if corpus.get(cat, 0) > 0 or re.search(r'[·\-/(\[]$', last) or re.fullmatch(r'[가-힣]', clean(first)):
            out += t
        elif corpus.get(clean(last), 0) > 0 and corpus.get(clean(first), 0) > 0 and not re.match(r'^[.,)\]]', first):
            out += ' ' + t
        else:
            out += t
    return out

# 정답지(앞쪽): 사상가 → [O/X ...]
key = OrderedDict(); th = None
for L in lines:
    if L['p'] > 5: break
    if re.fullmatch(r'\d+개', L['t']) or L['size'] >= 14: continue
    m = re.fullmatch(r'(\d+)\s+([OX])', L['t'])
    if m: key.setdefault(th, []).append(m.group(2)); continue
    if L['size'] in (10.0, 10.5, 12.0, 12.5) and not re.search(r'\d', L['t']) and len(L['t']) < 20:
        th = L['t']

items = []; unit = None; thinker = None; cur = None; mode = None
for L in lines:
    if L['p'] < 6 or L['p'] >= 119: continue
    s, t = L['size'], L['t']
    if s in (10.1, 12.0): continue  # 머리말·쪽번호
    if s == 14.5:
        if not re.fullmatch(r'[ⅠⅡⅢⅣⅤ]', t): unit = t
        continue
    if s == 12.5: thinker = t; continue
    if s == 9.0 and re.fullmatch(r'\d+개', t): continue
    if s == 10.4:
        m = re.match(r'^(\d+)\.\s*(.*)$', t)
        if m and (cur is None or mode != 'q'):
            cur = dict(unit=unit, thinker=thinker, n=int(m.group(1)), q=[m.group(2)], src=[], exp=[], note=[], ans=None, page=L['p']); items.append(cur); mode = 'q'
        else:
            cur['q'].append(t)
        a = re.search(r'〔([OX])〕\s*$', cur['q'][-1])
        if a:
            cur['ans'] = a.group(1); cur['q'][-1] = cur['q'][-1][:a.start()].strip(); mode = 'src'
        continue
    if s == 8.3 and cur is not None and mode in ('src', 'exp') and not cur['exp']:
        cur['src'].append(t); mode = 'src'; continue
    # 해설 뒤 '같은 선지: …'(다른 회차에 같은 선지가 또 나왔다는 참고) — 해설 끝에 한 문단으로 붙인다
    if s == 8.3 and cur is not None and cur['exp'] and (t.startswith('같은 선지') or cur['note']):
        cur['note'].append(t); continue
    if s == 9.6 and cur is not None:
        cur['exp'].append(t); mode = 'exp'; continue
    print('?? 처리 못 한 줄', L, file=sys.stderr)

out = []
for it in items:
    src = join(it['src']) if it['src'] else ''
    rate = re.search(r'정답률\s*(\d+)\s*%', src)
    out.append(dict(unit=it['unit'], thinker=it['thinker'], n=it['n'], question=join(it['q']), answer=it['ans'],
                    src=re.sub(r'\s*\|.*$', '', src).strip() or None, rate=int(rate.group(1)) if rate else None,
                    explanation=('\n'.join(x for x in [join(it['exp']), join(it['note'])] if x)) or None, page=it['page']))
json.dump(out, open('items.json', 'w'), ensure_ascii=False, indent=1)

# 검증
g = OrderedDict()
for o in out: g.setdefault(o['thinker'], []).append(o)
bad = 0
for th, rows in g.items():
    ns = [r['n'] for r in rows]
    ks = key.get(th, [])
    mism = [r['n'] for r, k in zip(rows, ks) if r['answer'] != k]
    if ns != list(range(1, len(ns) + 1)) or len(ks) != len(rows) or mism:
        bad += 1; print('불일치', th, len(rows), '정답지', len(ks), '번호연속', ns == list(range(1, len(ns) + 1)), '정답다름', mism[:5])
print('문항', len(out), '사상가', len(g), '단원', len(set(o['unit'] for o in out)), '불일치 사상가', bad)
print('정답없음', sum(1 for o in out if not o['answer']), '출처없음', sum(1 for o in out if not o['src']), '해설없음', sum(1 for o in out if not o['explanation']))
