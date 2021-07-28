var quake = {
    map: {},
    threeLayer: {},
    is3D: false,
};
var stats = null;
var infoWindow;
quake.infoWindow = infoWindow;

let camera, renderer, composer;
let object;
let effectDotScreen;



quake.viewMap = function () {
    quake.setBaseLayer();

    setAtdWorkers();


    quake.setThreeLayer();

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
        //maxZoom: 18,
        //minZoom: 9,
        centerCross: true,
        doubleClickZoom: false,
        baseLayer: setilLayer,
    });

}

//three layer 생성
quake.setThreeLayer = function () {
    quake.threeLayer = new maptalks.ThreeLayer('threelayer', {
        forceRenderOnZooming: false,
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

        renderer = gl;
        object = new THREE.Object3D();
        scene.add( object );


        composer = new THREE.EffectComposer( renderer );
        composer.addPass( new THREE.RenderPass( scene, camera ) );

        effectDotScreen = new THREE.DotScreenPass( new THREE.Vector2( 0, 0 ), 1.5, 0.1 );
 
        composer.addPass( effectDotScreen );

        // const effect2 = new THREE.ShaderPass( THREE.RGBShiftShader );
        // effect2.uniforms[ 'amount' ].value = 0.0015;
        // composer.addPass( effect2 );


    }

    quake.threeLayer.addTo(quake.map);
    //quake.map.on('moving moveend zoomend pitch rotate', update);

    //update();
}


quake.sortLayers = function () {
    //let sortLayers = []; 
    // quake.map.layer.forEach(l=>{
    //     if(l.type == 'ThreeLayer'){
    //         sortLayers.push(l);
    //     }
    // });
    //sortLayers.push(quake.threeLayer[3], quake.threeLayer[1], quake.threeLayer[0], quake.threeLayer[2] );
    //quake.map.sortLayers(sortLayers);   
}


function animation() {
    // layer animation support Skipping frames

    quake.threeLayer._needsUpdate = !quake.threeLayer._needsUpdate;
    if (quake.threeLayer._needsUpdate) {
        quake.threeLayer.renderScene();
    }
    if (stats) {
        stats.update();
    }
    requestAnimationFrame(animation);

    if(composer){
        //composer.render();
    }
}

var lineMaterial = new THREE.LineMaterial({
    color: 0x00ffff,
    transparent: true,
    // vertexColors: THREE.VertexColors,
    // side: THREE.BackSide,
    linewidth: 3, // in pixels
    // vertexColors: THREE.VertexColors,
    // dashed: false,
    wireframe: false,
});

// var lineMaterial = new THREE.LineBasicMaterial({
//      color: 0x00ffff,
//      //opacity: 0.8,
//      transparent: true,
//      linewidth: 10,
// });

var lines = [];

function getMesh(customId) {
    let resultData = [];
    const object3ds = quake.threeLayer.getMeshes();
    for (var i = 0; i < object3ds.length; i++) {
        let object3d = object3ds[i];
        if (object3d.object3d) {
            if (object3d.object3d.__parent) {
                let o3 = object3d.object3d.__parent;
                if (o3.customId == customId) {
                    resultData.push(object3d);
                }
            }
        }
    }

    return resultData;
}


function loadLine(e) {
    let seq = 0;
    let customId = 'line_' + seq;
    let meshs = getMesh(customId);
    if (e.checked) {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                m.show();
            });
        } else {
            fetch('/test/lineTest.geojson').then(function (res) {
                return res.json();
            }).then(function (geojson) {
                geojson = JSON.parse(geojson.geojson);

                var lineStrings = maptalks.GeoJSON.toGeometry(geojson);
                const mesh = quake.threeLayer.toFatLines(lineStrings, { interactive: false }, lineMaterial);
                //const mesh = quake.threeLayer.toLines(lineStrings, { interactive: false }, lineMaterial);
                mesh.customId = customId;
                lines.push(mesh);
                quake.threeLayer.addMesh(mesh);

                if(quake.is3D){
                    if (customId == 'line_' + seq) {
                        let LngLatData = [];
                        let pData = mesh._datas;
                        for (var i = 0; i < pData.length; i++) {
                            let p = pData[i];
                            for (var j = 0; j < p._coordinates.length; j++) {
                                let coord = p._coordinates[j];
                                let x = coord.x;
                                let y = coord.y;

                                LngLatData.push({ i, x, y });
                            }
                        }

                        runAtdWorker({ layer: mesh.customId, LngLatData });
                    }
                }
            });
        }
    } else {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                m.hide();
            });
        }
    }
}

var polygonMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, wireframe:false, flatShading: true});


let polygonMeshs = [];
let shaderMaterial = null;

