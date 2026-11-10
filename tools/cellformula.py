# Print the formula and cached value of specific cells. Args: workbook "Sheet name" CELL [CELL...]
import zipfile, re, sys, html
f, sheet, cells = sys.argv[1], sys.argv[2], sys.argv[3:]
z = zipfile.ZipFile(f)
wb = z.read('xl/workbook.xml').decode()
rels = z.read('xl/_rels/workbook.xml.rels').decode()
rid = re.search(r'name="' + re.escape(sheet) + r'"[^>]*r:id="([^"]+)"', wb).group(1)
t = re.search(r'Id="' + rid + r'"[^>]*Target="([^"]+)"', rels) or re.search(r'Target="([^"]+)"[^>]*Id="' + rid + '"', rels)
x = z.read('xl/' + t.group(1).replace('/xl/', '')).decode()
for c in cells:
    m = re.search(r'<c r="' + c + r'"[^>]*?(?:/>|>(.*?)</c>)', x, flags=re.S)
    body = (m.group(1) if m else '') or ''
    fm = re.search(r'<f[^>]*>(.*?)</f>', body, flags=re.S)
    v = re.search(r'<v>(.*?)</v>', body)
    print(c, '=', html.unescape(fm.group(1)) if fm else '(no formula)', '->', v.group(1) if v else '')
