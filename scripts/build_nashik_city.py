#!/usr/bin/env python3
"""Nashik City Builder: OSM (Overpass JSON or GeoJSON) to playable city-world.json.

Python stdlib only. Network used only with --download; downloads are cached under
.city-cache for retries/resume. Coordinates use a stable WGS84 local metre frame.
This is a bounded *urban study area*, not a verified municipal boundary.
"""
import argparse, json, math, os, pathlib, subprocess, sys, time, tempfile, urllib.parse, urllib.request, urllib.error, gzip, lzma, xml.etree.ElementTree as ET
from collections import Counter

HERE=pathlib.Path(__file__).resolve().parents[1]
W,H=1175,1280
CENTER_LAT,CENTER_LON=20.0,73.79
SCALE=23.5 # fixed city-wide frame: 1 image pixel = 23.5 metres
BOUNDS=(19.91,73.67,20.09,73.915) # south, west, north, east
HIGHWAYS={'motorway','trunk','primary','secondary','tertiary','unclassified','residential','service','living_street',
          'motorway_link','trunk_link','primary_link','secondary_link','tertiary_link'}
WIDTH={'motorway':18,'trunk':14,'primary':12,'secondary':9,'tertiary':8,'residential':6,
       'service':3.5,'living_street':4,'unclassified':6,'motorway_link':8,'trunk_link':8,
       'primary_link':7,'secondary_link':6,'tertiary_link':5}
M_PER_DEG_LON=111195*math.cos(math.radians(CENTER_LAT))
M_PER_DEG_LAT=111195
CACHE=HERE/'.city-cache'
OVERPASS=("https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter")


def download_from_overpass(host, query, payload):
    """HTTPS download with periodic status and actionable errors (never bypass SSL).

    macOS uses Apple system curl. curl response bytes go to a temporary file
    to avoid deadlock on multi-megabyte Overpass responses.
    """
    agent='NashikFirstDriveCityImporter/2.0.2 (personal educational mapping project)'
    if sys.platform == 'darwin':
        try:
            with tempfile.TemporaryDirectory(prefix='nashik-osm-') as folder:
                output=pathlib.Path(folder)/'response.json'
                command=['curl','--silent','--show-error','--location',
                         '--connect-timeout','15','--max-time','120',
                         '--user-agent',agent,'--header','Accept: application/json',
                         '--data-urlencode','data='+query,
                         '--output',str(output),'--write-out','%{http_code}',host]
                proc=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                elapsed=0
                try:
                    while True:
                        try:
                            output_status,stderr=proc.communicate(timeout=12)
                            break
                        except subprocess.TimeoutExpired:
                            elapsed+=12
                            print(f'    ... connection active, {elapsed}s elapsed (server can be busy)',flush=True)
                except BaseException:
                    proc.kill()
                    proc.communicate()
                    raise
                status_text=output_status.decode('utf8',errors='replace').strip()
                detail=stderr.decode('utf8',errors='replace').strip()[:400]
                if proc.returncode:
                    raise RuntimeError(f'Network error {proc.returncode}: {detail or "request failed"}')
                try:
                    status=int(status_text)
                except ValueError as exc:
                    raise RuntimeError(f'Unexpected HTTP status: {status_text[:100]}') from exc
                body=output.read_bytes() if output.exists() else b''
                if status in (429,503):
                    raise urllib.error.HTTPError(host,status,'Overpass server busy',None,None)
                if status >= 400:
                    snippet=body[:160].decode('utf8',errors='replace').replace('\n',' ').strip()
                    raise urllib.error.HTTPError(host,status,f'Server rejected request: {snippet}',None,None)
                if not body:
                    raise RuntimeError(f'Empty map response (HTTP {status})')
                if len(body)>45*1024*1024:
                    raise ValueError('Map tile exceeded 45 MB; use a smaller tile')
                return body
        except FileNotFoundError as exc:
            raise RuntimeError('curl not available on this Mac') from exc
    req=urllib.request.Request(host,data=payload,headers={'User-Agent':agent})
    with urllib.request.urlopen(req,timeout=120) as res:
        return res.read(45*1024*1024+1)


def pixel(lon,lat):
    return [round(W/2+(lon-CENTER_LON)*M_PER_DEG_LON/SCALE,3),
            round(H/2-(lat-CENTER_LAT)*M_PER_DEG_LAT/SCALE,3)]


def is_coord(p):
    return isinstance(p,(list,tuple)) and len(p)>=2 and all(isinstance(c,(int,float)) and math.isfinite(c) for c in p[:2])