async function loadPolygon(e) {
    let seq = 0;
    let customId = 'polygon_' + seq;
    let meshs = getMesh(customId);
    if (e.checked) {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                m.show();
            });
        } else {
            let res = await fetch('/test/polygonTest.geojson');
            let geojson = await res.json();
 
            let polygons = [];

            geojson.features.forEach(feature => {
                const geometry = feature.geometry;
                const type = feature.geometry.type;
                if (['Polygon', 'MultiPolygon'].includes(type)) {
                    const height = 0;
                    const properties = feature.properties;
                    properties.height = height;
                    const polygon = maptalks.GeoJSON.toGeometry(feature);
                    polygon.setProperties(properties);
                    polygons.push(polygon);
                }

            });
            if (polygons.length > 0) {

                 
                let custom_style_res = await fetch('/test/custom_style1.json');
                let custom_style = await custom_style_res.json();
                let texture = canvas2ImgTexture(custom_style);

                let vertShader = 
                `
                    varying vec2 vUv;
            
                    void main() {
            
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                    }
                `;

                let fragShader = `
                    varying vec2 vUv;
 
                    uniform sampler2D channel0;

                    void main() {
                        vec2 st = vUv;
                        float pixels = 20.0;
                        vec4 mosaicCol = texture2D(channel0, floor(st * pixels) / pixels);
                    
                        float dist = distance(fract(st * pixels), vec2(0.5));
                        dist = step(dist, 0.5);
                        gl_FragColor = vec4(vec3(1.0), dist) * mosaicCol;
                    }
                `;

                let uniforms = {
                    'channel0': {
                        value: texture
                    }
                };
                let ttmaterial = new THREE.ShaderMaterial( {
                    uniforms: uniforms,
                    vertexShader: vertShader,
                    fragmentShader: fragShader
                } );
                 
                var mesh = quake.threeLayer.toFlatPolygons(polygons.slice(0, Infinity), { topColor: '#fff', interactive: false, }, ttmaterial);
             
                mesh.customId = customId;
                quake.threeLayer.addMesh(mesh);
                polygonMeshs.push(mesh);

                polygons.length = 0; 

                object.add( mesh.object3d );
                
            } 
        }
    } else {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                m.hide();
            });
        }
    }
}
function canvas2ImgTexture(isCustom){
    const patternCanvas = document.createElement('canvas');
    const patternContext = patternCanvas.getContext('2d');
    if(isCustom.what == 'hatch'){
        var wh = Number(isCustom.size.wh);
        var barWidth = Number(isCustom.size.barWidth);
        var type = isCustom.size.type;
        
        patternCanvas.width = wh; //이미지 컨테이너 가로길이
        patternCanvas.height = wh; //이미지 켄터이너 세로길이
        var dg = Math.sqrt((wh*wh)+(wh*wh)); //대각선길이
        var rect={ x:(wh/2)-barWidth/2, y:(wh - dg)/2, width:barWidth, height:dg };
        patternContext.fillStyle = '#ffffff00'; //배경
        patternContext.fillRect(0, 0, patternCanvas.width, patternCanvas.height); //배경그리기
        
        patternContext.translate(wh/2, wh/2);
        
        var angle = 45;
        if(type == "\\"){
          angle = 45;
        }else if(type == "/"){
          angle = 135;
        }else if(type == "X"){
          angle = 45;
        }
        
        patternContext.rotate( -(Math.PI / 180) * angle );
        patternContext.translate(-wh/2, -wh/2);
        
        patternContext.fillStyle = isCustom.hatchColor;
        //patternContext.globalAlpha = Number(isCustom.opacity);
        patternContext.fillRect( rect.x, rect.y, rect.width, rect.height );
        
        if(type == "\\" || type == "/"){
            patternContext.fillRect((wh - dg)/2 - barWidth/2, (wh/2) - (barWidth/2), barWidth, barWidth); //왼쪽하단
            patternContext.fillRect((wh + dg)/2 - barWidth/2, (wh/2) - (barWidth/2), barWidth, barWidth); //오른쪽상단
        }else if(type == "X"){
          patternContext.restore();
          patternContext.translate(wh/2, wh/2);
          patternContext.rotate( -(Math.PI / 180) * 90 );
          patternContext.translate(-wh/2, -wh/2);
          patternContext.fillRect( rect.x, rect.y, rect.width, rect.height );
        }
        
    } else if(isCustom.what == 'dot'){
        var wh = Number(isCustom.size.wh);
        var offset = Number(isCustom.size.offset);
        var radius = Number(isCustom.size.radius);
        patternCanvas.width = wh + offset; //이미지 컨테이너 가로길이
        patternCanvas.height = wh + offset; //이미지 켄터이너 세로길이
        patternContext.beginPath();
        patternContext.arc(wh/2, wh/2, radius, 0, Math.PI * 2, true);
        patternContext.fillStyle = isCustom.dotColor;
        //patternContext.globalAlpha = Number(isCustom.opacity);
        patternContext.fill();
    }
    
    // var canvas=document.createElement('canvas');
    // var ctx=canvas.getContext("2d");
    // ctx.fillStyle=ctx.createPattern(patternCanvas,'repeat');
    // ctx.fillRect(0,0,1200,1200);

    const texture = new THREE.CanvasTexture(patternContext.canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set( 5, 5 );
    
    //const texture = new THREE.CanvasTexture(ctx.canvas);

//     NearestFilter: THREE.NearestFilter,
//     NearestMipMapLinearFilter: THREE.NearestMipMapLinearFilter,
//     NearestMipMapNearestFilter: THREE.NearestMipMapNearestFilter,
//     'LinearFilter ': THREE.LinearFilter,
//     'LinearMipMapLinearFilter (Default)': THREE.LinearMipMapLinearFilter,
//     LinearMipmapNearestFilter: THREE.LinearMipmapNearestFilter,
//      },
//      magFilters: {
//     NearestFilter: THREE.NearestFilter,
//     'LinearFilter (Default)': THREE.LinearFilter,

    // texture.minFilter = THREE.LinearMipMapLinearFilter;
    // texture.magFilter = THREE.NearestFilter;
    // texture.needsUpdate = true
    // const material = new THREE.MeshPhongMaterial({
    //     map: texture,
    //     transparent:true,
    //     //side: THREE.DoubleSide,
    //     //color: '#ffff00',
    //     //bumpMap: THREE.ImageUtils.loadTexture('http://i.imgur.com/tz483el.jpg'),
    // });

    //var dataURL = patternCanvas.toDataURL("image/jpg");

    return texture;

    // var dataURL = patternCanvas.toDataURL("image/jpg");

    // return dataURL ; // dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
}

function createMateria(fillStyle) {
    const idx = Math.floor(Math.random() * 3);
    return new THREE.PointsMaterial({
        // size: 10,
        sizeAttenuation: false,
        color: fillStyle,
        // alphaTest: 0.5,
        // vertexColors: THREE.VertexColors,
        transparent: true,
        color: 0xffffff,
        size: 25,
        //transparent: true, //使材质透明
        //blending: THREE.AdditiveBlending,
        //depthTest: true, //深度测试关闭，不消去场景的不可见面
        //depthWrite: false,
        map: new THREE.TextureLoader().load('/test/selectFnIcon' + (idx + 1) + '.png')
        //刚刚创建的粒子贴图就在这里用上
    });
}

let markerList = [];
function loadPoint(e) {
    let seq = 0;
    let customId = 'point_' + seq;
    let meshs = getMesh(customId);
    if (e.checked) {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                m.show();
            });
        } else {
            fetch('/test/pointTest.geojson').then((function (res) {
                return res.json();
            })).then(function (json) {
                let seq = 261;

                let dataInfo = json.dataInfo;
                let dataList = json.dataList;

                var lon;
                var lat;
                var addr;
                $.each(dataList, function (idx, obj) {
                    //console.log(obj);
                    if (obj.map_opt == "LON") {
                        lon = obj.data_field_nm;//x?
                    } else if (obj.map_opt == "LAT") {
                        lat = obj.data_field_nm;//x?
                    } else if (obj.map_opt == "ADDR") {
                        addr = obj.data_field_nm;//x?
                    }
                });

                const lnglats = [];
                dataInfo.forEach(di => {
                    di.seq = seq;
                    di.lon = di.LNG;
                    di.lat = di.LAT;
                    lnglats.push({ coordinate: [di.LNG, di.LAT], properties: di });
                });

                points = lnglats.map(lnglat => {
                    const material = createMateria();
                    const point = quake.threeLayer.toPoint(lnglat.coordinate, { height: 100, properties: lnglat.properties }, material);
                    point.customId = customId;


                    //for (var i = 0; i < point.object3d.geometry.attributes.position.count; i++) {
                    //point.object3d.geometry.attributes.position.setZ(i, 0.1);
                    //}
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
                                    quake.infoWindow.addTo(this).show({ x: e.target.options.coordinate[0], y: e.target.options.coordinate[1] });
                                }
                                //this.openInfoWindow(e.coordinate);
                            }
                        });
                    });
                    return point;

                });

                quake.threeLayer.addMesh(points);
            });
        }
    } else {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                m.hide();
            });
        }
    }
}

