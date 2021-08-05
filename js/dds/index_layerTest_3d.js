var quake = {
    map: {},
    threeLayer: {},
    is3D: false,
    prevCameraInfo: {},
};
var stats = null;
var infoWindow;
quake.infoWindow = infoWindow;

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
        quake.prevCameraInfo = {far:camera.far, near:camera.near, fov:camera.fov, position:camera.position};
        stats = new Stats();
        stats.domElement.style.zIndex = 100;
        document.getElementById('map').appendChild(stats.domElement);

        var light = new THREE.DirectionalLight(0xffffff);
        light.position.set(0, -10, 10).normalize();
        scene.add(light);

        composer = new THREE.EffectComposer( gl );

        const renderPass = new THREE.RenderPass( scene, camera );
        composer.addPass( renderPass ); 

        effectFXAA = new THREE.ShaderPass( THREE.FXAAShader );
        effectFXAA.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );
        composer.addPass( effectFXAA );
    }

    quake.threeLayer.addTo(quake.map);
    //quake.map.on('moving moveend zoomend pitch rotate', update);

    //update();
}

let composer,  effectFXAA;

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
var startTime = Date.now();
var timeDelta = 0;

function animation() {
    timeDelta = Date.now() - startTime;
    // layer animation support Skipping frames

    quake.threeLayer._needsUpdate = !quake.threeLayer._needsUpdate;
    if (quake.threeLayer._needsUpdate) {
        quake.threeLayer.renderScene();
    }
    if(quake.threeLayer._renderer.camera && quake.is3D){
        //console.log('maptalks', quake.map.cameraFar, quake.map.cameraNear, quake.map._fov);

        //console.log('three', quake.threeLayer._renderer.camera.far, quake.threeLayer._renderer.camera.near, quake.threeLayer._renderer.camera.fov);
        
        quake.threeLayer._renderer.camera.far = quake.map.cameraFar;
        quake.threeLayer._renderer.camera.near = quake.map.cameraNear;
        quake.threeLayer._renderer.camera.fov = quake.map._fov;
        quake.threeLayer._renderer.camera.position.x = quake.map.cameraPosition[0];
        quake.threeLayer._renderer.camera.position.y = quake.map.cameraPosition[1];
        quake.threeLayer._renderer.camera.position.z = quake.map.cameraPosition[2];
 
    }

    if (stats) {
        stats.update();
    }

    if(composer){
        composer.render();
    }

    //polygoneCirclePatternMaterial.uniforms.u_time.value = timeDelta;

    requestAnimationFrame(animation);
} 

var lineMaterial = new THREE.LineMaterial({
    color: 0x00ffff,
    transparent: true,
    // vertexColors: THREE.VertexColors,
    //side: THREE.DoubleSide,
    linewidth: 1, // in pixels
    // vertexColors: THREE.VertexColors,
    // dashed: false,
    wireframe: false,
    depthTest: false,
    blending: THREE.NormalBlending ,
});

// var lineMaterial = new THREE.LineBasicMaterial({
//      color: 0x00ffff,
//      //opacity: 0.8,
//      transparent: true,
//      linewidth: 10,
// });

var lines = [];

quake.getMesh = function(customId) {
    let resultData = [];
    const object3ds = quake.threeLayer.getMeshes();
    for (var i = 0; i < object3ds.length; i++) {
        let object3d = object3ds[i];
        if (object3d.object3d && object3d.object3d.customId) { //maptalks.three mesh
            let splitIds = object3d.object3d.customId.split('_');
            if(splitIds[0] == customId){ //seq check 
                resultData.push(object3d.object3d); 
            }
        }else if(object3d.customId){ //three mesh
            let splitIds = object3d.customId.split('_');
            if(splitIds[0] == customId){ //seq check  
                resultData.push(object3d); 
            }
        }
    }

    return resultData;
}


function loadLine(e) {
    let seq = -1;
    //let customId = seq;
    let meshs = quake.getMesh(seq);
    if (e.checked) {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.show();
                }else{
                    m.visible = true;
                }
            });
        } else {
            fetch('/test/lineTest.geojson').then(function (res) {
                return res.json();
            }).then(function (geojson) {
                geojson = JSON.parse(geojson.geojson);

                var lineStrings = maptalks.GeoJSON.toGeometry(geojson);
                const lineMesh = quake.threeLayer.toFatLines(lineStrings, { interactive: false }, lineMaterial);
                //const mesh = quake.threeLayer.toLines(lineStrings, { interactive: false }, lineMaterial);

                // lineMaterial.polygonOffset = true;
                // lineMaterial.polygonOffsetUnits = -1;
                // lineMaterial.polygonOffsetFactor = -1;

                lineMesh.object3d.customId = seq + '_line';
                    
                quake.threeLayer.addMesh(lineMesh);
 

                if(quake.is3D){ 
                    quake.convert3DWorker('line', lineMesh.object3d); 
                }
            });
        }
    } else {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.hide();
                }else{
                    m.visible = false;
                }
            });
        }
    }
}

