importScripts('/js/maptalks/three.js');
importScripts('/js/maptalks/maptalks_removeDom.js');
importScripts('/js/maptalks/maptalks.three_removeDom.js');
importScripts('/js/proj4.js');
importScripts('/js/util/bufferParser.js');

var ray = new THREE.Raycaster();
var rayPos = new THREE.Vector3();
var rayDir = new THREE.Vector3(0, 0, -1); // Ray points down
var geometryList = [];

onmessage = async function (e) {
    if(e.data.what == 'coordinateToVector3'){
        let rtnData = [];
       
        for(var i=0; i<e.data.data.length; i++){
            let rtd = e.data.data[i];
            let param = rtd.param;
            let eData = rtd.eData;
            let sData = rtd.sData;

            let vtxList = [];
            
            let geometry = new THREE.PlaneGeometry(1, 1, 64, 64);
            for(var j=0; j<rtd.tvL.length; j++){
                let vertex = rtd.tvL[j];
                geometry.vertices[i].x = vertex.x;
                geometry.vertices[i].y = vertex.y;
                geometry.vertices[i].z = vertex.z;
                vtxList.push(vertex.x, vertex.y, vertex.z);
            }
                
            var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/});
            material.opacity = 0.8;
            material.wireframe = true;
            var address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + param.level + "&IDX=" + param.IDX + "&IDY=" + param.IDY;
            var plane = new THREE.Mesh(geometry, material);
            plane.custom2DExtent = new maptalks.Extent(sData[0], sData[1], eData[0], eData[1]);   
            geometryList.push(plane);
            rtnData.push({sData, eData, vtxList, address});
        }
        this.postMessage({what:'terrainCreate',data:rtnData});
    }
    else if(e.data.what == 'terrain'){
        const z_2 = e.data.z_2;//quake.threeLayer.distanceToVector3(1000, 1000).x;
        const v_2 = e.data.v_2;//quake.threeLayer.coordinateToVector3([129.152369,35.153617], z_2);
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
    
        let rtnData = [];
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

        for(const req of requests){
            let r = await req;
            const size = r.headers.get("content-length");
            let param = params[reqIdx];
            let IDX = param.IDX;
            let IDY = param.IDY;
            let level = param.level;
            reqIdx++;
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
                    rtnData.push({geometryVerticesLength:4225/*65X65*/, pdata, eData, sData, param});
                });
            }
        }
        this.postMessage({what:'coordinateToVector3',data:rtnData});
    }
    else if(e.data.what == 'buildingLoad'){
        let url = 'http://220.123.241.100:8181/geoserver/dds/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dds%3Atb_building_g2&outputFormat=application%2Fjson';
        let buildingSize = 80805888;
        let response = await fetch(url);
        const reader = response.body.getReader();
        const contentLength = buildingSize;//+response.headers.get('Content-Length');

        let receivedLength = 0; // received that many bytes at the moment
        let chunks = []; // array of received binary chunks (comprises the body)
        while(true) {
            const {done, value} = await reader.read();

            if (done) {
                break;
            }

            chunks.push(value);
            receivedLength += value.length;
            var tic = receivedLength / contentLength * 100;
            tic = Math.round(tic * 100) / 100;
            //if(tic < 90) quake.progressPBar(tic); else quake.progressBarContents('데이터 취합중..');
        }

        // Step 4: concatenate chunks into single Uint8Array
        let chunksAll = new Uint8Array(receivedLength); // (4.1)
        let position = 0;
        for(let chunk of chunks) {
        chunksAll.set(chunk, position); // (4.2)
        position += chunk.length;
        }

        // Step 5: decode into a string
        let result = new TextDecoder("utf-8").decode(chunksAll);

        // We're done!
        let commits = JSON.parse(result);

        let polygons = [];

        let positionHelper = new THREE.Object3D();
        positionHelper.position.z = 1;

        let validBuildingCnt = 0;
        console.time("testFunction");

        let centerList = [];
        for(var i=0; i< commits.features.length; i++){
        //if(polygons.length > 100000) break;
            let feature = commits.features[i];
            const geometry = feature.geometry;
            const type = feature.geometry.type;
            if (['Polygon', 'MultiPolygon'].includes(type)) {
                const height = feature.height || feature.properties.height || 20;
                if(height < 400){ //error data 400m높이 건물 이하로
                    const properties = feature.properties;
                    properties.height = height;
                    feature.height = height;
                    const polygon = maptalks.GeoJSON.toGeometry(feature);
                    let center =  polygon.getCenter(); 
                    centerList.push({centerX:center.x, centerY:center.y, feature});
                }
            }
        }

        this.postMessage({what:'features', data:centerList});
    }
    else if(e.data.what == 'featuresProcess'){
        for(var i=0; i<e.data.data.length; i++){
            const vv = e.data.data[i].center;
            rayPos.x = vv.x;
            rayPos.y = vv.y;
            ray.set(rayPos, rayDir);
            const feature = e.data.data[i].feature;
            
            let originCenter = new maptalks.Coordinate(e.data.data[i].originCenter[0], e.data.data[i].originCenter[1]);
            
            // Check where it intersects terrain Mesh
            var containGeo = null;
            for(var j=0; j<geometryList.length; j++){
                var containGeos = geometryList[j];
                if(containGeos.custom2DExtent.contains(originCenter)){
                    containGeo = containGeos;
                }
            }
            if(containGeo){
                let intersect = ray.intersectObject(containGeo);
                if ( intersect.length > 0) {
                    polygon.custom_altitude = intersect[0].point.z;
                }
            }

            
        }
    }
    
}
