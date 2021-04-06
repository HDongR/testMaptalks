
var quake = {
    map : {},
    threeLayer : {},
//  barsLayer : {}, 
//  geojsonVtLayer : {},
};



var baseConfig = {
    minZoom: 9,
    maxZoom: 20
};

var legendColor = [];
var buildingLayer = [];
var heatmap = null;

var properties = {}; 
var renderStatus = 'loading';

var prevMode = "";
var bars = [];

var bars2 = [];
var gap = 0;

var uSigungu;
var markLayers = [];
var isTable = -1;
var isGraphic = -1;
var isHm = -1;

var sig_fd_polygon = []; // 도시 중심 - 시군구 표시

var gui = null;
var mapOpacity = null;

var legendHtml = [];

var render_bars = [];

var infoWindow;
 

var damageBuildingMaterials = [];
 

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


const resTracker = new ResourceTracker();
const track = resTracker.track.bind(resTracker);

quake.viewMap = function(){
    //공통 properties 설정
    area.getCommonProperties(function(data){
        properties.contextPath = data.contextPath;
        properties.geoserver_url = data.geoserver_url;
        properties.gisProxy = data.gisProxy;
        properties.baseMapAPIKey = data.baseMapAPIKey;
        properties.serverIp = data.serverIp;
    })
    quake.setBaseLayer();
    quake.setThreeLayer();
    
    //시나리오 리스트 조회
    quake.selectScenarioList();
    
    //범례별 색상값 조회
    quake.setLegendColor();
    
    //범례별 빌딩색깔 메터리얼 생성
    quake.initBuildingMaterial();
    
    // 시도 설정 / 사용자 시도 정보
    quake.userSigungu();
    
    // 기능 목록
    quake.fnList();
    
    //기능 클릭이벤트
    quake.addPointEvent();
    
    //
    mapOpacity = new MapOpacity();
}

/*
 * 건물피해도 범례별 색상 정보 조회
 */
quake.setLegendColor = function() {
    var params = {
        scenario_cd : 'sco_0002'
    }
    
    $.ajax({
        type : 'POST',
        url : properties.contextPath + '/gis/quake/selectLegendColor.do',
        async: false,
        data : params,
        dataType : 'json',
        success : function(data) {          
            var dataList = data.dataList;

            var target = $('#mLegend .mia_con');
            $('#mLegend .mia_con div').remove();
            
            legendColor = [];
            $.each(dataList, function(idx, obj){
                legendColor.push(obj.color);
                
                var $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:" + obj.color + ";' />",{}).appendTo(target);
                $('<span style="color: white;">' + obj.f_value + "< 피해도 <" + obj.t_value + '</span>').appendTo($d);
            })
            
            //console.log(legendColor);
        }
    });
}

/*빌딩색상메터리얼 초기화*/
quake.initBuildingMaterial = function() {
    for(var i=0; i<legendColor.length; i++){
        damageBuildingMaterials[i] = new THREE.MeshPhongMaterial({ color: legendColor[i], transparent: true });
    }
}


var normallayerUrl = 'http://api.vworld.kr/req/wmts/1.0.0/' + 'D6200AF4-16B4-3161-BE8E-1CCDD332A8E3' + '/Base/{z}/{y}/{x}.png';
var normalLayer = new maptalks.TileLayer('tile1', {
    spatialReference:{
        projection:'EPSG:3857'
        // other properties necessary for spatial reference
      },
    'urlTemplate' : normallayerUrl
});
    
var setillayerUrl = 'http://api.vworld.kr/req/wmts/1.0.0/' + 'D6200AF4-16B4-3161-BE8E-1CCDD332A8E3' + '/midnight/{z}/{y}/{x}.png';
var setilLayer = new maptalks.TileLayer('tile2', {
    spatialReference:{
        projection:'EPSG:3857'
        // other properties necessary for spatial reference
      },
    'urlTemplate' : setillayerUrl
});
     
var earthlayerUrl = 'http://api.vworld.kr/req/wmts/1.0.0/' + 'D6200AF4-16B4-3161-BE8E-1CCDD332A8E3' + '/gray/{z}/{y}/{x}.png';
var earthLayer = new maptalks.TileLayer('tile3', {
    spatialReference:{
        projection:'EPSG:3857'
        // other properties necessary for spatial reference
      },
    'urlTemplate' : earthlayerUrl
});


quake.setBaseLayer = function() {
    //basemap : vworld
   // var url = 'http://api.vworld.kr/req/wmts/1.0.0/' + properties.baseMapAPIKey + '/Base/{z}/{y}/{x}.png'
 
    quake.map = new maptalks.Map("quake_map", {
        center : global.baseMapCenter,
        pitch: 40,
        zoom: 15,
        maxZoom: 20,
        minZoom: 9,
        maxPitch: 60,
        spatialReference:{
            projection:'EPSG:4326'//map control 좌표계
        },
        centerCross: true,
        doubleClickZoom: false,
        baseLayer: normalLayer,
    });
    
    quake.map.on('zoomend zooming', function(){
        quake.controlBuildingLayer();
    });
    
}

//three layer 생성
quake.setThreeLayer = function(){
    quake.threeLayer = new maptalks.ThreeLayer('quake', {
        forceRenderOnMoving: true,
        forceRenderOnRotating: true
    });

    quake.threeLayer.prepareToDraw = function (gl, scene, camera) {
        stats = new Stats();
        stats.domElement.style.zIndex = 1;
        document.getElementById("quake_map").appendChild(stats.domElement);
        
        var light = new THREE.DirectionalLight(0xFFFFFF);
        light.position.set(0, -10, -10).normalize();
        scene.add(light);
        
        scene.add(new THREE.AmbientLight(0xffffff));
    }
    
    quake.threeLayer.addTo(quake.map);
}


//기본레이어 선택
quake.showLayer = function(selectMap) { 
    if(selectMap == 0) { //일반지도
        /*quake.map.addLayer(normalLayer);
        quake.map.removeLayer(setilLayer);
        quake.map.removeLayer(earthLayer);*/
        quake.map.setBaseLayer(normalLayer);
    } else if(selectMap == 1) { //위성지도
        /*quake.map.addLayer(setilLayer);
        quake.map.removeLayer(normalLayer);
        quake.map.removeLayer(earthLayer);*/
        quake.map.setBaseLayer(setilLayer);
    } else if(selectMap == 2) { //지형지도 
       /* quake.map.addLayer(earthLayer);
        quake.map.removeLayer(normalLayer);
        quake.map.removeLayer(setilLayer);*/
        quake.map.setBaseLayer(earthLayer);
        
    }
}

/*
 * 시나리오 정보 조회
 * 
 */
quake.selectScenarioList = function(){
    $.ajax({
        type : 'POST',
        url : properties.contextPath + '/gis/quake/selectScenarioList.do',
        async: false,
        dataType : 'json',
        success : function(data) {
            console.log(data);
            
            var target = $('#scenario_list');
            target.empty();
            
            $.each(data.dataList, function(idx, obj){
                var $li = $("<li/>",{}).appendTo(target);
                
                var icon_file_path = properties.contextPath + '/gis/quake/selectListIcon.do?eqseq=' + obj.eq_m_seq;
                /*if (obj.eq_type == 'BD') {
                    var icon_nm = 'earthquake_ico01.png';
                }
                else {
                    var icon_nm = 'earthquake_ico02.png';
                }*/
                
                //var icon = icon_file_path + icon_nm;
                
                $('<span class="icobox"><img src="' + icon_file_path + '" alt="건물붕괴" /></span>').appendTo($li);
                $('<em class="tit">' + obj.eq_titel + '</em>').appendTo($li);
                $a = $('<a href="#;" class="btns grayBtn" ">실행</a>').appendTo($li);
                
                $a.click(function() {
                    quake.setScenario(obj);
                });
                
                $('<div class="txt" style="display:none">좌측 메뉴에서 시나리오를 선택하면 결과를 지도 위에 표출. 진앙 및 규모를 레이어 표출. 선택한 시나리오 정보를 지도 위에 레이어 표출</div>').appendTo($li);
                
                
            })
            
        }
    }); 
}

