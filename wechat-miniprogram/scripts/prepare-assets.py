"""Build local tab icons and copy the existing Texta Chinese policies verbatim."""
from pathlib import Path
from html.parser import HTMLParser
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parents[1]
assets = ROOT / 'miniprogram/assets'
assets.mkdir(parents=True, exist_ok=True)
for active, color in [(False, '#606963'), (True, '#386548')]:
    for name in ['write', 'book', 'user']:
        img = Image.new('RGBA', (192, 192))
        d = ImageDraw.Draw(img)
        if name == 'write':
            d.line([(44, 74), (44, 150), (142, 150), (142, 104)], fill=color, width=10, joint='curve')
            d.polygon([(76, 114), (85, 87), (136, 36), (157, 57), (106, 108)], outline=color, width=10)
            d.line([(124, 48), (145, 69)], fill=color, width=8)
        elif name == 'book':
            d.line([(96, 55), (96, 154)], fill=color, width=9)
            d.line([(96, 55), (65, 43), (30, 47), (30, 140), (66, 136), (96, 154), (126, 136), (162, 140), (162, 47), (126, 43), (96, 55)], fill=color, width=9, joint='curve')
        else:
            d.ellipse((67, 34, 125, 92), outline=color, width=9)
            d.arc((38, 98, 154, 204), 180, 360, fill=color, width=9)
            d.line([(38, 151), (154, 151)], fill=color, width=9)
        img.resize((64, 64), Image.Resampling.LANCZOS).save(assets / (name + ('-active' if active else '') + '.png'))

class PolicyParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.zh = False
        self.section = None
        self.heading = False
        self.sections = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('data-legal-lang') == 'en': self.zh = False
        if attrs.get('data-legal-lang') == 'zh': self.zh = True
        if self.zh and tag == 'section': self.section = {'title': '', 'text': ''}
        if self.section is not None:
            if tag == 'h2': self.heading = True
            if tag in ['p', 'li', 'tr']: self.section['text'] += '\n'
            if tag in ['td', 'th']: self.section['text'] += ' '
    def handle_endtag(self, tag):
        if tag == 'h2': self.heading = False
        if tag == 'section' and self.section is not None:
            self.section['text'] = self.section['text'].strip()
            self.sections.append(self.section)
            self.section = None
    def handle_data(self, data):
        if self.section is not None:
            self.section['title' if self.heading else 'text'] += data

source = ROOT.parent / 'public'
policies = {}
for name in ['privacy', 'terms']:
    parser = PolicyParser()
    parser.feed((source / (name + '.html')).read_text(encoding='utf-8'))
    assert parser.sections, 'No policy sections found'
    policies[name] = {'source': 'Texta public/' + name + '.html', 'sections': parser.sections}
data_dir = ROOT / 'miniprogram/data'
data_dir.mkdir(parents=True, exist_ok=True)
(data_dir / 'policies.js').write_text('module.exports = ' + json.dumps(policies, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')

for filename in ['project.config.json', 'project.private.config.json']:
    path = ROOT / filename
    if not path.exists():
        continue
    config = json.loads(path.read_text(encoding='utf-8-sig'))
    config['projectname'] = 'Texta小程序'
    if filename == 'project.config.json':
        config['description'] = 'Texta 词汇生成、双语阅读与生词复习小程序'
        config['setting']['useCompilerPlugins'] = []
    path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Prepared six native tab icons, full Chinese policies, and project names; AppID preserved.')
