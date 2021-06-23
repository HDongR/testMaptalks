var quake = {
  map : {},
  threeLayer : {},
//  barsLayer : {}, 
//  geojsonVtLayer : {},
};

quake.viewMap = function(){
  terminateWorkerThread();
  createWorkerThread();
  quake.setBaseLayer();
  quake.setThreeLayer();
  //quake.set3DTile();
  loadLevel(11);
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

  setilLayer._getTileExtent = function (x,y,z){
    const map = this.getMap(),
                res = map._getResolution(z),
                tileConfig = this._getTileConfig(),
                tileExtent = tileConfig.getTilePrjExtent(x, y, res);
            return tileExtent;
  }

  setilLayer._getTileLngLatExtent = function (x, y, z) {
    const tileExtent = this._getTileExtent(x, y, z);
    let max = tileExtent.getMax(),
        min = tileExtent.getMin();
    const map = this.getMap();
    const projection = map.getProjection();
    min = projection.unproject(min);
    max = projection.unproject(max);
    return new maptalks.Extent(min, max);
  }



  quake.map = new maptalks.Map("map", {
      center: [129.15158, 35.15361],
      zoom: 11,
      maxZoom: 18,
      minZoom: 9,
      centerCross: true,
      doubleClickZoom: false,
      baseLayer: setilLayer,
  });
  
}

THREE.Loader.Handlers.add( /\.dds$/i, new THREE.DDSLoader() );
var mtlLoaded = false;

//three layer 생성
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
    
    // var mtlLoader = new THREE.MTLLoader();
    // mtlLoader.setPath( '/tiles/obj/' );
    // mtlLoader.load( 'mtl_281396_113916.mtl', function( materials ) {
    //     materials.preload();
    //     //change to back side with THREE <= v0.94
    //     // for (const p in materials.materials) {
    //     //     //change material's side to BackSide
    //     //     materials.materials[p].side = THREE.BackSide;
    //     // }
    //     var objLoader = new THREE.OBJLoader();
    //     objLoader.setMaterials( materials );
    //     objLoader.setPath( '/tiles/obj/' );
    //     objLoader.load( 'obj file_281396_113916.obj', function ( object ) {
    //         object.traverse( function ( child ) {
    //             if ( child instanceof THREE.Mesh ) {
    //               child.scale.set(0.0066, 0.0066, 0.0066);
    //               //child.rotation.set(Math.PI * 1 / 2, -Math.PI * 1 / 2, 0);
    //             }
    //         });
    //         var v = quake.threeLayer.coordinateToVector3({x:129.15087890625,y:35.1529541015625});
    //         object.position.x = v.x;
    //         object.position.y = v.y;
    //         object.position.z = 0.3019727304665139;
    //         //scene.add(object);

           
    //         mtlLoaded = true;
    //         quake.threeLayer.renderScene();
    //         quake.threeLayer.config('animation',true);
    //     });
    // });
    mtlLoaded = true
    animation();
  }

  quake.threeLayer.addTo(quake.map);
  
  //quake.map.on('moving moveend zoomend pitch rotate', update);
  
  //update();

  quake.threeLayer.draw = function () {
    if (mtlLoaded) {
        this.renderScene();
    }
  }
  
  quake.threeLayer.drawOnInteracting = function () {
    if (mtlLoaded) {
        this.renderScene();
    }
  }
}

const textureLoader = new THREE.TextureLoader();

var uvs = [];
for (var i = 0 ; i< 65 ; i++) {
  var v = 1.0-(i*1.0/64.0);
  for (var j=0 ; j<65 ; j++) {
     var u = j*(1.0/64.0);
     var uv = new THREE.Vector2(u, v);
     uvs.push(uv);
    //uvs.push({u,v});
  }
}


