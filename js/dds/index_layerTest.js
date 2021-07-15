var quake = {
    map: {},
    threeLayerList: [],
};
var stats = null;
var infoWindow;
quake.infoWindow = infoWindow;

quake.viewMap = function () {
    quake.setBaseLayer();
    quake.setThreeLayer('line');
    quake.setThreeLayer('polygon');
    quake.setThreeLayer('marker');
    quake.setThreeLayer('terrain');

    quake.addPointEvent();
    quake.sortLayers();

    animation();
    
    initGui();
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
        stats = new Stats();
        stats.domElement.style.zIndex = 100;
        document.getElementById('map').appendChild(stats.domElement);

        var light = new THREE.DirectionalLight(0xffffff);
        light.position.set(0, -10, 10).normalize();
        scene.add(light);

        if(id == 'line'){
            loadLine();
        }else if(id == 'polygon'){
            loadPolygon();
        }else if(id == 'marker'){
            loadPoint();
        }else if(id == 'terrain'){
            
        }
    }

    threeLayer.addTo(quake.map);

    quake.threeLayerList.push(threeLayer);
    //quake.map.on('moving moveend zoomend pitch rotate', update);

    //update();
}

quake.sortLayers = function () {
    let sortLayers = []; 
    // quake.map.layer.forEach(l=>{
    //     if(l.type == 'ThreeLayer'){
    //         sortLayers.push(l);
    //     }
    // });
    sortLayers.push(quake.threeLayerList[1], quake.threeLayerList[0], quake.threeLayerList[2], quake.threeLayerList[3]);
    quake.map.sortLayers(sortLayers);   
}


function animation() {
    // layer animation support Skipping frames
    quake.threeLayerList.forEach(tl=>{
        tl._needsUpdate = !tl._needsUpdate;
        if (tl._needsUpdate) {
            tl.renderScene();
        }
    });
    if(stats){
        stats.update();
    }
    requestAnimationFrame(animation);
}


var lineMaterial = new THREE.LineBasicMaterial({color: 0x00ffff,/*opacity: 0.8,*/transparent: true});
var lines = [];

function loadLine() {
    fetch('/test/lineTest.geojson').then(function (res) {
        return res.json();
    }).then(function (geojson) {
        geojson = JSON.parse(geojson.geojson);

            
        var lineStrings = maptalks.GeoJSON.toGeometry(geojson);
        var timer = 'generate line time';
        console.time(timer);
        const mesh = quake.threeLayerList[0].toLines(lineStrings, { interactive: false}, lineMaterial);
        lines.push(mesh);
        quake.threeLayerList[0].addMesh(mesh);
    });
}

var polygonMaterial = new THREE.MeshPhongMaterial({ color: 0x00ffff, transparent: true });  

let polygonMeshs = [];

function loadPolygon() {
    fetch('/test/polygonTest.geojson').then(function (res) {
        return res.json();
    }).then(function (geojson) {
        let polygons = [];

        geojson.features.forEach(feature => {
            const geometry = feature.geometry;
            const type = feature.geometry.type;
            if (['Polygon', 'MultiPolygon'].includes(type)) {
                const height = 0.1;
                const properties = feature.properties;
                properties.height = height;
                const polygon = maptalks.GeoJSON.toGeometry(feature);
                polygon.setProperties(properties);
                polygons.push(polygon);
            }

        });
        if (polygons.length > 0) {
            var mesh = quake.threeLayerList[1].toExtrudePolygons(polygons.slice(0, Infinity), { topColor: '#fff', interactive: false }, polygonMaterial);
            quake.threeLayerList[1].addMesh(mesh);
            polygonMeshs.push(mesh);
            polygons.length = 0;
        }
    });
}

function createMateria(fillStyle) {
    const idx = Math.floor(Math.random() * 3);
    return new THREE.PointsMaterial({
        // size: 10,
        sizeAttenuation: false,
        color: fillStyle,
        // alphaTest: 0.5,
        // vertexColors: THREE.VertexColors,
        //  transparent: true
        // color: 0xffffff,
        size: 25,
        transparent: true, //使材质透明
        blending: THREE.AdditiveBlending,
        depthTest: true, //深度测试关闭，不消去场景的不可见面
        depthWrite: false,
        map: new THREE.TextureLoader().load('/test/selectFnIcon' + (idx+1) + '.png')
        //刚刚创建的粒子贴图就在这里用上
    });
}