var colorQuake = {
        color0: '#F7F8E0',
        color1: '#F3F781',
        color2: '#FFFF00',
        color3: '#F5DA81',
        color4: '#FFBF00',
        color5: '#FE2E2E',
        color6: '#8A0808',
        color7: '#610B0B',
        color8: '#3B0B0B',
        color9: '#190707'
    };

function getColor(z) {
    z /= 1000;
    if (z < 2) {
        return colorQuake.color0;
    }
    else if (z < 4) {
        return colorQuake.color1;
    }
    else if (z < 6) {
        return colorQuake.color2;
    }
    else if (z < 8) {
        return colorQuake.color3;
    }
    else if (z < 1) {
        return colorQuake.color4;
    }
    else if (z < 12) {
        return colorQuake.color5;
    }
    else if (z < 14) {
        return colorQuake.color6;
    }
    else if (z < 16) {
        return colorQuake.color7;
    }
    else if (z < 18) {
        return colorQuake.color8;
    }
    return colorQuake.color9;
}

var materialMap = {};
function getMaterialQuake(z) {
    var c = getColor(z);
    var material = materialMap[c];
    if (!material) {
        //material = materialMap[c] = new THREE.MeshBasicMaterial({ color: c, blending: THREE.AdditiveBlending });
        material = materialMap[c] = new THREE.MeshBasicMaterial({ color: c, blending: THREE.AdditiveBlending, transparent: true, opacity : mapOpacity.Opacity });
    }
    return material;
}

/*
 * zoom level에 따라서 건물 레이어 보임/안보임 설정
 * zoom level < 15 건물 안보임
 */
quake.controlBuildingLayer = function(){
    /*var zoom = quake.map.getZoom();
    console.log(zoom);
    
    if (prevMode != 'bars') {
        if (zoom < 15) {
            quake.threeLayer.hide();
        }
        else {
            quake.threeLayer.show();
        }
    }*/
}

quake.setScenario = function(data){
    //console.log(data);
    $('.mia_type3_1').removeClass('hidden');
    //지진파 위치정보 표시
    $('.mia_type3_1 > h3 > strong').text(data.eq_titel);
    
    //129.26239013671875,35.22767235493585,"5","10"
    var content = '설명 : ' + data.eq_cont + '<br />' +
                  '진앙 : ' + data.lat + ', ' + data.lon + '' + '<br />' +
                  '규모 : ' + data.eq_magnitude;
                  //rjy changed 20201113
                  // '진앙 : 35.22767235N, 129.2623901E' + '<br />' +
                  // '규모 : 5';
                  //'진앙 : ' + data.lat + ', ' + data.lon + '' + '<br />' +
                  //'진앙 : ' + data.lat + 'N, ' + data.lon + 'E' + '<br />' +
                  //'진도 : ' + data.eq_magnitude;    
    $('.mia_type3_1 .mia_con').html(content);   
    
    //
    if(isHm == -1){
        if(gui != null){
            $(gui.domElement).remove();
            gui = null;
        }
    }
    //
    
    if (data.eq_type == 'BD') {//건물피해도
        isrun = false;
        setTimeout(() => {
            quake.setBuildingDemageLayer(data.eq_m_seq);
        }, 1000);
        
        
        $('#mLegend').removeClass('hidden');
    }else if (data.eq_type == 'WA') {//지진파
        
        // 기능 - GIS 관련 Off
        $('.fnlst_GIS').removeClass('on');
        // rest 관련 레이어 초기화/제외
        $.each(quake.map.getLayers(), function(idx, obj){
            if(obj.getId().indexOf('rest') == 0){
                obj.clear();
            }
        });
        // HeatMap 관련 Off
        $('.fnlst_HM').removeClass('on');
        isHm = -1;
        heatmap = null;
        if(gui != null){
            $(gui.domElement).remove();
            gui = null;
        }
        $('#mLegend_hm').addClass('hidden');
        
        // 지진파
        v_type = data.visual_type;
        quake.addQuakeBars();
        
        //건물레이어 설정  
        //rjy quake.setBuildingLayer();
        
        // 건물 피해도 레전드바 숨김
        $('#mLegend').addClass('hidden');
        
        // 투명도 설정 바 생성
        if(gui == null){
            
            gui = new dat.GUI({ autoPlace: false });
            $('#quake_map1').append($(gui.domElement));
            
            gui.add(mapOpacity, 'Opacity', 0, 1);
            
            guiSphere = gui.addFolder('Legend');
            guiSphere.addColor(colorQuake, 'color9').name('20');
            guiSphere.addColor(colorQuake, 'color8').name('18');
            guiSphere.addColor(colorQuake, 'color7').name('16');
            guiSphere.addColor(colorQuake, 'color6').name('14');
            guiSphere.addColor(colorQuake, 'color5').name('12');
            guiSphere.addColor(colorQuake, 'color4').name('10');
            guiSphere.addColor(colorQuake, 'color3').name('08');
            guiSphere.addColor(colorQuake, 'color2').name('06');
            guiSphere.addColor(colorQuake, 'color1').name('04');
            guiSphere.addColor(colorQuake, 'color0').name('02');
            guiSphere.open();
        }
    }
    
    
    // heatmap 을 보여주고 있던 상태라면 다시 heatmap 레이어를 추가 (지진파 시, 레이어 초기화 문제 회피)
    if(isHm != -1 && heatmap != null)
        quake.threeLayer.addMesh(heatmap);
}

var damageBuildingFileIdx = 0;
var damageBuildingFileTotal = 6;
let polygons = [];
var meshs = [];
quake.geoFileLoad = async function(eq_m_seq, damageBuildingFileIdx) {
    startLoadingBar();
    if (damageBuildingFileIdx == 0) {
       // $.blockUI({message:"건물 피해도 데이터 Loading..."});
        damageBuildingFileIdx++;
    }
    
    var file = properties.contextPath + '/gis/quake/selectFile.do?eqseq=' + eq_m_seq + "&num=" + damageBuildingFileIdx;
    let response = await fetch(file);
    const reader = response.body.getReader();
    const contentLength = +response.headers.get('Content-Length');

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
        if(tic < 90) progressPBar(tic); else progressBarContents('데이터 취합중..');
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
    //alert(commits[0].author.login);
    //startLoadingBar();
    
    
    commits.features.forEach(feature => {
        var meandamage = feature.properties.meandamage;
        var tileIdx = 0;
        if (meandamage < 0.25) {tileIdx = 0;}
        else if (meandamage >= 0.25 && meandamage < 0.5) {tileIdx = 1;}
        else if (meandamage >= 0.5 && meandamage < 0.75) {tileIdx = 2;}
        else if (meandamage >= 0.75 && meandamage < 0.95) {tileIdx = 3;}
        else if (meandamage >= 0.95) {tileIdx = 4;}
        
        const geometry = feature.geometry;
        const type = feature.geometry.type;
        if (['Polygon', 'MultiPolygon'].includes(type)) {
            const height = feature.height || feature.properties.height || 20;
            if(height < 400){ //error data 400m높이 건물 이하로
                const properties = feature.properties;
                properties.height = height;
                properties.legend = tileIdx;
                const polygon = maptalks.GeoJSON.toGeometry(feature);
                polygon.setProperties(properties);
                polygons.push(polygon);
            }
        }

    });
    if (polygons.length > 0) {
        var mesh = quake.threeLayer.toExtrudePolygons(polygons.slice(0, Infinity), { topColor: '#fff', interactive: false }, damageBuildingMaterials[damageBuildingFileIdx-1]);
        quake.threeLayer.addMesh(mesh);
        meshs.push(mesh);
        polygons = [];
    }
    damageBuildingFileIdx++;
    if (damageBuildingFileIdx < damageBuildingFileTotal) {
        setTimeout(() => {
            quake.geoFileLoad(eq_m_seq ,damageBuildingFileIdx);
        }, 10);
    } else {
      //  $.unblockUI();//해제
        animation();
        quake.threeLayer.renderScene();
    }
    endLoadingBar();
}