var geometryCacahe = {};
function messageCallback(e) {
    //console.log('worker message callback');
    const { id, faces } = e.data;
    const { _positions, callback, timeId } = geometryCacahe[id];
    //console.timeEnd(timeId);
    const geometry = new THREE.Geometry();
    geometry.vertices = _positions;
    for (let i = 0, len = faces.length; i < len; i += 3) {
        const index1 = faces[i],
            index2 = faces[i + 1],
            index3 = faces[i + 2];
        // if ((!(_positions[index1].z > _minZ) && (!(_positions[index2].z > _minZ)) && (!(_positions[index3].z > _minZ)))) {
        //     continue;
        // }
        const face = new THREE.Face3(index1, index2, index3);
        geometry.faces.push(face);
        
        geometry.faceVertexUvs[0].push([uvs[index1], uvs[index2], uvs[index3]]);
    }

    // geometry.computeVertexNormals();
    // geometry.computeFaceNormals();
    // geometry.computeFlatVertexNormals();
    // geometry.computeMorphNormals();
    // geometry.mergeVertices();
    const buffGeom = new THREE.BufferGeometry();
    buffGeom.fromGeometry(geometry);
    // buffGeom.addAttribute('uv',new THREE.BufferAttribute(new Float32Array(uvs), 2));
    buffGeom.removeAttribute('color');


    if (callback) {
        callback(buffGeom);
        delete geometryCacahe[id];
    }
}

var hardwareConcurrency = typeof window !== 'undefined' ? window.navigator.hardwareConcurrency || 4 : 0;
var workerCount = Math.max(Math.floor(hardwareConcurrency / 2), 1);
var currentWorker = 0;
var tinWorkers = [];

function terminateWorkerThread(){
  tinWorkers.forEach(tin=>{
    tin.terminate();
  });
}

function createWorkerThread(){
  var tinWorker;
  for(var i=0; i<workerCount; i++){
    tinWorkers.push({id:i, itnWorker:new Worker('/js/dds/worker.tin.js')});
  }
}

function getTinWorker() {
  var tt;
  tinWorkers.some(el => {
    if(el.id == currentWorker){
      if(el.itnWorker){
        tt = el.itnWorker;
        return true;
      }
    }
  });
  
  currentWorker++;
  if(currentWorker >= workerCount){
    currentWorker = 0;
  }

  return tt;
}

function getGeometry(data = [], layer, callback) {
  if (!Array.isArray(data)) {
      data = [data];
  }
  const points = [];
  let minHeight = Infinity;
  data.forEach(element => {
      let lnglat, height;
      if (Array.isArray(element)) {
          lnglat = [element[0], element[1]];
          height = element[2];
      } else {
          lnglat = element.lnglat || element.xy || element._lnglat || element._xy;
          height = element.height || element.z || element.h;
      }
      if (height !== undefined) {
          minHeight = Math.min(minHeight, height);
      }
      if (lnglat && height !== undefined) {
          const point = {
              geometry: {
                  coordinates: lnglat,
                  type: 'Point'
              },
              properties: {
                  z: height
              }
          };
          points.push(point);
      }
  });
  const indexMap = {};
  const positions = [];
  const zs = [];
  const zMap = {};
  for (let i = 0, len = points.length; i < len; i++) {
      const { geometry, properties } = points[i];
      const lnglat = geometry.coordinates;
      const key = lnglat.toString();
      indexMap[key] = i;
      const height = properties.z;
      let z = zMap[height];
      if (z === undefined) {
          z = zMap[height] = layer.distanceToVector3(height, height).x;
      }
      const v = layer.coordinateToVector3(lnglat, z);
      positions.push(v);
      zs.push(v.z);
  }

  const id = maptalks.Util.GUID();
  const minZ = layer.distanceToVector3(minHeight, minHeight).x;
  const buffGeom = new THREE.BufferGeometry();
  const timeId = 'tin worker ' + maptalks.Util.GUID();
  geometryCacahe[id] = {
      _positions: positions,
      _indexMap: indexMap,
      _minHeight: minHeight,
      _minZ: minZ,
      timeId,
      callback
  };
  //console.log('worker runing');
  //console.time(timeId);
  setTimeout(message(getTinWorker(), { points, id, indexMap, zs, minZ }, messageCallback), Math.random() * 100);
  return {
      buffGeom, minHeight
  };
}

