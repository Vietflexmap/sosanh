(() => {
  'use strict';

  const WORLD_URL = 'https://raw.githubusercontent.com/TheTrueSize/natural-earth-vector/main/geojson/ne_50m_admin_0_countries.geojson';
  const VIETNAM_ISO = 'VNM';
  const MAX_LAT = 84.8;
  const WB = {
    population: 'SP.POP.TOTL',
    gdp: 'NY.GDP.MKTP.CD',
    gdppc: 'NY.GDP.PCAP.CD'
  };

  const $ = id => document.getElementById(id);
  const ui = {
    select:$('countrySelect'), home:$('homeBtn'), targetName:$('targetName'), targetIso:$('targetIso'),
    vnArea:$('vnArea'), targetArea:$('targetArea'), areaRatio:$('areaRatio'),
    vnNorthSouth:$('vnNorthSouth'), targetNorthSouth:$('targetNorthSouth'), northSouthRatio:$('northSouthRatio'),
    vnPopulation:$('vnPopulation'), targetPopulation:$('targetPopulation'), populationRatio:$('populationRatio'),
    vnDensity:$('vnDensity'), targetDensity:$('targetDensity'), densityRatio:$('densityRatio'),
    vnGDP:$('vnGDP'), targetGDP:$('targetGDP'), gdpRatio:$('gdpRatio'),
    vnGDPpc:$('vnGDPpc'), targetGDPpc:$('targetGDPpc'), gdpPcRatio:$('gdpPcRatio'),
    footprintPopulation:$('footprintPopulation'), footprintNote:$('footprintNote'),
    distortion:$('distortionFactor'), distortionBar:$('distortionBar'), distortionText:$('distortionText'), projectionLabel:$('projectionLabel'),
    chart:$('distortionChart'), status:$('dataStatus'), loading:$('loading'),
    info:$('infoDialog'), infoBtn:$('infoBtn'), closeInfo:$('closeInfo'),
    mercatorBtn:$('mercatorBtn'), equalEarthBtn:$('equalEarthBtn'),
    mercator:$('map'), equalEarth:$('equalEarth')
  };

  const map = L.map('map',{zoomControl:false,minZoom:2,maxZoom:10,worldCopyJump:true}).setView([17,106],4);
  L.control.zoom({position:'topright'}).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);

  let world, countriesLayer, targetLayer, vnSource, vnCenter, vnAreaKm2=0, vnNorthSouthKm=0, vnOverlay, handle;
  let currentTarget, currentLat=17, currentLon=106, currentProjection='mercator', requestToken=0;
  const indicatorCache = new Map();
  let equalProjection, equalPath, equalSvg, equalWorldG, equalTargetPath, equalVnPath, equalHandle;

  const countryName = f => f?.properties?.NAME_VI || f?.properties?.NAME || f?.properties?.ADMIN || 'Không rõ';
  const countryIso = f => {
    const p=f?.properties||{};
    return String([p.ADM0_A3,p.ISO_A3,p.WB_A3,p.SOV_A3].find(v=>v&&v!=='-99')||'').toUpperCase();
  };

  function formatArea(v){return Number.isFinite(v)?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(v)+' km²':'—'}
  function formatDistance(v){return Number.isFinite(v)?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(v)+' km':'—'}
  function formatPopulation(v){if(!Number.isFinite(v))return'—';if(v>=1e9)return(v/1e9).toLocaleString('vi-VN',{maximumFractionDigits:2})+' tỷ';if(v>=1e6)return(v/1e6).toLocaleString('vi-VN',{maximumFractionDigits:1})+' triệu';return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(v)}
  function formatDensity(v){return Number.isFinite(v)?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(v)+' người/km²':'—'}
  function formatUSD(v){if(!Number.isFinite(v))return'—';if(v>=1e12)return'$'+(v/1e12).toLocaleString('vi-VN',{maximumFractionDigits:2})+' nghìn tỷ';if(v>=1e9)return'$'+(v/1e9).toLocaleString('vi-VN',{maximumFractionDigits:1})+' tỷ';if(v>=1e6)return'$'+(v/1e6).toLocaleString('vi-VN',{maximumFractionDigits:1})+' triệu';return'$'+new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(v)}
  function formatUSDpc(v){return Number.isFinite(v)?'$'+new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(v):'—'}
  function ratioText(a,b,labelA='Quốc gia đích',labelB='Việt Nam'){if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return'—';const r=a/b;if(Math.abs(r-1)<.01)return'Gần tương đương '+labelB;return r>=1?labelA+' ≈ '+r.toLocaleString('vi-VN',{maximumFractionDigits:2})+'× '+labelB:labelB+' ≈ '+(1/r).toLocaleString('vi-VN',{maximumFractionDigits:2})+'× '+labelA}
  function areaKm2(feature){try{return turf.area(feature)/1e6}catch(_){return NaN}}
  function centerOf(feature){try{const c=turf.centerOfMass(feature).geometry.coordinates;return[c[1],c[0]]}catch(_){const c=turf.centroid(feature).geometry.coordinates;return[c[1],c[0]]}}

  function flattenCoordinates(geometry){
    const out=[];
    const visit=x=>{
      if(!Array.isArray(x))return;
      if(typeof x[0]==='number'&&typeof x[1]==='number'){out.push(x);return}
      x.forEach(visit);
    };
    visit(geometry?.coordinates);
    return out;
  }

  function northSouthKm(feature){
    const pts=flattenCoordinates(feature?.geometry);
    if(!pts.length)return NaN;
    let north=pts[0],south=pts[0];
    for(const p of pts){if(p[1]>north[1])north=p;if(p[1]<south[1])south=p}
    return turf.distance(turf.point(south),turf.point(north),{units:'kilometers'});
  }

  function lonLatToVec(lon,lat){const l=lon*Math.PI/180,p=lat*Math.PI/180,cp=Math.cos(p);return[cp*Math.cos(l),cp*Math.sin(l),Math.sin(p)]}
  function vecToLonLat(v){const n=Math.hypot(v[0],v[1],v[2])||1,x=v[0]/n,y=v[1]/n,z=v[2]/n;return[Math.atan2(y,x)*180/Math.PI,Math.asin(Math.max(-1,Math.min(1,z)))*180/Math.PI]}
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const scale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];

  function rotationMapper(fromLonLat,toLonLat){
    const a=lonLatToVec(fromLonLat[0],fromLonLat[1]),b=lonLatToVec(toLonLat[0],toLonLat[1]),v=cross(a,b),s=Math.hypot(v[0],v[1],v[2]),c=Math.max(-1,Math.min(1,dot(a,b)));
    if(s<1e-12){
      if(c>0)return x=>x;
      const axis0=Math.abs(a[0])<.8?[1,0,0]:[0,1,0],k0=cross(a,axis0),kn=Math.hypot(...k0),k=scale(k0,1/kn);
      return x=>add(scale(x,-1),scale(k,2*dot(k,x)));
    }
    const k=scale(v,1/s);
    return x=>add(add(scale(x,c),scale(cross(k,x),s)),scale(k,dot(k,x)*(1-c)));
  }

  function unwrapRing(ring,targetLon){let prev=null;return ring.map(([lon,lat])=>{while(lon-targetLon>180)lon-=360;while(lon-targetLon<-180)lon+=360;if(prev!==null){while(lon-prev>180)lon-=360;while(lon-prev<-180)lon+=360}prev=lon;return[lon,lat]})}
  function rotateGeometry(geometry,targetLat,targetLon){
    const mapper=rotationMapper([vnCenter[1],vnCenter[0]],[targetLon,targetLat]);
    const rotateRing=ring=>unwrapRing(ring.map(([lon,lat])=>vecToLonLat(mapper(lonLatToVec(lon,lat)))),targetLon);
    if(geometry.type==='Polygon')return{type:'Polygon',coordinates:geometry.coordinates.map(rotateRing)};
    if(geometry.type==='MultiPolygon')return{type:'MultiPolygon',coordinates:geometry.coordinates.map(poly=>poly.map(rotateRing))};
    throw new Error('Chỉ hỗ trợ Polygon/MultiPolygon');
  }
  function overlayFeature(lat,lon){return{type:'Feature',properties:{name:'Việt Nam — kích thước thật'},geometry:rotateGeometry(vnSource.geometry,lat,lon)}}
  function mercatorAreaFactor(lat){const p=Math.min(MAX_LAT,Math.max(-MAX_LAT,lat))*Math.PI/180;return 1/Math.pow(Math.cos(p),2)}

  function renderChart(){
    const lats=[0,30,45,60,75],rows=lats.map(lat=>({lat,f:mercatorAreaFactor(lat)})),max=Math.max(...rows.map(r=>r.f));
    ui.chart.innerHTML=rows.map(r=>'<div class="chart-col"><div class="chart-bar-wrap"><div class="chart-bar" style="height:'+Math.max(3,r.f/max*72)+'px"></div></div><div class="chart-value">'+r.f.toFixed(r.f<10?2:1)+'×</div><div class="chart-label">'+r.lat+'°</div></div>').join('');
  }

  function renderDistortion(lat){
    const f=mercatorAreaFactor(lat);
    if(currentProjection==='equalEarth'){
      ui.projectionLabel.textContent='Equal Earth';
      ui.distortion.textContent='1.00× diện tích';
      ui.distortionBar.style.width='4%';
      ui.distortionText.textContent='Equal Earth là phép chiếu equal-area: diện tích tương đối được bảo toàn theo mô hình phép chiếu.';
    }else{
      ui.projectionLabel.textContent='Mercator tại vị trí hiện tại';
      ui.distortion.textContent=f.toLocaleString('vi-VN',{maximumFractionDigits:2})+'×';
      ui.distortionBar.style.width=Math.max(4,Math.min(100,4+Math.log2(f)*17))+'%';
      ui.distortionText.textContent='Hệ số xấp xỉ theo diện tích: 1 / cos²(vĩ độ).';
    }
  }

  function featureAt(lat,lon){
    const pt=turf.point([lon,lat]);
    for(const f of world.features){try{if((f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon')&&turf.booleanPointInPolygon(pt,f))return f}catch(_){}}
    return null;
  }

  function updateMercatorOverlay(lat,lon,duringDrag=false){
    if(vnOverlay)map.removeLayer(vnOverlay);
    vnOverlay=L.geoJSON(overlayFeature(lat,lon),{style:{color:'#a91017',weight:2,fillColor:'#d71920',fillOpacity:.43},interactive:false}).addTo(map);
    if(!duringDrag){vnOverlay.bringToFront();handle?.bringToFront?.()}
  }

  function paintMercatorTarget(feature){
    if(targetLayer)map.removeLayer(targetLayer);
    if(!feature)return;
    targetLayer=L.geoJSON(feature,{style:{color:'#1b6ca8',weight:2,fillColor:'#1b6ca8',fillOpacity:.12},interactive:false}).addTo(map);
    targetLayer.bringToBack();
  }

  function sizeEqualEarth(){
    if(!equalSvg)return;
    const box=ui.equalEarth.getBoundingClientRect(),w=Math.max(320,box.width),h=Math.max(240,box.height);
    equalSvg.attr('viewBox','0 0 '+w+' '+h);
    equalProjection.fitExtent([[18,18],[w-18,h-18]],{type:'Sphere'});
    equalPath.projection(equalProjection);
    equalSvg.select('.equal-sphere').attr('d',equalPath({type:'Sphere'}));
    equalSvg.select('.equal-graticule').attr('d',equalPath(d3.geoGraticule10()));
    equalWorldG.selectAll('path').attr('d',equalPath);
    redrawEqual();
  }

  function initEqualEarth(){
    equalSvg=d3.select(ui.equalEarth);
    equalProjection=d3.geoEqualEarth();
    equalPath=d3.geoPath(equalProjection);
    equalSvg.append('path').attr('class','equal-sphere');
    equalSvg.append('path').attr('class','equal-graticule');
    equalWorldG=equalSvg.append('g');
    equalWorldG.selectAll('path').data(world.features).join('path').attr('class','equal-country')
      .attr('data-iso',d=>countryIso(d))
      .on('click',(event,d)=>moveToFeature(d,true));
    equalTargetPath=equalSvg.append('path').attr('class','equal-country target').style('pointer-events','none');
    equalVnPath=equalSvg.append('path').attr('class','equal-vn');
    equalHandle=equalSvg.append('circle').attr('class','equal-handle').attr('r',10);

    equalHandle.call(d3.drag().on('drag',event=>{
      const p=equalProjection.invert([event.x,event.y]);
      if(!p)return;
      currentLon=p[0];currentLat=Math.max(-89,Math.min(89,p[1]));
      const f=featureAt(currentLat,currentLon);
      if(f)currentTarget=f;
      redrawEqual();
      renderDistortion(currentLat);
    }).on('end',()=>{
      const f=featureAt(currentLat,currentLon);
      updateComparison(f||vnSource);
      ui.select.value=f?countryIso(f):'';
    }));

    sizeEqualEarth();
    new ResizeObserver(sizeEqualEarth).observe(ui.equalEarth);
  }

  function redrawEqual(){
    if(!equalPath||!vnSource)return;
    equalWorldG.selectAll('path').classed('target',d=>currentTarget&&countryIso(d)===countryIso(currentTarget));
    equalTargetPath.attr('d',currentTarget?equalPath(currentTarget):null);
    equalVnPath.attr('d',equalPath(overlayFeature(currentLat,currentLon)));
    const p=equalProjection([currentLon,currentLat]);if(p)equalHandle.attr('cx',p[0]).attr('cy',p[1]);
  }

  function updateOverlay(lat,lon,duringDrag=false){
    currentLat=Math.max(-MAX_LAT,Math.min(MAX_LAT,lat));currentLon=lon;
    updateMercatorOverlay(currentLat,currentLon,duringDrag);
    redrawEqual();
    renderDistortion(currentLat);
  }

  function naturalEarthPopulation(feature){
    const p=feature?.properties||{},value=Number(p.POP_EST),year=Number(p.POP_YEAR)||null;
    return Number.isFinite(value)&&value>0?{value,year,source:'Natural Earth'}:null;
  }

  async function getIndicator(feature,indicator){
    const iso=countryIso(feature),key=iso+'|'+indicator;
    if(!iso)return null;
    if(indicatorCache.has(key))return indicatorCache.get(key);
    const promise=(async()=>{
      try{
        const url='https://api.worldbank.org/v2/country/'+encodeURIComponent(iso)+'/indicator/'+indicator+'?format=json&per_page=70';
        const res=await fetch(url);if(!res.ok)throw new Error('WB '+res.status);
        const json=await res.json(),rows=Array.isArray(json)&&Array.isArray(json[1])?json[1]:[],row=rows.find(r=>r&&r.value!==null&&Number.isFinite(Number(r.value)));
        if(row)return{value:Number(row.value),year:Number(row.date),source:'World Bank'};
      }catch(_){}
      if(indicator===WB.population)return naturalEarthPopulation(feature);
      return null;
    })();
    indicatorCache.set(key,promise);return promise;
  }

  function intersectionAreaKm2(a,b){
    try{
      const fc=turf.featureCollection([a,b]);
      const inter=turf.intersect(fc);
      return inter?areaKm2(inter):0;
    }catch(_){return NaN}
  }

  async function estimateFootprintPopulation(target,targetArea,targetPopulation){
    if(!target||!Number.isFinite(targetArea)||!Number.isFinite(targetPopulation))return{value:NaN,overlap:NaN};
    const placed=overlayFeature(currentLat,currentLon);
    const overlap=intersectionAreaKm2(placed,target);
    if(!Number.isFinite(overlap))return{value:NaN,overlap:NaN};
    const density=targetPopulation/targetArea;
    return{value:overlap*density,overlap};
  }

  async function updateComparison(feature){
    currentTarget=feature||vnSource;
    paintMercatorTarget(currentTarget);redrawEqual();
    const name=countryName(currentTarget),iso=countryIso(currentTarget)||'—',targetAreaKm2=areaKm2(currentTarget),targetNS=northSouthKm(currentTarget);
    ui.targetName.textContent=name;ui.targetIso.textContent=iso;
    ui.vnArea.textContent=formatArea(vnAreaKm2);ui.targetArea.textContent=formatArea(targetAreaKm2);ui.areaRatio.textContent=ratioText(targetAreaKm2,vnAreaKm2,name,'Việt Nam');
    ui.vnNorthSouth.textContent=formatDistance(vnNorthSouthKm);ui.targetNorthSouth.textContent=formatDistance(targetNS);ui.northSouthRatio.textContent=ratioText(targetNS,vnNorthSouthKm,name,'Việt Nam');

    ['vnPopulation','targetPopulation','vnDensity','targetDensity','vnGDP','targetGDP','vnGDPpc','targetGDPpc','footprintPopulation'].forEach(k=>ui[k].textContent='…');
    const token=++requestToken;
    const [vnPop,targetPop,vnGDP,targetGDP,vnGDPpc,targetGDPpc]=await Promise.all([
      getIndicator(vnSource,WB.population),getIndicator(currentTarget,WB.population),
      getIndicator(vnSource,WB.gdp),getIndicator(currentTarget,WB.gdp),
      getIndicator(vnSource,WB.gdppc),getIndicator(currentTarget,WB.gdppc)
    ]);
    if(token!==requestToken)return;

    const vp=vnPop?.value,tp=targetPop?.value,vd=Number.isFinite(vp)?vp/vnAreaKm2:NaN,td=Number.isFinite(tp)?tp/targetAreaKm2:NaN;
    ui.vnPopulation.textContent=formatPopulation(vp);ui.targetPopulation.textContent=formatPopulation(tp);
    ui.vnDensity.textContent=formatDensity(vd);ui.targetDensity.textContent=formatDensity(td);
    ui.populationRatio.textContent=ratioText(tp,vp,name,'Việt Nam')+(targetPop?.year?' · '+targetPop.year:'');
    ui.densityRatio.textContent=ratioText(td,vd,name,'Việt Nam');
    ui.vnGDP.textContent=formatUSD(vnGDP?.value);ui.targetGDP.textContent=formatUSD(targetGDP?.value);ui.gdpRatio.textContent=ratioText(targetGDP?.value,vnGDP?.value,name,'Việt Nam')+(targetGDP?.year?' · '+targetGDP.year:'');
    ui.vnGDPpc.textContent=formatUSDpc(vnGDPpc?.value);ui.targetGDPpc.textContent=formatUSDpc(targetGDPpc?.value);ui.gdpPcRatio.textContent=ratioText(targetGDPpc?.value,vnGDPpc?.value,name,'Việt Nam')+(targetGDPpc?.year?' · '+targetGDPpc.year:'');

    const fp=await estimateFootprintPopulation(currentTarget,targetAreaKm2,tp);
    if(token!==requestToken)return;
    ui.footprintPopulation.textContent=formatPopulation(fp.value);
    ui.footprintNote.textContent=Number.isFinite(fp.overlap)
      ?'Ước tính từ '+formatArea(fp.overlap)+' footprint nằm trong '+name+' × mật độ trung bình quốc gia.'
      :'Không tính được phần giao hình học.';
    ui.status.textContent='Natural Earth · World Bank '+(targetPop?.year||'')+' · '+(currentProjection==='mercator'?'OSM / Mercator':'D3 / Equal Earth');
  }

  function moveToFeature(feature,fit=false){
    if(!feature)return;
    const [lat,lon]=centerOf(feature);currentTarget=feature;handle.setLatLng([lat,lon]);updateOverlay(lat,lon);updateComparison(feature);ui.select.value=countryIso(feature);
    if(currentProjection==='mercator'){
      if(fit){const b=L.geoJSON(feature).getBounds();if(b.isValid())map.fitBounds(b.pad(.45),{maxZoom:5,animate:true})}
      else map.panTo([lat,lon],{animate:true});
    }
  }

  function switchProjection(mode){
    currentProjection=mode;
    const merc=mode==='mercator';
    ui.mercator.classList.toggle('active',merc);ui.equalEarth.classList.toggle('active',!merc);
    ui.mercatorBtn.classList.toggle('active',merc);ui.equalEarthBtn.classList.toggle('active',!merc);
    if(merc){setTimeout(()=>map.invalidateSize(),0)}else{setTimeout(sizeEqualEarth,0)}
    renderDistortion(currentLat);
    ui.status.textContent='Natural Earth · World Bank · '+(merc?'OSM / Mercator':'D3 / Equal Earth');
  }

  function populateSelect(){
    const items=world.features.map(f=>({f,name:countryName(f),iso:countryIso(f)})).filter(x=>x.iso).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
    ui.select.innerHTML='<option value="">Chọn quốc gia…</option>'+items.map(x=>'<option value="'+x.iso+'">'+escapeHtml(x.name)+'</option>').join('');
    ui.select.value=VIETNAM_ISO;
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  async function init(){
    try{
      renderChart();
      const res=await fetch(WORLD_URL);if(!res.ok)throw new Error('Không tải được Natural Earth ('+res.status+')');world=await res.json();
      vnSource=world.features.find(f=>countryIso(f)===VIETNAM_ISO||countryName(f).toLowerCase().includes('vietnam'));if(!vnSource)throw new Error('Không tìm thấy polygon Việt Nam.');
      vnCenter=centerOf(vnSource);vnAreaKm2=areaKm2(vnSource);vnNorthSouthKm=northSouthKm(vnSource);currentLat=vnCenter[0];currentLon=vnCenter[1];

      countriesLayer=L.geoJSON(world,{style:{color:'#728078',weight:.65,fillColor:'#fff',fillOpacity:.08},onEachFeature:(f,layer)=>{layer.on('click',()=>moveToFeature(f,true));layer.bindTooltip(countryName(f),{sticky:true,direction:'top'})}}).addTo(map);
      handle=L.marker(vnCenter,{draggable:true,zIndexOffset:1000,icon:L.divIcon({className:'vn-handle',html:'',iconSize:[20,20],iconAnchor:[10,10]})}).addTo(map);
      handle.bindTooltip('Kéo Việt Nam',{direction:'top',className:'vn-tooltip'});
      handle.on('drag',e=>{const p=e.target.getLatLng();if(Math.abs(p.lat)>MAX_LAT){p.lat=Math.sign(p.lat)*MAX_LAT;e.target.setLatLng(p)}const f=featureAt(p.lat,p.lng);if(f)currentTarget=f;updateOverlay(p.lat,p.lng,true);paintMercatorTarget(currentTarget)});
      handle.on('dragend',e=>{const p=e.target.getLatLng(),f=featureAt(p.lat,p.lng);updateOverlay(p.lat,p.lng);updateComparison(f||vnSource);ui.select.value=f?countryIso(f):''});

      populateSelect();initEqualEarth();updateOverlay(vnCenter[0],vnCenter[1]);await updateComparison(vnSource);
      map.fitBounds(L.geoJSON(vnSource).getBounds().pad(.9),{maxZoom:5});
      ui.loading.classList.add('hidden');setTimeout(()=>ui.loading.remove(),350);
    }catch(err){ui.loading.innerHTML='<strong>Không thể khởi tạo</strong><span>'+escapeHtml(err.message||String(err))+'</span>'}
  }

  ui.select.addEventListener('change',()=>{const f=world?.features?.find(x=>countryIso(x)===ui.select.value);if(f)moveToFeature(f,true)});
  ui.home.addEventListener('click',()=>moveToFeature(vnSource,true));
  ui.mercatorBtn.addEventListener('click',()=>switchProjection('mercator'));
  ui.equalEarthBtn.addEventListener('click',()=>switchProjection('equalEarth'));
  ui.infoBtn.addEventListener('click',()=>ui.info.showModal());ui.closeInfo.addEventListener('click',()=>ui.info.close());ui.info.addEventListener('click',e=>{if(e.target===ui.info)ui.info.close()});
  init();
})();