def polygons(features):
    for feature in features:
        p=feature.get('properties') or {}
        geometry=feature.get('geometry') or {}
        if not (p.get('building') not in (None,'no','false','0') or p.get('building:part') not in (None,'no','false')):
            continue
        if geometry.get('type')=='Polygon':
            rings=[geometry.get('coordinates',[])]
        elif geometry.get('type')=='MultiPolygon':
            rings=geometry.get('coordinates',[])
        else: continue
        for i,poly in enumerate(rings):
            if poly and poly[0] and len(poly[0])>3:
                yield str(feature.get('id') or p.get('osm_id') or id(feature))+'-'+str(i),poly[0],p


def by_feature(raw):
    if raw.get('type')=='FeatureCollection':
        yield from raw.get('features') or []
    elif raw.get('type')=='Feature':
        yield raw
    elif 'elements' in raw:
        for obj in raw['elements']:
            if obj.get('type')!='way': continue
            geom=obj.get('geometry') or []
            coords=[[v['lon'],v['lat']] for v in geom if 'lon' in v and 'lat' in v]
            if len(coords)<2: continue
            tags=obj.get('tags') or {}
            kind='Polygon' if tags.get('building') and len(coords)>3 and coords[0]==coords[-1] else 'LineString'
            yield {'type':'Feature','id':'way/'+str(obj['id']),'properties':tags,
                   'geometry':{'type':kind,'coordinates':[coords] if kind=='Polygon' else coords}}
    else: raise ValueError('Expected Overpass JSON or GeoJSON FeatureCollection')


def simplify(ring,min_dist=1.2):
    """Remove extremely close/collinear points without distorting footprint."""
    pts=[]
    for p in ring:
        if not is_coord(p): continue
        px=pixel(p[0],p[1]);
        if not pts or math.dist(pts[-1],px)*SCALE>min_dist: pts.append(px)
    if len(pts)>3 and math.dist(pts[0],pts[-1])*SCALE<min_dist: pts.pop()
    for _ in range(2):
        if len(pts)<4:break
        result=[]
        for i,b in enumerate(pts):
            a,c=pts[i-1],pts[(i+1)%len(pts)]
            cross=abs((c[0]-a[0])*(a[1]-b[1])-(a[0]-b[0])*(c[1]-a[1]))
            den=math.dist(a,c) or 1
            if cross/den*SCALE>.35: result.append(b)
        if len(result)<3:break
        pts=result
    return pts


def polygon_area(pts):
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(pts,pts[1:]+pts[:1])))*SCALE*SCALE/2


def as_height(tags):
    try:
        floors=int(float(tags.get('building:levels',3)))
        floors=max(1,min(16,floors))
    except (ValueError,TypeError):floors=3
    h=str(tags.get('height','')).lower().replace('m','').strip()
    try:height=float(h);height=height if 2.5<height<80 else floors*3.2
    except ValueError:height=floors*3.2
    return floors,round(height,2)


def osm_xml_features(path):
    """Read a locally downloaded BBBike OSM XML extract (.osm, .osm.gz or .osm.xz).

    No requests to Overpass are made. Only mapped road ways and closed building
    ways are retained. Multipolygon relations are not included in this v1 pass.
    """
    opener = gzip.open if path.name.endswith('.gz') else lzma.open if path.name.endswith('.xz') else open
    node_coords = {}
    used_ways = 0
    with opener(path, 'rb') as fh:
        try:
            for event, obj in ET.iterparse(fh, events=('end',)):
                tag = obj.tag.rsplit('}', 1)[-1]
                if tag == 'node':
                    lat,lon=obj.get('lat'),obj.get('lon')
                    if lat is not None and lon is not None:
                        node_coords[obj.get('id')]=(float(lon),float(lat))
                    obj.clear()
                elif tag == 'way':
                    props={child.get('k'): child.get('v') for child in obj if child.tag.rsplit('}',1)[-1]=='tag'}
                    hw=props.get('highway')
                    is_building=props.get('building') not in (None,'no','false','0') or props.get('building:part') not in (None,'no','false','0')
                    if hw in HIGHWAYS or is_building:
                        refs=[child.get('ref') for child in obj if child.tag.rsplit('}',1)[-1]=='nd']
                        coords=[node_coords[r] for r in refs if r in node_coords]
                        if len(coords)>=2:
                            # Import only features overlapping the bounded urban study area.
                            if any(BOUNDS[1]-.002 <= x <= BOUNDS[3]+.002 and BOUNDS[0]-.002 <= y <= BOUNDS[2]+.002 for x,y in coords):
                                closed=bool(is_building and len(coords)>=4 and refs[0]==refs[-1])
                                if closed and coords[0]!=coords[-1]:coords.append(coords[0])
                                feature={'type':'Feature','id':'way/'+str(obj.get('id')),'properties':props,'geometry':
                                    {'type':'Polygon' if closed else 'LineString',
                                     'coordinates':[coords] if closed else coords}}
                                used_ways+=1
                                yield feature
                    obj.clear()
                elif tag in ('relation','bounds'):
                    obj.clear()
        except ET.ParseError as exc:
            raise ValueError(f'Invalid or truncated OSM XML file: {path.name}') from exc
    print(f'Offline OSM XML: read {len(node_coords):,} nodes, retained {used_ways:,} road/building ways.',flush=True)


