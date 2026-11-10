# Build the VEERG input catalogue from the *_Arguments tables in GAF-VEERG-Functions/Modules/**/*.xlf.
# Usage: python -I tools/xlf-catalogue.py <Modules dir> <out dir>
# Writes <out>/veerg-inputs.json (every argument, with kind) and <out>/veerg-inputs.md (Input arguments by module
# section, plus the consistency checks: same symbol / different wording, same wording / different symbol, symbol
# reused for different things, non-standard "kind" values, encoding problems).
import json, os, re, sys
from collections import defaultdict

modules_dir, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)

ROW = re.compile(r'"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"')
BLOCK = re.compile(r'^\s*(VEERG_\w+?)_Arguments(\w*)\s*\n\s*=\s*LAMBDA\((.*?)\n\s*\);', re.S | re.M)
SECTION_NAMES = {
    '3.1': 'Enteric methane: beef feedlot', '3.2': 'Enteric methane: beef grazing', '3.3': 'Enteric methane: dairy',
    '3.4': 'Enteric methane: sheep', '3.5': 'Enteric methane: pigs', '3.6': 'Enteric methane: other livestock',
    '4.1': 'Manure: beef feedlot', '4.2': 'Manure: beef grazing', '4.3': 'Manure: dairy', '4.4': 'Manure: sheep',
    '4.5': 'Manure: pigs', '4.6': 'Manure: poultry', '4.7': 'Manure: other livestock',
    '5.1': 'Inorganic fertiliser', '5.2': 'Organic fertiliser', '5.3': 'Lime', '5.4': 'Atmospheric deposition',
    '5.5': 'Leaching and runoff', '6.1': 'Return of crop residues to soils', '6.2': 'Return of pasture residues to soils',
    '6.3': 'Leaching and run-off from crop and pasture residues', '6.4': 'Field burning of crop residues',
    '7.1': 'Rice cultivation', '8.1': 'Fuel: transport',
    '8.2': 'Fuel: stationary', '9.1': 'Refrigerants', '10.1': 'Solid waste', '11.1': 'Wastewater',
    '12.1': 'Supplementary CO2', '14.1': 'Electricity (scope 2)',
    '15.1': 'Scope 3: purchased livestock', '15.2': 'Scope 3: purchased feed',
    '15.3': 'Scope 3: purchased mineral supplements for livestock', '15.4': 'Scope 3: purchased fertiliser',
    '15.5': 'Scope 3: purchased agrichemicals', '15.6': 'Scope 3: purchased lime',
    '15.7': 'Scope 3: purchased services and contractors', '15.8': 'Scope 3: purchased packaging',
    '15.9': 'Scope 3: purchased grow media', '15.10': 'Scope 3: other purchased goods and services',
    '15.11': 'Scope 3: upstream emissions from fuel', '15.12': 'Scope 3: upstream emissions from purchased electricity',
    '15.13': 'Scope 3: management of waste', '15.14': 'Scope 3: upstream freight',
}

def section_of(name):
    m = re.match(r'VEERG_(\d+)_(\d+)', name)
    return f'{m.group(1)}.{m.group(2)}' if m else '?'

def eq_ref(name):
    m = re.match(r'VEERG_((?:\d+_)+)_(\d+)', name)
    return (m.group(1).rstrip('_').replace('_', '.') + f' ({m.group(2)})') if m else name

def norm(s):
    s = re.sub(r'\s+', ' ', s.strip().lower()).rstrip('.')
    return s

records = []
for root, _, files in os.walk(modules_dir):
    for f in sorted(files):
        if not f.endswith('.xlf'):
            continue
        path = os.path.join(root, f)
        text = open(path, encoding='utf-8-sig', errors='replace').read()
        for m in BLOCK.finditer(text):
            name, suffix, body = m.groups()
            for sym, desc, unit, kind in ROW.findall(body):
                records.append({
                    'section': section_of(name), 'equation': name, 'ref': eq_ref(name), 'variant': suffix.lstrip('_'),
                    'symbol': sym.strip(), 'description': desc.replace('""', '"').strip(), 'unit': unit.strip(),
                    'kind': kind.strip(), 'file': os.path.relpath(path, modules_dir).replace('\\', '/'),
                })