function message(worker, params, callback) {
  
      worker.postMessage(params);
      runing = true;
      worker.onmessage = (e) => {
          callback(e);
      };
}

var terrains = [];

quake.set3DTile = function(){

  var directory = '/tiles/lonlatfile';
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.open('GET', directory, false); // false for synchronous request
  xmlHttp.send(null);
  var ret = xmlHttp.responseText;
  const toNodes = new DOMParser().parseFromString(ret, 'text/html').body.childNodes[2].nextElementSibling.childNodes[3];//.childNodes[1];
  var k = 0;
  let txtList = [];
  toNodes.childNodes.forEach(el =>{
    if(el.nodeName == 'LI'){
      if(k > 0){
        //console.log(el.childNodes[0].childNodes[0].innerHTML);
        txtList.push(el.childNodes[0].childNodes[0].innerHTML);
      }
      k++;
    }
  });

  txtList.forEach(txt => {
    fetch('/tiles/lonlatfile/' + txt).then(res => res.text()).then(evadata => {
      let data = evadata.split("\n");
      let pdata = [];
      data.forEach(v =>{
        if(v.length > 0){ 
          let j = v.split(",");
          j[0] = Number(j[0]);
          j[1] = Number(j[1]);
          j[2] = Number(j[2]);
          pdata.push(j);
        }
      });
      var material = new THREE.MeshBasicMaterial({side:THREE.BackSide});
      //var material = new THREE.MeshBasicMaterial({color: 'hsl(0,100%,50%)',side:THREE.BackSide});
      //material.opacity = 0.9;
      //material.wireframe = true;
      const terrain = new Terrain(txt, pdata, { interactive: false }, material, quake.threeLayer);
      terrains.push(terrain);
      quake.threeLayer.addMesh(terrains);
      //animation();
    });
  });
}

let fetchCnt = 0;
let fetchThreshold = 1000000;
let cacheTerrian = {};
let allowZoom = function(zoom){
  if(zoom <= 9){
    return 9;
  }else if(zoom > 9 && zoom < 15){
    return 12;
  }else if(zoom >= 15){
    return 15
  }
};
function isFunction(obj) {
  if (isNil(obj)) {
    return false;
  }

  return typeof obj === 'function' || obj.constructor !== null && obj.constructor === Function;
}
function _getTileOffset(z) {
  let _this = quake.map._baseLayer;
  var map = _this.getMap();

  var scale = map._getResolution() / map._getResolution(z);

  var offset = _this.options['offset'];

  if (isFunction(offset)) {
    offset = offset(_this);
  }

  offset[0] *= scale;
  offset[1] *= scale;
  return offset;
};

var TEMP_POINT = new maptalks.Point(0, 0);
var TEMP_POINT0$3 = new maptalks.Point(0, 0);
var TEMP_POINT1$1 = new maptalks.Point(0, 0);
var TEMP_POINT2 = new maptalks.Point(0, 0);
var TEMP_POINT3 = new maptalks.Point(0, 0);
var TEMP_POINT4 = new maptalks.Point(0, 0);
var TEMP_POINT5 = new maptalks.Point(0, 0);
var TEMP_POINT6 = new maptalks.Point(0, 0);


