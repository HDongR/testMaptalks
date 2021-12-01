var quake = {
  map: {},
  threeLayer: {},
  //  barsLayer : {}, 
  //  geojsonVtLayer : {},
};

const textureLoader = new THREE.TextureLoader();

var geometryCacahe = {};

quake.viewMap = function () {
  quake.setBaseLayer();
  quake.setThreeLayer();
}

quake.setBaseLayer = function () {
  //basemap : vworld
  // var url = 'http://api.vworld.kr/req/wmts/1.0.0/' + properties.baseMapAPIKey + '/Base/{z}/{y}/{x}.png'
  var setillayerUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  //var setillayerUrl = 'http://api.vworld.kr/req/wmts/1.0.0/' + 'D6200AF4-16B4-3161-BE8E-1CCDD332A8E3' + '/Satellite/{z}/{y}/{x}.jpeg';
  var setilLayer = new maptalks.TileLayer('tile2', {
    spatialReference: {
      projection: 'EPSG:3857'
      // other properties necessary for spatial reference
    },
    'urlTemplate': setillayerUrl,
    debug: true,
  });

  setilLayer._getTileExtent = function (x, y, z) {
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
    maxZoom: 19,
    minZoom: 0,
    centerCross: true,
    spatialReference: {
      projection: 'EPSG:3857'//map control 좌표계
    },
    centerCross: true,
    doubleClickZoom: false,
    baseLayer: setilLayer,
  });

}

//three layer 생성
quake.setThreeLayer = function () {
  quake.threeLayer = new maptalks.ThreeLayer('t', {
    forceRenderOnMoving: true,
    forceRenderOnRotating: true
  });

  quake.threeLayer.prepareToDraw = function (gl, scene, camera) {
    camera.near = 0;
    quake.map.cameraNear = 0;

    stats = new Stats();
    stats.domElement.style.zIndex = 100;
    document.getElementById('map').appendChild(stats.domElement);

    var light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, -10, 10).normalize();
    scene.add(light);

    //quake.map.on('moving moveend zoomend pitch rotate', update);
    //update();
    
    quake.loadTerrainNetwork();
    animation();
  }

  quake.threeLayer.addTo(quake.map);
}
 
function fetch_terrain(key, unit, address, level, IDX, IDY, isShow){
  cacheTerrain[key].startTime = Date.now();

  try{
    fetch(address).then(r => {
      const size = r.headers.get("content-length");
      if (Number(size) >= 16900) {
        r.arrayBuffer().then(function (buffer) {
          //var byteArray = new Uint8Array(buffer);
          let p = new Parser(buffer);

          let x = unit * (IDX - (Math.pow(2, level - 1) * 10));
          let y = unit * (IDY - (Math.pow(2, level - 2) * 10));
          let pdata = [];
          let sData = null;
          let eData = null;
          let center = [];

          for (var yy = 64; yy >= 0; yy--) {
            for (var xx = 0; xx < 65; xx++) {
              let xDegree = x + (unit / 64) * xx;
              let yDegree = y + (unit / 64) * yy;
              let height = p.getFloat4();
              pdata.push([xDegree, yDegree, height]);

              if (yy == 0 && xx == 64) {
                eData = [xDegree, yDegree];
              } else if (yy == 64 && xx == 0) {
                sData = [xDegree, yDegree];
              } else if (yy == 32 && xx == 32) {
                center = [xDegree, yDegree];
              }
            }
          }
          var geometry = new THREE.PlaneGeometry(1, 1, 64, 64);
          let centerConv = coordinateToVector3(center, 0);

          for (var i = 0, l = geometry.attributes.position.count; i < l; i++) {
            const z = pdata[i][2] / 80;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
            const v = coordinateToVector3([pdata[i][0], pdata[i][1]], z);
            geometry.attributes.position.setXYZ(i, v.x - centerConv.x, v.y - centerConv.y, v.z);
          }

          var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/ });
          material.opacity = 1;
          material.wireframe = false;
          var address = "https://xdworld.vworld.kr/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;

          loader.setOptions({ imageOrientation: 'flipY' });
          loader.load(address, function (imageBitmap) {
            

            
            var tx = new THREE.CanvasTexture(imageBitmap);
            material.map = tx;
            //material.side = THREE.DoubleSide;
            material.visible = isShow ? true : false;
            material.needsUpdate = true;
            cacheTerrain[key].isJpeg = true;
            
          });
          

          var plane = new THREE.Mesh(geometry, material);
          plane.position.set(centerConv.x, centerConv.y, 0);
          material.visible = false;

          quake.threeLayer.addMesh(plane);

          cacheTerrain[key].terrain = plane;
          cacheTerrain[key].endTime = Date.now();

        });//arraybuffer
      }//16900
      else{

        cacheTerrain[key].notFind = true;
      }
    }); //fetch

  }catch(e){
    console.log(e);
  }

}


