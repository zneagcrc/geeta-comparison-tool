# Print LAMBDA definitions from .xlf files, skipping metadata (_Title, _Unit, ...). Args: files... [-k keep-regex]
import re,sys
args=sys.argv[1:]; keep=None
if '-k' in args: i=args.index('-k'); keep=re.compile(args[i+1]); args=args[:i]+args[i+2:]
SKIP=re.compile(r'_(Title|Variable|Unit|Source|ReadableEquation|LatexEquation|Variation|Arguments|Description)$')
for f in args:
    txt=open(f,encoding='utf-8-sig').read()
    txt=re.sub(r'/\*.*?\*/','',txt,flags=re.S)
    for m in re.finditer(r'^([A-Za-z_][\w.]*)\s*\n\s*=\s*(LAMBDA\(.*?\n\s*\);?|LAMBDA\(.*?\);)',txt,flags=re.S|re.M):
        name,body=m.group(1),m.group(2)
        if SKIP.search(name): continue
        if keep and not keep.search(name): continue
        print('##',name); print(body.strip()); print()
