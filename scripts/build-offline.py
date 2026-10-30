#!/usr/bin/env python3
"""Rebuild the complete published-static-file offline manifest after edits."""
from pathlib import Path
from urllib.parse import quote
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
settings=json.loads((ROOT/'offline-settings.json').read_text())
public_extensions={'.html','.js','.mjs','.css','.json','.csv','.svg','.png','.jpg','.jpeg','.gif','.webp','.avif','.ico','.woff','.woff2','.ttf','.otf','.eot','.pdf','.webmanifest','.mp4','.webm','.mp3','.wav','.ogg','.m4a','.txt'}
excluded={'node_modules','graphify-out','.git','.github','app','scripts','tests','test','src','docs'}
files=[]
for file in ROOT.rglob('*'):
 relative=file.relative_to(ROOT)
 if not file.is_file() or any(part in excluded or part.startswith('.') for part in relative.parts):continue
 if file.name in {'sw.js','package.json','package-lock.json','offline-settings.json','offline-assets.json','fetch-concerns.mjs','sample-posts.json','AGENTS.md'}:continue
 if file.suffix.lower() in public_extensions:files.append(file)
files.sort()
html=[file for file in files if file.suffix.lower()=='.html']
for file in html:
 text=file.read_text()
 if 'data-offline-client' not in text:
  depth=len(file.relative_to(ROOT).parts)-1
  prefix='../'*depth
  text=re.sub(r'</head>',f'<meta name="offline-limits" content="{settings["limits"]}"><link rel="manifest" href="{prefix}manifest.webmanifest"><script data-offline-client src="{prefix}offline-client.js" defer></script></head>',text,count=1,flags=re.I)
  file.write_text(text)
digest=hashlib.sha256()
for file in files:digest.update(str(file.relative_to(ROOT)).encode());digest.update(file.read_bytes())
config={'app':settings['app'],'version':digest.hexdigest()[:20],'assets':[quote(str(file.relative_to(ROOT)).replace('\\','/')) for file in files],'pages':[quote(str(file.relative_to(ROOT)).replace('\\','/')) for file in html],'spa':settings.get('spa',False)}
template=(ROOT/'scripts/offline-worker-template.js').read_text()
(ROOT/'sw.js').write_text(template.replace('/* OFFLINE_CONFIG */',json.dumps(config,separators=(',',':'))))
(ROOT/'offline-assets.json').write_text(json.dumps({'version':config['version'],'files':len(files),'pages':len(html),'bytes':sum(file.stat().st_size for file in files)},indent=2)+'\n')
print(json.dumps({'app':settings['app'],'files':len(files),'pages':len(html),'bytes':sum(file.stat().st_size for file in files)}))
