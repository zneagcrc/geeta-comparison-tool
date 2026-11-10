# Dump a VEERG generated-sourcedata JSON: every table (or those whose name contains the 2nd arg) with source, variation and rows.
import json,sys
d=json.load(open(sys.argv[1]))
filt=sys.argv[2] if len(sys.argv)>2 else ''
for t in d['tables']:
    if filt and filt.lower() not in t['name'].lower(): continue
    print('TABLE',t['name'],'|',t.get('source',''),'|',t.get('variation','')[:300])
    print('   ',t['header'])
    for r in t['rows']: print('   ',r)