let markerList = [];
function loadPoint() {
    fetch('/test/pointTest.geojson').then((function (res) {
        return res.json();
    })).then(function (json) {
        let seq = 261;

        let dataInfo = json.dataInfo;
        let dataList = json.dataList;

        var lon;
        var lat;
        var addr;
        $.each(dataList, function(idx, obj){
        	//console.log(obj);
            if(obj.map_opt == "LON"){
                lon = obj.data_field_nm;//x?
            }else if(obj.map_opt == "LAT"){
                lat = obj.data_field_nm;//x?
            }else if(obj.map_opt == "ADDR"){
                addr = obj.data_field_nm;//x?
            }
        });

        const lnglats = [];
        dataInfo.forEach(di=>{
            di.seq = seq;
            di.lon = di.LNG;
            di.lat = di.LAT;
            lnglats.push({coordinate:[di.LNG, di.LAT], properties:di});
        });
             
        points = lnglats.map(lnglat => {
            const material = createMateria();
            const point = quake.threeLayerList[2].toPoint(lnglat.coordinate, { height: 100, properties:lnglat.properties }, material);
            for(var i=0; i<point.object3d.geometry.attributes.position.count; i++){
                //point.object3d.geometry.attributes.position.setZ(i, 0.1);
            } 
            //infowindow test
            
            point.setInfoWindow(//options
                {
                    containerClass: 'maptalks-msgBox',
    autoPan: false,
    autoCloseOn: null,
    autoOpenOn: 'click',
    width: 0,
    height: 0,
    minHeight: 0,
    custom: true,
    title: '',
    content: '',
    animation: 'fade',
    showTimeout: 200
                }
            );
            //event test
            ['click'].forEach(function (eventType) {
                point.on(eventType, async function (e) {
                    console.log(e.type, e);
                    let data = e.target.options.properties;
                    if (e.type === 'click' && data) {
                        const value = data.value;
                        quake.infoWindow = this.getInfoWindow();
                        let options = await getContents(point);

                        quake.infoWindow.setContent(options.content);
                        if (quake.infoWindow && (!quake.infoWindow._owner)) {
                            quake.infoWindow.addTo(this).show({x:e.target.options.coordinate[0], y:e.target.options.coordinate[1]});
                        }
                        //this.openInfoWindow(e.coordinate);
                    }
                });
            });
            return point;

        });
        quake.threeLayerList[2].addMesh(points); 
    });
}

quake.addPointEvent = function(){
    //quake.map.on('click', function(e){
        //quake.addPointIdentify(e);
    //});
}

