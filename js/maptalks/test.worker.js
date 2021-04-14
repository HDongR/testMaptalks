importScripts('/js/three.js');
importScripts('/js/maptalks.js');
importScripts('/js/threejs-cube.js');

var quake = {
    map : {},
    threeLayer : {},
  //  barsLayer : {}, 
  //  geojsonVtLayer : {},
};
const textureLoader = new THREE.TextureLoader();
var workerCount = 2;
var tinWorkers = [];
var currentWorker = 0;
var tinWorker;
for(var i=0; i<workerCount; i++){
  tinWorkers.push({id:i, itnWorker:new Worker('./js/worker.tin_backup.js')});
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

quake.viewMap = function(){
    quake.setBaseLayer();
    //quake.setThreeLayer();
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

  
let cube = null;

self.onmessage = function(e) {
    switch (e.data.msg) {
    case 'start':
        quake.viewMap();

        if (!cube) {
        
        e.data.canvas.style = { width: 0, height: 0 }
        const renderer = new THREE.WebGLRenderer({ canvas: e.data.canvas });
        renderer.setSize(400, 200);
        cube = new ThreejsCube(renderer);
        }
        cube.animate();
        break;
    }
};
  