# -*- coding: utf-8 -*-
"""把中国 GeoJSON 精简为可在 file:// 下直接 <script> 引入的 JS 全局变量。
坐标保留 2 位小数（约 1 km 精度），仅保留名称、几何与九段线标记。"""
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
src = json.load(open(os.path.join(BASE, 'china.json'), encoding='utf-8'))


def rnd(c):
    if isinstance(c, float):
        return round(c, 2)
    if isinstance(c, list):
        return [rnd(x) for x in c]
    return c


feats = []
for f in src['features']:
    g = f['geometry']
    props = f['properties']
    feats.append({
        'name': props.get('name', ''),
        'jd': props.get('adchar') == 'JD',
        'type': g['type'],
        'coords': rnd(g['coordinates'])
    })

js = 'window.CHINA_GEO = ' + \
    json.dumps({'features': feats}, ensure_ascii=False, separators=(',', ':')) + ';'
out_path = os.path.join(BASE, 'china-geo.js')
open(out_path, 'w', encoding='utf-8').write(js)
print('features:', len(feats))
print('china-geo.js: %.1f KB' % (len(js.encode('utf-8')) / 1024))
