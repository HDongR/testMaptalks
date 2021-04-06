var quake = {
  map : {},
  threeLayer : {},
//  barsLayer : {}, 
//  geojsonVtLayer : {},
};

const textureLoader = new THREE.TextureLoader();


class ResourceTracker {
  constructor() {
    this.resources = new Set();
  }
  track(resource) {
      if (!resource) {
        return resource;
      }

      // handle children and when material is an array of materials or
      // uniform is array of textures
      if (Array.isArray(resource)) {
        resource.forEach(resource => this.track(resource));
        return resource;
      }

      if (resource.dispose || resource instanceof THREE.Object3D) {
        this.resources.add(resource);
      }
      if (resource instanceof THREE.Object3D) {
        this.track(resource.geometry);
        this.track(resource.material);
        this.track(resource.children);
      } else if (resource instanceof THREE.Material) {
        // We have to check if there are any textures on the material
        for (const value of Object.values(resource)) {
          if (value instanceof THREE.Texture) {
            this.track(value);
          }
        }
        // We also have to check if any uniforms reference textures or arrays of textures
        if (resource.uniforms) {
          for (const value of Object.values(resource.uniforms)) {
            if (value) {
              const uniformValue = value.value;
              if (uniformValue instanceof THREE.Texture ||
                  Array.isArray(uniformValue)) {
                this.track(uniformValue);
              }
            }
          }
        }
      }
      return resource;
    }
    untrack(resource) {
      this.resources.delete(resource);
    }
    dispose() {
      for (const resource of this.resources) {
        if (resource instanceof THREE.Object3D) {
          if (resource.parent) {
            resource.parent.remove(resource);
          }
        }
        if (resource.dispose) {
          resource.dispose();
        }
      }
      this.resources.clear();
   }
}

var tinWorker;
function getTinWorker() {
    if (!tinWorker) {
        tinWorker = new Worker('./js/worker.tin.js');
    }
    return tinWorker;
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
    }
    geometry.computeVertexNormals();
    geometry.computeFaceNormals();
    // geometry.computeFlatVertexNormals();
    // geometry.computeMorphNormals();
    const buffGeom = new THREE.BufferGeometry();
    buffGeom.fromGeometry(geometry);
    if (callback) {
        callback(buffGeom);
        delete geometryCacahe[id];
    }
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
  pushQueue(getTinWorker(), { points, id, indexMap, zs, minZ }, messageCallback);
  return {
      buffGeom, minHeight
  };
}

//default values
const OPTIONS = {
  altitude: 0
};
class Terrain extends maptalks.BaseObject {
  constructor(data, options, material, layer) {
      options = maptalks.Util.extend({ data, layer }, OPTIONS, options);
      super();
      this._initOptions(options);

      const { buffGeom, minHeight } = getGeometry(data, layer, (buffGeom) => {
          this.getObject3d().geometry = buffGeom;
          this.getObject3d().geometry.needsUpdate = true;
      });
     
      textureLoader.load('/tiles/image/tile_281396_113916.jpeg',function(tx){
        material.map = tx;
        material.needsUpdate = true;
        material.wireframe = false; 
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

  /**
* animationShow test
* 
* */
  animateShow(options = {}, cb) {
      if (this._showPlayer) {
          this._showPlayer.cancel();
      }
      if (maptalks.Util.isFunction(options)) {
          options = {};
          cb = options;
      }
      const duration = options['duration'] || 1000,
          easing = options['easing'] || 'out';
      const player = this._showPlayer = maptalks.animation.Animation.animate({
          'scale': 1
      }, {
          'duration': duration,
          'easing': easing
      }, frame => {
          const scale = frame.styles.scale;
          if (scale > 0) {
              this.getObject3d().scale.set(1, 1, scale);
          }
          if (cb) {
              cb(frame, scale);
          }
      });
      player.play();
      return player;
  }

}

const resTracker = new ResourceTracker();
const track = resTracker.track.bind(resTracker);

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
          //projection:'EPSG:3857'
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
      pitch: 40,
      zoom: 15,
      maxZoom: 20,
      minZoom: 9,
      maxPitch: 60,
      centerCross : true,
      // spatialReference:{
      //     projection:'EPSG:4326'//map control 좌표계
      // },
      centerCross: true,
      doubleClickZoom: false,
      baseLayer: setilLayer,
  });
  
}

//three layer 생성
quake.setThreeLayer = function(){
  const layer = new maptalks.VectorLayer('layer').addTo(quake.map);

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
    
    //setilLayer.hide();
    
    animation();
  }
  quake.threeLayer.addTo(quake.map);
  
  quake.map.on('moving moveend zoomend', update);
  
  update();
}

var terrains = [];


quake.set3DTile = function(){

  fetch('/tiles/lonlatfile/terrain_file_281396_113916.txt').then(res => res.text()).then(evadata => {
    let data = evadata.split("\n");
    let pdata = [];
    data.forEach(v =>{
      let j = v.split(",");
      j[0] = Number(j[0]);
      j[1] = Number(j[1]);
      j[2] = Number(j[2]);
      pdata.push(j);
    });
    var material = new THREE.MeshBasicMaterial
    const terrain = new Terrain(pdata, { interactive: false }, material, quake.threeLayer);
    terrains.push(terrain);
    quake.threeLayer.addMesh(terrains);


    animation();
  });
}




function update() {
  var projection = quake.map.getProjection();
  var center = quake.map.getCenter(),
    prj = projection.project(center),
    containerPoint = quake.map.coordinateToContainerPoint(center).round();

  document.getElementById('coordinate').innerHTML = '<div><br><br>' + [
    'Center : [' + center.x.toFixed(5) + ', ' + center.y.toFixed(5) + ']',
    'Projected Coordinate : [' + prj.x.toFixed(5) + ', ' + prj.y.toFixed(5) + ']',
    'ContainerPoint is the screen position in px from northwest of the map container.',
    'ContainerPoint : [' + containerPoint.x + ', ' + containerPoint.y + ']'
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