function _getTiles(tileZoom, containerExtent, cascadeLevel, parentRenderer){
  let _this = quake.map._baseLayer;
  var map = _this.getMap();
  var z = tileZoom;
  var frustumMatrix = map.projViewMatrix;

  if (cascadeLevel < 2) {
    if (cascadeLevel === 0) {
      z -= 1;
    }

    frustumMatrix = cascadeLevel === 0 ? map.cascadeFrustumMatrix0 : cascadeLevel === 1 ? map.cascadeFrustumMatrix1 : map.projViewMatrix;
  }

  var zoom = z + _this.options['zoomOffset'];

  var offset = _this._getTileOffset(zoom),
      hasOffset = offset[0] || offset[1];

  var emptyGrid = {
    'zoom': z,
    'extent': null,
    'offset': offset,
    'tiles': []
  };

  if (zoom < 0) {
    return emptyGrid;
  }

  var minZoom = _this.getMinZoom(),
      maxZoom = _this.getMaxZoom();

  if (!map || !_this.isVisible() || !map.width || !map.height) {
    return emptyGrid;
  }

  if (!isNil(minZoom) && z < minZoom || !isNil(maxZoom) && z > maxZoom) {
    return emptyGrid;
  }

  var tileConfig = _this._getTileConfig();

  if (!tileConfig) {
    return emptyGrid;
  }

  var sr = _this.getSpatialReference();
  var mapSR = map.getSpatialReference();
  var res = sr.getResolution(zoom);
  var glScale = map.getGLScale(z);
  var repeatWorld = sr === mapSR && _this.options['repeatWorld'];
  var extent2d = containerExtent.convertTo(function (c) {
    var result;

    if (c.y > 0 && c.y < map.height) {
      var key = (c.x === 0 ? 0 : 1) + c.y;

      if (!_this._coordCache[key]) {
        _this._coordCache[key] = map._containerPointToPoint(c);
      }

      result = _this._coordCache[key];
    }

    result = map._containerPointToPoint(c, undefined, TEMP_POINT);
    return result;
  });

  extent2d._add(offset);

  var prjCenter = map._containerPointToPrj(containerExtent.getCenter(), TEMP_POINT0$3);

  var centerPoint = map._prjToPoint(prjCenter, undefined, TEMP_POINT1$1);

  var c;

  if (hasOffset) {
    c = _this._project(map._pointToPrj(centerPoint._add(offset), undefined, TEMP_POINT1$1), TEMP_POINT1$1);
  } else {
    c = _this._project(prjCenter, TEMP_POINT1$1);
  }

  TEMP_POINT2.x = extent2d.xmin;
  TEMP_POINT2.y = extent2d.ymax;
  TEMP_POINT3.x = extent2d.xmax;
  TEMP_POINT3.y = extent2d.ymin;

  var pmin = _this._project(map._pointToPrj(TEMP_POINT2, undefined, TEMP_POINT2), TEMP_POINT2);
  var pmax = _this._project(map._pointToPrj(TEMP_POINT3, undefined, TEMP_POINT3), TEMP_POINT3);

  return {pmin, pmax, tileZoom};
}
function getTiles(z, parentLayer){
  let _this = quake.map._baseLayer;
  var map = _this.getMap();
  var pitch = map.getPitch();
  var parentRenderer = parentLayer && parentLayer.getRenderer();
  var mapExtent = map.getContainerExtent();
  var tileGrids = [];
  var count = 0;
  var minZoom = _this.getMinZoom();
  var cascadePitch0 = map.options['cascadePitches'][0];
  var cascadePitch1 = map.options['cascadePitches'][1];
  var visualHeight1 = Math.floor(map._getVisualHeight(cascadePitch1));
  var tileZoom = isNil(z) ? _this._getTileZoom(map.getZoom()) : z;
  _this._coordCache = {};

  if (!isNil(z) || !_this.options['cascadeTiles'] || pitch <= cascadePitch0 || !isNil(minZoom) && tileZoom <= minZoom) {
    var containerExtent = pitch <= cascadePitch1 ? mapExtent : new maptalks.PointExtent(0, map.height - visualHeight1, map.width, map.height);

    var _currentTiles = this._getTiles(tileZoom, containerExtent, 2, parentRenderer);

    if (_currentTiles) {
      tileGrids.push(_currentTiles);
    }

    return {
      tileGrids: tileGrids
    };
  }

  var visualHeight0 = Math.floor(map._getVisualHeight(cascadePitch0));
  var extent0 = new maptalks.PointExtent(0, map.height - visualHeight0, map.width, map.height);

  var currentTiles = this._getTiles(tileZoom, extent0, 0, parentRenderer);

  tileGrids.push(currentTiles);
  var cascadeHeight = extent0.ymin;
  var d = map.getSpatialReference().getZoomDirection();
  var cascadeLevels = d;
  var cascadeTiles1;

  if (pitch > cascadePitch1) {
    if (tileZoom - cascadeLevels <= minZoom) {
      cascadeLevels = 0;
    }

    var extent1 = new maptalks.PointExtent(0, map.height - visualHeight1, map.width, cascadeHeight);
    cascadeTiles1 = this._getTiles(tileZoom - cascadeLevels, extent1, 1, parentRenderer);
    cascadeHeight = extent1.ymin;
    cascadeLevels += 4 * d;
  }

  var cascadeTiles2;

  if (tileZoom - cascadeLevels >= minZoom) {
    var extent2 = new maptalks.PointExtent(0, mapExtent.ymin, map.width, cascadeHeight);
    cascadeTiles2 = this._getTiles(tileZoom - cascadeLevels, extent2, 2, parentRenderer);
    tileGrids.push(cascadeTiles2);
  }

  if (cascadeTiles1 && cascadeTiles2) {
    tileGrids[1] = cascadeTiles2;
    tileGrids[2] = cascadeTiles1;
  }

  return {
    tileGrids: tileGrids,
    count: count
  };
};
function isNil(obj) {
  return obj == null;
}
let showKeyList = {};
const bst = new BST();
function loadLevel(level){
  // var coordMin = new maptalks.Coordinate(128.783010, 34.980677);
  // var coordMax = new maptalks.Coordinate(129.314373, 35.396265);
  var coordMin = new maptalks.Coordinate(129.148876, 35.151681);
  var coordMax = new maptalks.Coordinate(129.155753, 35.156076);
  var proj = proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:3857'));

  if(level > 15){
    level = 15;
  }
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

  let allLength = idxIdyList.length * 65 * 65;
  let currentCnt = 0;

  for (var i=0 ; i<idxIdyList.length ; i++) {
    const IDX = idxIdyList[i][0];
    const IDY = idxIdyList[i][1];
    const layer = "dem";
    let address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
  
    const key = layer + "-" + level + "-" + IDX + "-" + IDY;
    //showKeyList[key] = key;
    const cache = cacheTerrian[key];
    if(cache && cache.demUrl == address){
      continue;
    }
    
    cacheTerrian[key] = {id:key, level:level, isData:false, isFetch:true, isJpeg:false, demUrl:address, terrian:null};
    fetch(address).then(r=>{
      const size = r.headers.get("content-length");
      if(Number(size) >= 16900){
        r.arrayBuffer().then(function(buffer) {
          //var byteArray = new Uint8Array(buffer);
          p = new Parser(buffer);

          let x = unit * (IDX - (Math.pow(2, level-1)*10));
          let y = unit * (IDY - (Math.pow(2, level-2)*10));
          let pdata = [];
          for(var yy=64; yy>=0; yy--){
            const latBst = new BST();
            for(var xx=0; xx<65; xx++){
              let xDegree = x+(unit/64)*xx;
              let yDegree = y+(unit/64)*yy;
              let height = p.getFloat4();
              
              var result = proj.forward([xDegree, yDegree]);
              
              latBst.insert({key:result[1], value:height});
              bst.insert({key:result[0], value:latBst});

              pdata.push([xDegree, yDegree, height]);
              //console.log(xDegree, yDegree, height);
              
              currentCnt++;
              if(currentCnt % 100000 == 0){
                console.log(allLength, currentCnt);
              }
              if(currentCnt > 2600000){
                console.log(allLength, currentCnt);
              }
            }
          }
          //console.log(r);
          var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/ side:THREE.BackSide});
          material.opacity = 0.9;
          //material.wireframe = true;
          const terrain = new Terrain({layer,level,IDX,IDY}, pdata, {interactive: false}, material, quake.threeLayer);
          //terrains.push({terrain, key});
          quake.threeLayer.addMesh(terrain);

          cacheTerrian[key].terrian = terrain;
          cacheTerrian[key].isData = true;

        });
      }
    });
    
  }
}