class ZoffSetGenerator {
    constructor(){
        this.polygonOffsetFactor = -1.0;
        this.polygonOffsetUnits = -1.0;
    }

    getPolygonOffsetFactor(){
        return this.polygonOffsetFactor -= 0.1;
    }

    getPolygonOffsetUnits(){
        return this.polygonOffsetUnits -= 0.1;
    }
}
 
let zoffSetGenerator = new ZoffSetGenerator();
   

async function loadPolygon(e) {
    let seq = 0;
    let meshs = quake.getMesh(seq);
    if (e.checked) {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.show();
                }else{
                    m.visible = true;
                }
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

                // var polygonMaterial1 = new THREE.MeshStandardMaterial({ color: 0xffff00, transparent: true, wireframe:false, opacity:0.8, depthTest:true,    polygonOffset: true,
                //     polygonOffsetFactor: zoffSetGenerator.getPolygonOffsetFactor(),
                //     polygonOffsetUnits: zoffSetGenerator.getPolygonOffsetUnits(),
                //     depthTest: false,
                //     blending: THREE.AdditiveBlending,
                //     opacity: 0.8,
                //     wireframe: false,
                // });
                let color = new THREE.Color('#ffff00');
                let polygonMaterial = new THREE.ShaderMaterial( {
                    transparent : true,
                    uniforms: THREE.DefaultColorShader.uniforms,
                    vertexShader: THREE.DefaultColorShader.vertexShader,
                    fragmentShader: THREE.DefaultColorShader.fragmentShader,
                    polygonOffset: true,
                    polygonOffsetFactor: zoffSetGenerator.getPolygonOffsetFactor(),
                    polygonOffsetUnits: zoffSetGenerator.getPolygonOffsetUnits(),
                    depthTest: false,
                    blending:  THREE.NormalBlending  ,
                    opacity: 0.8,
                });
                polygonMaterial.uniforms.resolution.value.copy(new THREE.Vector2(window.innerWidth, window.innerHeight)); 
                polygonMaterial.uniforms.r.value = color.r;
                polygonMaterial.uniforms.g.value = color.g;
                polygonMaterial.uniforms.b.value = color.b;

                var polygonMesh = quake.threeLayer.toFlatPolygons(polygons.slice(0, Infinity), {altitude:0, topColor: '#fff', interactive: false, }, polygonMaterial);
                polygonMesh.object3d.customId = seq + '_polygon';
                
                quake.threeLayer.addMesh(polygonMesh); 



                let outlinePass = new THREE.OutlinePass( new THREE.Vector2( window.innerWidth, window.innerHeight ), quake.threeLayer._renderer.scene, quake.threeLayer._renderer.camera );
                
                outlinePass.edgeStrength = 10.0 // 边框的亮度
                outlinePass.edgeGlow = 1// 光晕[0,1]
                outlinePass.usePatternTexture = false // 是否使用父级的材质
                outlinePass.edgeThickness = 1.0 // 边框宽度
                outlinePass.downSampleRatio = 1 // 边框弯曲度
                outlinePass.pulsePeriod = 5 // 呼吸闪烁的速度
                outlinePass.visibleEdgeColor.set(parseInt(0xffff00)) // 呼吸显示的颜色
                outlinePass.hiddenEdgeColor = new THREE.Color(0, 0, 0) // 呼吸消失的颜色
                outlinePass.clear = true

                // outlinePass.visibleEdgeColor.set("#ffff00");
                // outlinePass.hiddenEdgeColor.set( '#000000' );
                outlinePass.selectedObjects = [polygonMesh.object3d];
                composer.addPass( outlinePass );

                polygons.length = 0;

                if(quake.is3D){ 
                    quake.convert3DWorker('polygon', polygonMesh.object3d); 
                }
            }
        }
    } else {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.hide();
                }else{
                    m.visible = false;
                }
            });
        }
    }
}

