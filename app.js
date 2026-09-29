(() => {
'use strict';

const WORLD_URLS=[
 'https://raw.githubusercontent.com/TheTrueSize/natural-earth-vector/main/geojson/ne_110m_admin_0_countries.geojson',
 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson'
];
const VIETNAM_ISO='VNM',MAX_LAT=84.8;
const WB={population:'SP.POP.TOTL',gdp:'NY.GDP.MKTP.CD',gdppc:'NY.GDP.PCAP.CD'};
const ISLAND_REFS=[
  {name:'Hoàng Sa',coord:[112.3,16.5]},
  {name:'Trường Sa',coord:[114.2,10.2]}
];
const $=id=>document.getElementById(id);
const ui={
 select:$('countrySelect'),home:$('homeBtn'),targetName:$('targetName'),targetIso:$('targetIso'),
 vnArea:$('vnArea'),targetArea:$('targetArea'),areaRatio:$('areaRatio'),vnNorthSouth:$('vnNorthSouth'),targetNorthSouth:$('targetNorthSouth'),northSouthRatio:$('northSouthRatio'),
 vnPopulation:$('vnPopulation'),targetPopulation:$('targetPopulation'),populationRatio:$('populationRatio'),vnDensity:$('vnDensity'),targetDensity:$('targetDensity'),densityRatio:$('densityRatio'),
 vnGDP:$('vnGDP'),targetGDP:$('targetGDP'),gdpRatio:$('gdpRatio'),vnGDPpc:$('vnGDPpc'),targetGDPpc:$('targetGDPpc'),gdpPcRatio:$('gdpPcRatio'),
 footprintPopulation:$('footprintPopulation'),footprintNote:$('footprintNote'),
 distortion:$('distortionFactor'),distortionBar:$('distortionBar'),distortionText:$('distortionText'),projectionLabel:$('projectionLabel'),chart:$('distortionChart'),status:$('dataStatus'),
 loading:$('loading'),info:$('infoDialog'),infoBtn:$('infoBtn'),closeInfo:$('closeInfo'),mercatorBtn:$('mercatorBtn'),equalEarthBtn:$('equalEarthBtn'),mercator:$('map'),equalEarth:$('equalEarth'),
 compass:$('compass'),compassNeedle:$('compassNeedle'),rotationValue:$('rotationValue'),rotationRange:$('rotationRange'),resetRotation:$('resetRotation')
};

const map=Vietflex.vietflexMap('map',{
  useLegacyGoogleTiles:true,
  googleMapType:'roadmap',
  center:[17,106],
  zoom:4,
  minZoom:2,
  maxZoom:10,
  maxBounds:null,
  worldCopyJump:true,
  zoomControl:false,
  attributionControl:false
});
new Vietflex.ZoomControl({position:'topright'}).addTo(map);
new Vietflex.AttributionControl({position:'bottomright'}).addTo(map);

let world,countriesLayer,targetLayer,vnSource,vnCenter,vnAreaKm2=0,vnNorthSouthKm=0,vnOverlay,islandLayer;
let currentTarget,currentLat=17,currentLon=106,currentRotation=0,currentProjection='mercator',requestToken=0,isDraggingVN=false;
const indicatorCache=new Map();
let equalProjection,equalPath,equalSvg,equalWorldG,equalVnPath,equalIslandG;

const countryName=f=>f?.properties?.NAME_VI||f?.properties?.NAME||f?.properties?.ADMIN||'Không rõ';
const countryIso=f=>{const p=f?.properties||{};return String([p.ADM0_A3,p.ISO_A3,p.WB_A3,p.SOV_A3].find(v=>v&&v!=='-99')||'').toUpperCase()};
const fmt=(v,s='')=>Number.isFinite(v)?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(v)+s:'—';
function formatPopulation(v){if(!Number.isFinite(v))return'—';if(v>=1e9)return(v/1e9).toLocaleString('vi-VN',{maximumFractionDigits:2})+' tỷ';if(v>=1e6)return(v/1e6).toLocaleString('vi-VN',{maximumFractionDigits:1})+' triệu';return fmt(v)}
function formatUSD(v){if(!Number.isFinite(v))return'—';if(v>=1e12)return'$'+(v/1e12).toLocaleString('vi-VN',{maximumFractionDigits:2})+' nghìn tỷ';if(v>=1e9)return'$'+(v/1e9).toLocaleString('vi-VN',{maximumFractionDigits:1})+' tỷ';return'$'+fmt(v)}
function ratioText(a,b,A='Quốc gia đích',B='Việt Nam'){if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return'—';const r=a/b;if(Math.abs(r-1)<.01)return'Gần tương đương '+B;return r>=1?A+' ≈ '+r.toLocaleString('vi-VN',{maximumFractionDigits:2})+'× '+B:B+' ≈ '+(1/r).toLocaleString('vi-VN',{maximumFractionDigits:2})+'× '+A}
function areaKm2(f){try{return turf.area(f)/1e6}catch(_){return NaN}}
function centerOf(f){try{const c=turf.centerOfMass(f).geometry.coordinates;return[c[1],c[0]]}catch(_){const c=turf.centroid(f).geometry.coordinates;return[c[1],c[0]]}}
function flattenCoordinates(g){const out=[];const visit=x=>{if(!Array.isArray(x))return;if(typeof x[0]==='number'&&typeof x[1]==='number'){out.push(x);return}x.forEach(visit)};visit(g?.coordinates);return out}
function northSouthKm(f){const pts=flattenCoordinates(f?.geometry);if(!pts.length)return NaN;let n=pts[0],s=pts[0];for(const p of pts){if(p[1]>n[1])n=p;if(p[1]<s[1])s=p}return turf.distance(turf.point(s),turf.point(n),{units:'kilometers'})}

function lonLatToVec(lon,lat){const l=lon*Math.PI/180,p=lat*Math.PI/180,cp=Math.cos(p);return[cp*Math.cos(l),cp*Math.sin(l),Math.sin(p)]}
function vecToLonLat(v){const n=Math.hypot(...v)||1,x=v[0]/n,y=v[1]/n,z=v[2]/n;return[Math.atan2(y,x)*180/Math.PI,Math.asin(Math.max(-1,Math.min(1,z)))*180/Math.PI]}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],scale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
function rotationMapper(from,to){const a=lonLatToVec(...from),b=lonLatToVec(...to),v=cross(a,b),s=Math.hypot(...v),c=Math.max(-1,Math.min(1,dot(a,b)));if(s<1e-12){if(c>0)return x=>x;const axis0=Math.abs(a[0])<.8?[1,0,0]:[0,1,0],k0=cross(a,axis0),k=scale(k0,1/Math.hypot(...k0));return x=>add(scale(x,-1),scale(k,2*dot(k,x)))}const k=scale(v,1/s);return x=>add(add(scale(x,c),scale(cross(k,x),s)),scale(k,dot(k,x)*(1-c)))}
function rotateAroundAxis(v,axis,degrees){const t=degrees*Math.PI/180,c=Math.cos(t),s=Math.sin(t),k=axis;return add(add(scale(v,c),scale(cross(k,v),s)),scale(k,dot(k,v)*(1-c)))}
function pointTransformer(targetLat,targetLon,spin=currentRotation){
 const move=rotationMapper([vnCenter[1],vnCenter[0]],[targetLon,targetLat]);
 const axis=lonLatToVec(targetLon,targetLat);
 return ([lon,lat])=>vecToLonLat(rotateAroundAxis(move(lonLatToVec(lon,lat)),axis,spin));
}
function unwrapRing(ring,targetLon){let prev=null;return ring.map(([lon,lat])=>{while(lon-targetLon>180)lon-=360;while(lon-targetLon<-180)lon+=360;if(prev!==null){while(lon-prev>180)lon-=360;while(lon-prev<-180)lon+=360}prev=lon;return[lon,lat]})}
function transformedGeometry(g,targetLat,targetLon){const tx=pointTransformer(targetLat,targetLon),ring=r=>unwrapRing(r.map(tx),targetLon);if(g.type==='Polygon')return{type:'Polygon',coordinates:g.coordinates.map(ring)};if(g.type==='MultiPolygon')return{type:'MultiPolygon',coordinates:g.coordinates.map(p=>p.map(ring))};throw new Error('Unsupported geometry')}
function overlayFeature(){return{type:'Feature',properties:{name:'Việt Nam'},geometry:transformedGeometry(vnSource.geometry,currentLat,currentLon)}}
function transformedIslandRefs(){const tx=pointTransformer(currentLat,currentLon);return ISLAND_REFS.map(x=>({...x,coord:tx(x.coord)}))}
function mercatorAreaFactor(lat){const p=Math.min(MAX_LAT,Math.max(-MAX_LAT,lat))*Math.PI/180;return 1/Math.cos(p)**2}

async function fetchJsonWithTimeout(url,ms=9000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
 try{
  const r=await fetch(url,{signal:controller.signal,cache:'force-cache'});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const text=await r.text();
  if(!text||text.length<1000)throw new Error('Dữ liệu rỗng');
  const json=JSON.parse(text);
  if(!json||json.type!=='FeatureCollection'||!Array.isArray(json.features)||json.features.length<100)throw new Error('GeoJSON không hợp lệ');
  return json;
 }finally{clearTimeout(timer)}
}
async function loadWorld(){
 ui.loading.querySelector('strong').textContent='Đang nạp bản đồ thế giới…';
 try{
  return await Promise.any(WORLD_URLS.map(url=>fetchJsonWithTimeout(url)));
 }catch(err){
  throw new Error('Không thể tải dữ liệu bản đồ thế giới. Hãy tải lại trang hoặc kiểm tra kết nối mạng.');
 }
}

function renderChart(){const ls=[0,30,45,60,75],rows=ls.map(lat=>({lat,f:mercatorAreaFactor(lat)})),max=Math.max(...rows.map(r=>r.f));ui.chart.innerHTML=rows.map(r=>'<div class="chart-col"><div class="chart-bar-wrap"><div class="chart-bar" style="height:'+Math.max(3,r.f/max*72)+'px"></div></div><div class="chart-value">'+r.f.toFixed(r.f<10?2:1)+'×</div><div class="chart-label">'+r.lat+'°</div></div>').join('')}
function renderDistortion(){const f=mercatorAreaFactor(currentLat);if(currentProjection==='equalEarth'){ui.projectionLabel.textContent='Equal Earth';ui.distortion.textContent='1.00× diện tích';ui.distortionBar.style.width='4%';ui.distortionText.textContent='Equal Earth là phép chiếu equal-area.'}else{ui.projectionLabel.textContent='Mercator tại vị trí hiện tại';ui.distortion.textContent=f.toLocaleString('vi-VN',{maximumFractionDigits:2})+'×';ui.distortionBar.style.width=Math.max(4,Math.min(100,4+Math.log2(f)*17))+'%';ui.distortionText.textContent='Hệ số xấp xỉ theo diện tích: 1 / cos²(vĩ độ).'}}
function renderRotation(){ui.rotationValue.textContent=Math.round(currentRotation)+'°';ui.rotationRange.value=Math.round(currentRotation);ui.compassNeedle.style.transform='rotate('+currentRotation+'deg)';ui.compass.setAttribute('aria-valuenow',Math.round(currentRotation))}

function featureAt(lat,lon){const pt=turf.point([lon,lat]);for(const f of world.features){try{if((f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon')&&turf.booleanPointInPolygon(pt,f))return f}catch(_){}}return null}
function paintTarget(f){if(targetLayer)map.removeLayer(targetLayer);if(!f)return;targetLayer=new Vietflex.GeoJSON(f,{style:{color:'#1b6ca8',weight:2,fillColor:'#1b6ca8',fillOpacity:.12},interactive:false}).addTo(map);targetLayer.bringToBack()}

function startLeafletDrag(e){
 Vietflex.DomEvent.stop(e.originalEvent);isDraggingVN=true;map.dragging.disable();
 vnOverlay.eachLayer(l=>l.getElement?.()?.classList.add('dragging'));
}
function endLeafletDrag(){
 if(!isDraggingVN)return;isDraggingVN=false;map.dragging.enable();
 const f=featureAt(currentLat,currentLon)||vnSource;currentTarget=f;ui.select.value=f?countryIso(f):'';updateComparison(f);
}
map.on('pointermove',e=>{if(!isDraggingVN)return;currentLat=Math.max(-MAX_LAT,Math.min(MAX_LAT,e.latlng.lat));currentLon=e.latlng.lng;const f=featureAt(currentLat,currentLon);if(f)currentTarget=f;redrawAll(false);if(f){ui.targetName.textContent=countryName(f);ui.targetIso.textContent=countryIso(f)||'—'}});
map.on('pointerup',endLeafletDrag);map.on('pointercancel',endLeafletDrag);

function drawLeafletOverlay(){
 if(vnOverlay)map.removeLayer(vnOverlay);if(islandLayer)map.removeLayer(islandLayer);
 vnOverlay=new Vietflex.GeoJSON(overlayFeature(),{style:{color:'#a91017',weight:2,fillColor:'#d71920',fillOpacity:.43,className:'vn-draggable'},interactive:true}).addTo(map);
 vnOverlay.eachLayer(layer=>{layer.on('pointerdown',startLeafletDrag)});
 islandLayer=new Vietflex.LayerGroup(transformedIslandRefs().map(ref=>{
   const m=new Vietflex.CircleMarker([ref.coord[1],ref.coord[0]],{radius:5,color:'#fff',weight:2,fillColor:'#d71920',fillOpacity:1,className:'vn-draggable'}).bindTooltip(ref.name,{permanent:true,direction:'right',className:'vn-island-label'});
   m.on('pointerdown',startLeafletDrag);return m;
 })).addTo(map);
 vnOverlay.bringToFront();islandLayer.eachLayer(layer=>{if(typeof layer.bringToFront==='function')layer.bringToFront()});
}

function sizeEqualEarth(){if(!equalSvg)return;const b=ui.equalEarth.getBoundingClientRect(),w=Math.max(320,b.width),h=Math.max(240,b.height);equalSvg.attr('viewBox','0 0 '+w+' '+h);equalProjection.fitExtent([[18,18],[w-18,h-18]],{type:'Sphere'});equalPath.projection(equalProjection);equalSvg.select('.equal-sphere').attr('d',equalPath({type:'Sphere'}));equalSvg.select('.equal-graticule').attr('d',equalPath(d3.geoGraticule10()));equalWorldG.selectAll('path').attr('d',equalPath);redrawEqual()}
function initEqualEarth(){
 equalSvg=d3.select(ui.equalEarth);equalProjection=d3.geoEqualEarth();equalPath=d3.geoPath(equalProjection);
 equalSvg.append('path').attr('class','equal-sphere');equalSvg.append('path').attr('class','equal-graticule');equalWorldG=equalSvg.append('g');
 equalWorldG.selectAll('path').data(world.features).join('path').attr('class','equal-country').attr('d',d=>equalPath(d)).on('click',(ev,d)=>moveToFeature(d,true));
 equalVnPath=equalSvg.append('path').attr('class','equal-vn');
 equalIslandG=equalSvg.append('g');
 const drag=d3.drag().on('start',()=>equalVnPath.classed('dragging',true)).on('drag',event=>{const p=equalProjection.invert([event.x,event.y]);if(!p)return;currentLon=p[0];currentLat=Math.max(-89,Math.min(89,p[1]));const f=featureAt(currentLat,currentLon);if(f)currentTarget=f;redrawAll(false);if(f){ui.targetName.textContent=countryName(f);ui.targetIso.textContent=countryIso(f)||'—'}}).on('end',()=>{equalVnPath.classed('dragging',false);const f=featureAt(currentLat,currentLon)||vnSource;currentTarget=f;ui.select.value=f?countryIso(f):'';updateComparison(f)});
 equalVnPath.call(drag);equalIslandG.call(drag);
 sizeEqualEarth();new ResizeObserver(sizeEqualEarth).observe(ui.equalEarth);
}
function redrawEqual(){
 if(!equalPath||!vnSource)return;
 equalWorldG.selectAll('path').classed('target',d=>currentTarget&&countryIso(d)===countryIso(currentTarget));
 equalVnPath.attr('d',equalPath(overlayFeature()));
 const refs=transformedIslandRefs(),groups=equalIslandG.selectAll('g').data(refs,d=>d.name).join(enter=>{const g=enter.append('g');g.append('circle').attr('class','equal-island').attr('r',5);g.append('text').attr('class','equal-island-label').attr('dx',8).attr('dy',3);return g});
 groups.each(function(d){const p=equalProjection(d.coord);if(!p)return;d3.select(this).attr('transform','translate('+p[0]+','+p[1]+')').select('text').text(d.name)});
}
function redrawAll(updateCompare=false){drawLeafletOverlay();redrawEqual();renderDistortion();renderRotation();if(updateCompare&&currentTarget)updateComparison(currentTarget)}

function naturalEarthPopulation(f){const p=f?.properties||{},v=Number(p.POP_EST),y=Number(p.POP_YEAR)||null;return Number.isFinite(v)&&v>0?{value:v,year:y,source:'Natural Earth'}:null}
async function getIndicator(f,indicator){const iso=countryIso(f),key=iso+'|'+indicator;if(!iso)return null;if(indicatorCache.has(key))return indicatorCache.get(key);const promise=(async()=>{try{const r=await fetch('https://api.worldbank.org/v2/country/'+encodeURIComponent(iso)+'/indicator/'+indicator+'?format=json&per_page=70');if(!r.ok)throw 0;const j=await r.json(),rows=Array.isArray(j)&&Array.isArray(j[1])?j[1]:[],row=rows.find(x=>x&&x.value!==null&&Number.isFinite(Number(x.value)));if(row)return{value:Number(row.value),year:Number(row.date),source:'World Bank'}}catch(_){}if(indicator===WB.population)return naturalEarthPopulation(f);return null})();indicatorCache.set(key,promise);return promise}
function intersectionAreaKm2(a,b){try{const i=turf.intersect(turf.featureCollection([a,b]));return i?areaKm2(i):0}catch(_){return NaN}}
async function updateComparison(feature){
 currentTarget=feature||vnSource;paintTarget(currentTarget);redrawEqual();
 const name=countryName(currentTarget),iso=countryIso(currentTarget)||'—',ta=areaKm2(currentTarget),tns=northSouthKm(currentTarget);
 ui.targetName.textContent=name;ui.targetIso.textContent=iso;ui.vnArea.textContent=fmt(vnAreaKm2,' km²');ui.targetArea.textContent=fmt(ta,' km²');ui.areaRatio.textContent=ratioText(ta,vnAreaKm2,name,'Việt Nam');
 ui.vnNorthSouth.textContent=fmt(vnNorthSouthKm,' km');ui.targetNorthSouth.textContent=fmt(tns,' km');ui.northSouthRatio.textContent=ratioText(tns,vnNorthSouthKm,name,'Việt Nam');
 const token=++requestToken,[vp,tp,vg,tg,vpc,tpc]=await Promise.all([getIndicator(vnSource,WB.population),getIndicator(currentTarget,WB.population),getIndicator(vnSource,WB.gdp),getIndicator(currentTarget,WB.gdp),getIndicator(vnSource,WB.gdppc),getIndicator(currentTarget,WB.gdppc)]);if(token!==requestToken)return;
 const V=vp?.value,T=tp?.value,vd=Number.isFinite(V)?V/vnAreaKm2:NaN,td=Number.isFinite(T)?T/ta:NaN;
 ui.vnPopulation.textContent=formatPopulation(V);ui.targetPopulation.textContent=formatPopulation(T);ui.populationRatio.textContent=ratioText(T,V,name,'Việt Nam')+(tp?.year?' · '+tp.year:'');
 ui.vnDensity.textContent=fmt(vd,' người/km²');ui.targetDensity.textContent=fmt(td,' người/km²');ui.densityRatio.textContent=ratioText(td,vd,name,'Việt Nam');
 ui.vnGDP.textContent=formatUSD(vg?.value);ui.targetGDP.textContent=formatUSD(tg?.value);ui.gdpRatio.textContent=ratioText(tg?.value,vg?.value,name,'Việt Nam')+(tg?.year?' · '+tg.year:'');
 ui.vnGDPpc.textContent=formatUSD(vpc?.value);ui.targetGDPpc.textContent=formatUSD(tpc?.value);ui.gdpPcRatio.textContent=ratioText(tpc?.value,vpc?.value,name,'Việt Nam')+(tpc?.year?' · '+tpc.year:'');
 const overlap=intersectionAreaKm2(overlayFeature(),currentTarget),fp=Number.isFinite(overlap)&&Number.isFinite(td)?overlap*td:NaN;ui.footprintPopulation.textContent=formatPopulation(fp);ui.footprintNote.textContent=Number.isFinite(overlap)?'Ước tính từ '+fmt(overlap,' km²')+' footprint nằm trong '+name+' × mật độ trung bình quốc gia.':'Không tính được phần giao hình học.';
 ui.status.textContent='Natural Earth · World Bank '+(tp?.year||'')+' · '+(currentProjection==='mercator'?'Vietflex / Google Roadmap':'D3 / Equal Earth');
}
function moveToFeature(f,fit=false){if(!f)return;const [lat,lon]=centerOf(f);currentTarget=f;currentLat=lat;currentLon=lon;redrawAll();updateComparison(f);ui.select.value=countryIso(f);if(currentProjection==='mercator'&&fit){const b=new Vietflex.GeoJSON(f).getBounds();if(b.isValid())map.fitBounds(b.pad(.45),{maxZoom:5,animate:true})}}
function switchProjection(mode){currentProjection=mode;const m=mode==='mercator';ui.mercator.classList.toggle('active',m);ui.equalEarth.classList.toggle('active',!m);ui.mercatorBtn.classList.toggle('active',m);ui.equalEarthBtn.classList.toggle('active',!m);if(m)setTimeout(()=>map.invalidateSize(),0);else setTimeout(sizeEqualEarth,0);renderDistortion()}

function setRotation(deg,update=true){currentRotation=((Number(deg)%360)+360)%360;redrawAll(false);if(update&&currentTarget)updateComparison(currentTarget)}
function compassAngleFromEvent(ev){const r=ui.compass.getBoundingClientRect(),x=ev.clientX-(r.left+r.width/2),y=ev.clientY-(r.top+r.height/2);return(Math.atan2(x,-y)*180/Math.PI+360)%360}
let compassDragging=false;
ui.compass.addEventListener('pointerdown',ev=>{compassDragging=true;ui.compass.setPointerCapture(ev.pointerId);setRotation(compassAngleFromEvent(ev),false)});
ui.compass.addEventListener('pointermove',ev=>{if(compassDragging)setRotation(compassAngleFromEvent(ev),false)});
ui.compass.addEventListener('pointerup',ev=>{compassDragging=false;ui.compass.releasePointerCapture(ev.pointerId);if(currentTarget)updateComparison(currentTarget)});
ui.compass.addEventListener('keydown',ev=>{if(ev.key==='ArrowRight'||ev.key==='ArrowUp'){ev.preventDefault();setRotation(currentRotation+5)}if(ev.key==='ArrowLeft'||ev.key==='ArrowDown'){ev.preventDefault();setRotation(currentRotation-5)}});
ui.rotationRange.addEventListener('input',()=>setRotation(ui.rotationRange.value,false));ui.rotationRange.addEventListener('change',()=>currentTarget&&updateComparison(currentTarget));ui.resetRotation.addEventListener('click',()=>setRotation(0));

function populateSelect(){const items=world.features.map(f=>({name:countryName(f),iso:countryIso(f)})).filter(x=>x.iso).sort((a,b)=>a.name.localeCompare(b.name,'vi'));ui.select.innerHTML='<option value="">Chọn quốc gia…</option>'+items.map(x=>'<option value="'+x.iso+'">'+String(x.name).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</option>').join('');ui.select.value=VIETNAM_ISO}
async function init(){
 try{
  renderChart();world=await loadWorld();
  vnSource=world.features.find(f=>countryIso(f)===VIETNAM_ISO||countryName(f).toLowerCase().includes('vietnam'));if(!vnSource)throw new Error('Không tìm thấy polygon Việt Nam');
  vnCenter=centerOf(vnSource);vnAreaKm2=areaKm2(vnSource);vnNorthSouthKm=northSouthKm(vnSource);currentLat=vnCenter[0];currentLon=vnCenter[1];currentTarget=vnSource;
  countriesLayer=new Vietflex.GeoJSON(world,{style:{color:'#728078',weight:.65,fillColor:'#fff',fillOpacity:.08},onEachFeature:(f,l)=>{l.on('click',()=>moveToFeature(f,true));l.bindTooltip(countryName(f),{sticky:true})}}).addTo(map);
  populateSelect();initEqualEarth();redrawAll();await updateComparison(vnSource);map.fitBounds(new Vietflex.GeoJSON(vnSource).getBounds().pad(.9),{maxZoom:5});
  ui.loading.classList.add('hidden');setTimeout(()=>ui.loading.remove(),350);
 }catch(err){ui.loading.innerHTML='<strong>Không thể khởi tạo</strong><span>'+String(err.message||err)+'</span>'}
}
ui.select.addEventListener('change',()=>{const f=world?.features?.find(x=>countryIso(x)===ui.select.value);if(f)moveToFeature(f,true)});
ui.home.addEventListener('click',()=>{currentRotation=0;moveToFeature(vnSource,true)});
ui.mercatorBtn.addEventListener('click',()=>switchProjection('mercator'));ui.equalEarthBtn.addEventListener('click',()=>switchProjection('equalEarth'));
ui.infoBtn.addEventListener('click',()=>ui.info.showModal());ui.closeInfo.addEventListener('click',()=>ui.info.close());ui.info.addEventListener('click',e=>{if(e.target===ui.info)ui.info.close()});
init();
})();