function update() {
  // console.log(quake.map.getZoom());

  // var tileGrids = getTiles().tileGrids;//modify
  var tileGrids = quake.map._baseLayer.getTiles().tileGrids;
  var zoom = quake.map.getZoom();
  
  //level = allowZoom(level);

  // if(tileGrids.length >= 2){
  //   return;
  // }

  if(fetchCnt < fetchThreshold){
    let showKeyList = {};

    for(var kk = 0; kk<tileGrids.length; kk++){
      tileGrid = tileGrids[kk];
      var resolution = 0;
      if(tileGrids.length == 1){
        resolution = quake.map.getResolution(tileGrid.zoom);
      }else if(tileGrids.length == 2){
        if(kk == 0){
          resolution = quake.map.getResolution(tileGrid.zoom - 1);
        }else if(kk == 1){
          resolution = quake.map.getResolution(tileGrid.zoom);
        }
      }else if(tileGrids.length == 3){
        if(kk == 0){
          resolution = quake.map.getResolution(tileGrid.zoom - 1);
        }else if(kk == 1){
          continue;
        } else if(kk == 2){
          resolution = quake.map.getResolution(tileGrid.zoom);
        }
      }

      //resolution = quake.map.getResolution(tileGrid.zoom); //modify

      let level = tileGrid.zoom - 4;
      //let level = tileGrid.tileZoom - 4; //modify

      var xmin = tileGrid.extent.xmin * resolution;
      var ymin = tileGrid.extent.ymin * resolution;
      var xmax = tileGrid.extent.xmax * resolution;
      var ymax = tileGrid.extent.ymax * resolution;

      // var xmin = tileGrid.pmin.x;//modify
      // var ymin = tileGrid.pmax.y;
      // var xmax = tileGrid.pmax.x;
      // var ymax = tileGrid.pmin.y;


      if(xmin == 0 && ymin == 0 && xmax == 0 && ymax == 0){
        continue;
      }
      //console.log(tileGrid.zoom, xmin, ymin, xmax,  ymax);
      var coordMin = quake.map.getProjection().unproject({x:xmin, y:ymin});
      var coordMax = quake.map.getProjection().unproject({x:xmax, y:ymax});

     
      if(level > 15){
        level = 15;
      }
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

      for (var i=0 ; i<idxIdyList.length ; i++) {
        const IDX = idxIdyList[i][0];
        const IDY = idxIdyList[i][1];
        const layer = "dem";
        let address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
     
        const key = layer + "-" + level + "-" + IDX + "-" + IDY;
        showKeyList[key] = key;
        const cache = cacheTerrian[key];
        if(cache && cache.demUrl == address){
          continue;
        }
       
        cacheTerrian[key] = {id:key, level:level, isData:false, isFetch:true, isJpeg:false, demUrl:address, terrian:null};
        fetch(address).then(r=>{
          const size = r.headers.get("content-length");
          if(size >= 16900){
            r.arrayBuffer().then(function(buffer) {
              //var byteArray = new Uint8Array(buffer);
              p = new Parser(buffer);

              let x = unit * (IDX - (Math.pow(2, level-1)*10));
              let y = unit * (IDY - (Math.pow(2, level-2)*10));
              let pdata = [];
              for(var yy=64; yy>=0; yy--){
                for(var xx=0; xx<65; xx++){
                  let xDegree = x+(unit/64)*xx;
                  let yDegree = y+(unit/64)*yy;
                  let height = p.getFloat4();

                  pdata.push([xDegree, yDegree, height]);
                  //console.log(xDegree, yDegree, height);
                }
              }
              //console.log(r);
              var material = new THREE.MeshBasicMaterial({side:THREE.BackSide});
                  //var material = new THREE.MeshBasicMaterial({color: 'hsl(0,100%,50%)',side:THREE.BackSide});
                  //material.opacity = 0.9;
                  //material.wireframe = true;
              const terrain = new Terrain({layer,level,IDX,IDY}, pdata, {interactive: false}, material, quake.threeLayer);
              //terrains.push({terrain, key});
              quake.threeLayer.addMesh(terrain);

              cacheTerrian[key].terrian = terrain;
              cacheTerrian[key].isData = true;

            });
          }
        });
        
      }
    }

    for(var k in cacheTerrian){
      let cs = cacheTerrian[k];
      let ct = cs.terrian;
      let level = cs.level;
      if(!ct){
        continue;
      }
      if(showKeyList[k]){
        ct.show();
      }else{
        ct.hide();
      }
    }
    
    fetchCnt++;
  }

  

  var projection = quake.map.getProjection();
  var center = quake.map.getCenter(),
    prj = projection.project(center),
    containerPoint = quake.map.coordinateToContainerPoint(center).round();
  
  var fullExtent = quake.map.getFullExtent();
  var containerExtent = quake.map.getContainerExtent();
  var extent = quake.map.getExtent();

  var projExtent = quake.map.getProjExtent();
  var maxExtent = quake.map.getMaxExtent();
  var zoomMax = quake.map.getMaxZoom();
  var zoomMin = quake.map.getMinZoom();
 

  document.getElementById('coordinate').innerHTML = '<div><br><br>' + [
    'Center : [' + center.x.toFixed(5) + ', ' + center.y.toFixed(5) + ']',
    'Projected Coordinate : [' + prj.x.toFixed(5) + ', ' + prj.y.toFixed(5) + ']',
    'Zoom : [' + zoom + ']' + ' minLon minLat: ' + extent.ymin + ' ' + extent.xmin + ' maxLon maxLat: ' + extent.ymax + ' ' + extent.xmax
  ].join('<br>') + '</div>';
}

