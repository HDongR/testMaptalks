var quake = {
    map: {},
    threeLayer: {},
    //  barsLayer : {}, 
    //  geojsonVtLayer : {},
};

let sliceCnt = 5;
let timeAvgSlice = 4;

quake.loadWAV = function () {
    console.log('start');
    console.time('performance');
    testTimeText2();

}

quake.viewMap = function () {
    quake.setBaseLayer();
    quake.setThreeLayer();
 
}

function animation() {
    // layer animation support Skipping frames
    quake.threeLayer._needsUpdate = !quake.threeLayer._needsUpdate;
    if (quake.threeLayer._needsUpdate) {
        quake.threeLayer.renderScene();
    }

    stats.update();

    //barAnim();
    barAnim2();
   
    requestAnimationFrame(animation);
}



quake.setBaseLayer = function () {
    //basemap : vworld
    // var url = 'http://api.vworld.kr/req/wmts/1.0.0/' + properties.baseMapAPIKey + '/Base/{z}/{y}/{x}.png'

    var setillayerUrl = 'http://api.vworld.kr/req/wmts/1.0.0/' + 'D6200AF4-16B4-3161-BE8E-1CCDD332A8E3' + '/Satellite/{z}/{y}/{x}.jpeg';
    var setilLayer = new maptalks.TileLayer('tile2', {
        spatialReference: {
            projection: 'EPSG:3857'
            // other properties necessary for spatial reference
        },
        'urlTemplate': setillayerUrl
    });

    quake.map = new maptalks.Map("map", {
        center: [129.15158, 35.15361],
        zoom: 12,
        centerCross: true,
        doubleClickZoom: false,
        baseLayer: setilLayer,
    });

}

//three layer 생성
quake.setThreeLayer = function () {
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

        animation();
    }

    quake.threeLayer.addTo(quake.map); 

    //quake.map.on('moving moveend zoomend pitch rotate', update);

    //update();

    //quake.map.on('moving moveend zoomend pitch rotate', testing);
}

var hardwareConcurrency = typeof window !== 'undefined' ? window.navigator.hardwareConcurrency || 4 : 0;
var workerCount = 5;//Math.max(Math.floor(hardwareConcurrency / 2), 1);
var currentWorker = 0;
var workerList = [];

let receivedData = {};
for(var i=0; i<workerCount; i++){
    let w = new Worker('/js/dds/wav_worker.js');
    w.onmessage = function(e) {
        receivedData[e.data.id] = e.data.resultData;

        if(objSize(receivedData) == workerCount){
            // let sortedO = sortObject(receivedData);
            // for (k in sortedO){
            //     let zxdf = sortedO[k];
            //     __data.push(...zxdf);
            // }
            let l = Object.values(receivedData);
            l.forEach(_l => {
                __data.push(..._l);
            });
            //__data.push(...receivedData);
            resolutionWAV();
            console.log('what');
        }
    }

    workerList.push({id:i, w});
}