quake.clearThreeLayer = function(){
    console.log('dispose threelayer');
    quake.threeLayer.getThreeRenderer().dispose();
    quake.threeLayer.getThreeRenderer().forceContextLoss();;
    const object3ds = quake.threeLayer.getMeshes();
    quake.threeLayer.clear();
    object3ds.forEach(object3d => {
        object3d = null;
    });
    let camera = quake.threeLayer.getCamera();
    let scene = quake.threeLayer.getScene();
    let pick = quake.threeLayer.getPick();
    let pickingTexture = pick.pickingTexture;
    let pickingScene = pick.pickingScene;
    scene.remove(camera);
    camera = null;
    scene = null;
    pickingTexture.dispose();
    pickingTexture = null;
    pickingScene = null;
    quake.threeLayer.remove();
}

quake.setBuildingDemageLayer = function(eq_m_seq) {
    /*var gl = quake.threeLayer._renderer;
    gl.clear();
    quake.threeLayer.clearCanvas();*/
    //quake.threeLayer._renderer.gl.getExtension('WEBGL_lose_context').loseContext();
    //quake.threeLayer.remove();
   
    //quake.map.remove();
    quake.clearThreeLayer();
    quake.setThreeLayer();
    //초기화
    quake.initThreeLayer();
    //영역표시 레이어 clear
    quake.areaClear();
    //quake.threeLayer._renderer.scene.add(new THREE.AmbientLight(0xffffff));
    
    var center;
    var zoomLevel;

    if (prevMode == "bars" || prevMode == "") {
        center = global.baseMapCenter;
        zoomLevel = 16;
    }
    else {
        //건물피해도 레이어 상태 또는 대피로 조회 상태
        center = quake.map.getCenter();
        zoomLevel = quake.map.getZoom();
    }
    
    prevMode = "building";
    //지역 선택 enabled
    $('.show_info > a').removeClass('disabled');
    //최적 대피로 조회 버튼  enabled
    $('.show_info2 > a').removeClass('disabled');
    
    //quake.threeLayer._renderer.scene.add(new THREE.AmbientLight(0xffffff));
    
    //set center and zoom
    //quake.map.setMinZoom(15).setMaxZoom(20).setPitch(60);
    quake.map.setCenterAndZoom(center, zoomLevel);

    quake.geoFileLoad(eq_m_seq, 0);
    
    /*if( window.Worker ) {
        var worker = new Worker('/dds/resources/js/dds/quake/progress.js');
        worker.addEventListener('message', function(e) {
            console.log('Worker said: ', e.data);
            if(e.data.exe == 'startLoadingBar'){
                startLoadingBar();
            }else if(e.data.exe == 'progressPBar'){
                progressPBar(e.data.ticProgress);
            }
          }, false);
        worker.postMessage('Hello World'); // Send data to our worker.
    }*/
}

function animation() {
    //애니메이션 넣을경우 주석해제
    // layer animation support Skipping frames
    /*quake.threeLayer._needsUpdate = !quake.threeLayer._needsUpdate;
   
    if (quake.threeLayer._needsUpdate) {
        quake.threeLayer.renderScene();
    }
    
    stats.update();
    requestAnimationFrame(animation);*/
}

/*
 * 건물 범례 표시 체크
 */
quake.showhideCheck = function(box){
    meshs.forEach(function (mesh) {
        if (box.checked) {
            mesh.show();
        } else {
            mesh.hide();
        }
    });
    
    quake.threeLayer.renderScene();
}


/*
 * 기능 목록 표시
 */
quake.fnList = function() {
    
    $.ajax({
        type : 'POST',
        url : properties.contextPath + '/gis/quake/selectFnList.do',
        async: false,
        dataType : 'json',
        success : function(data) {
            
            $('#fnList li').remove();
            
            var target = $('#fnList');
            
            $.each(data.dataList, function(idx, obj){
                
                var icon_file_path = properties.contextPath + '/gis/quake/selectFnIcon.do?eqseq=' + obj.sol_m_seq;
                
                var $li = $("<li class='fnlst_" + obj.sol_type + "' title='" + obj.sol_type_title + "' />",{}).appendTo(target);
                $a = $('<a href="#" class="nobtn" />').appendTo($li);
                $('<em><img src="' + icon_file_path + '" width="64" height="64" /></em>').appendTo($a);
                $('<span>' + obj.sol_type_title.substring(0, 5) + (obj.sol_type_title.length > 5 ? '...' : '') + '</span>').appendTo($a);
                $a.click(function() {
                    
                    quake.closeInfoWindow();
                    $('.showFnbox').removeClass('open');
                    
                    if(obj.sol_type == 'GIS'){
                        
                        var isOn= $li.hasClass("on");
                        quake.setRestArea(obj.sol_type_title, obj.sol_m_seq, isOn);
                        
                        $li.toggleClass('on');
                    }
                    else if(obj.sol_type == 'GRAPH'){
                        
                        $(".fnlst_" + obj.sol_type).removeClass('on');
                        
                        $('#grape_popup').toggleClass('hidden');
                        
                        quake.setRestGrape(obj.sol_type_title, obj.sol_m_seq);
                        
                        if(isGraphic != -1)
                            $li.toggleClass('on');
                    }
                    else if(obj.sol_type == 'TABLE'){
                        
                        $(".fnlst_" + obj.sol_type).removeClass('on');
                        
                        $('#table_popup').toggleClass('hidden');
                        
                        quake.setResetTable(obj.sol_type_title, obj.sol_m_seq, 1, false, "", "");
                        
                        // 검색
                        $('#btnSearch').click(function() {
                            quake.setResetTable(obj.sol_type_title, obj.sol_m_seq, 1, true, $('#optSearch option:selected').val(), $('#txtSearch').val());
                        });
                        
                        if(isTable != -1)
                            $li.toggleClass('on');
                    }
                    else if(obj.sol_type == 'HM'){
                        
                        $(".fnlst_" + obj.sol_type).removeClass('on');
                        
                        quake.setHm(obj.sol_type_title, obj.sol_m_seq, obj.visual_type);
                        
                        if(isHm != -1)
                            $li.toggleClass('on');
                    }
                });
            });
        }
    }); 
}

