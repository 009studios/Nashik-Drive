#!/usr/bin/env python3
"""Build seamless, unioned road surface geometry for the shipped world.json.
Uses Shapely only at authoring time; browsers need no Python or Shapely.
Geometry is rebuilt by running this script after a published road-network edit.
"""
import json, math, struct, pathlib
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles
base=pathlib.Path(__file__).resolve().parent.parent
world=json.loads((base/'world.json').read_text())
net=world['roadNetwork']; k=float(world['mapScale']); W=1175;H=1280
roads=net['roads']

def checksum(roads):
    # Same deterministic weighted sum as game.js (only 2 decimal-point precision needed).
    total=0; pts=0
    for i,r in enumerate(roads):
        total+=(i+1)*round(float(r.get('widthM',6))*100)
        for p in r['points']:
            pts+=1
            total+=round(float(p[0])*100)*31+round(float(p[1])*100)*17
    return f'{len(roads)}:{pts}:{total}'

def build(extra,path):
    buffers=[]
    for r in roads:
        pts=[]
        for p in r['points']:
            xy=((p[0]-W/2)*k,(p[1]-H/2)*k)
            if not pts or math.dist(pts[-1],xy)>0.035:pts.append(xy)
        if len(pts)<2:continue
        # Round ends & corners; union creates one plane at connected junctions.
        radius=max(2,min(35,float(r.get('widthM',6))))/2+extra/2
        buffers.append(LineString(pts).buffer(radius,cap_style='round',join_style='round',quad_segs=3))
    merged=unary_union(buffers)
    polygons=list(merged.geoms) if hasattr(merged,'geoms') else [merged]
    elevation=.046 if extra else .065
    arr=[]; count=0
    for poly in polygons:
        if not isinstance(poly, Polygon) or poly.is_empty:continue
        for triangle in constrained_delaunay_triangles(poly).geoms:
            coords=list(triangle.exterior.coords)[:3]
            if len(coords)!=3:continue
            for x,z in coords:arr.extend((x,elevation,z,0.,1.,0.))
            count+=1
    # We ship raw Float32 vertex buffers, directly usable by WebGL.
    with (base/path).open('wb') as out:out.write(struct.pack('<%sf'%len(arr),*arr))
    print(path,'triangles',count,'bytes',len(arr)*4)

build(1.2,'road-shoulder.bin')
build(0.,'road-surface.bin')
(base/'road-surface-meta.json').write_text(json.dumps({'signature':checksum(roads),'roads':len(roads),'scale':k,'source':'OpenStreetMap derived, local authoring geometry'},indent=2)+'\n')
print('signature',checksum(roads))