async function getContents(g){
    let markerTitle = '';
    let containerHeight = 'height:237px;';
    let containerHeight2 = 'height:188px;';
    let marginTop = 'top:-30px;';
    if(g.options.layer._id == 'quakeHistoryMarker'){  //지진 목록 마커이벤트 제목
        if(g.options.properties.fctp == '2'){
            markerTitle = '국외지진정보';
        }else if(g.options.properties.fctp == '3'){
            markerTitle = '국내지진정보';
        }else if(g.options.properties.fctp == '5'){
            markerTitle = '국내지진정보(재통보)';
        }else if(g.options.properties.fctp == '11'){
            markerTitle = '국내지진조기경보';
        }else if(g.options.properties.fctp == '12'){
            markerTitle = '국외지진조기경보';
        }else if(g.options.properties.fctp == '13'){
            markerTitle = '조기경보정밀분석';
        }else if(g.options.properties.fctp == '14'){
            markerTitle = '지진속보(조기분석)';
        }
        containerHeight = '';
        containerHeight2 = '';
        marginTop = 'top:-60px;';
    }else{//gis기능이벤트 제목
        markerTitle = g.options.properties.TITLE;
        containerHeight = 'height:237px;';
        containerHeight2 = 'height:188px;';
        marginTop = '';
    }
    var content = 
        '<div class="map_info_area mia_type1" style="position:absolute;width:460px;' + containerHeight + 'z-index:1000;' + marginTop + '">' +
        //'<h3><em>' + g.properties.name + '</em><a href="#;" class="closebtn" onclick="flood.closeInfoWindow()"><i class="fal fa-times"></i></a></h3> '+
        '<h3 style="height:45px;"><em>' + markerTitle + '</em><a href="#;" class="closebtn" onclick="quake.closeInfoWindow()"><i class="fal fa-times"></i></a></h3> '+
        '<div class="mia_con alignCenter" style="background-color: #fff;' + containerHeight2 + 'overflow-y:scroll;">' +
          '<table class="basic_tbl">'+
                  '<colgroup>'+
                      '<col style="width:37%"/>'+
                      '<col style="width:63%"/>'+
                  '</colgroup>'+
                  '<tbody>';
    if(g.options.layer._id == 'quakeHistoryMarker'){ //지진 목록 마커이벤트
        let tmeqk = g.options.properties.tmeqk;//진앙시
        let t_year = tmeqk.substr(0,4);
        let t_month = tmeqk.substr(4,2);
        let t_date = tmeqk.substr(6,2);
        let t_hour = tmeqk.substr(8,2);
        let t_minute = tmeqk.substr(10,2);
        let t_second = tmeqk.substr(12,2);
        let t_time = t_year + '/' + t_month + '/' + t_date + ' ' + t_hour + ':' + t_minute + ':' + t_second;
        
        let tmfc = g.options.properties.tmfc;//발표시각
        let tf_year = tmfc.substr(0,4);
        let tf_month = tmfc.substr(4,2);
        let tf_date = tmfc.substr(6,2);
        let tf_hour = tmfc.substr(8,2);
        let tf_minute = tmfc.substr(10,2);
        let tf_time = tf_year + '/' + tf_month + '/' + tf_date + ' ' + tf_hour + ':' + tf_minute; 
        
        content += '<tr><th>위치</th><td style="text-align:left;padding-left:10px;">'+ g.options.properties.loc +'</td></tr>';
        content += '<tr><th>규모</th><td style="text-align:left;padding-left:10px;">'+ g.options.properties.mag +'</td></tr>';
        content += '<tr><th>깊이</th><td style="text-align:left;padding-left:10px;">'+ g.options.properties.dep +' km</td></tr>';
        content += '<tr><th>진앙시</th><td style="text-align:left;padding-left:10px;">'+ t_time +'</td></tr>';
        content += '<tr><th>발표시각</th><td style="text-align:left;padding-left:10px;">'+ tf_time +'</td></tr>';
        content += '<tr><th>참조사항</th><td style="text-align:left;padding-left:10px;">'+ g.options.properties.rem +'</td></tr>';
        content += '<tr><th>진도</th><td style="text-align:left;padding-left:10px;">'+ g.options.properties.int +'</td></tr>';
//                            content += '<tr><td  colspan="2" style="text-align:left;padding-left:10px;"><img src="'+ g.properties.img +'"></img></td></tr>';
    }else{//gis기능이벤트
        console.log('기능마크팝업');
        console.log(g.options.properties.seq);
        console.log(g.options.properties.lat);
        console.log(g.options.properties.lon);
        //복수개의 정보가 있을 수 있으므로 DB에서 데이타를 다시 가져온다.
        var params = {
            'sol_m_seq' : g.options.properties.seq,
            'lat' : g.options.properties.lat,
            'lon' : g.options.properties.lon
        }
        let resp = await fetch('/test/makerEvent.geojson');
        let result = await resp.json();
          
        var map_list = result.map_list;
        var data_list = result.data_list;
        
        
        if(data_list.length>1){
            var html_head = '<table class="basic_tbl" style="padding-right:10px;"><tbody>';
            var html_body = '';
            var html_tail = '</tbody></table>';

            html_body += '<tr>';
            $.each(map_list, function(idx, obj){
                if(obj.map_opt == 'SIGN_NM'){
                    html_body += '<th style="width:150px;">' + obj.sign_nm + '</th>';
                }
            });
            html_body += '</tr>';

            $.each(data_list, function(idx, obj){
                html_body += '<tr>';
                $.each(map_list, function(idx2, obj2){
                    if(obj2.map_opt == 'SIGN_NM'){
                        //console.log(obj2.data_field_nm);
                        var td_data = obj[obj2.data_field_nm];
                        if(td_data == '#N/A') td_data = '';
                        html_body += '<td>' + td_data + '</td>';
                    }
                });
                html_body += '</tr>';
            });
            var html = html_head + html_body + html_tail;
            console.log(html);

            content += '<tr>';
            content += '<td colspan="2" style="width:100%;margin:0;padding:0;border-left:0;border-right:0;border-bottom:0;border-top:0;">'+ html +'</td>';
            content += '</tr>';
        }else{
            $.each(data_list, function(idx, obj){
                $.each(map_list, function(idx2, obj2){
                    if(obj2.map_opt == 'SIGN_NM'){
                        //console.log(obj2.data_field_nm);
                        var td_data = obj[obj2.data_field_nm];
                        if(td_data == '#N/A') td_data = '';
                        content += '<tr>';
                        content += '<th>' + obj2.sign_nm + '</th>';
                        content += '<td style="text-align:left;padding-left:10px;">' + td_data + '</td>';
                        content += '</tr>';
                    }
                });
            });
        } 
    }
    
    content += '</tbody></table></div>'; 
    
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

    return options;
}

