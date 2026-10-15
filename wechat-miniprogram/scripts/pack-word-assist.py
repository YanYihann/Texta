"""Pack the existing PC dictionary without discarding words; no network/download."""
from pathlib import Path
import json
import shutil
source = Path(__file__).resolve().parents[2] / 'public' / 'vendor'
target = Path(__file__).resolve().parent.parent / 'miniprogram' / 'data'
words = sorted(set(w for w in (source / 'english-words.txt').read_text(encoding='utf8').splitlines() if w.isascii() and w.isalpha() and w.islower()))
previous = ''
rows = []
alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
for word in words:
    common = 0
    while common < min(len(previous), len(word), 35) and previous[common] == word[common]:
        common += 1
    rows.append(alphabet[common] + word[common:])
    previous = word
(target / 'english-words.js').write_text('// Front-coded PC dictionary. License: english-words.LICENSE.\nmodule.exports = ' + json.dumps('\n'.join(rows)) + ';\n', encoding='utf8')
shutil.copyfile(source / 'english-words.LICENSE', target / 'english-words.LICENSE')
print(f'Packed {len(words)} dictionary entries; {(target / "english-words.js").stat().st_size} bytes.')