async function loadPolygonP1(e) {
    let seq = 1;
    let meshs = quake.getMesh(seq);
    if (e.checked) {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.show();
                }else{
                    m.visible = true;
                }
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
                let color = new THREE.Color(custom_style.color);

                let polygoneCirclePatternMaterial = new THREE.ShaderMaterial( {
                    transparent : true,
                    uniforms: THREE.PointPatternShader.uniforms,
                    vertexShader: THREE.PointPatternShader.vertexShader,
                    fragmentShader: THREE.PointPatternShader.fragmentShader,
                    polygonOffset: true,
                    polygonOffsetFactor: zoffSetGenerator.getPolygonOffsetFactor(),
                    polygonOffsetUnits: zoffSetGenerator.getPolygonOffsetUnits(),
                    depthTest: false,
                    blending: THREE.NormalBlending,
                    opacity: 0.8,
                });
                polygoneCirclePatternMaterial.uniforms.resolution.value.copy(new THREE.Vector2(window.innerWidth, window.innerHeight)); 
                polygoneCirclePatternMaterial.uniforms.r.value = color.r;
                polygoneCirclePatternMaterial.uniforms.g.value = color.g;
                polygoneCirclePatternMaterial.uniforms.b.value = color.b;
                polygoneCirclePatternMaterial.uniforms.opacity.value = custom_style.opacity; 
                polygoneCirclePatternMaterial.uniforms.radius.value = 0.593 / (-Number(custom_style.size.radius) + 14.0);

                // var polygoneOutlineMaterial = new THREE.LineMaterial( { color: 0xff0000, linewidth: 1, opacity:1.0, transparent: true} );
                // polygoneOutlineMaterial.resolution.set( window.innerWidth, window.innerHeight ); // important, for now...
                // polygoneOutlineMaterial.color = color;
                // polygoneOutlineMaterial.opacity = custom_style.opacity;

                var polygonMesh = quake.threeLayer.toFlatPolygons(polygons.slice(0, Infinity), { topColor: '#fff', interactive: false, }, polygoneCirclePatternMaterial);

                // const edges = new THREE.EdgesGeometry( polygonMesh.object3d.geometry );
                // var lineGeometry = new THREE.LineSegmentsGeometry().setPositions( edges.attributes.position.array );
                // var linePavement = new THREE.LineSegments2( lineGeometry, polygoneOutlineMaterial );
                // linePavement.position.copy(polygonMesh.object3d.position); 
                
                
                polygonMesh.object3d.customId = seq + '_polygon'; 
                //linePavement.customId = seq + '_polygonLine'; 

                quake.threeLayer.addMesh(polygonMesh);
                //quake.threeLayer.addMesh(linePavement);

                let outlinePass = new THREE.OutlinePass( new THREE.Vector2( window.innerWidth, window.innerHeight ), quake.threeLayer._renderer.scene, quake.threeLayer._renderer.camera );
                composer.addPass( outlinePass );
                outlinePass.visibleEdgeColor.set(color);
                outlinePass.hiddenEdgeColor.set( '#000000' );
                outlinePass.selectedObjects = [polygonMesh.object3d];

                polygons.length = 0;
 
                if(quake.is3D){ 
                    quake.convert3DWorker('polygon', polygonMesh.object3d);
                    //quake.convert3DWorker('polygonLine', linePavement);
                }
            } 
        }
    } else {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.hide();
                }else{
                    m.visible = false;
                }
            });
        }
    }
}

async function loadPolygonP2(e) {
    let seq = 2;
    let meshs = quake.getMesh(seq);
    if (e.checked) {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.show();
                }else{
                    m.visible = true;
                }
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
                 
                let custom_style_res = await fetch('/test/custom_style2.json');
                let custom_style = await custom_style_res.json();
                let color = new THREE.Color(custom_style.color);

                let polygoneHachPatternMaterial1 = new THREE.ShaderMaterial( {
                    transparent : true,
                    uniforms: THREE.HatchPatternShader1.uniforms,
                    vertexShader: THREE.HatchPatternShader1.vertexShader,
                    fragmentShader: THREE.HatchPatternShader1.fragmentShader,
                    polygonOffset: true,
                    polygonOffsetFactor: zoffSetGenerator.getPolygonOffsetFactor(),
                    polygonOffsetUnits: zoffSetGenerator.getPolygonOffsetUnits(),
                    depthTest: false,
                    blending: THREE.NormalBlending,
                    opacity:0.8,
                });
                polygoneHachPatternMaterial1.uniforms.resolution.value.copy(new THREE.Vector2(window.innerWidth, window.innerHeight)); 
                polygoneHachPatternMaterial1.uniforms.r.value = color.r;
                polygoneHachPatternMaterial1.uniforms.g.value = color.g;
                polygoneHachPatternMaterial1.uniforms.b.value = color.b; 
                polygoneHachPatternMaterial1.uniforms.opacity.value = custom_style.opacity; 
                polygoneHachPatternMaterial1.uniforms.wh.value = -3 * Number(custom_style.size.wh) + 70.0;
                polygoneHachPatternMaterial1.uniforms.barWidth.value = 0.026315 * Number(custom_style.size.barWidth) - 0.026315;
 
                // var polygoneOutlineMaterial = new THREE.LineMaterial( { color: 0xff0000, linewidth: 1, opacity:1.0, transparent: true} );
                // polygoneOutlineMaterial.resolution.set( window.innerWidth, window.innerHeight ); // important, for now...
                // polygoneOutlineMaterial.color = color;
                // polygoneOutlineMaterial.opacity = custom_style.opacity;

                var polygonMesh = quake.threeLayer.toFlatPolygons(polygons.slice(0, Infinity), { topColor: '#fff', interactive: false, }, polygoneHachPatternMaterial1);

                // const edges = new THREE.EdgesGeometry( polygonMesh.object3d.geometry );
                // var lineGeometry = new THREE.LineSegmentsGeometry().setPositions( edges.attributes.position.array );
                // var linePavement = new THREE.LineSegments2( lineGeometry, polygoneOutlineMaterial );
                // linePavement.position.copy(polygonMesh.object3d.position); 
                
                
                polygonMesh.object3d.customId = seq + '_polygon'; 
                //linePavement.customId = seq + '_polygonLine'; 

                quake.threeLayer.addMesh(polygonMesh);
                //quake.threeLayer.addMesh(linePavement);

                let outlinePass = new THREE.OutlinePass( new THREE.Vector2( window.innerWidth, window.innerHeight ), quake.threeLayer._renderer.scene, quake.threeLayer._renderer.camera );
                composer.addPass( outlinePass );
                outlinePass.visibleEdgeColor.set(color);
                outlinePass.hiddenEdgeColor.set( '#000000' );
                outlinePass.selectedObjects = [polygonMesh.object3d];

                polygons.length = 0;
 
                if(quake.is3D){ 
                    quake.convert3DWorker('polygon', polygonMesh.object3d);
                    //quake.convert3DWorker('polygonLine', linePavement);
                }
            } 
        }
    } else {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.hide();
                }else{
                    m.visible = false;
                }
            });
        }
    }
}
                 