quake.addPointIdentify = function(e){
    //identify
    quake.map.identify(
            {
                'coordinate' : e.coordinate,
                'layers' : quake.threeLayerList.filter(l=>l._id.includes('marker'))
              },
        function (geos) {
            
            if (geos.length === 0) {
                return;
            }
            let clickMarkers = [];
            for(var i=0; i<geos.length; i++){
                var g = geos[i];
                var lon = g.options.coordinate[0];
                var lat = g.options.coordinate[1];
                var from = turf.point([lon, lat]);
                var to = turf.point([e.coordinate.x, e.coordinate.y]);
                var distance = turf.distance(from, to);
                var key = g.options.layer._id + ':' + g.object3d.uuid;
                clickMarkers.push({key, distance});
            }
            clickMarkers.sort(function(a, b) {
                let a_layerId_markerId = a.key.split(':');
                let b_layerId_markerId = b.key.split(':');
                
                if(a_layerId_markerId[0] == 'quakeHistoryMarker' && b_layerId_markerId[0].includes('marker')){
                    return 1;
                }else if(a_layerId_markerId[0].includes('marker') && b_layerId_markerId[0] == 'quakeHistoryMarker'){
                    return -1;
                }else if(a_layerId_markerId[0] == 'quakeHistoryMarker' && b_layerId_markerId[0] == 'quakeHistoryMarker'){
                    if(a.distance > b.distance){
                        return 1;
                    }
                    if(a.distance < b.distance){
                        return -1;
                    }
                }else if(a_layerId_markerId[0].includes('marker') && b_layerId_markerId[0].includes('marker')){
                    if(a.distance > b.distance){
                        return 1;
                    }
                    if(a.distance < b.distance){
                        return -1;
                    }
                }
                  
                return 0;
            });
            
            geos.forEach(function (g) {
                let layerId_markerId = clickMarkers[0].key.split(':');
                if(layerId_markerId[0] == g.options.layer._id && layerId_markerId[1] == g.object3d.uuid){
                    //console.log(g);
                    let markerTitle = '';
                    let containerHeight = 'height:237px;';
                    let containerHeight2 = 'height:188px;';
                    let marginTop = 'top:-30px;';
                    if(g.options.layer._id == 'quakeHistoryMarker'){  //지진 목록 마커이벤트 제목
                        if(g.options.properties.fctp == '2'){
                            markerTitle = '국외지진정보';
                        }else if(g.options.properties.fctp == '3'){
                            markerTitle = '국내지진정보';
                        }else if(g.options.properties.fctp == '5'){
                            markerTitle = '국내지진정보(재통보)';
                        }else if(g.options.properties.fctp == '11'){
                            markerTitle = '국내지진조기경보';
                        }else if(g.options.properties.fctp == '12'){
                            markerTitle = '국외지진조기경보';
                        }else if(g.options.properties.fctp == '13'){
                            markerTitle = '조기경보정밀분석';
                        }else if(g.options.properties.fctp == '14'){
                            markerTitle = '지진속보(조기분석)';
                        }
                        containerHeight = '';
                        containerHeight2 = '';
                        marginTop = 'top:-60px;';
                    }else{//gis기능이벤트 제목
                        markerTitle = g.options.properties.title;
                        containerHeight = 'height:237px;';
                        containerHeight2 = 'height:188px;';
                        marginTop = '';
                    }
                    var content = 
                        '<div class="map_info_area mia_type1" style="position:absolute;width:460px;' + containerHeight + 'z-index:1000;' + marginTop + '">' +
                        //'<h3><em>' + g.properties.name + '</em><a href="#;" class="closebtn" onclick="flood.closeInfoWindow()"><i class="fal fa-times"></i></a></h3> '+
                        '<h3 style="height:45px;"><em>' + markerTitle + '</em><a href="#;" class="closebtn" onclick="common_gis.closeInfoWindow()"><i class="fal fa-times"></i></a></h3> '+
                        '<div class="mia_con alignCenter" style="background-color: #fff;' + containerHeight2 + 'overflow-y:scroll;">' +
                          '<table class="basic_tbl">'+
                                  '<colgroup>'+
                                      '<col style="width:37%"/>'+
                                      '<col style="width:63%"/>'+
                                  '</colgroup>'+
                                  '<tbody>';
                    if(g.options.layer._id == 'quakeHistoryMarker'){ //지진 목록 마커이벤트
                        let tmeqk = g.options.properties.tmeqk;//진앙시
                        let t_year = tmeqk.substr(0,4);
                        let t_month = tmeqk.substr(4,2);
                        let t_date = tmeqk.substr(6,2);
                        let t_hour = tmeqk.substr(8,2);
                        let t_minute = tmeqk.substr(10,2);
                        let t_second = tmeqk.substr(12,2);
                        let t_time = t_year + '/' + t_month + '/' + t_date + ' ' + t_hour + ':' + t_minute + ':' + t_second;
                        
                        let tmfc = g.options.properties.tmfc;//발표시각
                        let tf_year = tmfc.substr(0,4);
                        let tf_month = tmfc.substr(4,2);
                        let tf_date = tmfc.substr(6,2);
                        let tf_hour = tmfc.substr(8,2);
                        let tf_minute = tmfc.substr(10,2);
                        let tf_time = tf_year + '/' + tf_month + '/' + tf_date + ' ' + tf_hour + ':' + tf_minute; 
                        
                        content += '<tr><th>위치</th><td style="text-align:left;padding-left:10px;">'+ g.options.properties.loc +'</td></tr>';
                        content += '<tr><th>규모</th><td style="text-align:left;padding-left:10px;">'+ g.options.properties.mag +'</td></tr>';
                        content += '<tr><th>깊이</th><td style="text-align:left;padding-left:10px;">'+ g.options.properties.dep +' km</td></tr>';
                        content += '<tr><th>진앙시</th><td style="text-align:left;padding-left:10px;">'+ t_time +'</td></tr>';
                        content += '<tr><th>발표시각</th><td style="text-align:left;padding-left:10px;">'+ tf_time +'</td></tr>';
                        content += '<tr><th>참조사항</th><td style="text-align:left;padding-left:10px;">'+ g.options.properties.rem +'</td></tr>';
                        content += '<tr><th>진도</th><td style="text-align:left;padding-left:10px;">'+ g.options.properties.int +'</td></tr>';
//                            content += '<tr><td  colspan="2" style="text-align:left;padding-left:10px;"><img src="'+ g.properties.img +'"></img></td></tr>';
                    }else{//gis기능이벤트
                        console.log('기능마크팝업');
                        console.log(g.options.properties.seq);
                        console.log(g.options.properties.lat);
                        console.log(g.options.properties.lon);
                        //복수개의 정보가 있을 수 있으므로 DB에서 데이타를 다시 가져온다.
                        // var params = {
                        //     'sol_m_seq' : g.options.properties.seq,
                        //     'lat' : g.options.properties.lat,
                        //     'lon' : g.options.properties.lon
                        // }
                        // $.ajax({
                        //     type : 'POST',
                        //     url : gisObj.properties.contextPath + '/gis/common/selectFnMapData.do',
                        //     async: false,
                        //     data : params,
                        //     success : function(result) {
                        //         //alert(data);
                        //         var map_list = result.map_list;
                        //         var data_list = result.data_list;
                                
                               
                        //         if(data_list.length>1){
                        //             var html_head = '<table class="basic_tbl" style="padding-right:10px;"><tbody>';
                        //             var html_body = '';
                        //             var html_tail = '</tbody></table>';

                        //             html_body += '<tr>';
                        //             $.each(map_list, function(idx, obj){
                        //                 if(obj.map_opt == 'SIGN_NM'){
                        //                     html_body += '<th style="width:150px;">' + obj.sign_nm + '</th>';
                        //                 }
                        //             });
                        //             html_body += '</tr>';

                        //             $.each(data_list, function(idx, obj){
                        //                 html_body += '<tr>';
                        //                 $.each(map_list, function(idx2, obj2){
                        //                     if(obj2.map_opt == 'SIGN_NM'){
                        //                         //console.log(obj2.data_field_nm);
                        //                         var td_data = obj[obj2.data_field_nm];
                        //                         if(td_data == '#N/A') td_data = '';
                        //                         html_body += '<td>' + td_data + '</td>';
                        //                     }
                        //                 });
                        //                 html_body += '</tr>';
                        //             });
                        //             var html = html_head + html_body + html_tail;
                        //             console.log(html);

                        //             content += '<tr>';
                        //             content += '<td colspan="2" style="width:100%;margin:0;padding:0;border-left:0;border-right:0;border-bottom:0;border-top:0;">'+ html +'</td>';
                        //             content += '</tr>';
                        //         }else{
                        //             $.each(data_list, function(idx, obj){
                        //                 $.each(map_list, function(idx2, obj2){
                        //                     if(obj2.map_opt == 'SIGN_NM'){
                        //                         //console.log(obj2.data_field_nm);
                        //                         var td_data = obj[obj2.data_field_nm];
                        //                         if(td_data == '#N/A') td_data = '';
                        //                         content += '<tr>';
                        //                         content += '<th>' + obj2.sign_nm + '</th>';
                        //                         content += '<td style="text-align:left;padding-left:10px;">' + td_data + '</td>';
                        //                         content += '</tr>';
                        //                     }
                        //                 });
                        //             });
                        //         }
                                
                        //     }
                        // });
                    }
                    
                    content += '</tbody></table></div>'; 
                    
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
                    
                    if (quake.infoWindow != null) {
                        quake.infoWindow.remove();
                    }   
                      
                    var coordinate = g.options.coordinate;                  
                    quake.infoWindow = new maptalks.ui.InfoWindow(options);
                    quake.infoWindow.addTo(quake.map);
                    quake.infoWindow.show(coordinate);
                    //quake.infoWindow.addTo(quake.map).show(coordinate);
                    //flood.map.setCenterAndZoom(coordinate, flood.map.getZoom());
                }
            });
        }
    );
}

