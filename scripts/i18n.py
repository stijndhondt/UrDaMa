"""Merges translation entries into projects/web/public/i18n/{en,nl}.json (a dev helper).
Usage: python scripts/i18n.py path/to/entries.json   where entries = {"key.path": ["English", "Nederlands"], ...}
"""
import json, sys

def set_path(d, path, value):
    parts = path.split('.')
    for p in parts[:-1]:
        d = d.setdefault(p, {})
    d[parts[-1]] = value

entries = json.load(open(sys.argv[1], encoding='utf-8'))
for i, lang in enumerate(['en', 'nl']):
    f = f'projects/web/public/i18n/{lang}.json'
    data = json.load(open(f, encoding='utf-8'))
    for key, texts in entries.items():
        set_path(data, key, texts[i])
    with open(f, 'w', encoding='utf-8', newline='\n') as out:
        json.dump(data, out, ensure_ascii=False, indent=2)
        out.write('\n')