quake.setRestArea = function(title, seq, isOn){
    
    var restLayer = quake.map.getLayer('rest' + seq);
    if (restLayer != null) {
        restLayer.clear();
    }
    
    if(isOn)
        return false;
    
    var params = {
            'seq' : seq
    }
    
    $.ajax({
        type : 'POST',
        url : properties.contextPath + '/quake/selectFnInfo',
        async: false,
        data : params,
        dataType : 'json',
        success : function(data) {
            
            quake.addPoint(title, data, seq);
        }
    });
    
    //showbox hide
    //$('.showhidebox').removeClass('open');
    
}

quake.closeInfoWindow = function(){
    
    if(infoWindow != null)
        infoWindow.remove();
}

quake.addPoint = function(title, data, seq){
    
    var markers = [];
    
    var lon;
    var lat;
    var fields = [];
    var fields_data = [];
    $.each(data.dataList, function(idx, obj){
        
        if(obj.map_opt == "LON")
            lon = obj.data_field_nm;
        else if(obj.map_opt == "LAT")
            lat = obj.data_field_nm;
        
        fields.push(obj.file_head_nm);
        fields_data.push(obj.data_field_nm);
    });
    
    $.each(data.dataInfo, function(idx, obj){
        
        if(obj[lon] != '-' && obj[lat] != '-'){
            
            var datas = []
            $.each(fields_data, function(idx2, obj2){
                datas.push(obj[obj2]);
            })
            
            var point = [obj[lon], obj[lat]];
            var marker = new maptalks.Marker(
                point,
                {
                  'symbol' : {
                    'markerFile'   : properties.contextPath + '/gis/quake/selectFnIcon.do?eqseq=' + seq, //'./resources/images/pointer.png',
                    'markerWidth'  : 30,
                    'markerHeight' : 30,
                    'markerDx'     : 0,
                    'markerDy'     : 0,
                    'markerOpacity': 1
                  },
                  'properties' : {
                      'title' : title,
                      'fields' : fields,
                      'datas' : datas
                    }
                }
              ) ;
            markers.push(marker);
        }
        
    })
    
    var restLayer = quake.map.getLayer('rest' + seq);
    
    if (restLayer == null) {
        restLayer = new maptalks.VectorLayer('rest' + seq).addTo(quake.map);
        markLayers.push(restLayer);
    }
    else {
        restLayer.clear();
    }
    
    restLayer.addGeometry(markers);
}

quake.areaClear = function() {
    var areaLayer = quake.map.getLayer('area');
    
    if (areaLayer != null) {
        areaLayer.clear();
    }
    
    $('.showhidebox').removeClass('open');
    
}

quake.addPointEvent = function(){
    
    quake.map.on('click', function (e) {
        
        //identify
        quake.map.identify(
                {
                    'coordinate' : e.coordinate,
                    'layers' : markLayers
                  },
            function (geos) {
                
                if (geos.length === 0) {
                    return;
                }
                    
                geos.forEach(function (g) {
                    console.log(g);
                      
                    var content = 
                      '<div class="map_info_area mia_type1" style="position:absolute;width:460px;height:237px;z-index:1000;">' +
                      //'<h3><em>' + g.properties.name + '</em><a href="#;" class="closebtn" onclick="finedust.closeInfoWindow()"><i class="fal fa-times"></i></a></h3> '+
                      '<h3 style="height:45px;"><em>' + g.properties.title + '</em><a href="#;" class="closebtn" onclick="quake.closeInfoWindow()"><i class="fal fa-times"></i></a></h3> '+
                      '<div class="mia_con alignCenter" style="background-color: #fff; height:188px;overflow-y:scroll;">' +
                        '<table class="basic_tbl">'+
                                '<colgroup>'+
                                    '<col style="width:37%"/>'+
                                    '<col style="width:63%"/>'+
                                '</colgroup>'+
                                '<tbody>';
                                
                                $.each(g.properties.fields, function(idx, obj){
                                    content += '<tr>'+
                                                    '<th>' + obj + '</th>'+
                                                    '<td style="text-align:left;padding-left:10px;">'+ g.properties.datas[idx] +'</td>'+
                                                '</tr>';
                                });
                                
                        
                        content +=  '</tbody>'+
                                    '</table>' +
                                '</div>'; 
                  
                    var options = {
                        'autoOpenOn' : false,  //set to null if not to open window when clicking on map
                        'single' : false,
                        'custom' : true,
                        'width' : 460,
                        'height' : 170,
                        'dx' : -230,
                        'dy' : -230 - 40,
                        'content'   : content
                    };
                  
                    if (infoWindow != null) {
                        infoWindow.remove();
                    }
                    
                    var coordinate = e.coordinate;                  
                    infoWindow = new maptalks.ui.InfoWindow(options);
                    
                    infoWindow.addTo(quake.map).show(coordinate);
                    //quake.map.setCenterAndZoom(coordinate, quake.map.getZoom());
                });
            }
        );
    });
}

quake.setRestGrape = function(title, seq){
    
    //showbox hide
    $('.showhidebox').removeClass('open');
    
    $('#grape_title').html(title);
    
    if (isGraphic != seq){
        
        var params = {
                'seq' : seq
        }
        
        $.ajax({
            type : 'POST',
            url : properties.contextPath + '/quake/selectFnInfoGraphic',
            async: false,
            data : params,
            dataType : 'json',
            success : function(data) {
                
                var catNm = '';
                var catX = '';
                var catY = '';
                var cate = [];
                var dt = [];
                $.each(data.dataList, function(idx, obj){
                    
                    if(obj.map_opt == "X_INDEX"){
                        catX = obj.data_field_nm;
                    }
                    
                    if(obj.map_opt == "Y_DATA"){
                        catY = obj.data_field_nm;
                        catNm = obj.file_head_nm;
                    }
                })
                
                $.each(data.dataInfo, function(idx, obj){
                    
                    cate.push(obj[catX]);
                    dt.push(obj[catY]);
                })
                
                chartLine("grapeDiv", "", cate, [new createSeries(catNm, dt)]);
            }
        });
        
        isGraphic = seq;
    }
    else
        isGraphic = -1;
    
}

quake.closeGrapePopup = function() {
    
    $('#grape_popup').addClass('hidden');
    
    $(".fnlst_GRAPH").removeClass('on');
    isGraphic = -1;
}

quake.setHm = function(title, seq, type){
    
    $('#mLegend_hm').addClass('hidden');
    
    //if(heatmap != null){
        
        if(gui != null){
            $(gui.domElement).remove();
            gui = null;
        }
        
        quake.threeLayer.removeMesh(heatmap);
    //}
    
    if (isHm != seq){
        
        $.blockUI({message:"데이터 Loading..."});
        
        var params = {
                'seq' : seq
        }
        
        $.ajax({
            type : 'POST',
            url : properties.contextPath + '/quake/selectHeatmapFile',
            async: false,
            data : params,
            dataType : 'json',
            success : function(data) {
                
                $('#mLegend_hm').removeClass('hidden');
                quake.addHm(title, data, seq, type);
                
                $.unblockUI();//해제
            }
        });
        
        /*
        var file = properties.contextPath + '/file/scenario3/SOL_20210106115324319.json';   
        fetch(file).then(res => res.json()).then(geoJSON => {
            
            quake.addHm(title, geoJSON, seq);
        });
        */
    
        isHm = seq;
    }
    else
        isHm = -1;
}