function initGui() {
    var params = {
        add: true,
        color: 0x00ffff,
        show: true,
        opacity: 1,
        altitude: 0,
        interactive: false
    };
    var gui = new dat.GUI();
    
    gui.addColor(params, 'color').name('line color').onChange(function () {
        lineMaterial.color.set(params.color);
        lines.forEach(function (mesh) {
            mesh.setSymbol(lineMaterial);
        });
    });
    gui.add(params, 'opacity', 0, 1).onChange(function () {
        lineMaterial.opacity = params.opacity;
        lines.forEach(function (mesh) {
            mesh.setSymbol(lineMaterial);
        });
    });
      
    gui.addColor(params, 'color').name('polygon color').onChange(function () {
        polygonMaterial.color.set(params.color);
        polygonMeshs.forEach(function (mesh) {
            mesh.setSymbol(polygonMaterial);
        });
    });
    gui.add(params, 'opacity', 0, 1).onChange(function () {
        polygonMaterial.opacity = params.opacity;
        polygonMeshs.forEach(function (mesh) {
            mesh.setSymbol(polygonMaterial);
        });
    });
  
}

quake.closeInfoWindow = function(){
    //console.log($('.map_info_area.mia_type1'));
    //$('.map_info_area.mia_type1').css("display", "none");
    
    if (quake.infoWindow != null) {
        quake.infoWindow.remove();
    }
}

