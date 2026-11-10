# Extract paragraph text (including OMML equation text) from .docx files into .txt
import zipfile,re,sys,os,html
out=sys.argv[1]
for f in sys.argv[2:]:
    x=zipfile.ZipFile(f).read('word/document.xml').decode('utf8')
    paras=re.findall(r'<w:p[ >].*?</w:p>',x,flags=re.S)
    lines=[]
    for p in paras:
        t=''.join(re.findall(r'<(?:w|m):t(?: [^>]*)?>([^<]*)</(?:w|m):t>',p))
        if t.strip(): lines.append(html.unescape(t))
    open(os.path.join(out,os.path.basename(f)+'.txt'),'w',encoding='utf8').write('\n'.join(lines))
