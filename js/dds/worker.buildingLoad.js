importScripts('/js/maptalks/three.js');
importScripts('/js/maptalks/maptalks_removeDom.js');
importScripts('/js/maptalks/maptalks.three_removeDom.js');
importScripts('/js/proj4.js');
importScripts('/js/util/bufferParser.js');

var ray = new THREE.Raycaster();
var rayPos = new THREE.Vector3();
var rayDir = new THREE.Vector3(0, 0, -1); // Ray points down
var buildingData = null;
var geometryList = [];
var tileData = [];
var bdData = [];

let buildingDownloadWorker = new Worker('/js/dds/worker.buildingDownload.js');
buildingDownloadWorker.postMessage({what:'buildingDownload'});
buildingDownloadWorker.onmessage = (e) => {
    let result = new TextDecoder("utf-8").decode(e.data);
    buildingData = JSON.parse(result);
}

onmessage = async function (e) {
    let dd = ab2str(e.data);
    let buf = JSON.parse(dd);
    if(buf.what == 'TRLD'){
        const z_2 = 8.001423545269063;
        const v_2 = new THREE.Vector3(0, 0, z_2);
        const zResol = 80;
        rayPos.set(v_2.x, v_2.y, v_2.z);
    
        var coordMin = new maptalks.Coordinate(128.783010, 34.980677);
        var coordMax = new maptalks.Coordinate(129.314373, 35.396265);
        //var coordMin = new maptalks.Coordinate(129.148876, 35.151681);
        //var coordMax = new maptalks.Coordinate(129.155753, 35.156076);
        var proj = proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:3857'));
        level = 10;
        let unit = 360 / (Math.pow(2, level) * 10);
        let minIdx = Math.floor((coordMin.x+180)/unit);
        let minIdy = Math.floor((coordMin.y+90)/unit);
        let maxIdx = Math.floor((coordMax.x+180)/unit);
        let maxIdy = Math.floor((coordMax.y+90)/unit);

        var idxIdyList = Array.from(Array((maxIdx-minIdx+1)*(maxIdy-minIdy+1)), () => new Array(2));
        var index = 0;
        for (var i=minIdx ; i<=maxIdx ; i++) {
            for (var j=minIdy ; j<=maxIdy; j++) {
                idxIdyList[index][0] = i+"";
                idxIdyList[index][1] = j+"";
                index++;
            }
        }
    
        let urls = [];
        let params = [];
        for (var i=0 ; i<idxIdyList.length ; i++) {
            const IDX = idxIdyList[i][0];
            const IDY = idxIdyList[i][1];
            const layer = "dem";
            let url = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
            urls.push(url);
            params.push({IDX, IDY, level});
        }

        let reqIdx = 0;
        let requests = urls.map(async url => {
            const response = await fetch(url);
            return response;
        });
        let arrayBuffers = [];
        let existParams = [];
        for(const req of requests){
            let r = await req;
            const size = r.headers.get("content-length");
            
            let param = params[reqIdx];
            let IDX = param.IDX;
            let IDY = param.IDY;
            let level = param.level;
            reqIdx++;

            if(Number(size) >= 16900){
                let arrayBuffer = await r.arrayBuffer();
                arrayBuffers.push(arrayBuffer);
                existParams.push({IDX, IDY, level});
            }
        }
        reqIdx = 0;
        for(const buff of arrayBuffers){
            let r = await buff;
            let param = existParams[reqIdx];
            let IDX = param.IDX;
            let IDY = param.IDY;
            let level = param.level;
            reqIdx++;

                //.then(function(buffer) {
                    //var byteArray = new Uint8Array(buffer);
            p = new Parser(r);

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

            let vtxList = [];

            var geometry = new THREE.PlaneGeometry(1, 1, 64, 64);
            for (var i = 0, l = geometry.vertices.length; i < l; i++) {
                const z = pdata[i][2]/zResol;//quake.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
                const v = coordinateToVector3([pdata[i][0],pdata[i][1]], z);
                geometry.vertices[i].x = v.x;
                geometry.vertices[i].y = v.y;
                geometry.vertices[i].z = v.z;
                vtxList.push(v.x, v.y, v.z);
            }
            var address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
            
            var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/});
            var plane = new THREE.Mesh(geometry, material);   
            plane.custom2DExtent = new maptalks.Extent(sData[0], sData[1], eData[0], eData[1]);
            geometryList.push(plane);
            tileData.push({sData, eData, vtxList, address});
        }

        let buff = str2ab(JSON.stringify({what:'TRCP'}));
        this.postMessage(buff);

        this.setTimeout(function(){
            _loadBuilding();
        }, 4000);
    }
    else if(buf.what == 'TRCR'){
        if(tileData.length > 0){
            let buff = str2ab(JSON.stringify({what:'TRCR', data:tileData}));
            this.postMessage(buff);
        }
    }
    else if(buf.what == 'BDCR'){
        if(bdData.length > 0){
            this.postMessage({what:'BDCR', data:bdData});
        }
    }
    
}
function _loadBuilding(){
    if(buildingData){
        let positionHelper = new THREE.Object3D();
        positionHelper.position.z = 1;

        for(var i=0; i< buildingData.features.length; i++){
            let feature = buildingData.features[i];
            const geometry = feature.geometry;
            const type = feature.geometry.type;
            if (['Polygon', 'MultiPolygon'].includes(type)) {
                const height = feature.height || feature.properties.height || 20;
                if(height < 400){ //error data 400m높이 건물 이하로
                    const polygon = maptalks.GeoJSON.toGeometry(feature);
                    const properties = feature.properties;
                    properties.height = height;
                    let center =  polygon.getCenter();
                    const vv = coordinateToVector3([center.x, center.y], 0);
                    rayPos.x = vv.x;
                    rayPos.y = vv.y;
                    ray.set(rayPos, rayDir);
                    
                    var containGeo = null;
                    for(var j=0; j<geometryList.length; j++){
                        var containGeos = geometryList[j];
                        if(containGeos.custom2DExtent.contains(center)){
                            containGeo = containGeos;
                        }
                    }
                    if(containGeo){
                        let intersect = ray.intersectObject(containGeo);
                        if (intersect.length > 0) {
                            bdData.push({feature, custom_altitude:intersect[0].point.z});
                        }
                    }
                }
            }
        }
        let buff = str2ab(JSON.stringify({what:'BDCP'}));
        this.postMessage(buff);
    }else{
        setTimeout(function(){_loadBuilding();}, 1000);
    }
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

function ab2str(buf) {
    var uintArray = new Uint16Array(buf);
    var converted = [];
    uintArray.forEach(function(byte) {
        converted.push(String.fromCharCode(byte))
    });
    return converted.join('');
}

function str2ab(str) {
    var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
    var bufView = new Uint16Array(buf);
    for (var i=0, strLen=str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}