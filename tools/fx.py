# Compact dump of a VEERG test input / scenario file: cells, then each table row with non-empty fields.
import json,sys
for f in sys.argv[1:]:
    d=json.load(open(f,encoding='utf-8-sig'))
    print('#####',f.split('/')[-1], '| extends:',d.get('ScenarioExtends'))
    for k,v in d.items():
        if k not in ('InputTables','ScenarioFiles','Scenarios','ScenarioName','ScenarioExtends','ScenarioDescription') and not k.startswith('X_Cell_Site_FarmName') and not k.startswith('X_Cell_Site_Reporting'): print(' ',k,'=',v)
    if 'ScenarioDescription' in d: print('  DESC:',d['ScenarioDescription'][:400])
    for t in d.get('InputTables',[]):
        body=t.get('Cols') or t.get('Rows') or {}
        print('  TABLE',t['TableName'],'(Replace)' if t.get('Replace') else '')
        for k,v in body.items():
            if isinstance(v,dict):
                v={a:b for a,b in v.items() if b not in ('',None,0)}
                if v: print('     ',k,v)
            else: print('     ',k,v)