async function loadPolygonP3(e) {
    let seq = 3;
    let meshs = quake.getMesh(seq);
    if (e.checked) {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.show();
                }else{
                    m.visible = true;
                }
            });
        } else {
            let res = await fetch('/test/polygonTest2.geojson');
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
                 
                let custom_style_res = await fetch('/test/custom_style3.json');
                let custom_style = await custom_style_res.json();
                let color = new THREE.Color(custom_style.color);

                let polygoneHachPatternMaterial2 = new THREE.ShaderMaterial( {
                    transparent : true,
                    uniforms: THREE.HatchPatternShader2.uniforms,
                    vertexShader: THREE.HatchPatternShader2.vertexShader,
                    fragmentShader: THREE.HatchPatternShader2.fragmentShader,
                    polygonOffset: true,
                    polygonOffsetFactor: zoffSetGenerator.getPolygonOffsetFactor(),
                    polygonOffsetUnits: zoffSetGenerator.getPolygonOffsetUnits(),
                    depthTest: false,
                    blending: THREE.NormalBlending,
                    opacity:0.8,
                });
                polygoneHachPatternMaterial2.uniforms.resolution.value.copy(new THREE.Vector2(window.innerWidth, window.innerHeight)); 
                polygoneHachPatternMaterial2.uniforms.r.value = color.r;
                polygoneHachPatternMaterial2.uniforms.g.value = color.g;
                polygoneHachPatternMaterial2.uniforms.b.value = color.b; 
                polygoneHachPatternMaterial2.uniforms.opacity.value = custom_style.opacity; 
                polygoneHachPatternMaterial2.uniforms.wh.value = -3 * Number(custom_style.size.wh) + 70.0;
                polygoneHachPatternMaterial2.uniforms.barWidth.value = 0.026315 * Number(custom_style.size.barWidth) - 0.026315;
 
                // var polygoneOutlineMaterial = new THREE.LineMaterial( { color: 0xff0000, linewidth: 1, opacity:1.0, transparent: true} );
                // polygoneOutlineMaterial.resolution.set( window.innerWidth, window.innerHeight ); // important, for now...
                // polygoneOutlineMaterial.color = color;
                // polygoneOutlineMaterial.opacity = custom_style.opacity;

                var polygonMesh = quake.threeLayer.toFlatPolygons(polygons.slice(0, Infinity), { topColor: '#fff', interactive: false, }, polygoneHachPatternMaterial2);

                // const edges = new THREE.EdgesGeometry( polygonMesh.object3d.geometry, 170 );
                // var lineGeometry = new THREE.LineSegmentsGeometry().setPositions( edges.attributes.position.array );
                // var linePavement = new THREE.LineSegments2( lineGeometry, polygoneOutlineMaterial );
                // linePavement.position.copy(polygonMesh.object3d.position); 
                
                
                polygonMesh.object3d.customId = seq + '_polygon'; 
                //linePavement.customId = seq + '_polygonLine'; 
 

                quake.threeLayer.addMesh(polygonMesh);
                //quake.threeLayer.addMesh(linePavement);

                polygons.length = 0;
 
                let outlinePass = new THREE.OutlinePass( new THREE.Vector2( window.innerWidth, window.innerHeight ), quake.threeLayer._renderer.scene, quake.threeLayer._renderer.camera );
                composer.addPass( outlinePass );
                outlinePass.visibleEdgeColor.set(color);
                outlinePass.hiddenEdgeColor.set( '#000000' );
                outlinePass.selectedObjects = [polygonMesh.object3d];
                
                if(quake.is3D){ 
                    quake.convert3DWorker('polygon', polygonMesh.object3d);
                    //quake.convert3DWorker('polygonLine', linePavement);
                }
            } 
        }
    } else {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.hide();
                }else{
                    m.visible = false;
                }
            });
        }
    }
}
 



