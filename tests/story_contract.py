import json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
def exists_ref(value, root):
    value=str(value or '').strip()
    if not value or value.startswith(('http://','https://','blob:','data:')): return True
    p=pathlib.PurePosixPath(value.replace('\\\\','/'))
    if p.is_absolute() or '..' in p.parts: return False
    rel=value if value.startswith('assets/') else root+value
    return (ROOT/rel).is_file()
worlds={}
for p in (ROOT/'assets/TheGioi').glob('*/TheGioi.json'):
    try: worlds[json.loads(p.read_text(encoding='utf-8')).get('slug')]=json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: print('INVALID WORLD',p,e); sys.exit(1)
bad=[]; total=0
for p in sorted((ROOT/'assets/KichBan').glob('*/*.json')):
    total+=1
    try: d=json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: bad.append((str(p.relative_to(ROOT)),'invalid JSON',str(e))); continue
    if d.get('phien_ban')!=3: bad.append((str(p),'phien_ban must be 3',d.get('phien_ban')))
    world=worlds.get(d.get('world_id'));
    if not world: bad.append((str(p),'unknown world_id',d.get('world_id'))); continue
    chars=d.get('nhan_vat') or {}; known={str(c.get('character_id') or c.get('id')):c for c in world.get('characters',[])}
    for cid in chars:
        if cid not in known: bad.append((str(p),'character missing from world',cid))
    for i,row in enumerate(d.get('danh_sach') or [],1):
        where=f'{p.relative_to(ROOT)} line {i}'
        if row.get('nhan_vat') not in chars: bad.append((where,'unknown speaker',row.get('nhan_vat')))
        for spec in row.get('nhan_vat_hien_thi') or []:
            if spec.get('id') not in chars: bad.append((where,'unknown visible character',spec.get('id')))
            m=spec.get('motion') or {}; keys=m.get('keyframes') or []
            if keys and (len(keys)<2 or any(not 0<=float(k.get('t',-1))<=1 for k in keys) or any(float(keys[n].get('t',-1))>=float(keys[n+1].get('t',-1)) for n in range(len(keys)-1))): bad.append((where,'invalid character keyframes',spec.get('id')))
            if m and float(m.get('duration_seconds',1))<=0: bad.append((where,'invalid character motion duration',spec.get('id')))
        bg=str(row.get('anh_nen') or '')
        if bg and not exists_ref(bg,'assets/Nen/'): bad.append((where,'missing background',bg))
        for fx in row.get('hieu_ung_canh') or []:
            ref=fx if isinstance(fx,str) else (fx.get('file') or fx.get('path') or '')
            if ref and not exists_ref(ref,'assets/HieuUng/'): bad.append((where,'missing scene effect',ref))
        for key,folder in [('nhac_nen','assets/AmThanh/Nen/'),('hieu_ung_am_thanh','assets/AmThanh/HieuUng/')]:
            ref=(row.get('am_thanh') or {}).get(key,{}).get('tep','')
            if ref and not exists_ref(ref,folder): bad.append((where,'missing audio',ref))
        for obj in row.get('scene_objects') or []:
            ref=obj.get('asset') or obj.get('path') or obj.get('file') or ''
            if ref and not exists_ref(ref,''): bad.append((where,'missing scene object',ref))
        fx=row.get('hieu_ung') or {}
        if 'che_do' in (row.get('am_thanh') or {}): bad.append((where,'deprecated audio field che_do',None))
        if not all(isinstance(fx.get(k),list) for k in ('nhan_vat','nen','camera','moi_truong')): bad.append((where,'invalid effect arrays',None))
print(f'Checked {total} story JSON files')
for item in bad: print('FAIL',*item)
print('PASS story/asset contract' if not bad else f'FAIL {len(bad)} issues')
sys.exit(1 if bad else 0)