quake.addHm = function(title, data, seq, type){
    
    var markers = [];
    
    var lon;
    var lat;
    var fields = [];
    var fields_data = [];
    $.each(data.dataList, function(idx, obj){
        
        if(obj.map_opt == "LON")
            lon = obj.data_field_nm;
        else if(obj.map_opt == "LAT")
            lat = obj.data_field_nm;
        
        fields.push(obj.file_head_nm);
        fields_data.push(obj.data_field_nm);
    });
    
    var hmData = [];
    $.each(data.dataInfo, function(idx, obj){
        
        if(obj[lon] != '-' && obj[lat] != '-'){
            
            hmData.push({
                coordinate: [obj[lon], obj[lat]],
                height: 0,
                count: Math.round(obj['x3'] * (type == 'PERIOD' ? 100 : 1)),
                value: 0
            });
        }
    })
    
    if(heatmap != null)
        quake.threeLayer.removeMesh(heatmap);
    
    var met = null;
    if(type == 'PERIOD'){
        
        met = new THREE.MeshBasicMaterial({ transparent: true, wireframe: false, color: 'white', opacity : 0.5 })
        heatmap = quake.threeLayer.toHeatMap(hmData,
                 {
                     gridScale: 8,
                     size: 6,
                     gradient: { 0.025: 'rgb(124,79,137)', 0.175: 'rgb(126,107,162)', 0.325: 'rgb(118,132,173)', 0.475: 'rgb(108,154,175)', 0.625: 'rgb(100,173,175)', 0.775: 'rgb(100,194,168)', 0.925: 'rgb(129,212,152)', 1: 'rgb(250,237,99)' }, //1.075: 'rgb(177,226,123)', 1.225: 'rgb(250,237,99)' },
                 }, met);
        
        var target = $('#mLegend_hm .mia_con');
        $('#mLegend_hm .mia_con div').remove();
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(250,237,99);' />",{}).appendTo(target);
        $('<span style="color: white;"> 1</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(129,212,152);' />",{}).appendTo(target);
        $('<span style="color: white;"> 0.925</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(100,194,168);' />",{}).appendTo(target);
        $('<span style="color: white;"> 0.775</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(100,173,175);' />",{}).appendTo(target);
        $('<span style="color: white;"> 0.625</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(108,154,175);' />",{}).appendTo(target);
        $('<span style="color: white;">  0.475</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(118,132,173);' />",{}).appendTo(target);
        $('<span style="color: white;"> 0.325</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(126,107,162);' />",{}).appendTo(target);
        $('<span style="color: white;"> 0.175</span>').appendTo($d);
        var $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(124,79,137);' />",{}).appendTo(target);
        $('<span style="color: white;">0.025</span>').appendTo($d);
    }
    else{
        
        met = new THREE.MeshBasicMaterial({ transparent: true, wireframe: false, color: 'white', opacity : 0.5 });
        heatmap = quake.threeLayer.toHeatMap(hmData,
                {
                    gridScale: 8,
                    size: 6,
                    gradient: { 0.10: 'rgb(124,79,137)', 0.20: 'rgb(126,107,162)', 0.30: 'rgb(118,132,173)', 0.40: 'rgb(108,154,175)', 0.50: 'rgb(100,173,175)', 0.60: 'rgb(100,194,168)', 0.70: 'rgb(129,212,152)', 0.80: 'rgb(177,226,123)', 0.90: 'rgb(250,237,99)' }, //1.075: 'rgb(177,226,123)', 1.225: 'rgb(250,237,99)' },
                }, met);
        
        var target = $('#mLegend_hm .mia_con');
        $('#mLegend_hm .mia_con div').remove();
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(250,237,99);' />",{}).appendTo(target);
        $('<span style="color: white;">90</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(177,226,123);' />",{}).appendTo(target);
        $('<span style="color: white;">80</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(129,212,152);' />",{}).appendTo(target);
        $('<span style="color: white;">70</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(100,194,168);' />",{}).appendTo(target);
        $('<span style="color: white;">60</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(100,173,175);' />",{}).appendTo(target);
        $('<span style="color: white;">50</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(108,154,175);' />",{}).appendTo(target);
        $('<span style="color: white;">40</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(118,132,173);' />",{}).appendTo(target);
        $('<span style="color: white;">30</span>').appendTo($d);
        $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(126,107,162);' />",{}).appendTo(target);
        $('<span style="color: white;">20</span>').appendTo($d);
        var $d = $("<div style='height:30px;text-align:center;padding-top:5px;background-color:rgb(124,79,137);' />",{}).appendTo(target);
        $('<span style="color: white;">10</span>').appendTo($d);
    }
    
    quake.threeLayer.addMesh(heatmap);
    heatmap.getObject3d().scale.z = 8;
    
    //
    if(gui == null){
        
        gui = new dat.GUI({ autoPlace: false });
        $('#quake_map1').append($(gui.domElement));
        
        gui.add(mapOpacity, 'Opacity', 0, 1).onChange(function () {
            met.opacity = mapOpacity.Opacity;
            heatmap.setSymbol(met);
            
            quake.threeLayer.renderScene();
        });
    }
    
    quake.map.setCenterAndZoom(heatmap.getCenter(), 12);
    //quake.map.setCenterAndZoom([uSigungu.lon, uSigungu.lat], 12);
}

var MapOpacity = function() {
    this.Opacity = 0.5;
};

var quakeHeatmap = null;
function addQuakeCity(data){
    
    if(data == null){
        quake.threeLayer.removeMesh(quakeHeatmap);
        quakeHeatmap = null;
        return;
    }
    
    var hmData = [];
    $.each(data, function(idx, obj){
        
        hmData.push({
            coordinate: [obj.value[0], obj.value[1]],
            height: 0,
            count: obj.value[2] / 1000,
            value: 0
        });
    })
    
    if(quakeHeatmap != null){
        quake.threeLayer.removeMesh(quakeHeatmap);
        quakeHeatmap = null;
    }
    
    var met = new THREE.MeshBasicMaterial({ transparent: true, wireframe: false, color: 'white', opacity :  mapOpacity.Opacity })
    quakeHeatmap = quake.threeLayer.toHeatMap(hmData,
             {
                 gridScale: 2,
                 size: 2,
                 gradient: { 0.02: colorQuake.color0, 0.04: colorQuake.color1, 0.06: colorQuake.color2, 0.08: colorQuake.color3, 0.1: colorQuake.color4, 0.12: colorQuake.color5, 0.14: colorQuake.color6, 0.16: colorQuake.color7, 0.18: colorQuake.color8, 0.19: colorQuake.color9, 1: colorQuake.color9 }, //1.075: 'rgb(177,226,123)', 1.225: 'rgb(250,237,99)' },
             }, met);
    
    quake.threeLayer.addMesh(quakeHeatmap);
    quakeHeatmap.getObject3d().scale.z = 8;
}

/*
 * 사용자 지역 코드
 */
quake.userSigungu = function() {
    
    $.ajax({
        type : 'POST',
        url : properties.contextPath + '/gis/quake/selectUserSigungu.do',
        async: false,
        dataType : 'json',
        success : function(data) {
            
            uSigungu = data;
            
            quake.setAreaSd();
        }
    }); 
}

/*
 * 시도 행정경계 리스트 설정
 */
quake.setAreaSd = function() {
    area.searchSdList(function(data){
        //console.log(data);
        
        $('#sd_list li').remove();
        
        var target = $('#sd_list');
        
                
        $.each(data.dataList, function(idx, obj){
            target.append('<li><a code="' + obj.code +'" href="#;">'+obj.name+'</a></li>');
        });
        
        //부산시 default 설정, find index
        var index = area.searchIndex('#sd_list', uSigungu.dataList[0].code);
        $("#sd_list li:eq(" + index + ")").addClass('on');
        quake.setAreaSig($("#sd_list li:eq(" + index + ")").children('a').attr('code'));
        var value = $("#sd_list li:eq(" + index + ")").children('a').text();
        $('#quake_area_sd').text(value);
        
        $("#sd_list > li > a").click(function () {
            $(this).parent().siblings('li').removeClass('on'); 
            
            $(this).parent().addClass('on');
            quake.setAreaSig($(this).attr('code'));
            $('#quake_area_sd').text($(this).text());
            
            //시군구의 첫번째 아이템 default 선택
            $('#sig_list li:eq(0)').children('a').click();
            
            //console.log($(this).attr('code'));
        })

    })
    
}

/*
 * 시군구 행정경계 리스트 설정
 */
quake.setAreaSig = function(sd_cd) {
    area.searchSigList(function(data){
        //console.log(data);
        
        $('#sig_list li').remove();
        
        var target = $('#sig_list');
        
        $.each(data.dataList, function(idx, obj){
            target.append('<li><a code="' + obj.code +'" href="#;">'+obj.name+'</a></li>');
        });
        
        //부산시 부산진구 default 설정, find index
        var index = area.searchIndex('#sig_list', uSigungu.dataList[1].code);
        $("#sig_list li:eq(" + index + ")").addClass('on');
        quake.setAreaEmd($("#sig_list li:eq(" + index + ")").children('a').attr('code'));
        var value = $("#sig_list li:eq(" + index + ")").children('a').text();
        $('#quake_area_sig').text(value);

        
        $("#sig_list > li > a").click(function () {
            $(this).parent().siblings('li').removeClass('on'); 
            
            $(this).parent().addClass('on');
            quake.setAreaEmd($(this).attr('code'));
            $('#quake_area_sig').text($(this).text());
            
            //읍면동의 첫번째 아이템 default 선택
            $('#emd_list li:eq(0)').children('a').click();
            //console.log($(this).attr('code'));
        })
        
    }, sd_cd)

}

/*
 * 읍면동 행정경계 리스트 설정
 */
quake.setAreaEmd = function(sig_cd){
    area.searchEmdList(function(data){
        //console.log(data);
        
        $('#emd_list li').remove();
        
        var target = $('#emd_list');
        
        $.each(data.dataList, function(idx, obj){
            target.append('<li><a code="' + obj.code +'" href="#;">'+obj.name+'</a></li>');
        });
        
        //부산시 부산진구 개금동 default 설정, find index
        var index = area.searchIndex('#emd_list', uSigungu.dataList[2].code);
        $("#emd_list li:eq(" + index + ")").addClass('on');
        var value = $("#emd_list li:eq(" + index + ")").children('a').text();
        $('#quake_area_emd').text(value);

        
        $("#emd_list > li > a").click(function () {
            $(this).parent().siblings('li').removeClass('on'); 
            
            $(this).parent().addClass('on');
                        
            $('#quake_area_emd').text($(this).text());
        })
        
        //
        quake.map.setCenterAndZoom([uSigungu.lon, uSigungu.lat], 15);
        
    }, sig_cd)
}

/*
 * 지역 설정 후 확인 : 해당 지역 이동  
 */
quake.areaMove = function() {
    var areaLayer = quake.map.getLayer('area');
    prevMode = "area";
    
    if (areaLayer == null) {
        areaLayer = new maptalks.VectorLayer('area').addTo(quake.map);
    }
    else {
        areaLayer.clear();
    }
    
    
    var url = properties.contextPath + properties.gisProxy + '?' + properties.geoserver_url;
    url += '/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dds%3Atb_emd_g&maxFeatures=100&outputFormat=application%2Fjson&CQL_FILTER='; 

    
/*  var url = '/dds/gisProxy?' + 'http://14.51.61.9:8181/geoserver/dds/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dds%3Atb_emd_g&' +
              'maxFeatures=100&outputFormat=application%2Fjson&CQL_FILTER=';
*/  
    var index = area.searchClassOnIndex('#emd_list');
    var code = $("#emd_list li:eq(" + index + ")").children('a').attr('code');
    var value = $("#emd_list li:eq(" + index + ")").children('a').text();
    var col_filter = 'emd_cd=' + code;
    
    $.blockUI({message:"지역 이동 중..."});
    
    fetch(url + col_filter).then(res => res.json()).then(geojson => {       
        var polygons = [];
        const lineMaterial = new THREE.LineBasicMaterial({ color: "#000" });

        geojson.features.forEach(feature => {
          const geometry = feature.geometry;
          const type = feature.geometry.type;
          const lineStrings = [];
          
          if (['Polygon', 'MultiPolygon'].includes(type)) {
              const properties = feature.properties;
              properties.color = 0x0054FF;
              
              
              var shape = new maptalks.GeoJSON.toGeometry(feature);
              shape.updateSymbol({
                'lineColor': '#34495e',
                  'lineWidth': 2,
                  'polygonFill': 'rgb(135,196,240)',
                  'polygonOpacity': 0.6
              })
              
              var center = shape.getCenter();
              quake.map.getLayer('area').addGeometry([shape]);
              
              //console.log(quake.map.getZoom());
              
              
              quake.map.setCenterAndZoom(shape.getExtent().getCenter(), 10);
              //quake.map.setCenter(shape.getExtent().getCenter());
              
              //console.log(shape.getExtent())
              quake.map.fitExtent(shape.getExtent());
              //console.log(quake.map.getZoom());
              
              

              
              //quake.map.fitExtent(shape.getExtent());
              

              var label = new maptalks.Marker(quake.map.getCenter(), {
                  'symbol' : {
                    'textName' : value,
                    'textFaceName' : 'sans-serif',
                    'textSize' : 18,
                    'textFill' : 'black',
                    'textWeight' : 'bold',
                    //'textHaloFill' : '#fff',
                    //'textHaloRadius' : 5,
                    'textDx' : 0
                  }
              });
              
              quake.map.getLayer('area').addGeometry([label]);
              
              $('.showhidebox').removeClass('open');
              var quakeLayer = quake.map.getLayer('quake');
            
              //읍면동 레이어가 제일 위로 올라옴.
              quake.map.sortLayers([areaLayer, quakeLayer]);
                
              $.unblockUI();    
               
          }
        
        });
        
        //console.log(polygons);
        //areaLayer.addMesh(polygons);
        
        //animation();
    });
}

/*
 * AI 기반 최적 대피로 조회
 */
quake.findEsrPath = function() {
//  $.blockUI({message:"최적 대피로 조회중..."});
    if (prevMode =='bars') {
        alert("지반가속도 데이터에서 대피로 정보를 조회할 수 없습니다.");
        return;
    }
    
    var params = {
        scenario_id : 'sn_001'
    }
    
    $.ajax({
        type : 'POST',
        url : properties.contextPath + '/common/selectEsrPath',
        //async: false,
        data : params, 
        dataType : 'json',
        success : function(data) {
            //console.log(data);
            prevMode = "esrpath";
            quake.drawEsrPathLine(data.dataList);
            
        }
    });
}

/*
 * 최적대피로 line 그리기 
 */
quake.drawEsrPathLine = function(data){
    //1. 출발지, 도착지 표시
    var esrPointLayer = quake.map.getLayer('esrpoint');
    
    if (esrPointLayer == null) {
        esrPointLayer = new maptalks.VectorLayer('esrpoint').addTo(quake.map);
    }
    else {
        esrPointLayer.clear();
    }

    var road_start = new maptalks.Marker(
        [data[0].x, data[0].y],
        {
          'symbol' : {
            'markerFile'   : './resources/images/road_start.png',
            'markerWidth'  : 28,
            'markerHeight' : 40,
            'markerDx'     : 0,
            'markerDy'     : 0,
            'markerOpacity': 1
          }
        }
      ).addTo(esrPointLayer);
    
    var road_end = new maptalks.Marker(
        [data[data.length-1].x, data[data.length-1].y],
        {
          'symbol' : {
            'markerFile'   : './resources/images/road_end.png',
            'markerWidth'  : 28,
            'markerHeight' : 40,
            'markerDx'     : 0,
            'markerDy'     : 0,
            'markerOpacity': 1
          }
        }
      ).addTo(esrPointLayer);
    
    
    //2. 대피로 line 표시
    var url = properties.contextPath + properties.gisProxy + '?' + properties.geoserver_url;
    url += '/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dds%3Atb_edge_road_g&maxFeatures=100&outputFormat=application%2Fjson&CQL_FILTER='; 
    
    var col_filter = '';
    //%20:space, %27:'
    $.each(data, function(idx, obj){
        if (obj.edge != "") {
            if (idx == data.length - 2) {
                col_filter += 'id=%27' + String(obj.edge)  + '%27';
            }
            else {
                col_filter += 'id=%27' + String(obj.edge) + '%27' + 'or%20' ;   
            }
        }
    }) 
        
    url += col_filter;
    var material = new THREE.LineMaterial({
        color: 0x0d2678,
        transparent: true,
        linewidth: 7 // in pixels
    });
    
    //quake.map.setMinZoom(15).setMaxZoom(20).setPitch(60);
    fetch(url).then(res => res.json()).then(geojson => {    
        /* LineString
         * var lineStrings = maptalks.GeoJSON.toGeometry(geojson);

        const line = quake.threeLayer.toFatLines(lineStrings, { interactive: false }, material);
        
        quake.threeLayer.addMesh(line);
         */     
        
        //MultiLineString
        const multiLineStrings = maptalks.GeoJSON.toGeometry(geojson);
        for (const multiLineString of multiLineStrings) {
            const line = multiLineString._geometries.filter(lineString => {
                const len = lineLength(lineString);
                return len > 0;
            }).map(lineString => {
                const len = lineLength(lineString)
                return quake.threeLayer.toFatLines(lineString, { interactive: false }, material);
            });
            
            quake.threeLayer.addMesh(line);
            //esrPath_lines.push(line);
        }        
        
        //quake.threeLayer.addMesh(lines);
        
        //quake.map.setCenter(multiLineStrings[0].getExtent().getCenter());
        
        //quake.map.setCenterAndZoom(multiLineStrings[0].getExtent().getCenter(), 10);
        quake.map.setCenterAndZoom(multiLineStrings[0].getExtent().getCenter(), quake.map.getZoom());
        
        /*if (quake.map.getZoom() < 15) {
            quake.map.setCenterAndZoom(multiLineStrings[0].getExtent().getCenter(), 15);
        }
        else {  
            quake.map.setCenterAndZoom(multiLineStrings[0].getExtent().getCenter(), quake.map.getZoom());
        }*/ 
        
        
    })
    
}

/*
 * threeLayer 초기화
 */
quake.initThreeLayer = function() {
    //1.건물 tile 데이터 초기화
   // quake.threeLayer.removeMesh(meshs);
    /*quake.threeLayer._baseObjects = [];
    meshs.forEach(mesh => {
        mesh.getObject3d().geometry.dispose();
        for (const key in mesh) {
            mesh[key] = null;
        }
        mesh = null;
    });*/
    
    meshs = [];
   
    var ll = quake.map.getLayer('quake');
    if (ll != null) {
        ll.clear();
    }
    
    //2.최적 대피로 Line Mesh, 지반가속도 Polygon Mesh 초기화
    /*var totCnt = quake.threeLayer._renderer.scene.children.length - 1;
    var obj;

    for (var i = totCnt; i >= 0; i--) {
        if(quake.threeLayer._renderer.scene.children[i].type == "Mesh" ||
            quake.threeLayer._renderer.scene.children[i].type == "Line2" ||
            quake.threeLayer._renderer.scene.children[i].type == "AmbientLight") {
            obj = quake.threeLayer._renderer.scene.children[i];
            quake.threeLayer._renderer.scene.remove(obj);
        }
    }
    */
    //3.최적대피로 출발점, 도착점 layer 초기화
    var roadLayer = quake.map.getLayer('esrpoint');
    quake.map.removeLayer(roadLayer);

    //mp4 공간 clear
    $('#videoholder').empty();
    
    //
    //quake.threeLayer.removeMesh(sig_fd_polygon);
    
    animation();
}

//도시 중심 - 시군구 표시
quake.displayData = function(btn, type) {   
    
    //좋음(1), 보통(2), 나쁨(3), 매우나쁨(4), 점검중(5)
    var grade = ['#0054FF', '#1DDB16', '#FF5E00', '#FF0000', '#4C4C4C'];
    
    if (sig_fd_polygon.length > 0) {
        quake.threeLayer.removeMesh(sig_fd_polygon);
    }
    
    if (uSigungu != null) {                     
        var url = properties.contextPath + properties.gisProxy + '?' + properties.geoserver_url;
        var col_filter = 'sig_cd%20like%27' + uSigungu.dataList[0].code + '%25'  + '%27';
        url = url + '/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dds%3Atb_sig_g&maxFeatures=100&outputFormat=application%2Fjson&CQL_FILTER=' + col_filter; 
        
        fetch(url).then(res => res.json()).then(geojson => {        
              sig_fd_polygon = [];
              const lineMaterial = new THREE.LineBasicMaterial({ color: "#000" });
              
              geojson.features.forEach(feature => {
                  const geometry = feature.geometry;
                  const type = feature.geometry.type;
                  const lineStrings = [];
                  
                  if (['Polygon', 'MultiPolygon'].includes(type)) {
                      const properties = feature.properties;
                      
                          //properties.color = '#0054FF';
                          geometry.coordinates.forEach((coordinates) => {
                                lineStrings.push(new maptalks.LineString(coordinates[0]));
                          });
                          
                          var mesh_material = new THREE.MeshBasicMaterial({ color: properties.color, transparent: true, opacity: 0.5 });
                          var mesh = quake.threeLayer.toExtrudePolygon(maptalks.GeoJSON.toGeometry(feature), {
                              height: 1,
                              topColor: '#fff'                          
                          }, mesh_material);
              
                          sig_fd_polygon.push(mesh);
                          
                          lineStrings.forEach((lineString) => {
                              const line = quake.threeLayer.toLine(
                                      lineString,
                                      { altitude: 0, interactive: false },
                                      lineMaterial
                               );
                               sig_fd_polygon.push(line);
                          });
                  }
              });
              quake.threeLayer.addMesh(sig_fd_polygon);
          });
    }
    
}

var UPDATE_DURATION = 100;
var isrun = false;
var v_type = null;

//지진파 - 지진파 중심
quake.addQuakeBars = function() { 
    
    bars2 = [];
    gap = 0;
    
    prevMode = "bars";
    //지역 선택 popup disabled
    $('.show_info > a').addClass('disabled');
    //최적 대피로 버튼 disabled
    $('.show_info2 > a').addClass('disabled');
    
    
    //threeLayer 초기화
    quake.initThreeLayer();
    //영역표시 레이어 clear
    quake.areaClear();
    
    // 도시 중심 - 시군구 표시
    if(v_type == 'CITY')
        quake.displayData();
    
    //$('.selectbox .ai_evacuation').attr('disabled', true);
    
    //set zoom and pitch
    //quake.map.setMinZoom(9).setMaxZoom(15).setPitch(60);
    quake.map.setCenterAndZoom(global.baseMapCenter, 10);
    
    /*
    var min = Infinity, max = -Infinity;
    
    var material = new THREE.MeshLambertMaterial({ color: "#fff", transparent: true, opacity : mapOpacity.Opacity });

    var lines = [];
    var lineMaterial = new THREE.LineBasicMaterial({
        linewidth: 1,
        color: 'rgb(128,109,117)',
        opacity: mapOpacity.Opacity,
        transparent: true
    });*/
    
    $.blockUI({message:"지반가속도 데이터 Loading..."});
    
    setTimeout(initVisualizer(), UPDATE_DURATION);

    animation();
}

// code from https://www.echartsjs.com/examples/zh/editor.html?c=bar3d-music-visualization&gl=1
function initVisualizer() {

    function update() {
       
        var dataProvider = [];
        if(bars2[0].P.length > 0) {
           
            var xs = bars2[0].LAT.split(' ');
            var ys = bars2[0].LON.split(' ');
            var ps = bars2[0].P.split(' ');
            
            for(var i = 0; i < ps.length; i+=2){
                
                if(xs[i] == '')
                    continue;
                
                dataProvider.push([ys[i] / 1, xs[i] / 1, parseInt(ps[i] * 10)]);
            }
        }
        var musdata = [];
        for (var i = 0; i < dataProvider.length; i++) {
            var d = dataProvider[i];
            var x = d[0],
                y = d[1],
                z = d[2];
            var height =  z * 1000;
            musdata.push({
                value: [x, y, height]
            });
        }
        
        //if(v_type == 'WAVE')
            addBars(musdata);
        //else
            //addQuakeCity(musdata);

        
        gap++;
        console.log('gap:' + gap);
        if(isrun)
            setTimeout(nextCall, UPDATE_DURATION);
        else{
            
           // if(v_type == 'WAVE')
                addBars(null);
            //else
               // addQuakeCity(null);
            
            //if(isHm == -1){
                if(gui != null){
                    $(gui.domElement).remove();
                    gui = null;
                }
            //}
            $('.show_info > a').removeClass('disabled');
            $('.show_info2 > a').removeClass('disabled');
        }
        
    }
    
    isrun = true;
    nextCall();
    quake.playBarsMp4();//play mp4         
    $.unblockUI();//해제
    
    function nextCall(){
        
        var file = properties.contextPath + '/file/scenario2/' + gap + '.json';
        fetch(file).then((function (res) {
            return res.json();
        })).then(function (json) {
            
            bars2 = [];
            json.forEach(t => {
                
                bars2.push(t);
            });
            
            update();
            
        }).catch(error => { 
            
            //if(v_type == 'WAVE')
                addBars(null);
           // else
               // addQuakeCity(null);
            
            //if(isHm == -1){
                if(gui != null){
                    $(gui.domElement).remove();
                    gui = null;
                }
            //}
            $('.show_info > a').removeClass('disabled');
            $('.show_info2 > a').removeClass('disabled');
        });
    }
}

quake.playBarsMp4 = function(){
    var src = properties.contextPath + '/resources_gis/mp4/quake.mp4';
    var theVideo = $('<video width="410px" autoplay controls>' + 
            '<source src=' + src  + ' type="video/mp4"></source>' +
        '</video>');
    
/*  console.log(src);
    console.log(theVideo);
*/      
    videoHolder = $('#videoholder');
    //videoHolder = $('.rc_viewbox');
    videoHolder.append(theVideo);
    
    /*videoHolder.on("click", function() {
        var videoEl = theVideo[0];
        if (videoEl.paused) {
          videoEl.play();
        } else {
          videoEl.pause();
        }
      });*/
}

var geometries = [];
var mergedBars = {};

function addBars(data) {
    
    if (mergedBars) {
        quake.threeLayer.removeMesh(mergedBars);
    }
 
    quake.threeLayer._baseObjects = [];
   
    resTracker.dispose();
    geometries = [];
    
    if(data == null || data.length <= 0)
        return;
    
    const positionHelper = track(new THREE.Object3D());
    positionHelper.position.z = 1;
    data.forEach((dat) => {
        var value = dat.value;
        if(value[2] > 0){
       
            const boxWidth = 1;
            const boxHeight = 1;
            var boxDepth = 0;
            if(v_type == 'WAVE'){
                boxDepth = value[2] < 30000 ? value[2] : 30000;
                boxDepth = boxDepth / 200;
            } else {
                boxDepth = value[2] > 0 ? value[2] / 6000 : 0;
            }
            
            const geometry = track(new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth));
            //const geometry = new THREE.CylinderGeometry(boxWidth, boxHeight, boxDepth, 9, 1);
            const coordinate = value.slice(0, 2); 
            var position = quake.threeLayer.coordinateToVector3(coordinate);
            positionHelper.position.y = position.y;
            positionHelper.position.x = position.x; 
            positionHelper.position.z = boxDepth/2;
            
            //positionHelper.scale.set(1, 1, 1);
            positionHelper.updateWorldMatrix(true, false);
            geometry.applyMatrix4(positionHelper.matrixWorld);
            
            const color = track(new THREE.Color(getColor(value[2]))); 
            const rgb = color.toArray().map(v => v * 255);
                
            const numVerts = geometry.getAttribute('position').count;
            const itemSize = 3;  // r, g, b
            const colors = track(new Uint8Array(itemSize * numVerts));
            colors.forEach((v, ndx) => {
                colors[ndx] = rgb[ndx % 3];
              });
            const normalized = true;
            const colorAttrib = track(new THREE.BufferAttribute(colors, itemSize, normalized));
            geometry.setAttribute('color', colorAttrib);
            
            geometries.push(geometry);
        }
    });
  
    if(geometries.length > 0){
        const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries, false);
        const material = track(new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity:mapOpacity.Opacity
          }));
            
        mergedBars = track(new THREE.Mesh(mergedGeometry, material));
        quake.threeLayer.addMesh(mergedBars);
    }
}

function startLoadingBar() {
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
        'width' : maskWidth
        , 'height': maskHeight
        , 'opacity' : '0.3'
    }); 

    //마스크 표시
    $('#mask').show();   

    //로딩중 이미지 표시
    $('#loadingImg').show();
    
    var progressbar = $( "#pbar" ),
    progressLabel = $( ".progress-label" );

    progressbar.progressbar({
        value: false,
        change: function() {
          progressLabel.text( progressbar.progressbar( "value" ) + "%" );
    },
    complete: function() {
          setTimeout(endLoadingBar, 0);
        }
    });
}

function progressPBar(pval) {
    var progressbar = $( "#pbar" );
    var val = progressbar.progressbar( "value" ) || 0;
    
    progressbar.progressbar( "value", pval);
}

function progressBarContents(c){
    var progressbar = $( "#pbar" ),
    progressLabel = $( ".progress-label" );
    progressbar.progressbar("value", 99.9);
    progressLabel.text(c);
}

function endLoadingBar() {
    $('#mask, #loadingImg').hide();
    $('#mask, #loadingImg').remove();  
}