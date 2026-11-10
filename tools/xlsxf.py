# Dump cell formulas (and cached values) from an .xlsx. Args: file [regex-on-formula-or-name] [--names] [--sheet NAME]
import zipfile,re,sys,html
f=sys.argv[1]; args=sys.argv[2:]
names='--names' in args; args=[a for a in args if a!='--names']
sheetf=None
if '--sheet' in args: i=args.index('--sheet'); sheetf=args[i+1]; args=args[:i]+args[i+2:]
pat=re.compile(args[0],re.I) if args else None
z=zipfile.ZipFile(f)
wb=z.read('xl/workbook.xml').decode('utf8')
rels=z.read('xl/_rels/workbook.xml.rels').decode('utf8')
rid={m.group(1):m.group(2) for m in re.finditer(r'<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"',rels)}
rid.update({m.group(2):m.group(1) for m in re.finditer(r'<Relationship [^>]*Target="([^"]+)"[^>]*Id="([^"]+)"',rels)})
sheets=[(html.unescape(m.group(1)),rid[m.group(2)]) for m in re.finditer(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"',wb)]
if names:
    for m in re.finditer(r'<definedName [^>]*name="([^"]+)"[^>]*>([^<]*)</definedName>',wb):
        n,v=m.group(1),html.unescape(m.group(2))
        if not pat or pat.search(n) or pat.search(v): print('NAME',n,'=',v[:400])
    sys.exit()
ss=[]
if 'xl/sharedStrings.xml' in z.namelist():
    for si in re.findall(r'<si>(.*?)</si>',z.read('xl/sharedStrings.xml').decode('utf8'),flags=re.S):
        ss.append(html.unescape(''.join(re.findall(r'<t[^>]*>([^<]*)</t>',si))))
for name,target in sheets:
    if sheetf and sheetf.lower() not in name.lower(): continue
    x=z.read('xl/'+target.lstrip('/').replace('xl/','')).decode('utf8')
    shared={}
    for c in re.finditer(r'<c r="([A-Z]+\d+)"([^>]*?)(?:/>|>(.*?)</c>)',x,flags=re.S):
        ref,attrs,body=c.groups(); body=body or ''
        fm=re.search(r'<f([^>]*)>(.*?)</f>',body,flags=re.S); fe=re.search(r'<f([^>]*)/>',body)
        v=re.search(r'<v>(.*?)</v>',body,flags=re.S); val=v.group(1) if v else ''
        if 't="s"' in attrs and val: val=ss[int(val)]
        formula=None
        if fm:
            formula=html.unescape(fm.group(2)); si=re.search(r'si="(\d+)"',fm.group(1))
            if si: shared[si.group(1)]=(ref,formula)
        elif fe:
            si=re.search(r'si="(\d+)"',fe.group(1))
            if si and si.group(1) in shared: formula='(shared from %s) %s'%shared[si.group(1)]
        if formula is None: 
            if pat and not sheetf: continue
            if pat and not pat.search(str(val)): continue
            if not pat and not sheetf: continue
            print(f'{name}!{ref} = {val!r}'); continue
        if pat and not pat.search(formula) and not pat.search(str(val)): continue
        print(f'{name}!{ref}: ={formula[:600]}   -> {val!r}')