function objSize(obj) {
    var size = 0,
      key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

function sortObject(o){
    var sorted = {},

    key, a = [];
    for (key in o) {
        if (o.hasOwnProperty(key)) a.push(key);
    }
    a.sort(); 

    for (key=0; key<a.length; key++) {
        sorted[a[key]] = o[a[key]];
    }
    return sorted;
}


function getTinWorker() {
    var tt;
    workerList.some(el => {
      if(el.id == currentWorker){
        if(el.w){
          tt = el.w;
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

function postWorker(data, start, end, id, timeAvgSlice){
    getTinWorker().postMessage({what:"sliceProcess", data, start, end, id, timeAvgSlice});
}



let geometries = [];
let mergedBars = null;
//let zValues = [];
let __data = [];

async function testTimeText2() {
    let df = await dfd.read_csv("http://localhost:5500/test/test_time_pgv.csv");
    let data = df.data.slice(0);
    let columns = df.columns;
    if (columns[0].trim() == 'name' && columns[1].trim() == 'lat' && columns[2].trim() == 'lon' && columns[3].trim() == 'max_pgv' && columns[4].trim() == 'times_pga') {
    } else {
        alert("잘못된 형식입니다.\n헤더는 [name,lat,lon,max_pgv,times_pga]로 구성되어야 합니다.");
        return;
    }

    for (var member in df) delete df[member];
    df = null;
  
    let resultData = [];
     
    for (var i = 0; i < data.length; i++) {
        //if (i == 10000) break;
        if(!data[i]){
            continue;
        }
        
        let row = data[i];
        let name = row[0];
        let lat = Number(row[1]);
        let lon = Number(row[2]);
        let max_pgv = Number(row[3]);
        let times_pga = row[4];

        if (lon && lat) {
            
            let splitpga = times_pga.split(' ');
            
            let splitpga_ = [];
            for (var k = 0; k < splitpga.length; k++) {
                if (splitpga[k] == '') continue;
                splitpga_.push(splitpga[k]);
            }
            let _tt = splitpga_.slice(0);
            
            let timeTmpAvgList = [];
            let timeAvgList = [];
            for(var _t=1; _t<=_tt.length; _t++){
                let t = Number(_tt[_t-1]);
                timeTmpAvgList.push(t);
                if(_t % timeAvgSlice == 0){
                    let sum = 0;
                    let avg = 0;
                    for(var _t2=0; _t2<timeTmpAvgList.length; _t2++){
                        sum += timeTmpAvgList[_t2];
                    }
                    avg = sum / timeTmpAvgList.length;
                    timeAvgList.push(avg);
                    timeTmpAvgList.length = 0;
                }
                
            }
            resultData.push([lat, lon, timeAvgList]);
            //console.log(i);
            splitpga_.length = 0;
            
            splitpga.length = 0;
            
        }
        data[i].length = 0;
        name = null;
        lat = null;
        lon = null;
        max_pgv = null;
        times_pga = null;
        splitpga_ = null;
        splitpga = null;
        data[i] = null;
    }



    let elementSize = Math.floor(resultData.length / sliceCnt);
    let namugi = resultData.length % sliceCnt;
    
    for(var i=0; i<sliceCnt; i++) {
        var start = i * elementSize;
        var end = (i + 1) * elementSize;
        if(namugi > 0) {
            if(i == sliceCnt - 1) {
                end = resultData.length;
            }
        }
        let sl = resultData.slice(start, end);  
        postWorker(sl, start, end, i, timeAvgSlice);
    }
}

let blossomMesh = null;

function resolutionWAV(){
    positionHelper.position.z = 1;

    const geometry = new THREE.BoxGeometry(3, 3, 1);

    const material = new THREE.MeshPhongMaterial({transparent: true, opacity:0.7});

    blossomMesh = new THREE.InstancedMesh( geometry, material, __data.length );
    
    blossomMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage ); // will be updated every frame

    for (var i = 0; i < __data.length; i++) { 
        blossomMesh.setColorAt( i, color);
    }


    quake.threeLayer.addMesh(blossomMesh);

    
    

    console.timeEnd('performance'); 
}

let test_2 = 0;
let isEndIdx2 = 0;
let mz = [0,2,5,7,10,11,12,13,16,17,18,19];
let psCnt = 24;
const color = new THREE.Color();

function __getColor(p){
    if(p >= 0 && p < 0.02){
        return {x:234,y:234,z:185,w:255};
        //return {x:0,y:0,z:0,w:0};
    }else if(p >= 0.02 && p < 0.04){
        return {x:255,y:254,z:177,w:255};
        //return {x:0,y:0,z:0,w:0};
    }else if(p >= 0.04 && p < 0.06){
        return {x:254,y:251,z:0,w:255};
    }else if(p >= 0.06 && p < 0.08){
        return {x:254,y:186,z:0,w:255};
    }else if(p >= 0.08 && p < 0.1){
        return {x:254,y:114,z:0,w:255};
    }else if(p >= 0.1 && p < 0.12){
        return {x:252,y:48,z:1,w:255};
    }else if(p >= 0.12 && p < 0.14){
        return {x:236,y:0,z:0,w:255};
    }else if(p >= 0.14 && p < 0.16){
        return {x:169,y:0,z:2,w:255};
    }else if(p >= 0.16 && p < 0.18){
        return {x:101,y:0,z:0,w:255};
    }else if(p >= 0.18 && p < 0.2){
        return {x:32,y:0,z:0,w:255};
    }else if(p >= 0.2){
        return {x:32,y:0,z:0,w:255};
    }
    return {x:212,y:0,z:255,w:255};
}

const positionHelper = new THREE.Object3D();
let normalize = 10.0;
let coordMap = new Map();
function barAnim2(){
    if(blossomMesh != null){
 

        for (var i = 0; i < __data.length; i++) {
            let __d = __data[i];
            let splitpga_ = __d[2]; 

            isEndIdx2 = splitpga_.length;
 
            let p = splitpga_[test_2];
            let boxDepth = p * 100;
            let lon = __d[1];
            let lat = __d[0];
            let key = i;

            var position = null;
            
            if(coordMap.has(key)){
                position = coordMap.get(key);
            }else{
                position = quake.threeLayer.coordinateToVector3([lon, lat]);
                coordMap.set(key, position);
            }

            if(boxDepth <= 0){
                positionHelper.position.y = 0;
                positionHelper.position.x = 0; 
            }else{
                positionHelper.position.y = position.y;
                positionHelper.position.x = position.x;
            }
            
            
            let v_type = 'CITY';
            if(v_type && v_type == 'CITY'){
                
                boxDepth = normalize*Math.log2(boxDepth);
            }

            positionHelper.position.z = boxDepth/2;
            positionHelper.scale.z = boxDepth;

            let color__ = __getColor(p);
            //color.setHex( Math.random() * 0xffffff
            color.r = color__.x/255;
            color.g = color__.y/255;
            color.b = color__.z/255;
            if(boxDepth <= 0.0){
                positionHelper.scale.z = 0;
            }

            positionHelper.updateMatrix();
            blossomMesh.setMatrixAt( i, positionHelper.matrix );
            blossomMesh.setColorAt( i, color );
            
            

        }
        blossomMesh.instanceColor.needsUpdate = true;
        blossomMesh.instanceMatrix.needsUpdate = true;
        
        test_2++;
        if(isEndIdx2 <= test_2){
            test_2 = 0;
        }


        // let attr = mergedBars.geometry.attributes;
        
        // let nextIdx = 0;
        // for(var i=0; i<attr.position.count; i++){
            
        //     if(i % psCnt == 0 && i >= psCnt){
        //         nextIdx++;
        //     }
        //     let splitpga_ = __data[nextIdx][2];
        //     let lon = __data[nextIdx][1];
        //     let lat = __data[nextIdx][0];
        //     let p = splitpga_[test_2];
        //     isEndIdx2 = splitpga_.length;
        //     if(mz[0]+(nextIdx*24) == i || mz[1]+(nextIdx*24) == i || mz[2]+(nextIdx*24) == i || mz[3]+(nextIdx*24) == i  || 
        //         mz[4]+(nextIdx*24) == i || mz[5]+(nextIdx*24) == i || mz[6]+(nextIdx*24) == i || mz[7]+(nextIdx*24) == i  || 
        //         mz[8]+(nextIdx*24) == i || mz[9]+(nextIdx*24) == i || mz[10]+(nextIdx*24) == i || mz[11]+(nextIdx*24) == i){
        //         let normalizedMultiple = 100;
        //         let boxDepth = p * normalizedMultiple;
        //         if(boxDepth == 0){
        //             continue;
        //         }
        //         boxDepth = boxDepth == 0 ? 1 : boxDepth;
        //         boxDepth = 20*Math.log2(boxDepth);
        //         attr.position.setZ(i, boxDepth);//array[i] = boxDepth;
                
        //     }
             
        //     // let normalizedMultiple = 100;
        //     // let boxDepth = p * normalizedMultiple;
        //     // if(boxDepth == 0){
        //     //     continue;
        //     // }
        //     // boxDepth = boxDepth == 0 ? 1 : boxDepth;
        //     // boxDepth = 20*Math.log2(boxDepth);
        //     // attr.position.setZ(i, boxDepth);//array[i] = boxDepth;
        //     let color = __getColor(p);
        //     attr.color.setXYZW(i, color.x, color.y, color.z, color.w);
        // }
        // mergedBars.geometry.attributes.position.needsUpdate = true;
        // mergedBars.geometry.attributes.color.needsUpdate = true;
        // //mergedBars.geometry.computeBoundingBox();
        // //mergedBars.geometry.computeBoundingSphere();

        // // isEndIdx = b.options.splitpga_.length;
        // // let pga = b.options.splitpga_[test_];
        // // let _color = getColor(pga);
        // // b.object3d.material.color.set(_color);
        // // b.object3d.material.needsUpdate = true;
        // // b.setAltitude(pga * 1000);

        // test_2++;
        // if(isEndIdx2 <= test_2){
        //     test_2 = 0;

        //     for(var i=0; i<attr.position.count; i++){ 
        //         let color = __getColor(0);
        //         attr.position.setZ(i, 1);
        //         attr.color.setXYZW(i, color.x, color.y, color.z, color.w);
        //     } 
        //     mergedBars.geometry.attributes.position.needsUpdate = true;
        //     mergedBars.geometry.attributes.color.needsUpdate = true;
        // }
    } 
}