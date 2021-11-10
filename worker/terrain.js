import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r132/build/three.module.js';
import Parser from "/js/util/bufferParser_es6.js";
import {addScene} from '/worker/shared-orbitcontrols.js';

var loader = new THREE.ImageBitmapLoader();


export function _createTerrain() {
    loadTerrain();

}


var loadTerrain = async function () {

    let preloadData = { tile_zoom: 10, startpoint: "128.755734,34.978977", endpoint: "129.314373,35.396265" };
    let startLon = preloadData.startpoint.split(',')[0];
    let startLat = preloadData.startpoint.split(',')[1];
    let endLon = preloadData.endpoint.split(',')[0];
    let endLat = preloadData.endpoint.split(',')[1];

    let zResol = 80;
    var coordMin = { x: Number(startLon), y: Number(startLat) };
    var coordMax = { x: Number(endLon), y: Number(endLat) };
    //var coordMin = new maptalks.Coordinate(129.148876, 35.151681);
    //var coordMax = new maptalks.Coordinate(129.155753, 35.156076);
    //var proj = proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:3857'));
    let level = Number(preloadData.tile_zoom);
    let unit = 360 / (Math.pow(2, level) * 10);
    let minIdx = Math.floor((coordMin.x + 180) / unit);
    let minIdy = Math.floor((coordMin.y + 90) / unit);
    let maxIdx = Math.floor((coordMax.x + 180) / unit);
    let maxIdy = Math.floor((coordMax.y + 90) / unit);
    //console.log(minIdx, minIdy, maxIdx, maxIdy);
    //console.log(tileGrid.zoom, coordMin, coordMax);

    var idxIdyList = Array.from(Array((maxIdx - minIdx + 1) * (maxIdy - minIdy + 1)), () => new Array(2));
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
              let p = new Parser(buffer);
    
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
              
              for (var i = 0, l = geometry.attributes.position.count; i < l; i++) {
                  const z = pdata[i][2]/zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
                  const v = coordinateToVector3([pdata[i][0],pdata[i][1]], z);
                  geometry.attributes.position.setXYZ(i, v.x - 93952, v.y - 27219, v.z);
              }
            
              var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/});
              material.opacity = 1;
              material.wireframe = false;
              var address = "https://xdworld.vworld.kr/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
              
              loader.setOptions( { imageOrientation: 'flipY' } );
              loader.load( address, function ( imageBitmap ) {
                var tx = new THREE.CanvasTexture( imageBitmap );
                material.map = tx;
                material.needsUpdate = true;
              });
              
            
              
              var plane = new THREE.Mesh(geometry, material);   
              plane.rotation.x = - Math.PI / 2;

           
              addScene(plane);
               
 
            });//arraybuffer
          }//16900
        }); //fetch
      }//for
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

    return {x, y};
}

function prjToPoint(coord){
    var scale = 152.8740565703525;
    var matrix = [1,-1,0,0];
    var x = matrix[0] * (coord.x - matrix[2]) / scale;
    var y = -matrix[1] * (coord.y - matrix[3]) / scale;
    return {x, y};
}

function coordinateToVector3(coordinate, z) {
    if (z === void 0) { z = 0; }
    var p = project(coordinate);
    var p2 = prjToPoint(p);
    return new THREE.Vector3(p2.x, p2.y, z);
}