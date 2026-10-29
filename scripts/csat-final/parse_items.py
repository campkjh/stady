import json, re
rows=json.load(open('rows.json')); corpus=json.load(open('corpus.json'))
start=min(r['p'] for r in rows if r['toks'] and re.fullmatch(r'\d+\.', r['toks'][0]) and r['size']>=9.4)
R=[r for r in rows if r['p']>=start]
def clean(w): return re.sub(r'[.,()\'"’‘“”?!·]','',w)
def join_rows(rs):
    out=''
    for i,r in enumerate(rs):
        t=' '.join(r['toks'])
        if not out: out=t; continue
        last=out.split(' ')[-1]; first=t.split(' ')[0]
        full = r_prev['x1'] > r_prev['W'] - 50 if False else True
        cat=clean(last+first)
        if corpus.get(cat,0)>0 and not re.search(r'[.,)]$', last): out+=t
        else: out+=' '+t
    return out
items=[]; unit=None; thinker=None; cur=None; mode=None
UNIT_RE=re.compile(r'^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]$')
for r in R:
    toks=r['toks']; txt=' '.join(toks)
    if r['size']==12.9: continue   # page header
    if r['size']>=15 and UNIT_RE.match(toks[0]): unit=' '.join(toks[1:]); continue
    if r['size']==11.5: thinker=txt; continue
    if r['size']==9.0 and re.fullmatch(r'\d+개',txt): continue
    m=re.fullmatch(r'(\d+)\.', toks[0])
    if m and r['sizes'][0]==9.5:
        cur=dict(unit=unit,thinker=thinker,n=int(m.group(1)),q=[],ctx=[],ans=None,src=None,rate=None,exp=[],page=r['p']); items.append(cur)
        toks=toks[1:]; mode='q'
        if not toks: continue
    if cur is None: continue
    if mode=='q':
        if any(re.fullmatch(r'\[[OX]\]',t) for t in toks):
            k=[i for i,t in enumerate(toks) if re.fullmatch(r'\[[OX]\]',t)][0]
            if toks[:k]: cur['q'].append(dict(r,toks=toks[:k]))
            if toks[k+1:]: pass
            cur['ans']=toks[k][1]; mode='src'; continue
        cur['q'].append(dict(r,toks=toks)); continue
    if mode=='src' and r['size']==8.3:
        cur['ctx'].append(r); continue
    if mode=='src' and r['size']==8.0:
        s=txt; mm=re.search(r'정답률\s*(\d+)\s*%',s)
        cur['rate']=int(mm.group(1)) if mm else None
        cur['src']=re.sub(r'\s*\|.*$','',s).strip(); mode='exp'; continue
    if mode in('exp','src'):
        if r['size']==8.0: continue
        cur['exp'].append(r); mode='exp'
out=[]
for it in items:
    out.append(dict(unit=it['unit'],thinker=it['thinker'],n=it['n'],context=join_rows(it['ctx']) if it['ctx'] else None,question=join_rows(it['q']),answer=it['ans'],src=it['src'],rate=it['rate'],explanation=join_rows(it['exp']),page=it['page']))
json.dump(out,open('items.json','w'),ensure_ascii=False,indent=1)
print('start page',start,'items',len(out))
from collections import OrderedDict, Counter
g=OrderedDict()
for o in out: g.setdefault((o['unit'],o['thinker']),[]).append(o['n'])
for k,v in g.items(): print(k, len(v), 'max',max(v), 'seq ok', v==list(range(1,len(v)+1)))
print('missing ans',sum(1 for o in out if not o['answer']),'missing src',sum(1 for o in out if not o['src']),'missing exp',sum(1 for o in out if not o['explanation']))
