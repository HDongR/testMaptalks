var quake = {
  map : {},
  threeLayer : {},
//  barsLayer : {}, 
//  geojsonVtLayer : {},
};

quake.textureLoader = new THREE.TextureLoader();
quake.terrainList = [];
const { MeshBVH, acceleratedRaycast } = MeshBVHLib;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
quake.ray = new THREE.Raycaster();
quake.ray.firstHitOnly = true;
quake.rayPos = new THREE.Vector3(0, 0, 15);
quake.rayDir = new THREE.Vector3(0, 0, -1); // Ray points down

quake.viewMap = function(){
  quake.setBaseLayer();
  quake.setThreeLayer();
  
  animation();
}

function animation() {
  // layer animation support Skipping frames
  quake.threeLayer._needsUpdate = !quake.threeLayer._needsUpdate;
  if (quake.threeLayer._needsUpdate) {
    quake.threeLayer.renderScene();
  }
  requestAnimationFrame(animation);
}

quake.setBaseLayer = function() {
  //basemap : vworld
 // var url = 'http://api.vworld.kr/req/wmts/1.0.0/' + properties.baseMapAPIKey + '/Base/{z}/{y}/{x}.png'

  var setillayerUrl = 'http://api.vworld.kr/req/wmts/1.0.0/' + 'D6200AF4-16B4-3161-BE8E-1CCDD332A8E3' + '/Satellite/{z}/{y}/{x}.jpeg';
  var setilLayer = new maptalks.TileLayer('tile2', {
      spatialReference:{
        projection:'EPSG:3857'
          // other properties necessary for spatial reference
      },
      'urlTemplate' : setillayerUrl
  });

  quake.map = new maptalks.Map("map", {
      center: [129.15158, 35.15361],
      centerCross: true,
      doubleClickZoom: false,
      baseLayer: setilLayer,
      zoom: 10,
      maxZoom: 18,
      minZoom: 9,
  });
  
}

quake.setThreeLayer = function(){
  quake.threeLayer = new maptalks.ThreeLayer('t', {
      forceRenderOnMoving: false,
      forceRenderOnRotating: false
  });

  quake.threeLayer.prepareToDraw = function (gl, scene, camera) {
    stats = new Stats();
    stats.domElement.style.zIndex = 100;
    document.getElementById('map').appendChild(stats.domElement);

    var light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, -10, 10).normalize();
    scene.add(light);

    initView();
  }

  quake.threeLayer.addTo(quake.map);
  
  //quake.map.on('moving moveend zoomend pitch rotate', update);
  
  //update();
}

function initView(){
	console.log(degrees2meters(129.152077, 35.153772));
	console.log(degrees2Tiles(129.152077, 35.153772, 16));

  loadTerrain();
}

var degrees2meters = function(lon,lat) {
  var x = lon * 20037508.34 / 180; 
  var y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180); 
  y = y * 20037508.34 / 180; 
  return [x, y];
}

var degrees2Tiles = function(lon,lat,zoom){
  let xtile = (Math.floor((lon+180)/360*Math.pow(2,zoom)));
  let ytile = (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)));
  return [xtile, ytile];
}