is_input = lambda r: r['kind'].lower().startswith('input')
json.dump(records, open(os.path.join(out_dir, 'veerg-inputs.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

inputs = [r for r in records if is_input(r)]
by_section = defaultdict(list)
for r in inputs:
    by_section[r['section']].append(r)
sec_key = lambda s: [int(x) if x.isdigit() else 0 for x in s.split('.')]

# ---- checks
issues = defaultdict(list)
for sec, rows in by_section.items():
    by_sym = defaultdict(set)
    for r in rows:
        by_sym[r['symbol']].add((norm(r['description']), r['unit']))
    for sym, variants in by_sym.items():
        if len(variants) > 1:
            issues['Same symbol, different description or unit'].append(
                (sec, sym, ' / '.join(sorted(f'"{d}" [{u}]' for d, u in variants))))
    by_desc = defaultdict(set)
    for r in rows:
        by_desc[norm(r['description'])].add(r['symbol'])
    for desc, syms in by_desc.items():
        if len(syms) > 1:
            issues['Same description, different symbols'].append((sec, ', '.join(sorted(syms)), f'"{desc}"'))
global_dims = defaultdict(set)
for r in inputs:
    if len(r['symbol']) <= 2:
        global_dims[r['symbol']].add(norm(r['description']))
for sym, meanings in sorted(global_dims.items()):
    if len(meanings) > 1:
        issues['Short symbol used for different things (across modules)'].append(('all', sym, ' / '.join(sorted(f'"{m}"' for m in meanings))))
for r in records:
    k = r['kind']
    if not (k in ('Input', 'Constant') or k.startswith('Calculated from') or k.startswith('Calculated by')):
        issues['Non-standard "kind" value'].append((r['section'], r['symbol'], f'{r["ref"]}: "{k}"'))
    for field in ('symbol', 'description', 'unit'):
        if '�' in r[field] or 'Â' in r[field]:
            issues['Encoding problem'].append((r['section'], r['symbol'], f'{r["ref"]} {field}: "{r[field]}"'))

# ---- markdown
md = ['# VEERG input catalogue', '',
      'Generated from the `*_Arguments` tables in `GAF-VEERG-Functions/Modules/**/*.xlf` by `tools/xlf-catalogue.py`.',
      'These are the methodology inputs in the document\'s own terms (arguments marked "Input"); constants and calculated',
      'values are in `veerg-inputs.json`.', '',
      'Single-letter subscripts (`i`, `j`, `z`, ...) are scoped to each equation, as in the documents, so the same letter can',
      'mean different things in different equations. In neutral scenarios those context inputs are keyed by their',
      'description (e.g. "state", "wet or dry climate zone") rather than the letter.', '',
      f'{len(records)} arguments in total, {len(inputs)} marked Input, {len({(r["section"], r["symbol"]) for r in inputs})} distinct section/symbol pairs.', '']
md += ['## Consistency checks', '']
if not issues:
    md += ['None found.', '']
for title, rows in issues.items():
    rows = sorted(set(rows), key=lambda x: (sec_key(x[0]) if x[0] != 'all' else [0], x[1]))
    md += [f'### {title} ({len(rows)})', '', '| Section | Symbol(s) | Detail |', '|---|---|---|']
    md += [f'| {a} | `{b}` | {c} |' for a, b, c in rows]
    md += ['']
md += ['## Inputs by section', '']
for sec in sorted(by_section, key=sec_key):
    rows = by_section[sec]
    md += [f'### {sec} {SECTION_NAMES.get(sec, "")}'.rstrip(), '', '| Symbol | Description | Unit | Used in |', '|---|---|---|---|']
    grouped = defaultdict(list)
    for r in rows:
        grouped[(r['symbol'], r['description'], r['unit'])].append(r['ref'] + (f' [{r["variant"]}]' if r['variant'] else ''))
    for (sym, desc, unit), refs in sorted(grouped.items(), key=lambda x: (x[0][0].lower(), x[0][1])):
        md += [f'| `{sym}` | {desc} | {unit} | {", ".join(sorted(set(refs)))} |']
    md += ['']
open(os.path.join(out_dir, 'veerg-inputs.md'), 'w', encoding='utf-8').write('\n'.join(md))
print(f'{len(records)} arguments, {len(inputs)} inputs; issues: ' + ', '.join(f'{k}: {len(set(v))}' for k, v in issues.items()))
