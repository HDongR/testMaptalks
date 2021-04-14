var quake = {
  map : {},
  threeLayer : {},
//  barsLayer : {}, 
//  geojsonVtLayer : {},
};

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
    console.log('worker message callback');
    const { id, faces } = e.data;
    const { _positions, callback, timeId } = geometryCacahe[id];
    console.timeEnd(timeId);
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
var workerCount = 5;
var tinWorkers = [];
var currentWorker = 0;
var tinWorker;
for(var i=0; i<workerCount; i++){
  
  tinWorkers.push({id:i, itnWorker:new Worker('/js/maptalks/worker.tin.js')});
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

//default values
const OPTIONS = {
  altitude: 0
};
class Terrain extends maptalks.BaseObject {
  constructor(txt, data, options, material, layer) {
      options = maptalks.Util.extend({ data, layer }, OPTIONS, options);
      super();
      this._initOptions(options);

      const { buffGeom, minHeight } = getGeometry(data, layer, (buffGeom) => {
          this.getObject3d().geometry = buffGeom;
          this.getObject3d().geometry.needsUpdate = true;
          var address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + txt.level + "&IDX=" + txt.IDX + "&IDY=" + txt.IDY;
          // fetch(address).then(r=>{
          //   var st = 'tile_' + txt.substring(13, 26) + '.jpeg';
            textureLoader.load(address, function(tx){
              material.map = tx;
              //material.flatShading = false,
              material.needsUpdate = true;
            });
          // });
          
      });
     
      

      this._createMesh(buffGeom, material);
      const z = layer.distanceToVector3(options.altitude, options.altitude).x;
      this.getObject3d().position.z = z;
      
      // var img = "/tiles/image/tile_281396_113916.jpeg";
      // var imgElement = document.createElement("img");
      // imgElement.setAttribute("src", img);

      // material.transparent = true;
      // textureLoader.load(imgElement.src, (texture) => {
      //   material.map = texture;
      //   material.opacity = 1;
      //   material.needsUpdate = true;
      //   this.fire('load');
      // });
  }
}

quake.viewMap = function(){
  quake.setBaseLayer();
  quake.setThreeLayer();
  //quake.set3DTile();
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
    
    var mtlLoader = new THREE.MTLLoader();
    mtlLoader.setPath( '/tiles/obj/' );
    mtlLoader.load( 'mtl_281396_113916.mtl', function( materials ) {
        materials.preload();
        //change to back side with THREE <= v0.94
        // for (const p in materials.materials) {
        //     //change material's side to BackSide
        //     materials.materials[p].side = THREE.BackSide;
        // }
        var objLoader = new THREE.OBJLoader();
        objLoader.setMaterials( materials );
        objLoader.setPath( '/tiles/obj/' );
        objLoader.load( 'obj file_281396_113916.obj', function ( object ) {
            object.traverse( function ( child ) {
                if ( child instanceof THREE.Mesh ) {
                  child.scale.set(0.0066, 0.0066, 0.0066);
                  //child.rotation.set(Math.PI * 1 / 2, -Math.PI * 1 / 2, 0);
                }
            });
            var v = quake.threeLayer.coordinateToVector3({x:129.15087890625,y:35.1529541015625});
            object.position.x = v.x;
            object.position.y = v.y;
            object.position.z = 0.3019727304665139;
            //scene.add(object);

           
            mtlLoaded = true;
            quake.threeLayer.renderScene();
            quake.threeLayer.config('animation',true);
        });
    });

    animation();
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
      //animation();
    });
    console.log('txt');
  });
  
  
}

let fetchCnt = 0;
let cacche