var loader = new THREE.ImageBitmapLoader();
let cacheTerrain = {};
function update() {
  // console.log(quake.map.getZoom());

  // var tileGrids = getTiles().tileGrids;//modify
  var tileGrids = quake.map._baseLayer.getTiles().tileGrids;
  var zoom = quake.map.getZoom();
  var pitch = quake.map.getPitch();
  var cascadePitch0 = quake.map.options['cascadePitches'][0];
  var cascadePitch1 = quake.map.options['cascadePitches'][1];
  var minZoom = quake.map.options['minZoom'];
  var d = quake.map.getSpatialReference().getZoomDirection();
  var cascadeLevels = d;
  var tileZoom = zoom;


  let showKeyList = {};

  for (var kk = 0; kk < tileGrids.length; kk++) {
    tileGrid = tileGrids[kk];
    var resolution = 0;
    if (tileGrids.length == 1) {
      if (pitch <= cascadePitch0 || tileZoom <= minZoom) {
        resolution = quake.map.getResolution(tileGrid.zoom);
      } else if (tileZoom - cascadeLevels >= minZoom) {
        resolution = quake.map.getResolution(tileGrid.zoom - 1);
      }
    } else if (tileGrids.length == 2) {
      if (kk == 0) {
        resolution = quake.map.getResolution(tileGrid.zoom - 1);
      } else if (kk == 1) {
        resolution = quake.map.getResolution(tileGrid.zoom);
      }
    } else if (tileGrids.length == 3) {
      if (kk == 0) {
        resolution = quake.map.getResolution(tileGrid.zoom - 1);
      } else if (kk == 1) {
        continue;
        //resolution = quake.map.getResolution(tileGrid.zoom);
      } else if (kk == 2) {
        resolution = quake.map.getResolution(tileGrid.zoom);
      }
    }

    //resolution = quake.map.getResolution(tileGrid.zoom); //modify

    let level = tileGrid.zoom - 4;
    //let level = tileGrid.zoom - 3;

    var xmin = tileGrid.extent.xmin * resolution;
    var ymin = tileGrid.extent.ymin * resolution;
    var xmax = tileGrid.extent.xmax * resolution;
    var ymax = tileGrid.extent.ymax * resolution;

    // var xmin = tileGrid.pmin.x;//modify
    // var ymin = tileGrid.pmax.y;
    // var xmax = tileGrid.pmax.x;
    // var ymax = tileGrid.pmin.y;


    if (xmin == 0 && ymin == 0 && xmax == 0 && ymax == 0) {
      continue;
    }
    //console.log(tileGrid.zoom, xmin, ymin, xmax,  ymax);
    var coordMin = quake.map.getProjection().unproject({ x: xmin, y: ymin });
    var coordMax = quake.map.getProjection().unproject({ x: xmax, y: ymax });


    if (level > 15) {
      level = 15;
    }
    let unit = 360 / (Math.pow(2, level) * 10);
    let minIdx = Math.floor((coordMin.x + 180) / unit);
    let minIdy = Math.floor((coordMin.y + 90) / unit);
    let maxIdx = Math.floor((coordMax.x + 180) / unit);
    let maxIdy = Math.floor((coordMax.y + 90) / unit);
    //console.log(minIdx, minIdy, maxIdx, maxIdy);
    //console.log(tileGrid.zoom, coordMin, coordMax);

    if((maxIdx - minIdx + 1) * (maxIdy - minIdy + 1) < 0 ) return;
    var idxIdyList = Array.from(Array((maxIdx - minIdx + 1) * (maxIdy - minIdy + 1)), () => new Array(2));
    var index = 0;
    for (var i = minIdx; i <= maxIdx; i++) {
      for (var j = minIdy; j <= maxIdy; j++) {
        idxIdyList[index][0] = i + "";
        idxIdyList[index][1] = j + "";
        index++;
      }
    }

    

    for (var i = 0; i < idxIdyList.length; i++) {
      const IDX = idxIdyList[i][0];
      const IDY = idxIdyList[i][1];
      const layer = "dem";
      let address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
  
      

      // preIdMap['_4'][preKey4] = null;
      // preIdMap['_3'][preKey3] = null;
      // preIdMap['_2'][preKey2] = null;
      // preIdMap['_1'][preKey1] = null;
       

      const key = layer + "-" + level + "-" + IDX + "-" + IDY;
      showKeyList[key] = key;
      let cache = cacheTerrain[key];
      if (cache && cache.demUrl == address) {
        if(cache.terrain){
          cache.terrain.visible = true;
        }else if(cache.notFind){
          // console.log(cache);
          // let preKey4 = layer + "-" + (level-4) + "-" + Math.floor(IDX / 16) + "-" + Math.floor(IDY / 16);
          // let preKey3 = layer + "-" + (level-3) + "-" + Math.floor(IDX / 8) + "-" + Math.floor(IDY / 8);
          // let preKey2 = layer + "-" + (level-2) + "-" + Math.floor(IDX / 4) + "-" + Math.floor(IDY / 4);
          // let preKey1 = layer + "-" + (level-1) + "-" + Math.floor(IDX / 2) + "-" + Math.floor(IDY / 2);


          // let preCache1 = cacheTerrain[preKey1];
          // let preCache2 = cacheTerrain[preKey2];
          // let preCache3 = cacheTerrain[preKey3];
          // let preCache4 = cacheTerrain[preKey4];
          // if(preCache1 && preCache1.terrain){
          //   preCache1.terrain.visible = true;
          //   preCache1.endTime = Date.now();
          // }else if(preCache2 && preCache2.terrain){
          //   preCache2.terrain.visible = true;
          //   preCache2.endTime = Date.now();
          // }
            //fetch_terrain(key, unit, address, level, IDX, IDY, true);
          
        }
        cache.endTime = Date.now();
        continue;
      }

      cacheTerrain[key] = { id: key, level: level, isJpeg: false, demUrl: address, terrain: null, IDX, IDY};

      fetch_terrain(key, unit, address, level, IDX, IDY, true);

    }
  }
 
  for(var k in cacheTerrain){
    let cs = cacheTerrain[k];
    let terrain = cs.terrain;
    let level = cs.level;
    let IDX = cs.IDX;
    let IDY = cs.IDY;

    if(terrain){
      if(showKeyList[k]){
        terrain.visible = true;
      }else{
        terrain.visible = false;
      }
    }
    
    if(cs.startTime - cs.time > 5000 && !cs.endTime){ //로딩못한 경우
      if(terrain) {
        deleteTerrain(terrain);
      }else{
        delete cacheTerrain[k];
      }
    }

    let preKey4 = "dem-" + (level-4) + "-" + Math.floor(IDX / 16) + "-" + Math.floor(IDY / 16);
    let preKey3 = "dem-" + (level-3) + "-" + Math.floor(IDX / 8) + "-" + Math.floor(IDY / 8);
    let preKey2 = "dem-" + (level-2) + "-" + Math.floor(IDX / 4) + "-" + Math.floor(IDY / 4);
    let preKey1 = "dem-" + (level-1) + "-" + Math.floor(IDX / 2) + "-" + Math.floor(IDY / 2);

    if (preKey1 in cacheTerrain || preKey2 in cacheTerrain || preKey3 in cacheTerrain || preKey4 in cacheTerrain) {
      
    }else{
      if (Date.now() - cs.endTime > 3000) {
        if (terrain) {
          deleteTerrain(terrain);
        }

        delete cacheTerrain[k];
      }
    }
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
    'Zoom : [' + zoom + ']' + ' minLon minLat: ' + extent.ymin + ' ' + extent.xmin + ' maxLon maxLat: ' + extent.ymax + ' ' + extent.xmax + ' tileCnt:' + Object.keys(cacheTerrain).length
  ].join('<br>') + '</div>';
}