function createMateria(fillStyle) {
    const idx = 0;//Math.floor(Math.random() * 3);
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
        depthTest: false, //深度测试关闭，不消去场景的不可见面
        //depthWrite: false,
        map: new THREE.TextureLoader().load('/test/selectFnIcon' + (idx + 1) + '.png'),
        polygonOffset: true,
        polygonOffsetFactor: zoffSetGenerator.getPolygonOffsetFactor(),
        polygonOffsetUnits: zoffSetGenerator.getPolygonOffsetUnits(),
        //刚刚创建的粒子贴图就在这里用上
    });
}
 
function loadPoint(e) {
    let seq = 261;
    let meshs = quake.getMesh(seq);
    if (e.checked) {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.show();
                }else{
                    m.visible = true;
                }
            });
        } else {
            fetch('/test/pointTest.geojson').then((function (res) {
                return res.json();
            })).then(function (json) {
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

                let points = [];

                for(var i=0; i<lnglats.length; i++){
                    let lnglat = lnglats[i];
                    const material = createMateria();
                     
                    const point = quake.threeLayer.toPoint(lnglat.coordinate, { height: 0, properties: lnglat.properties }, material);
                    point.object3d.customId = seq + '_point' + '_' + i;


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
                            //console.log(e.type, e);
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
                    points.push(point);
                }
                

                quake.threeLayer.addMesh(points);

                if(quake.is3D){ 
                    quake.convert3DWorker('point', points.map(p=>p.object3d));
                    //quake.convert3DWorker('polygonLine', linePavement);
                }
            });
        }
    } else {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.hide();
                }else{
                    m.visible = false;
                }
            });
        }
    }
}

