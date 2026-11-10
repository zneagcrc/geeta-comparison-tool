# List the "Input" arguments declared in VEERG .xlf equation files (the *_Arguments MAKEARRAY tables), i.e. the
# methodology's input parameters in the document's own terms. Args: xlf files... [--all] (--all also lists
# Constant / Calculated arguments). Output: tab-separated equation, symbol, description, unit, kind.
import re, sys

args = sys.argv[1:]
show_all = '--all' in args
files = [a for a in args if a != '--all']
row = re.compile(r'"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"')
for f in files:
    text = open(f, encoding='utf-8-sig').read()
    for m in re.finditer(r'^(VEERG_[\w]+?)_Arguments\w*\s*\n\s*=\s*LAMBDA\((.*?)\n\s*\);', text, flags=re.S | re.M):
        name, body = m.group(1), m.group(2)
        for sym, desc, unit, kind in row.findall(body):
            if show_all or kind.strip().lower().startswith('input'):
                print('\t'.join([name, sym, desc.replace('""', '"'), unit, kind]))
