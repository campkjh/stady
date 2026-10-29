import fitz, unicodedata, os, re, json, statistics
from collections import Counter, defaultdict
DL=os.path.expanduser('~/Downloads')
f=[os.path.join(DL,f) for f in os.listdir(DL) if '선지해설' in unicodedata.normalize('NFC',f)][0]
d=fitz.open(f)
rows=[]
for pi in range(d.page_count):
    p=d[pi]; chars=[]
    for b in p.get_text("rawdict")['blocks']:
        for l in b.get('lines',[]):
            for s in l['spans']:
                for c in s['chars']:
                    if c['c'].strip(): chars.append(dict(c=c['c'],x0=c['bbox'][0],x1=c['bbox'][2],y=c['origin'][1],size=round(s['size'],1)))
    groups=defaultdict(list)
    for c in chars: groups[round(c['y']/2.0)].append(c)
    for key in sorted(groups):
        g=sorted(groups[key], key=lambda c:c['x0'])
        gaps=[g[i+1]['x0']-g[i]['x1'] for i in range(len(g)-1)]
        # 글자 사이 기본 간격(양끝 맞춤으로 늘어난 줄 포함) = 아래쪽 사분위수. 낱말 사이는 그보다 확연히 크다
        base=sorted(gaps)[len(gaps)//4] if gaps else 0
        toks=[];cur=g[0]['c'];sizes=[g[0]['size']]
        for i in range(1,len(g)):
            gap=gaps[i-1]; sz=g[i]['size']
            if gap > base + sz*0.18 or sz!=g[i-1]['size'] and gap>0.5:
                toks.append(cur); cur=g[i]['c']; sizes.append(sz)
            else: cur+=g[i]['c']
        toks.append(cur)
        toks=[unicodedata.normalize('NFC',t) for t in toks]
        rows.append(dict(p=pi+1,size=max(c['size'] for c in g),toks=toks,sizes=sizes,x0=g[0]['x0'],x1=g[-1]['x1'],W=p.rect.width))
json.dump(rows,open('rows.json','w'),ensure_ascii=False)
corpus=Counter()
for r in rows:
    for t in r['toks']:
        corpus[re.sub(r'[.,()\'"’‘“”?!·]','',t)]+=1
json.dump(corpus,open('corpus.json','w'),ensure_ascii=False)
print(len(rows))