async function getContents(g) {
    let markerTitle = '';
    let containerHeight = 'height:237px;';
    let containerHeight2 = 'height:188px;';
    let marginTop = 'top:-30px;';
    if (g.options.layer._id == 'quakeHistoryMarker') {  //지진 목록 마커이벤트 제목
        if (g.options.properties.fctp == '2') {
            markerTitle = '국외지진정보';
        } else if (g.options.properties.fctp == '3') {
            markerTitle = '국내지진정보';
        } else if (g.options.properties.fctp == '5') {
            markerTitle = '국내지진정보(재통보)';
        } else if (g.options.properties.fctp == '11') {
            markerTitle = '국내지진조기경보';
        } else if (g.options.properties.fctp == '12') {
            markerTitle = '국외지진조기경보';
        } else if (g.options.properties.fctp == '13') {
            markerTitle = '조기경보정밀분석';
        } else if (g.options.properties.fctp == '14') {
            markerTitle = '지진속보(조기분석)';
        }
        containerHeight = '';
        containerHeight2 = '';
        marginTop = 'top:-60px;';
    } else {//gis기능이벤트 제목
        markerTitle = g.options.properties.TITLE;
        containerHeight = 'height:237px;';
        containerHeight2 = 'height:188px;';
        marginTop = '';
    }
    var content =
        '<div class="map_info_area mia_type1" style="position:absolute;width:460px;' + containerHeight + 'z-index:1000;' + marginTop + '">' +
        //'<h3><em>' + g.properties.name + '</em><a href="#;" class="closebtn" onclick="flood.closeInfoWindow()"><i class="fal fa-times"></i></a></h3> '+
        '<h3 style="height:45px;"><em>' + markerTitle + '</em><a href="#;" class="closebtn" onclick="quake.closeInfoWindow()"><i class="fal fa-times"></i></a></h3> ' +
        '<div class="mia_con alignCenter" style="background-color: #fff;' + containerHeight2 + 'overflow-y:scroll;">' +
        '<table class="basic_tbl">' +
        '<colgroup>' +
        '<col style="width:37%"/>' +
        '<col style="width:63%"/>' +
        '</colgroup>' +
        '<tbody>';
    if (g.options.layer._id == 'quakeHistoryMarker') { //지진 목록 마커이벤트
        let tmeqk = g.options.properties.tmeqk;//진앙시
        let t_year = tmeqk.substr(0, 4);
        let t_month = tmeqk.substr(4, 2);
        let t_date = tmeqk.substr(6, 2);
        let t_hour = tmeqk.substr(8, 2);
        let t_minute = tmeqk.substr(10, 2);
        let t_second = tmeqk.substr(12, 2);
        let t_time = t_year + '/' + t_month + '/' + t_date + ' ' + t_hour + ':' + t_minute + ':' + t_second;

        let tmfc = g.options.properties.tmfc;//발표시각
        let tf_year = tmfc.substr(0, 4);
        let tf_month = tmfc.substr(4, 2);
        let tf_date = tmfc.substr(6, 2);
        let tf_hour = tmfc.substr(8, 2);
        let tf_minute = tmfc.substr(10, 2);
        let tf_time = tf_year + '/' + tf_month + '/' + tf_date + ' ' + tf_hour + ':' + tf_minute;

        content += '<tr><th>위치</th><td style="text-align:left;padding-left:10px;">' + g.options.properties.loc + '</td></tr>';
        content += '<tr><th>규모</th><td style="text-align:left;padding-left:10px;">' + g.options.properties.mag + '</td></tr>';
        content += '<tr><th>깊이</th><td style="text-align:left;padding-left:10px;">' + g.options.properties.dep + ' km</td></tr>';
        content += '<tr><th>진앙시</th><td style="text-align:left;padding-left:10px;">' + t_time + '</td></tr>';
        content += '<tr><th>발표시각</th><td style="text-align:left;padding-left:10px;">' + tf_time + '</td></tr>';
        content += '<tr><th>참조사항</th><td style="text-align:left;padding-left:10px;">' + g.options.properties.rem + '</td></tr>';
        content += '<tr><th>진도</th><td style="text-align:left;padding-left:10px;">' + g.options.properties.int + '</td></tr>';
        //                            content += '<tr><td  colspan="2" style="text-align:left;padding-left:10px;"><img src="'+ g.properties.img +'"></img></td></tr>';
    } else {//gis기능이벤트
        console.log('기능마크팝업');
        console.log(g.options.properties.seq);
        console.log(g.options.properties.lat);
        console.log(g.options.properties.lon);
        //복수개의 정보가 있을 수 있으므로 DB에서 데이타를 다시 가져온다.
        var params = {
            'sol_m_seq': g.options.properties.seq,
            'lat': g.options.properties.lat,
            'lon': g.options.properties.lon
        }
        let resp = await fetch('/test/makerEvent.geojson');
        let result = await resp.json();

        var map_list = result.map_list;
        var data_list = result.data_list;


        if (data_list.length > 1) {
            var html_head = '<table class="basic_tbl" style="padding-right:10px;"><tbody>';
            var html_body = '';
            var html_tail = '</tbody></table>';

            html_body += '<tr>';
            $.each(map_list, function (idx, obj) {
                if (obj.map_opt == 'SIGN_NM') {
                    html_body += '<th style="width:150px;">' + obj.sign_nm + '</th>';
                }
            });
            html_body += '</tr>';

            $.each(data_list, function (idx, obj) {
                html_body += '<tr>';
                $.each(map_list, function (idx2, obj2) {
                    if (obj2.map_opt == 'SIGN_NM') {
                        //console.log(obj2.data_field_nm);
                        var td_data = obj[obj2.data_field_nm];
                        if (td_data == '#N/A') td_data = '';
                        html_body += '<td>' + td_data + '</td>';
                    }
                });
                html_body += '</tr>';
            });
            var html = html_head + html_body + html_tail;
            console.log(html);

            content += '<tr>';
            content += '<td colspan="2" style="width:100%;margin:0;padding:0;border-left:0;border-right:0;border-bottom:0;border-top:0;">' + html + '</td>';
            content += '</tr>';
        } else {
            $.each(data_list, function (idx, obj) {
                $.each(map_list, function (idx2, obj2) {
                    if (obj2.map_opt == 'SIGN_NM') {
                        //console.log(obj2.data_field_nm);
                        var td_data = obj[obj2.data_field_nm];
                        if (td_data == '#N/A') td_data = '';
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
        'autoOpenOn': false,  //set to null if not to open window when clicking on map
        'single': false,
        'custom': true,
        'width': 460,
        'height': 170,
        'dx': -230,
        'dy': -230 - 40,
        'content': content
    };

    return options;
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
        lineMaterial.uniforms.opacity.value = (params.opacity);
        if(params.opacity == 0){
            lines.forEach(function (mesh) {
                mesh.hide();
            });
        }else{
            lines.forEach(function (mesh) {
                mesh.show();
            });
        }
        lines.forEach(function (mesh) {
            mesh.setSymbol(lineMaterial);
        });
    });

    // gui.addColor(params, 'color').name('polygon color').onChange(function () {
    //     polygonMaterial.color.set(params.color);
    //     polygonMeshs.forEach(function (mesh) {
    //         mesh.setSymbol(polygonMaterial);
    //     });
    // });
    // gui.add(params, 'opacity', 0, 1).onChange(function () {
    //     polygonMaterial.opacity = params.opacity;
    //     polygonMeshs.forEach(function (mesh) {
    //         mesh.setSymbol(polygonMaterial);
    //     });
    // });

    var patternSizeParam = { 
        patternSize: 6,
    };
    gui.add(patternSizeParam, 'patternSize', 6, 200).onChange(function () {
        shaderMaterial.uniforms.patternSize = patternSizeParam.patternSize;
    });

}

quake.closeInfoWindow = function () {
    //console.log($('.map_info_area.mia_type1'));
    //$('.map_info_area.mia_type1').css("display", "none");

    if (quake.infoWindow != null) {
        quake.infoWindow.remove();
    }
}

const textureLoader = new THREE.TextureLoader();
let terrainList = [];
quake.loadTerrain = async function (e) {
    let isCheck = e.checked;

    quake.is3D = isCheck;
    if (quake.is3D) { //show
        if (terrainList.length > 0) { //객체가 있을경우
            terrainList.forEach(t => { t.visible = true; });


            quake.threeLayer._renderer.scene.children.forEach(c => {
                if (c.__parent && c.__parent.customId) {
                    let mesh_seq = c.__parent.customId.split('_');
                    let customId = mesh_seq[0];
                    let seq = mesh_seq[1];

                    if (customId == 'line') { 
                        let pData = c.__parent._datas;
                        let allCnt = 0;
                        let endPos = 0; 

                        for (var d = 0; d < pData.length; d++) {
                            let value = pData[d]._coordinates;

                            
                            let vcnt = value.length * 3 + ((value.length - 2) * 3);
                            allCnt += vcnt;
            
                            let idxCnt = (2 + ((value.length - 2) * 2));
            
                            let selIdx = 2;
            
                            for (var i = 0; i < value.length; i++) { //4개 18개 6
                                let vd = value[i];
                                let x = vd.x;
                                let y = vd.y;
                                let altitude = vd.altitude + 0.08;
            
                                let geo = null;
                                if (c.geometry) {
                                    geo = c.geometry;
                                } else if (c.object3d.geometry) {
                                    geo = c.object3d.geometry;
                                }
                                let posCnt = geo.attributes.instanceStart.count;
                                if (i == 0 || i == value.length - 1) {
                                    geo.attributes.instanceStart.array[selIdx + endPos] = altitude;
                                    geo.attributes.instanceEnd.array[selIdx + endPos] = altitude;
                                    selIdx += 3;
                                } else {
                                    geo.attributes.instanceStart.array[selIdx + endPos] = altitude;
                                    geo.attributes.instanceEnd.array[selIdx + endPos] = altitude;
                                    selIdx += 3;
                                    geo.attributes.instanceStart.array[selIdx + endPos] = altitude;
                                    geo.attributes.instanceEnd.array[selIdx + endPos] = altitude;
                                    selIdx += 3;
                                }
                                if (i == value.length - 1) {
                                    endPos += vcnt;
                                }
                            }
                        }

                        let geo = null;
                        if (c.geometry) {
                            geo = c.geometry;
                        } else if (c.object3d.geometry) {
                            geo = c.object3d.geometry;
                        }
                        geo.attributes.instanceStart.needsUpdate = true;
                        geo.attributes.instanceEnd.needsUpdate = true;
                        geo.computeBoundingBox();
                        geo.computeBoundingSphere();
                    }
                }

            });

        } else { //객체가 없을경우 로딩
            quake.loadTerrainNetwork();


            quake.threeLayer._renderer.scene.children.forEach(c => {
                //line
                if (c.__parent && c.__parent.customId) {
                    let mesh_seq = c.__parent.customId.split('_');
                    let customId = mesh_seq[0];
                    let seq = mesh_seq[1];

                    if (customId == 'line') {
                        let LngLatData = [];
                        let pData = c.__parent._datas;
                        for (var i = 0; i < pData.length; i++) {
                            let p = pData[i];
                            for (var j = 0; j < p._coordinates.length; j++) {
                                let coord = p._coordinates[j];
                                let x = coord.x;
                                let y = coord.y;

                                LngLatData.push({ i, x, y });
                            }
                        }

                        runAtdWorker({ layer: c.__parent.customId, LngLatData });
                    } else if (customId == 'polygon') {
                        let LngLatData = [];
                        let pData = c.__parent._datas;
                        for (var i = 0; i < pData.length; i++) {
                            let p = pData[i];
                            for (var j = 0; j < p._coordinates.length; j++) {
                                let coord = p._coordinates[j];
                                let x = coord.x;
                                let y = coord.y;

                                LngLatData.push({ i, x, y });
                            }
                            if(p._holes){
                                for (var h = 0; h < p._holes.length; h++){
                                    for (var j = 0; j < p._holes[h].length; j++) {
                                        let coord = p._holes[h][j];
                                        let x = coord.x;
                                        let y = coord.y;

                                        LngLatData.push({ i, x, y });
                                    }
                                }
                            }
                            
                        }

                        runAtdWorker({ layer: c.__parent.customId, LngLatData });
                    } else if (customId == 'point') {

                    }
                }

            });




        }
    } else { //hide
        if (terrainList.length > 0) {
            terrainList.forEach(t => { t.visible = false; });
        }

        quake.threeLayer._renderer.scene.children.forEach(c => {
            //line
            if (c.__parent && c.__parent.customId) {
                let mesh_seq = c.__parent.customId.split('_');
                let customId = mesh_seq[0];
                let seq = mesh_seq[1];

                if (customId == 'line') {
                    let geo = null;
                    if (c.geometry) {
                        geo = c.geometry;
                    } else if (c.object3d.geometry) {
                        geo = c.object3d.geometry;
                    }

                    let posCnt = geo.attributes.instanceStart.count;
                    for (var i = 0; i < posCnt; i++) {
                        geo.attributes.instanceStart.setZ(i, 0);
                        geo.attributes.instanceEnd.setZ(i, 0);
                    }
                    geo.attributes.instanceStart.needsUpdate = true;
                    geo.attributes.instanceEnd.needsUpdate = true;
                    geo.computeBoundingBox();
                    geo.computeBoundingSphere();
                }
            }
        });
    }


}

quake.loadTerrainNetwork = async function () {
    let zResol = 80;
    var coordMin = new maptalks.Coordinate(128.755734, 34.978977);//부산
    var coordMax = new maptalks.Coordinate(129.314373, 35.396265);//부산
    //var coordMin = new maptalks.Coordinate(129.148876, 35.151681);
    //var coordMax = new maptalks.Coordinate(129.155753, 35.156076);
    //var proj = proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:3857'));
    level = 10;
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

    for (var i = 0; i < idxIdyList.length; i++) {
        const IDX = idxIdyList[i][0];
        const IDY = idxIdyList[i][1];
        const layer = "dem";
        let address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;

        fetch(address).then(r => {
            const size = r.headers.get("content-length");
            if (Number(size) >= 16900) {
                r.arrayBuffer().then(function (buffer) {
                    //var byteArray = new Uint8Array(buffer);
                    p = new Parser(buffer);

                    let x = unit * (IDX - (Math.pow(2, level - 1) * 10));
                    let y = unit * (IDY - (Math.pow(2, level - 2) * 10));
                    let pdata = [];
                    let sData = null;
                    let eData = null;
                    for (var yy = 64; yy >= 0; yy--) {
                        for (var xx = 0; xx < 65; xx++) {
                            let xDegree = x + (unit / 64) * xx;
                            let yDegree = y + (unit / 64) * yy;
                            let height = p.getFloat4();
                            pdata.push([xDegree, yDegree, height]);

                            if (yy == 0 && xx == 64) {
                                eData = [xDegree, yDegree];
                            } else if (yy == 64 && xx == 0) {
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
                        const z = pdata[i][2] / zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
                        const v = quake.threeLayer.coordinateToVector3([pdata[i][0], pdata[i][1]], z);
                        geometry.attributes.position.setXYZ(i, v.x, v.y, v.z);
                    }

                    var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/ });
                    material.opacity = 1;
                    material.wireframe = false;
                    var address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
                    textureLoader.load(address, function (tx) {
                        material.map = tx;
                        material.needsUpdate = true;
                    });

                    var plane = new THREE.Mesh(geometry, material);
                    quake.threeLayer.addMesh(plane);
                    plane.custom2DExtent = new maptalks.Extent(sData[0], sData[1], eData[0], eData[1]);
                    terrainList.push(plane);
                });//arraybuffer
            }//16900
        }); //fetch
    }//for
}

function objSize(obj) {
    var size = 0,
        key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
}

function sortObject(o) {
    var sorted = {},

        key, a = [];
    for (key in o) {
        if (o.hasOwnProperty(key)) a.push(key);
    }
    a.sort();

    for (key = 0; key < a.length; key++) {
        sorted[a[key]] = o[a[key]];
    }
    return sorted;
}


let hardwareConcurrency = typeof window !== 'undefined' ? window.navigator.hardwareConcurrency || 4 : 0;
let atdWorkerCount = Math.max(Math.floor(hardwareConcurrency / 2), 1);
let currentAtdWorkerQueue = 0;
let atdReceivedData = new Map();
let atdData = new Map();
let atdWorkerQueueList = [];

for (var i = 0; i < atdWorkerCount; i++) {
    let wktq = new WorkerThreadQueue();
    wktq.qid = i;
    let w = new Worker('/js/worker/atd_worker.js');
    w.wid = i;

    atdWorkerQueueList.push({ wktq, w });
}

function setAtdWorkers() {
    for (var i = 0; i < atdWorkerCount; i++) {
        atdPostWorkerQueue("TRLD", null, null, mergeAtdWorkerCallback);
    }
}

function getAtdWorkerQueue() {
    var queue;
    var w;
    atdWorkerQueueList.some(el => {
        if (el.wktq.qid == currentAtdWorkerQueue && el.w.wid == currentAtdWorkerQueue) {
            if (el.wktq && el.w) {
                queue = el.wktq;
                w = el.w;
                return true;
            }
        }
    });

    currentAtdWorkerQueue++;
    if (currentAtdWorkerQueue >= atdWorkerCount) {
        currentAtdWorkerQueue = 0;
    }

    return { queue, w };
}

function atdPostWorkerQueue(what, data, layer, callback) {
    let wktqNw = getAtdWorkerQueue();
    wktqNw.queue.pushQueue(wktqNw.w, { what, data, qid: wktqNw.queue.qid, wid: wktqNw.w.wid, layer }, callback);
}

async function runAtdWorker(params) {
    console.time('performance' + params.layer);

    let layer = params.layer;
    let LngLatData = params.LngLatData;
    let sliceCnt = atdWorkerCount;
    let elementSize = Math.floor(LngLatData.length / sliceCnt);
    let namugi = LngLatData.length % sliceCnt;

    for (var i = 0; i < sliceCnt; i++) {
        let start = i * elementSize;
        let end = (i + 1) * elementSize;
        if (namugi > 0) {
            if (i == sliceCnt - 1) {
                end = LngLatData.length;
            }
        }
        let sl = LngLatData.slice(start, end);
        atdPostWorkerQueue("TRAN", sl, layer, mergeAtdWorkerCallback);
    }
}

let workerCompleCnt = 0;
function mergeAtdWorkerCallback(e) {
    if (e.data.what == 'TRCP') {
        workerCompleCnt++;
        if (workerCompleCnt == atdWorkerCount) {
            console.log("all atd worker complete");
        }
    } else if (e.data.what == 'TRANCOPLETE') {
        let qid = e.data.qid;
        let wid = e.data.wid;
        let transData = e.data.transData;
        let layer = e.data.layer;

        if(atdReceivedData.has(layer)){
            let rcvData = atdReceivedData.get(layer);
            rcvData[qid] = transData;
        }else{
            let rcvData = {};
            rcvData[qid] = transData;
            atdReceivedData.set(layer, rcvData);
        }
        
        atdReceivedData.forEach((value, key, mapObject) => {
            if (objSize(value) == atdWorkerCount) {
                // let sortedO = common_gis.sortObject(wavReceivedData);
                // for (k in sortedO){
                //     let zxdf = sortedO[k];
                //     __data.push(...zxdf);
                // }
                let l = Object.values(value);
                let rcvData = [];
                l.forEach(_l => {
                    rcvData.push(..._l);
                });
    
                for (var member in value) delete value[member];
                atdReceivedData.delete(key);
                atdData.set(layer, rcvData);
                atdPostProcess(layer);
                console.timeEnd('performance'+layer);
            }
        });
    }
}

function atdPostProcess(layer) {
    let rcvData = atdData.get(layer);
    atdData.delete(layer);
    //let custom_altitude = _this._datas[_i].properties.altitude;
    let processData = new Map();
    for (var i = 0; i < rcvData.length; i++) {
        let rd = rcvData[i];
        let idx = rd.d.i;
        let x = rd.d.x;
        let y = rd.d.y;
        let altitude = rd.altitude;

        if (processData.has(idx)) {
            let xyzList = processData.get(idx);
            xyzList.push({ x, y, altitude });
        } else {
            let xyzList = []
            xyzList.push({ x, y, altitude });
            processData.set(idx, xyzList);
        }
    }

    let childPos = -1;
    const object3ds = quake.threeLayer.getMeshes();
    for (var i = 0; i < object3ds.length; i++) {
        let object3d = object3ds[i];
        if (object3d.object3d) {
            if (object3d.object3d.__parent) {
                let o3 = object3d.object3d.__parent;
                if (o3.customId == layer) {
                    //mesh property에 altitude 넣기
                    for(var j=0; j<o3._datas.length; j++){
                        let _d = o3._datas[j]; 
                        if(j==42){
                            console.log("debug");
                        }

                        let pd = processData.get(j);
                        let pdIdx = 0;
                        for(pdIdx=0; pdIdx<_d._coordinates.length; pdIdx++){
                            let _coord = _d._coordinates[pdIdx];
                            let ca = pd[pdIdx];
                            if(ca.altitude){
                                _coord.altitude = ca.altitude;
                            }else{
                                _coord.altitude = 0;
                                console.log("debug1");
                            } 
                        }

                        if(_d._holes){
                            for(var h=0; h<_d._holes.length; h++){
                                for(var k=0; k<_d._holes[h].length; k++){
                                    let _coord = _d._holes[h][k];
                                    let ca = pd[pdIdx];
                                    if(ca.altitude){
                                        _coord.altitude = ca.altitude;
                                    }else{
                                        _coord.altitude = 0;
                                        console.log("debug2");
                                    }
                                    pdIdx++;
                                }
                            }
                        }
                    }
                    childPos = i;
                    break;
                }
            }
        }
    }

    let customId = layer.split('_');
    if(customId[0] == 'line'){ 
        let allCnt = 0;
        let endPos = 0;

        let c = object3ds[childPos];//quake.threeLayer._renderer.scene.children[childPos];
        let geo = null;
        if (c.geometry) {
            geo = c.geometry;
        } else if (c.object3d.geometry) {
            geo = c.object3d.geometry;
        }
        let posCnt = geo.attributes.instanceStart.count;

        for (var [key, value] of processData) {

            let vcnt = value.length * 3 + ((value.length - 2) * 3);
            allCnt += vcnt;

            let idxCnt = (2 + ((value.length - 2) * 2));

            let selIdx = 2;

            for (var i = 0; i < value.length; i++) { //4개 18개 6
                let vd = value[i];
                let x = vd.x;
                let y = vd.y;
                let altitude = vd.altitude + 0.2;

                if (i == 0 || i == value.length - 1) {
                    geo.attributes.instanceStart.array[selIdx + endPos] = altitude;
                    geo.attributes.instanceEnd.array[selIdx + endPos] = altitude;
                    selIdx += 3;
                } else {
                    geo.attributes.instanceStart.array[selIdx + endPos] = altitude;
                    geo.attributes.instanceEnd.array[selIdx + endPos] = altitude;
                    selIdx += 3;
                    geo.attributes.instanceStart.array[selIdx + endPos] = altitude;
                    geo.attributes.instanceEnd.array[selIdx + endPos] = altitude;
                    selIdx += 3;
                }
                if (i == value.length - 1) {
                    endPos += vcnt;
                }
            }

        }
        // let posCnt = geo.attributes.instanceStart.count;
        // for(var i=0; i<posCnt; i++){
        //     geo.attributes.instanceStart.setZ(i, 100);
        //     geo.attributes.instanceEnd.setZ(i, 100);
        // }
        geo.attributes.instanceStart.needsUpdate = true;
        geo.attributes.instanceEnd.needsUpdate = true;
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
    }else if(customId[0] == 'polygon'){
        let allCnt = 0;
        let endPos = 0;
        let testEndCnt = 0;
        let c = object3ds[childPos];//quake.threeLayer._renderer.scene.children[childPos];
        let geo = null;
        if (c.geometry) {
            geo = c.geometry;
        } else if (c.object3d.geometry) {
            geo = c.object3d.geometry;
        }
        let posCnt = geo.attributes.position.count;

        for (var [key, value] of processData) {
            let _geoCnt = 0;
            let allHolePoint = 0;
            let _polygon = c._datas[key];
            
            if(_polygon.type == 'MultiPolygon'){
                _polygon.forEach(p=>{
                    let mph = p.getHoles();
                    mph.forEach(h=>{
                        allHolePoint+=h.length;
                    });
                    _geoCnt+=p._coordinates.length;
                });
            }else if(_polygon.type == 'Polygon'){
                _geoCnt = _polygon._coordinates.length;
                let holes = _polygon.getHoles();
                holes.forEach(h=>{
                    allHolePoint+=h.length;
                });
            }

            let _allGeoCnt = _geoCnt + allHolePoint;
            let vertCnt = _allGeoCnt*3;//(_allGeoCnt*2 + _allGeoCnt*2*2)*3;
            allCnt += vertCnt;

            let selIdx = 2;
            
            for (var i = 0; i < value.length; i++) {
                let vd = value[i];
                let x = vd.x;
                let y = vd.y;
                let altitude = vd.altitude + 0.08;

                let zIdx = (i*3)+2;
                geo.attributes.position.array[zIdx + endPos] = altitude;
                
                
               // geo.attributes.position.array[selIdx + endPos] = altitude;
                //selIdx += 3;
                
                if (i == value.length - 1) {
                    endPos += vertCnt;
                }
            }

        }
 
        // for(var i=0; i<posCnt; i++){
        //     geo.attributes.position.setZ(i, 1);
        // }
        geo.attributes.position.needsUpdate = true;
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
    }
}