import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r132/build/three.module.js';
import Parser from "/js/util/bufferParser_es6.js";
import {addScene} from '/worker/shared-orbitcontrols.js';


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
    for (var i = minIdx; i <= maxIdx; i++) {
        for (var j = minIdy; j <= maxIdy; j++) {
            idxIdyList[index][0] = i + "";
            idxIdyList[index][1] = j + "";
            index++;
        }
    }

    let turmX = maxIdx - minIdx + 1;
    let turmY = maxIdy - minIdy + 1;

    let urls = [];
    let urlsMap = new Map();
    for (var i = 0; i < idxIdyList.length; i++) {
        const IDX = idxIdyList[i][0];
        const IDY = idxIdyList[i][1];
        const layer = "dem";
        let address = "https://xdworld.vworld.kr/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
        urls.push(address);
        urlsMap.set(address, IDX + ":" + IDY);
    }

    let requests = urls.map(url => fetch(url));

    let responses = await Promise.all(requests);
    for (let response of responses) {
        console.log(`${response.url}: ${response.status}`); // 모든 url의 응답코드가 200입니다.
    }



    let pdata = [];
    let extentData = [];
    //let reqResults = await Promise.all(responses.filter((r, index, arr)=> Number(r.headers.get("content-length")) >= 16900));

    let resResultCnt = 0;
    let lastCnt = turmX * turmY;
    Promise.all(responses).then(resList => {
        resList.forEach(async r => {
            let parser = null;
            if (Number(r.headers.get("content-length")) >= 16900) {
                let buffer = await r.arrayBuffer();
                parser = new Parser(buffer);
            } else {
                parser = null;
            }

            let urlMap = urlsMap.get(r.url).split(':');
            let IDX = urlMap[0];
            let IDY = urlMap[1];

            let x = unit * (IDX - (Math.pow(2, level - 1) * 10));
            let y = unit * (IDY - (Math.pow(2, level - 2) * 10));

            let sData = null;
            let eData = null;
            for (var yy = 64; yy >= 0; yy--) {
                for (var xx = 0; xx < 65; xx++) {
                    let xDegree = x + (unit / 64) * xx;
                    let yDegree = y + (unit / 64) * yy;
                    let height = parser ? parser.getFloat4() : 0.1;
                    pdata.push([xDegree, yDegree, height]);

                    if (yy == 0 && xx == 64) {
                        eData = [xDegree, yDegree];
                    } else if (yy == 64 && xx == 0) {
                        sData = [xDegree, yDegree];
                    }
                }
            }


            extentData.push({ sData, eData });

            resResultCnt++;

            if (lastCnt == resResultCnt) {
                console.log('complete');
                console.log(pdata, extentData);

                createTerrain(turmX, turmY, urls, pdata, extentData);
            }
        });



    });
}

var createTerrain = async function (turmX, turmY, urls, pdata, extentData) {
    console.log(turmX, turmY, pdata, extentData);
    let zResol = 80;
    var geometry = new THREE.PlaneGeometry(turmX * 100, turmY * 100, turmX * 64, turmY * 64);

    /*for (var i = 0, l = geometry.vertices.length; i < l; i++) {
      
      const z = pdata[i][2]/zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
      const v = quake.threeLayer.coordinateToVector3([pdata[i][0],pdata[i][1]], z);
      geometry.vertices[i].x = v.x;
      geometry.vertices[i].y = v.y;
      geometry.vertices[i].z = v.z;
    }*/
    for (var i = 0, l = geometry.attributes.position.count; i < l; i++) {
        const z = pdata[i][2] / zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
        const v = {x:pdata[i][0], y:pdata[i][1], z};//coordinateToVector3([pdata[i][0], pdata[i][1]], z);
        geometry.attributes.position.setXYZ(i, v.x, v.y, v.z);
    }

    var material = new THREE.MeshBasicMaterial({ color: 'hsl(0,100%,50%)', });
    material.opacity = 1;
    material.wireframe = true;
    var address = '/resource/img/testTile.jpg';
    //var address = "https://xdworld.vworld.kr/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + 10 + "&IDX=" + 8782 + "&IDY=" + 3554;
    // quake.textureLoader.load(address, function(tx){
    //     material.map = tx;
    //     material.needsUpdate = true;
    // });

    var plane = new THREE.Mesh(geometry, material); 

    addScene(plane);

    // let e1 = coordinateToVector3([extentData[0].sData[0], extentData[0].sData[1]], 0);
    // let e2 = coordinateToVector3([extentData[0].eData[0], extentData[0].eData[1]], 0);
    // plane.custom2DExtent = new maptalks.Extent(e1.x, e1.y, e2.x, e2.y);
    //terrainList.push(plane);
}

function coordinateToVector3(){


}