function animation() {
  // layer animation support Skipping frames
  quake.threeLayer._needsUpdate = !quake.threeLayer._needsUpdate;
  if (quake.threeLayer._needsUpdate) {
    quake.threeLayer.renderScene();
  }
  stats.update();
  requestAnimationFrame(animation);

}

//default values
const OPTIONS = {
  altitude: 0
};

class Terrain extends maptalks.BaseObject {
  constructor(param, data, options, material, layer) {
      options = maptalks.Util.extend({ data, layer }, OPTIONS, options);
      super();
      this._initOptions(options);

      const { buffGeom, minHeight } = getGeometry(data, layer, (buffGeom) => {
          this.getObject3d().geometry = buffGeom;
          this.getObject3d().geometry.needsUpdate = true;
          var address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + param.level + "&IDX=" + param.IDX + "&IDY=" + param.IDY;

          textureLoader.load(address, function(tx){
            const key = param.layer + "-" + param.level + "-" + param.IDX + "-" + param.IDY;
            cacheTerrian[key].isJpeg = true;
            material.map = tx;
            material.needsUpdate = true;
          });
        
      });

      this._createMesh(buffGeom, material);
      const z = layer.distanceToVector3(options.altitude, options.altitude).x;
      this.getObject3d().position.z = z;
  }
}

quake.getHeight = function(lon, lat){
  var projection = quake.map.getProjection();
  var coordinate = new maptalks.Coordinate(lon,lat);
  var prj = projection.project(coordinate); 

  document.getElementById('result_log').innerHTML = '<div>' + [
          'Projected Coordinate : [' + prj.x.toFixed(5) + ', ' + prj.y.toFixed(5) + ']',
          'ContainerPoint is the screen position in px from northwest of the map container.'
        ].join('<br>') + '</div>';

  var key = String(prj.x.toFixed(9)) + ":" + String(prj.y.toFixed(9));
  var value = bst.find(key);
  return value;
}