var loadTerrain = async function(){

  let preloadData = {tile_zoom : 10, startpoint:"128.755734,34.978977", endpoint:"129.314373,35.396265"};
  let startLon = preloadData.startpoint.split(',')[0];
  let startLat = preloadData.startpoint.split(',')[1];
  let endLon = preloadData.endpoint.split(',')[0];
  let endLat = preloadData.endpoint.split(',')[1];
  
  let zResol = 80;
  var coordMin = new maptalks.Coordinate(startLon, startLat);
  var coordMax = new maptalks.Coordinate(endLon, endLat);
  //var coordMin = new maptalks.Coordinate(129.148876, 35.151681);
  //var coordMax = new maptalks.Coordinate(129.155753, 35.156076);
  //var proj = proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:3857'));
  level = Number(preloadData.tile_zoom);
  let unit = 360 / (Math.pow(2, level) * 10);
  let minIdx = Math.floor((coordMin.x+180)/unit);
  let minIdy = Math.floor((coordMin.y+90)/unit);
  let maxIdx = Math.floor((coordMax.x+180)/unit);
  let maxIdy = Math.floor((coordMax.y+90)/unit);
  //console.log(minIdx, minIdy, maxIdx, maxIdy);
  //console.log(tileGrid.zoom, coordMin, coordMax);

  var idxIdyList = Array.from(Array((maxIdx-minIdx+1)*(maxIdy-minIdy+1)), () => new Array(2));
  var index = 0;
  for (var i=minIdx ; i<=maxIdx ; i++) {
    for (var j=minIdy ; j<=maxIdy; j++) {
      idxIdyList[index][0] = i+"";
      idxIdyList[index][1] = j+"";
      index++;
    }
  }     

  let turmX = maxIdx - minIdx + 1;
  let turmY = maxIdy - minIdy + 1;

  for (var i=0 ; i<idxIdyList.length ; i++) {
    const IDX = idxIdyList[i][0];
    const IDY = idxIdyList[i][1];
    const layer = "dem";
    let address = "https://xdworld.vworld.kr/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
    
    fetch(address).then(r=>{
      const size = r.headers.get("content-length");
      if(Number(size) >= 16900){
        r.arrayBuffer().then(function(buffer) {
          //var byteArray = new Uint8Array(buffer);
          p = new Parser(buffer);

          let x = unit * (IDX - (Math.pow(2, level-1)*10));
          let y = unit * (IDY - (Math.pow(2, level-2)*10));
          let pdata = [];
          let sData = null;
          let eData = null;
          for(var yy=64; yy>=0; yy--){ 
            for(var xx=0; xx<65; xx++){
              let xDegree = x+(unit/64)*xx;
              let yDegree = y+(unit/64)*yy;
              let height = p.getFloat4();
              pdata.push([xDegree, yDegree, height]);
              
              if(yy == 0 && xx == 64){
                eData = [xDegree, yDegree];
              }else if(yy == 64 && xx == 0){
                sData = [xDegree, yDegree];
              }
            }
          }
          var geometry = new THREE.PlaneGeometry(1, 1, 64, 64);

          /*for (var i = 0, l = geometry.vertices.length; i < l; i++) {
            
            const z = pdata[i][2]/zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
            const v = quake.threeLayer.coordinateToVector3([pdata[i][0],pdata[i][1]], z);
            geometry.vertices[i].x = v.x;
            geometry.vertices[i].y = v.y;
            geometry.vertices[i].z = v.z;
          }*/
          for (var i = 0, l = geometry.attributes.position.count; i < l; i++) {
              const z = pdata[i][2]/zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
              const v = quake.threeLayer.coordinateToVector3([pdata[i][0],pdata[i][1]], z);
              geometry.attributes.position.setXYZ(i, v.x, v.y, v.z);
          }
        
          var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/});
          material.opacity = 1;
          material.wireframe = false;
          var address = "https://xdworld.vworld.kr/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
          quake.textureLoader.load(address, function(tx){
              material.map = tx;
              material.needsUpdate = true;
          });
          
          var plane = new THREE.Mesh(geometry, material);  
          geometry.boundsTree = new MeshBVH( geometry );
          
          quake.threeLayer.addMesh(plane);
          
          let e1 = quake.threeLayer.coordinateToVector3([sData[0], sData[1]], 0);
          let e2 = quake.threeLayer.coordinateToVector3([eData[0], eData[1]], 0);
          plane.custom2DExtent = new maptalks.Extent(e1.x, e1.y, e2.x, e2.y);
          quake.terrainList.push(plane);
        });//arraybuffer
      }//16900
    }); //fetch
  }//for
}