function deleteTerrain(terrain){
  quake.threeLayer.removeMesh(terrain);
  terrain.geometry.dispose();
  for (const key in terrain) {
    terrain[key] = null;
  }
  terrain = null;
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

function project(coord){
  //var delta = 1E-7;
  var rad = Math.PI / 180;
  var metersPerDegree = 6378137 * Math.PI / 180;
  var maxLatitude = 85.0511287798;
  var lon = coord[0];
  var lat = Math.max(Math.min(maxLatitude, coord[1]), -maxLatitude);
  var c;
  if(lat === 0){
      c = 0;
  }else{
      c = Math.log(Math.tan((90 + lat) * rad / 2)) / rad;
  }

  var x = lon * metersPerDegree;
  var y = c * metersPerDegree;

  return new maptalks.Coordinate(x, y);
}

function prjToPoint(coord){
  var scale = 152.8740565703525;
  var matrix = [1,-1,0,0];
  var x = matrix[0] * (coord.x - matrix[2]) / scale;
  var y = -matrix[1] * (coord.y - matrix[3]) / scale;
  return new maptalks.Point(x, y);
}

function coordinateToVector3(coordinate, z) {
  if (z === void 0) { z = 0; }
  var p = project(coordinate);
  var p2 = prjToPoint(p);
  return new THREE.Vector3(p2.x, p2.y, z);
}

quake.loadTerrainNetwork = async function () {
  let zResol = 80;
  var coordMin = new maptalks.Coordinate(128.755734, 34.978977);//부산
  var coordMax = new maptalks.Coordinate(129.314373, 35.396265);//부산
  //var coordMin = new maptalks.Coordinate(129.148876, 35.151681);
  //var coordMax = new maptalks.Coordinate(129.155753, 35.156076);
  //var proj = proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:3857'));
  level = 10;
  let unit = 360 / (Math.pow(2, level) * 10);
  let minIdx = Math.floor((coordMin.x + 180) / unit);
  let minIdy = Math.floor((coordMin.y + 90) / unit);
  let maxIdx = Math.floor((coordMax.x + 180) / unit);
  let maxIdy = Math.floor((coordMax.y + 90) / unit);
  //console.log(minIdx, minIdy, maxIdx, maxIdy);
  //console.log(tileGrid.zoom, coordMin, coordMax);

  var idxIdyList = Array.from(Array((maxIdx - minIdx + 1) * (maxIdy - minIdy + 1)), () => new Array(2));
  var index = 0;
  for (var i = minIdx; i <= maxIdx; i++) {
      for (var j = minIdy; j <= maxIdy; j++) {
          idxIdyList[index][0] = i + "";
          idxIdyList[index][1] = j + "";
          index++;
      }
  }

  for (var i = 0; i < idxIdyList.length; i++) {
      const IDX = idxIdyList[i][0];
      const IDY = idxIdyList[i][1];
      const layer = "dem";
      let address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;

      fetch(address).then(r => {
          const size = r.headers.get("content-length");
          if (Number(size) >= 16900) {
              r.arrayBuffer().then(function (buffer) {
                  //var byteArray = new Uint8Array(buffer);
                  p = new Parser(buffer);

                  let x = unit * (IDX - (Math.pow(2, level - 1) * 10));
                  let y = unit * (IDY - (Math.pow(2, level - 2) * 10));
                  let pdata = [];
                  let sData = null;
                  let eData = null;
                  for (var yy = 64; yy >= 0; yy--) {
                      for (var xx = 0; xx < 65; xx++) {
                          let xDegree = x + (unit / 64) * xx;
                          let yDegree = y + (unit / 64) * yy;
                          let height = p.getFloat4();
                          pdata.push([xDegree, yDegree, height]);

                          if (yy == 0 && xx == 64) {
                              eData = [xDegree, yDegree];
                          } else if (yy == 64 && xx == 0) {
                              sData = [xDegree, yDegree];
                          }
                      }
                  }
                  var geometry = new THREE.PlaneGeometry(1, 1, 64, 64);

                  /*for (var i = 0, l = geometry.vertices.length; i < l; i++) {
                    
                    const z = pdata[i][2]/zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
                    const v = gisObj.threeLayer.coordinateToVector3([pdata[i][0],pdata[i][1]], z);
                    geometry.vertices[i].x = v.x;
                    geometry.vertices[i].y = v.y;
                    geometry.vertices[i].z = v.z;
                  }*/
                  for (var i = 0, l = geometry.attributes.position.count; i < l; i++) {
                      const z = pdata[i][2] / zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
                      const v = quake.threeLayer.coordinateToVector3([pdata[i][0], pdata[i][1]], z);
                      geometry.attributes.position.setXYZ(i, v.x, v.y, v.z);
                  }

                  var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/ });
                  material.opacity = 1;
                  material.wireframe = false;
                  var address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
                  textureLoader.load(address, function (tx) {
                      material.map = tx;
                      material.needsUpdate = true;
                  });

                  var plane = new THREE.Mesh(geometry, material);
                  quake.threeLayer.addMesh(plane);
                  plane.custom2DExtent = new maptalks.Extent(sData[0], sData[1], eData[0], eData[1]);
                  terrainList.push(plane);
              });//arraybuffer
          }//16900
      }); //fetch
  }//for
}