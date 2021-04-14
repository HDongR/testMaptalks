var quake = {
  map : {},
  threeLayer : {},
//  barsLayer : {}, 
//  geojsonVtLayer : {},
};

const textureLoader = new THREE.TextureLoader();


var geometryCacahe = {};
function messageCallback(e) {
    console.log('worker message callback');
    const { id, faces } = e.data;
    const { _positions, callback, timeId } = geometryCacahe[id];
    if (callback) {
        callback(e.data.buffGeom);
        delete geometryCacahe[id];
    }
}

var workerCount = 5;
var tinWorkers = [];
var currentWorker = 0;
var tinWorker;
for(var i=0; i<workerCount; i++){
  
  tinWorkers.push({id:i, itnWorker:new Worker('./js/maptalks/worker.tin_backup.js')});
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
    // if (!tinWorker) {
    //     tinWorker = new Worker('./js/worker.tin.js');
    // }
    // return tinWorker;
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
  console.log('worker runing');
  console.time(timeId);
  let bj = JSON.stringify(buffGeom);

  message(getTinWorker(), { points, id, indexMap, zs, minZ, positions, buffGeom }, messageCallback);
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

//default values
const OPTIONS = {
  altitude: 0
};
class Terrain extends maptalks.BaseObject {
  constructor(key, data, options, material, layer) {
      options = maptalks.Util.extend({ data, layer }, OPTIONS, options);
      super();
      this._initOptions(options);

      const { buffGeom, minHeight } = getGeometry(data, layer, (buffGeom) => {
        this.getObject3d().geometry = buffGeom;
        this.getObject3d().geometry.needsUpdate = true;
        var st = 'tile_' + key.substring(13, 26) + '.jpeg';
        textureLoader.load('/tiles/image/' + st, function(tx){
          material.map = tx;
          //material.flatShading = false,
          material.needsUpdate = true;
        });
      });
      
      this._createMesh(buffGeom, material);
      const z = layer.distanceToVector3(options.altitude, options.altitude).x;
      this.getObject3d().position.z = z;
   
  }
}

quake.viewMap = function(){
  quake.setBaseLayer();
  quake.setThreeLayer();
  quake.set3DTile();
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
      zoom: 15,
      maxZoom: 20,
      minZoom: 9,
      centerCross : true,
      spatialReference:{
         projection:'EPSG:3857'//map control 좌표계
      },
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
      forceRenderOnMoving: true,
      forceRenderOnRotating: true
  });

  quake.threeLayer.prepareToDraw = function (gl, scene, camera) {
    stats = new Stats();
    stats.domElement.style.zIndex = 100;
    document.getElementById('map').appendChild(stats.domElement);

    var light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, -10, 10).normalize();
    scene.add(light);
  }
  quake.threeLayer.addTo(quake.map);
  
  quake.map.on('moving moveend zoomend pitch rotate', update);
  
  update();

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
      mtlLoaded = true;
    });
  });
  
  
}




function update() {
  var projection = quake.map.getProjection();
  var center = quake.map.getCenter(),
    prj = projection.project(center),
    containerPoint = quake.map.coordinateToContainerPoint(center).round();
  var zoom = quake.map.getZoom();
  var fullExtent = quake.map.getFullExtent();
  var containerExtent = quake.map.getContainerExtent();
  var extent = quake.map.getExtent();
  var projExtent = quake.map.getProjExtent();
  var maxExtent = quake.map.getMaxExtent();
  var zoomMax = quake.map.getMaxZoom();
  var zoomMin = quake.map.getMinZoom();
  var resolution = quake.map.getResolution(zoom);

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