function loadPoint2(e) {
    let seq = 262;
    let meshs = quake.getMesh(seq);
    if (e.checked) {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.show();
                }else{
                    m.visible = true;
                }
            });
        } else {
            fetch('/test/pointTest.geojson').then((function (res) {
                return res.json();
            })).then(function (json) {
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

                let points = [];

                for(var i=0; i<lnglats.length; i++){
                    let lnglat = lnglats[i];
                    const material = createMateria();
                    const point = quake.threeLayer.toPoint(lnglat.coordinate, { height: 0, properties: lnglat.properties }, material);
                    point.object3d.customId = seq + '_point' + '_' + i;


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
                    points.push(point);
                }
                

                quake.threeLayer.addMesh(points);

                if(quake.is3D){ 
                    quake.convert3DWorker('point', points.map(p=>p.object3d));
                    //quake.convert3DWorker('polygonLine', linePavement);
                }
            });
        }
    } else {
        if (meshs && meshs.length > 0) {
            meshs.forEach(m => {
                if(m.__parent){
                    m.__parent.hide();
                }else{
                    m.visible = false;
                }
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
        // console.log('기능마크팝업');
        // console.log(g.options.properties.seq);
        // console.log(g.options.properties.lat);
        // console.log(g.options.properties.lon);
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
    var lineParams = {
        linewidth: 1.0,
        color: 0x00ffff, 
        opacity: 1.0, 
    };
    var gui = new dat.GUI();

    gui.addColor(lineParams, 'color').name('line color').onChange(function () {
        lineMaterial.color.set(lineParams.color);
        lines.forEach(function (mesh) {
            mesh.setSymbol(lineMaterial);
        });
    });
    gui.add(lineParams, 'opacity', 0, 1).name('line opacity').onChange(function () {
        lineMaterial.uniforms.opacity.value = lineParams.opacity;
        if(lineParams.opacity == 0){
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
    gui.add(lineParams, 'linewidth', 1, 7).name('line width').onChange(function () {
        lineMaterial.linewidth = lineParams.linewidth; 
    });

   
    var polygoneoutlineParam = { 
        color: 0xff0000,
        linewidth: 1,
        opacity:1
    }; 
 
    var polygonePatternParamCircle = {
        color: 0xff0000,
        radius:0.25,
        opacity:1
    };
    gui.addColor(polygonePatternParamCircle, 'color').name('dot color').onChange(function () {
        polygoneOutlineMaterial.color.set(polygonePatternParamCircle.color);
        let hex = polygonePatternParamCircle.color;
        hex = Math.floor(hex);
        let r = (hex >> 16 & 255) / 255;
        let g = (hex >> 8 & 255) / 255;
        let b = (hex & 255) / 255;

        polygoneCirclePatternMaterial.uniforms.r.value = r;
        polygoneCirclePatternMaterial.uniforms.g.value = g;
        polygoneCirclePatternMaterial.uniforms.b.value = b;
    });
    gui.add(polygonePatternParamCircle, 'opacity', 0, 1).name('dot opacity').onChange(function () {
        polygoneOutlineMaterial.uniforms.opacity.value = polygonePatternParamCircle.opacity;

        polygoneCirclePatternMaterial.uniforms.opacity.value = polygonePatternParamCircle.opacity;
    });

    gui.add(polygoneoutlineParam, 'linewidth', 1, 10).name('dot linewidth').onChange(function () {
        polygoneOutlineMaterial.uniforms.linewidth.value = polygoneoutlineParam.linewidth;
    }); 
 
    gui.add(polygonePatternParamCircle, 'radius', 1.0, 13.0).name('dot radius').onChange(function () {
        let radius = polygonePatternParamCircle.radius;
        let covversionRadius = 0.593 / (-radius + 14.0);
        polygoneCirclePatternMaterial.uniforms.radius.value = covversionRadius;
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
    if (quake.is3D) { //3d enable
        if (terrainList.length > 0) { //지형 객체가 있을경우
            terrainList.forEach(t => { t.visible = true; });
        }else{
            quake.loadTerrainNetwork();
        } 

        const object3ds = quake.threeLayer.getMeshes();
        let maybePointList = [];
        let pointMap = new Map();

        for (var i = 0; i < object3ds.length; i++) {
            let object3d = object3ds[i];
            let whatMesh = null;
            if (object3d.object3d && object3d.object3d.customId) { //maptalks.three mesh   
                whatMesh = object3d.object3d;
            }else if(object3d && object3d.customId){ //three mesh
                whatMesh = object3d;
            }
    
            if(whatMesh){
                if(whatMesh.geometry.altitude){ //고도데이터가 존재하는 경우
                    let what = whatMesh.customId.split('_')[1];
                    quake.convertObjectHeighting(what, whatMesh);
                }else{
                    let what = whatMesh.customId.split('_')[1];
                    if(what == 'point'){
                        let pointSeq = whatMesh.customId.split('_')[0];
                        
                        if(pointMap.has(pointSeq)){
                            pointMap.get(pointSeq).push(whatMesh);
                        }else{
                            maybePointList.push(whatMesh);
                            pointMap.set(pointSeq, maybePointList);
                        }
                        
                    }else{
                        quake.convert3DWorker(what, whatMesh);
                    }
                }

                whatMesh.material.depthTest = true;
            }
        }

        if(pointMap.size > 0){
            pointMap.forEach((value, key, mapObject) => quake.convert3DWorker('point', value)); 
        }
  
    } else { //3d disable

        quake.threeLayer._renderer.camera.far = quake.prevCameraInfo.far;
        quake.threeLayer._renderer.camera.near = quake.prevCameraInfo.near;
        quake.threeLayer._renderer.camera.fov = quake.prevCameraInfo.fov;
        quake.threeLayer._renderer.camera.position.x = quake.prevCameraInfo.position.x;
        quake.threeLayer._renderer.camera.position.y = quake.prevCameraInfo.position.y;
        quake.threeLayer._renderer.camera.position.z = quake.prevCameraInfo.position.z;


        if (terrainList.length > 0) {
            terrainList.forEach(t => { t.visible = false; });
        }

        const object3ds = quake.threeLayer.getMeshes();
        for (var i = 0; i < object3ds.length; i++) {
            let object3d = object3ds[i];
            let whatMesh = null;
            if (object3d.object3d && object3d.object3d.customId) { //maptalks.three mesh   
                whatMesh = object3d.object3d;
            }else if(object3d && object3d.customId){ //three mesh
                whatMesh = object3d;
            }
 
            if(whatMesh){
                if(whatMesh.geometry.altitude){
                    let what = whatMesh.customId.split('_')[1];
                    quake.convertObjectFlatting(what, whatMesh);
                }

                whatMesh.material.depthTest = false;
            }
        }
         
    }
}

quake.convertObjectHeighting = function(what, object3d){
    if (what == 'line' || what == 'polygonLine') {    
        let geo = object3d.geometry;
        let altitudeIdx = 0;
        var addedLineAltitude = what == 'line' ? lineAddedAltitude : polygonAddedAltitude;

        for(var j=2; j<geo.attributes.instanceStart.data.array.length; j+=3){
            geo.attributes.instanceStart.data.array[j] = geo.altitude[altitudeIdx] + addedLineAltitude;
            geo.attributes.instanceEnd.data.array[j] = geo.altitude[altitudeIdx] + addedLineAltitude;
            altitudeIdx++;
        }
        
        geo.attributes.instanceStart.needsUpdate = true;
        geo.attributes.instanceEnd.needsUpdate = true;
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
    }else if (what == 'polygon') {
        let geo = object3d.geometry;
        let altitudeIdx = 0;
        for(var j=2; j<geo.attributes.position.array.length; j+=3){
            geo.attributes.position.array[j] = geo.altitude[altitudeIdx] + polygonAddedAltitude;
            altitudeIdx++;
        }

        geo.attributes.position.needsUpdate = true;
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
    } else if (what == 'point') {
        let geo = object3d.geometry;
        for(var j=2; j<geo.attributes.position.array.length; j+=3){
            geo.attributes.position.array[j] = geo.altitude + pointAddedAltitude;
        }

        geo.attributes.position.needsUpdate = true;
        geo.computeBoundingBox();
        geo.computeBoundingSphere();

        object3d.__parent.options.height = geo.altitude/0.008;
        object3d.__parent.options.positions.z = geo.altitude + pointAddedAltitude;
    }
}

quake.convertObjectFlatting = function(what, object3d){
    if (what == 'line' || what == 'polygonLine') {    
        let geo = object3d.geometry;
        for(var j=2; j<geo.attributes.instanceStart.data.array.length; j+=3){
            geo.attributes.instanceStart.data.array[j] = 0;
            geo.attributes.instanceEnd.data.array[j] = 0;
        }

        geo.attributes.instanceStart.needsUpdate = true;
        geo.attributes.instanceEnd.needsUpdate = true;
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
    }else if (what == 'polygon') {
        let geo = object3d.geometry;
        for(var j=2; j<geo.attributes.position.array.length; j+=3){
            geo.attributes.position.array[j] = 0;
        }

        geo.attributes.position.needsUpdate = true;
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
    } else if (what == 'point') {
        let geo = object3d.geometry;
        for(var j=2; j<geo.attributes.position.array.length; j+=3){
            geo.attributes.position.array[j] = 0;
        }

        geo.attributes.position.needsUpdate = true;
        geo.computeBoundingBox();
        geo.computeBoundingSphere();

        object3d.__parent.options.height = 0;
        object3d.__parent.options.positions.z = 0
    }
}

quake.convert3DWorker = function(what, object3d){
    if(what == 'point'){
        object3d.forEach(o3 => o3.material.depthTest = quake.is3D ? true : false);
    }else{
        object3d.material.depthTest = quake.is3D ? true : false;
    }

    if (what == 'line' || what == 'polygonLine') {   
        let centerPos = object3d.position;
        let geo = object3d.geometry;
        let LngLatData = [];
        for(var j=0; j<geo.attributes.instanceStart.data.array.length; j+=3){
            let resultX = centerPos.x + geo.attributes.instanceStart.data.array[j];
            let resultY = centerPos.y + geo.attributes.instanceStart.data.array[j+1];
            //let resultZ = centerPos.x + geo.attributes.instanceStart.data.array[j+2];

            LngLatData.push({x:resultX, y:resultY});
        }

        runAtdWorker({ layer: object3d.customId, LngLatData });
    }else if (what == 'polygon') {
        let centerPos = object3d.position;
        let geo = object3d.geometry;
        let LngLatData = [];
         
        for(var j=0; j<geo.attributes.position.array.length; j+=3){
            let resultX = centerPos.x + geo.attributes.position.array[j];
            let resultY = centerPos.y + geo.attributes.position.array[j+1];
            //let resultZ = centerPos.x + geo.attributes.position.array[j+2];

            LngLatData.push({x:resultX, y:resultY});
        }

        runAtdWorker({ layer: object3d.customId, LngLatData });
    } else if (what == 'point') {
        let LngLatData = [];
        let customId = null;
        for(var i=0; i<object3d.length; i++){
            let o3 = object3d[i]; 
            
            let centerPos = o3.position;
            let geo = o3.geometry;

            for(var j=0; j<geo.attributes.position.array.length; j+=3){
                let resultX = centerPos.x + geo.attributes.position.array[j];
                let resultY = centerPos.y + geo.attributes.position.array[j+1];
                LngLatData.push({customId:o3.customId, x:resultX, y:resultY});
                customId = o3.customId;
            }
        }
        customId = customId.split('_');
        customId = customId[0] + '_' + customId[1];
        runAtdWorker({ layer: customId, LngLatData });
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
                    let e1 = quake.threeLayer.coordinateToVector3([sData[0], sData[1]], 0);
                    let e2 = quake.threeLayer.coordinateToVector3([eData[0], eData[1]], 0);
                    plane.custom2DExtent = new maptalks.Extent(e1.x, e1.y, e2.x, e2.y);
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
                value = sortObject(value);
                let l = Object.values(value);
                let rcvData = [];
                l.forEach(_l => {
                    _l.forEach(__l =>{
                        rcvData.push(__l);
                    });
                });
                l.length = 0;
    
                for (var member in value) delete value[member];
                atdReceivedData.delete(key);
                atdData.set(layer, rcvData);
                atdPostProcess(layer);
                console.timeEnd('performance'+layer);
            }
        });
    }
}

let polygonAddedAltitude = 0.08;
let lineAddedAltitude = 0.2;
let pointAddedAltitude = 0.5;

function atdPostProcess(layer) {
    let rcvData = atdData.get(layer);
    atdData.delete(layer);
    
    let customId = layer.split('_'); 

    let childPos = [];
    const object3ds = quake.threeLayer.getMeshes();
    for (var i = 0; i < object3ds.length; i++) {
        let object3d = object3ds[i];
        if (object3d.object3d && object3d.object3d.customId) { //maptalks.three mesh  
            if(object3d.object3d.customId == layer){ //polygon, line
                childPos.push(i);
                break;  
            }else if(customId[1] == 'point' && object3d.object3d.customId.includes(layer)){ //point
                childPos.push(i);
            }
            
        }else if(object3d && object3d.customId && object3d.customId == layer){ //three mesh
            childPos.push(i);
            break;
        }
    }

    
    if(customId[1] == 'line' || customId[1] == 'polygonLine'){
        let c = object3ds[childPos[0]];
        let geo = null;
        if (c.geometry) {
            geo = c.geometry;
        } else if (c.object3d.geometry) {
            geo = c.object3d.geometry;
        }
        let rcvIdx = 0;
        var addedLineAltitude = customId[1] == 'line' ? lineAddedAltitude : polygonAddedAltitude;
        for(var i=0; i<geo.attributes.instanceStart.array.length; i+=3){
            let altitude = rcvData[rcvIdx];
            if(altitude){
                altitude = altitude + addedLineAltitude;
                geo.attributes.instanceStart.array[i+2] = altitude;
                geo.attributes.instanceEnd.array[i+2] = altitude;
            }
            rcvIdx++
        }

        geo.altitude = rcvData.slice(0);
        geo.attributes.instanceStart.needsUpdate = true;
        geo.attributes.instanceEnd.needsUpdate = true;
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
    }else if(customId[1] == 'polygon'){
        let c = object3ds[childPos[0]];
        let geo = null;
        if (c.geometry) {
            geo = c.geometry;
        } else if (c.object3d.geometry) {
            geo = c.object3d.geometry;
        }

        let rcvIdx = 0;
        for(var i=0; i<geo.attributes.position.array.length; i+=3){
            let altitude = rcvData[rcvIdx];
            if(altitude){
                altitude = altitude + polygonAddedAltitude;
                geo.attributes.position.array[i+2] = altitude;
            }
            rcvIdx++
        }

        geo.altitude = rcvData.slice(0);
        geo.attributes.position.needsUpdate = true;
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
    }else if(customId[1] == 'point'){
        for(var i=0; i<childPos.length; i++){
            let c = object3ds[childPos[i]];
            let geo = null;
            if (c.geometry) {
                geo = c.geometry;
            } else if (c.object3d.geometry) {
                geo = c.object3d.geometry;
            }

            let rd = rcvData[i];
            if(rd && rd.customId == c.object3d.customId){
                let altitude = rd.altitude + pointAddedAltitude;
                geo.attributes.position.array[2] = altitude;
                geo.altitude = rd.altitude;
                geo.attributes.position.needsUpdate = true;
                geo.computeBoundingBox();
                geo.computeBoundingSphere();

                c.options.height = rd.altitude/0.008;
                c.options.positions.z = altitude
            }
        }
    }
}


function canvas2Texture(color){
    const patternCanvas = document.createElement('canvas');
    const patternContext = patternCanvas.getContext('2d'); 
    patternContext.fillStyle = color; //배경
    patternContext.fillRect(0, 0, patternCanvas.width, patternCanvas.height); //배경그리기
          
    const texture = new THREE.CanvasTexture(patternContext.canvas);
     
    return texture ; // dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
}