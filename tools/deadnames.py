# For each workbook, report VEERG_*_Result_* defined names whose target cell does not exist in the sheet XML.
import zipfile,re,sys,html
for f in sys.argv[1:]:
    z=zipfile.ZipFile(f); wb=z.read('xl/workbook.xml').decode(); rels=z.read('xl/_rels/workbook.xml.rels').decode()
    sheets={}
    for n,rid in re.findall(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"',wb):
        t=re.search(r'Id="'+rid+r'"[^>]*Target="([^"]+)"',rels) or re.search(r'Target="([^"]+)"[^>]*Id="'+rid+'"',rels)
        sheets[html.unescape(n)]=z.read('xl/'+t.group(1).replace('/xl/','')).decode()
    dead=[]
    for name,ref in re.findall(r'<definedName [^>]*name="(VEERG_[^"]*_Result_[^"]*)"[^>]*>([^<]*)<',wb):
        m=re.match(r"'?(.+?)'?!\$([A-Z]+)\$(\d+)$",html.unescape(ref))
        if not m: continue
        sh,col,row=m.groups(); x=sheets.get(sh,'')
        c=re.search(r'<c r="'+col+row+r'"[^>]*?(?:/>|>(.*?)</c>)',x,flags=re.S)
        if not c or not c.group(1) or '<f' not in (c.group(1) or ''): dead.append(f'{name} -> {sh}!{col}{row}')
    print(f.split('_test')[0], ':', len(dead), 'result names without a formula cell'); [print('   ',d) for d in dead[:12]]