def features_from_file(source):
    name=source.name.lower()
    if name.endswith(('.osm', '.osm.gz', '.osm.xz', '.xml', '.xml.gz', '.xml.xz')):
        yield from osm_xml_features(source)
    elif name.endswith(('.json','.geojson', '.json.gz','.geojson.gz','.json.xz','.geojson.xz')):
        opener = gzip.open if name.endswith('.gz') else lzma.open if name.endswith('.xz') else open
        with opener(source,'rt',encoding='utf8') as f: raw=json.load(f)
        yield from by_feature(raw)
    else:
        raise ValueError(f'Unsupported file: {source.name}. Choose BBBike OSM XML gzip (.osm.gz) or GeoJSON.')


def convert(sources):
    roads_by_id={}; buildings_by_id={}; n=0
    for source in sources:
        print(f'Importing {source.name} ...',flush=True)
        for feat in features_from_file(source):
            n+=1
            tags=feat.get('properties') or {}; geometry=feat.get('geometry') or {}; feature_id=str(feat.get('id') or tags.get('osm_id') or n)
            hw=tags.get('highway')
            if hw in HIGHWAYS and geometry.get('type') in ('LineString','MultiLineString'):
                lines=[geometry['coordinates']] if geometry['type']=='LineString' else geometry['coordinates']
                for i,line in enumerate(lines):
                    ps=[pixel(q[0],q[1]) for q in line if is_coord(q)]
                    if len(ps)<2:continue
                    # Prevent accidental enormous malformed geometries.
                    if len(ps)>2000:ps=ps[::max(1,len(ps)//2000)]
                    rid=feature_id+':'+str(i)
                    try: w=float(str(tags.get('width','')).replace('m','').strip())
                    except (ValueError,TypeError):w=WIDTH[hw]
                    roads_by_id[rid]={'id':rid,'name':str(tags.get('name',''))[:90],
                        'highway':hw,'widthM':max(2,min(30,w)),'oneway':tags.get('oneway') in ('yes','1','true'),
                        'grade':str(tags.get('layer','0')),'points':ps}
            for bid,ring,bprops in polygons([feat]):
                p=simplify(ring)
                if len(p)<3 or len(p)>150 or polygon_area(p)<10:continue
                xs=[a[0] for a in p];ys=[a[1] for a in p]
                a,b,c,d=min(xs),min(ys),max(xs),max(ys)
                # avoid far-out edges accidentally imported by requests
                if not (-15<a<W+15 and -15<b<H+15 and -15<c<W+15 and -15<d<H+15):continue
                bw,bd=c-a,d-b
                if min(bw,bd)*SCALE<2.5 or max(bw,bd)*SCALE>400:continue
                floors,height=as_height(bprops)
                typ='commercial' if bprops.get('building') in ('retail','commercial','shop','office') else 'residential'
                cx,cy=(a+c)/2,(b+d)/2
                normalized=[[round((x-cx)/bw,5),round((y-cy)/bd,5)] for x,y in p]
                buildings_by_id[bid]=[round(cx,3),round(cy,3),round(bw,4),round(bd,4),height,
                    len(buildings_by_id)%5,0,floors,typ,round(height/floors,3),'custom',normalized,
                    {'windows':True,'roof':'flat','osmId':bid}]
    roads=list(roads_by_id.values()); buildings=list(buildings_by_id.values())
    # Start near College Road on an actual mapped road, not just at the city centre.
    target=pixel(73.75674115,20.0037423)
    best=None;bestd=10**10
    for r in roads:
        for a,b in zip(r['points'],r['points'][1:]):
            dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((target[0]-a[0])*dx+(target[1]-a[1])*dy)/(dx*dx+dy*dy or 1)))
            pos=[a[0]+dx*t,a[1]+dy*t];di=math.dist(target,pos)
            if di<bestd:
                bestd=di;best=[round(pos[0],2),round(pos[1],2),round((math.degrees(math.atan2(dx,dy))+360)%360,2)]
    spawn=best or [round(target[0],2),round(target[1],2),180]
    world={
      'version':5,'cityMode':True,'cityName':'Nashik','mapScale':SCALE,
      'roadNetwork':{'version':1,'source':'OpenStreetMap city-area extract','coordinateSystem':'game-pixels',
                     'metresPerPixel':SCALE,'center':{'lat':CENTER_LAT,'lon':CENTER_LON},'roads':roads},
      'blocks':buildings,'assets':[],
      'mapEdits':{'version':3,'spawn':spawn,'roadStrokes':[]},
      'cityBounds':{'south':BOUNDS[0],'west':BOUNDS[1],'north':BOUNDS[2],'east':BOUNDS[3]},
      'attribution':'© OpenStreetMap contributors — ODbL 1.0',
    }
    return world