function update() {
  var tileGrids = quake.map._baseLayer.getTiles().tileGrids;
  var zoom = quake.map.getZoom();
  var resolution = quake.map.getResolution(zoom);
  if(fetchCnt == 0){
  tileGrids.forEach(tileGrid => {
    var xmin = tileGrid.extent.xmin * resolution;
    var ymin = tileGrid.extent.ymin * resolution;

    var xmax = tileGrid.extent.xmax * resolution;
    var ymax = tileGrid.extent.ymax * resolution;

    console.log(tileGrid.zoom, xmin, ymin, xmax,  ymax);
    var coordMin = quake.map.getProjection().unproject({x:xmin, y:ymin});
    var coordMax = quake.map.getProjection().unproject({x:xmax, y:ymax});

    const level = zoom - 3;
    let unit = 360 / (Math.pow(2, level) * 10);
    let minIdx = Math.floor((coordMin.x+180)/unit);
		let minIdy = Math.floor((coordMin.y+90)/unit);
		let maxIdx = Math.floor((coordMax.x+180)/unit);
		let maxIdy = Math.floor((coordMax.y+90)/unit);

    console.log(minIdx, minIdy, maxIdx, maxIdy);
    console.log(tileGrid.zoom, coordMin, coordMax);

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
      var address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
      
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
            const terrain = new Terrain({IDX,IDY,layer,level}, pdata, { interactive: false }, material, quake.threeLayer);
            terrains.push(terrain);
            quake.threeLayer.addMesh(terrains);
          });
        }
      });
    }

  });
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

class Parser {
  constructor(data) {
      this.dv = new DataView(data);
      this.endian = true;
      this.offset = 0;
  }

  getUint4() {
      const val = this.dv.getUint32(this.offset, this.endian);
      this.offset += 4;
      return val;
  }

  getUint1() {
      const val = this.dv.getUint8(this.offset, this.endian);
      this.offset += 1;
      return val;
  }

  getUint2() {
      const val = this.dv.getUint16(this.offset, this.endian);
      this.offset += 2;
      return val;
  }

  getLenStr() {
      const len = this.getUint1();

      var str = "";
      var val = "";
      for (var i = 0; i < len; i++) {
          val = this.getUint1();
          str += String.fromCharCode(val);
      }
      return {
          len: len,
          str: str,
      };
  }

  getFloat8() {
      const val = this.dv.getFloat64(this.offset, this.endian);
      this.offset += 8;
      return val;
  }

  getFloat4() {
      const val = this.dv.getFloat32(this.offset, this.endian);
      this.offset += 4;
      return val;
  }

  getVersion() {
      const val = `${this.getUint1()}.${this.getUint1()}.${this.getUint1()}.${this.getUint1()}`;
      return val;
  }

  getBox() {
      var minX = this.getFloat8();
      var maxX = this.getFloat8();
      var minY = this.getFloat8();
      var maxY = this.getFloat8();
      var minZ = this.getFloat8();
      var maxZ = this.getFloat8();
      return {
          minX: minX,
          maxX: maxX,
          minY: minY,
          maxY: maxY,
          minZ: minZ,
          maxZ: maxZ
      }
  }

  getVector2df() {
      var x = this.getFloat4();
      var y = this.getFloat4();
      return {
          x: x,
          y: y
      }
  }

  getVector3df() {
      var x = this.getFloat4();
      var y = this.getFloat4();
      var z = this.getFloat4();
      return {
          x: x,
          y: y,
          z: z
      }
  }

  getVector3dd() {
      var x = this.getFloat8();
      var y = this.getFloat8();
      var z = this.getFloat8();
      return {
          x: x,
          y: y,
          z: z
      }
  }

  //http://irrlicht.sourceforge.net/docu/structirr_1_1video_1_1_s3_d_vertex.html
  getCountVert() {
      const count = this.getUint4();
      var vert = [];
      for (var i = 0; i < count; i++) {
          const pos = this.getVector3df();
          const normal = this.getVector3df();
          const uv = this.getVector2df();

          vert.push({
              pos: pos,
              normal: normal,
              uv: uv
          })
      }
      return {
          count: count,
          vert: vert
      };
  }

  getCountIndex() {
      const count = this.getUint4();
      var index = [];
      for (var i = 0; i < count; i++) {
          const val = this.getUint2();
          index.push(val)
      }
      return {
          count: count,
          index: index
      };
  }


  getBox3dd() {
      const min = this.getVector3dd();
      const max = this.getVector3dd();
      return {
          min: min,
          max: max
      }
  }
}