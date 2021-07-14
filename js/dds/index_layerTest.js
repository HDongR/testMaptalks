var quake = {
    map: {},
    threeLayerList: [],
};

quake.viewMap = function () {
    quake.setBaseLayer();
    quake.setThreeLayer('1');
    quake.setThreeLayer('2');
    quake.setStaticalBuilding();
    animation();
}

function animation() {
    // layer animation support Skipping frames
    quake.threeLayerList[0]._needsUpdate = !quake.threeLayerList[0]._needsUpdate;
    if (quake.threeLayerList[0]._needsUpdate) {
        quake.threeLayerList[0].renderScene();
    }
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
        zoom: 10,
        maxZoom: 18,
        minZoom: 9,
        centerCross: true,
        doubleClickZoom: false,
        baseLayer: setilLayer,
    });

}

//three layer 생성
quake.setThreeLayer = function (id) {
    let threeLayer = new maptalks.ThreeLayer(id, {
        forceRenderOnMoving: false,
        forceRenderOnRotating: false
    });

    threeLayer.prepareToDraw = function (gl, scene, camera) {
        var light = new THREE.DirectionalLight(0xffffff);
        light.position.set(0, -10, 10).normalize();
        scene.add(light);
    }

    threeLayer.addTo(quake.map);

    quake.threeLayerList.push(threeLayer);
    //quake.map.on('moving moveend zoomend pitch rotate', update);

    //update();
}
 
var buildingMeshs = [];

quake.setStaticalBuilding = async function () {
    let url = 'http://220.123.241.100:8181/geoserver/dds/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dds%3Atb_building_g2&outputFormat=application%2Fjson';
    let buildingSize = 80805888;
    quake.startLoadingBar();

    let response = await fetch(url);
    const reader = response.body.getReader();
    const contentLength = buildingSize;//+response.headers.get('Content-Length');

    let receivedLength = 0; // received that many bytes at the moment
    let chunks = []; // array of received binary chunks (comprises the body)
    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
        receivedLength += value.length;
        var tic = receivedLength / contentLength * 100;
        tic = Math.round(tic * 100) / 100;
        if (tic < 90) quake.progressPBar(tic); else quake.progressBarContents('데이터 취합중..');
    }

    // Step 4: concatenate chunks into single Uint8Array
    let chunksAll = new Uint8Array(receivedLength); // (4.1)
    let position = 0;
    for (let chunk of chunks) {
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
 
    console.time("testFunction");
    for (var i = 0; i < commits.features.length; i++) {
        //if(polygons.length > 100000) break;
        let feature = commits.features[i];
        const geometry = feature.geometry;
        const type = feature.geometry.type;
        if (['Polygon', 'MultiPolygon'].includes(type)) {
            const height = feature.height || feature.properties.height || 20;
            if (height < 400) { //error data 400m높이 건물 이하로
                const properties = feature.properties;
                properties.height = height;
                const polygon = maptalks.GeoJSON.toGeometry(feature);
                
                // let center = polygon.getCenter();
                // const vv = quake.threeLayerList[0].coordinateToVector3(center);
                // rayPos.x = vv.x;
                // rayPos.y = vv.y;
                // ray.set(rayPos, rayDir);
 
                // var containGeo = null;
                // for (var j = 0; j < geometryList.length; j++) {
                //     var containGeos = geometryList[j];
                //     if (containGeos.custom2DExtent.contains(center)) {
                //         containGeo = containGeos;
                //     }
                // }
                // if (containGeo) {
                //     let intersect = ray.intersectObject(containGeo);
                //     if (intersect.length > 0) {
                //         polygon.custom_altitude = intersect[0].point.z;
                //     }
                // }


                polygon.setProperties(properties);
                polygons.push(polygon);
            }
        }
    }

    if (polygons.length > 0) {
        var buildingColor = '#BDBDBD';
        var buildingMaterial = new THREE.MeshPhongMaterial({ color: buildingColor, transparent: true, opacity: 1 });
        var mesh = quake.threeLayerList[0].toExtrudePolygons(polygons.slice(0, Infinity), { topColor: '#fff', interactive: false }, buildingMaterial);
        quake.threeLayerList[0].addMesh(mesh);
        polygons.length = 0;
    }

    quake.threeLayerList[0].renderScene();
    quake.endLoadingBar();
}

quake.startLoadingBar = function () {
    //화면의 높이와 너비를 구한다.
    var maskHeight = $(document).height();
    var maskWidth = window.document.body.clientWidth;

    var mask = "<div id='mask' style='position:absolute; z-index:9000; background-color:#000000; display:none; left:0; top:0;'></div>";
    var loadingImg = '';

    loadingImg += "<div id='loadingImg' style='width:500px; position:absolute; left:50%; top:40%; display:none; z-index:10000;align:center;font-weight:bold;'>";
    /* loadingImg += "<img src='/dds/resources/images/common/loading_01.png'/>";*/
    loadingImg += "<div id='pbar'><div class='progress-label' style='text-align:center;top: 4px;font-weight: bold;text-shadow: 1px 1px 0 #fff;'>Loading...</div></div>";
    loadingImg += "</div>";

    //화면에 레이어 추가
    $('body')
        .append(mask)
        .append(loadingImg)

    //마스크의 높이와 너비를 화면 것으로 만들어 전체 화면을 채운다.
    $('#mask').css({
        'width': maskWidth
        , 'height': maskHeight
        , 'opacity': '0.3'
    });

    //마스크 표시
    $('#mask').show();

    //로딩중 이미지 표시
    $('#loadingImg').show();

    var progressbar = $("#pbar"),
        progressLabel = $(".progress-label");

    progressbar.progressbar({
        value: false,
        change: function () {
            progressLabel.text(progressbar.progressbar("value") + "%");
        },
        complete: function () {
            setTimeout(endLoadingBar, 0);
        }
    });
}

quake.progressPBar = function (pval) {
    var progressbar = $("#pbar");
    var val = progressbar.progressbar("value") || 0;

    progressbar.progressbar("value", pval);
}

quake.progressBarContents = function (c) {
    var progressbar = $("#pbar"),
        progressLabel = $(".progress-label");
    progressbar.progressbar("value", 99.9);
    progressLabel.text(c);
}

quake.endLoadingBar = function () {
    $('#mask, #loadingImg').hide();
    $('#mask, #loadingImg').remove();
}