def download_tiles():
    CACHE.mkdir(exist_ok=True)
    south,west,north,east=BOUNDS
    step_lat,step_lon=.035,.042
    tiles=[];lat=south;i=0
    while lat<north-1e-8:
        lon=west
        while lon<east-1e-8:
            tile=(round(lat,6),round(lon,6),round(min(north,lat+step_lat),6),round(min(east,lon+step_lon),6))
            tiles.append(tile);lon+=step_lon
        lat+=step_lat
    results=[]
    for i,(s,w,n,e) in enumerate(tiles):
        path=CACHE/f'part_{s}_{w}.json';results.append(path)
        if path.exists():
            print(f'[{i+1}/{len(tiles)}] Cached {path.name}',flush=True);continue
        # Highways + buildings only; no decorative POIs. Tile requests are deliberately modest.
        query=f'''[out:json][timeout:90];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]({s},{w},{n},{e});way["building"]({s},{w},{n},{e}););out geom;'''
        payload=urllib.parse.urlencode({'data':query}).encode('utf8')
        completed=False
        for attempt in range(6):
            host=OVERPASS[(i+attempt)%len(OVERPASS)]
            try:
                print(f'[{i+1}/{len(tiles)}] Fetching from {urllib.parse.urlsplit(host).hostname}, attempt {attempt+1}/6 ...',flush=True)
                out=download_from_overpass(host,query,payload)
                if len(out)>45*1024*1024: raise ValueError('Map tile too large')
                data=json.loads(out)
                if 'elements' not in data:raise ValueError('Missing elements')
                temp=path.with_suffix('.tmp');temp.write_bytes(out);temp.replace(path)
                print(f'[{i+1}/{len(tiles)}] Downloaded {len(data["elements"])} features',flush=True)
                completed=True;break
            except urllib.error.HTTPError as ex:
                retry_after=ex.headers.get('Retry-After') if ex.headers else None
                if ex.code in (429,503):
                    try: seconds=max(30,min(180,int(retry_after))) if retry_after else 35+attempt*8
                    except ValueError: seconds=35+attempt*8
                    print(f'[{i+1}/{len(tiles)}] Server is busy (HTTP {ex.code}). Waiting before retry; cached downloads are safe.',flush=True)
                    time.sleep(seconds)
                else:
                    print(f'[{i+1}/{len(tiles)}] HTTP error {ex.code}: {ex.reason}',flush=True)
                    if ex.code==406:
                        print('    This server refused the request; trying another Overpass host.',flush=True)
                        continue
                    time.sleep(min(3+attempt*3,20))
            except Exception as ex:
                print(f'[{i+1}/{len(tiles)}] Attempt {attempt+1} failed: {ex}',flush=True)
                time.sleep(min(3+attempt*3,20))
        if not completed:
            print('Download stopped; run the command again to resume from cached tiles.',file=sys.stderr)
            sys.exit(1)
        time.sleep(.4)
    return results


def main():
    parser=argparse.ArgumentParser(description='Build city-world.json from Nashik OSM road + building data')
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--download',action='store_true',help='Fetch the city area in resumable Overpass tiles')
    group.add_argument('--input',nargs='+',type=pathlib.Path,help='Existing .osm.gz / .osm.xz / .osm / .geojson / Overpass .json files')
    parser.add_argument('--output',type=pathlib.Path,default=HERE/'city-world.json')
    args=parser.parse_args()
    paths=download_tiles() if args.download else args.input
    for p in paths:
        if not p.exists():parser.error(f'Missing input {p}')
    print('Converting geographic data into unified metre-aligned Nashik world...',flush=True)
    world=convert(paths)
    if not world['roadNetwork']['roads']:raise RuntimeError('No compatible roads found in supplied data')
    args.output.write_text(json.dumps(world,separators=(',',':'),ensure_ascii=False),encoding='utf8')
    print(f'CITY READY: {len(world["roadNetwork"]["roads"]):,} roads / {len(world["blocks"]):,} buildings',flush=True)
    print(f'File: {args.output}',flush=True)
    print('Open http://localhost:8000/ — it will select city-world.json automatically.',flush=True)

if __name__=='__main__':main()