const textureLoader = new THREE.TextureLoader();
let terrainList = [];
let isShowTerrain = false;
quake.loadTerrain = async function(){
    isShowTerrain = !isShowTerrain;

    if(isShowTerrain){ //show
        if(terrainList.length > 0 ){
            terrainList.forEach(t=>{t.visible = true;});
        }else{
            quake.loadTerrainNetwork();
        }
    }else{ //hide
        if(terrainList.length > 0 ){
            terrainList.forEach(t=>{t.visible = false;});
        }

    }
    
}

quake.loadTerrainNetwork = async function(){
    let zResol = 80;
    var coordMin = new maptalks.Coordinate(128.755734, 34.978977);//부산
    var coordMax = new maptalks.Coordinate(129.314373, 35.396265);//부산
    //var coordMin = new maptalks.Coordinate(129.148876, 35.151681);
    //var coordMax = new maptalks.Coordinate(129.155753, 35.156076);
    //var proj = proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:3857'));
    level = 10;
    let unit = 360 / (Math.pow(2, level) * 10);
    let minIdx = Math.floor((coordMin.x+180)/unit);
    let minIdy = Math.floor((coordMin.y+90)/unit);
    let maxIdx = Math.floor((coordMax.x+180)/unit);
    let maxIdy = Math.floor((coordMax.y+90)/unit);
    //console.log(minIdx, minIdy, maxIdx, maxIdy);
    //console.log(tileGrid.zoom, coordMin, coordMax);

    var idxIdyList = Array.from(Array((maxIdx-minIdx+1)*(maxIdy-minIdy+1)), () => new Array(2));
    var index = 0;
    for (var i=minIdx ; i<=maxIdx ; i++) {
      for (var j=minIdy ; j<=maxIdy; j++) {
        idxIdyList[index][0] = i+"";
        idxIdyList[index][1] = j+"";
        index++;
      }
    }     

    for (var i=0 ; i<idxIdyList.length ; i++) {
      const IDX = idxIdyList[i][0];
      const IDY = idxIdyList[i][1];
      const layer = "dem";
      let address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
      
      fetch(address).then(r=>{
        const size = r.headers.get("content-length");
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
            var geometry = new THREE.PlaneGeometry(1, 1, 64, 64);

            /*for (var i = 0, l = geometry.vertices.length; i < l; i++) {
              
              const z = pdata[i][2]/zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
              const v = gisObj.threeLayer.coordinateToVector3([pdata[i][0],pdata[i][1]], z);
              geometry.vertices[i].x = v.x;
              geometry.vertices[i].y = v.y;
              geometry.vertices[i].z = v.z;
            }*/
            for (var i = 0, l = geometry.attributes.position.count; i < l; i++) {
                const z = pdata[i][2]/zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
                const v = quake.threeLayerList[3].coordinateToVector3([pdata[i][0],pdata[i][1]], z);
                geometry.attributes.position.setXYZ(i, v.x, v.y, v.z);
            }
          
            var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/});
            material.opacity = 1;
            material.wireframe = false;
            var address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
            textureLoader.load(address, function(tx){
              material.map = tx;
              material.needsUpdate = true;
            });
            
            var plane = new THREE.Mesh(geometry, material);   
            quake.threeLayerList[3].addMesh(plane);
            plane.custom2DExtent = new maptalks.Extent(sData[0], sData[1], eData[0], eData[1]);
            terrainList.push(plane);
          });//arraybuffer
        }//16900
      }); //fetch
    }//for
}