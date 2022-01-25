
class MinMaxGUIHelper {
    constructor(obj, minProp, maxProp, minDif) {
        this.obj = obj;
        this.minProp = minProp;
        this.maxProp = maxProp;
        this.minDif = minDif;
    }
    get min() {
        return this.obj[this.minProp];
    }
    set min(v) {
        this.obj[this.minProp] = v;
        this.obj[this.maxProp] = Math.max(this.obj[this.maxProp], v + this.minDif);
    }
    get max() {
        return this.obj[this.maxProp];
    } 
    set max(v) {
        this.obj[this.maxProp] = v;
        this.min = this.min;
    }
}

let camera, scene, renderer, controls, stats;
let target;
let target2;
let postScene, postCamera, postMaterial;
let supportsExtension = true;
let composer;
let scene2, surfaceMaterial;

const params = {
    format: THREE.DepthFormat,
    type: THREE.UnsignedShortType
};

const formats = { DepthFormat: THREE.DepthFormat, DepthStencilFormat: THREE.DepthStencilFormat };
const types = { UnsignedShortType: THREE.UnsignedShortType, UnsignedIntType: THREE.UnsignedIntType, UnsignedInt248Type: THREE.UnsignedInt248Type };

init();
animate();


function init() {
    
    renderer = new THREE.WebGLRenderer();
    
    if ( renderer.capabilities.isWebGL2 === false && renderer.extensions.has( 'WEBGL_depth_texture' ) === false ) {

        supportsExtension = false;
        document.querySelector( '#error' ).style.display = 'block';
        return;

    }

    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    //

    stats = new Stats();
    document.body.appendChild( stats.dom );

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 150 );
    camera.position.z = 100;

    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
    }
    controls.enableDamping = true;

    // Create a render target with depth texture
    setupRenderTarget();
    composer = new THREE.EffectComposer( renderer, target);
    // Our scene
    setupScene();

    // Setup post-processing step
    setupPost();
    setupSerfaceMaterial();

    onWindowResize();
    window.addEventListener( 'resize', onWindowResize );

    //
    const gui = new dat.GUI( { width: 300 } );

    gui.add( params, 'format', formats ).onChange( setupRenderTarget );
    gui.add( params, 'type', types ).onChange( setupRenderTarget );

    const minMaxGUIHelper = new MinMaxGUIHelper(camera, 'near', 'far', 0.1);
    gui.add(minMaxGUIHelper, 'min', 0.1, 5000, 0.1).name('near').onChange(updateCamera);
    gui.add(minMaxGUIHelper, 'max', 0.1, 5000, 0.1).name('far').onChange(updateCamera);

    gui.open();

    loadTerrainNetwork();
    
   // setRender();
}

function setRender(){
    const clearPass = new THREE.ClearPass();
    composer.addPass( clearPass );

    const renderPass = new THREE.RenderPass( scene, camera );
    composer.addPass( renderPass );
    
    const depthPass = new THREE.ShaderPass(THREE.SurfaceShader);
    composer.addPass(depthPass);

}

function render(){
    if(false){
        if(composer){
            composer.render();
        }
    }else{
        renderer.setRenderTarget( target );
        renderer.render( scene, camera );

        surfaceMaterial.uniforms.tDiffuse.value = target.texture;
        surfaceMaterial.uniforms.tDepth.value = target.depthTexture;

        //renderer.setRenderTarget( null );
        //renderer.render( scene, camera );

        postMaterial.uniforms.cameraFar.value = camera.far;
        postMaterial.uniforms.cameraNear.value = camera.near;
        postMaterial.uniforms.tDiffuse.value = target.texture;
        postMaterial.uniforms.tDepth.value = target.depthTexture;

        renderer.setRenderTarget( null );
        renderer.render( scene, camera );
    }
}

function updateCamera() {
    camera.updateProjectionMatrix();
}

function setupRenderTarget() {

    if ( target ) target.dispose();

    const format = parseFloat( params.format );
    const type = parseFloat( params.type );

    target = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight );
    target.texture.format = THREE.RGBFormat;
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.magFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    target.stencilBuffer = ( format === THREE.DepthStencilFormat ) ? true : false;
    target.depthBuffer = true;
    target.depthTexture = new THREE.DepthTexture();
    target.depthTexture.format = format;
    target.depthTexture.type = THREE.UnsignedIntType;

    if(target2) target2.dispose();
    target2 = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight );
    target2.texture.format = THREE.RGBFormat;
    target2.texture.minFilter = THREE.NearestFilter;
    target2.texture.magFilter = THREE.NearestFilter;
    target2.texture.generateMipmaps = false;
    target2.stencilBuffer = ( format === THREE.DepthStencilFormat ) ? true : false;
    target2.depthBuffer = true;
    target2.depthTexture = new THREE.DepthTexture();
    target2.depthTexture.format = format;
    target2.depthTexture.type = THREE.UnsignedIntType;

}

function setupSerfaceMaterial(){
    surfaceMaterial = new THREE.ShaderMaterial({
        uniforms:THREE.SurfaceShader.uniforms,
        vertexShader:THREE.SurfaceShader.vertexShader,
        fragmentShader:THREE.SurfaceShader.fragmentShader,

    });

    surfaceMaterial.uniforms.cameraNear.value = camera.near;
    surfaceMaterial.uniforms.cameraFar.value = camera.far;

}

function setupPost() {

    // Setup post processing stage
    postCamera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
    //postCamera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 50 );
    postMaterial = new THREE.ShaderMaterial( {
        vertexShader: `
        #include <packing>
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform float cameraNear;
        uniform float cameraFar;


        float readDepth( sampler2D depthSampler, vec2 coord ) {
            float fragCoordZ = texture2D( depthSampler, coord ).x;
            float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
            return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
        }
        void main() {
            vUv = uv;
            float depth = readDepth( tDepth, vUv );
            vec3 pos = position;
            pos.z += (1. - depth)*0.6;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
        `,
        fragmentShader: `
        #include <packing>

        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform float cameraNear;
        uniform float cameraFar;


        float readDepth( sampler2D depthSampler, vec2 coord ) {
            float fragCoordZ = texture2D( depthSampler, coord ).x;
            float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
            return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
        }

        void main() {
            vec3 diffuse = texture2D( tDiffuse, vUv ).rgb;
            float depth = readDepth( tDepth, vUv );

            gl_FragColor.rgb = vec3( depth );
            gl_FragColor.a = 1.0;
        }
        `,
        uniforms: {
            cameraNear: { value: camera.near },
            cameraFar: { value: camera.far },
            tDiffuse: { value: null },
            tDepth: { value: null }
        }
    } );
    const postPlane = new THREE.PlaneGeometry( 2, 2 );
    const postQuad = new THREE.Mesh( postPlane, postMaterial );
    postScene = new THREE.Scene();
    postScene.add( postQuad );

}

function setupScene() {

    scene = new THREE.Scene();
    scene2 = new THREE.Scene();

    
    const geometry = new THREE.TorusKnotGeometry( 1, 0.3, 128, 64 );
    const material = new THREE.MeshBasicMaterial( { color: 'blue' } );

    const count = 50;
    const scale = 5;

    for ( let i = 0; i < count; i ++ ) {

        const r = Math.random() * 2.0 * Math.PI;
        const z = ( Math.random() * 2.0 ) - 1.0;
        const zScale = Math.sqrt( 1.0 - z * z ) * scale;

        const mesh = new THREE.Mesh( geometry, material );
        mesh.position.set(
            Math.cos( r ) * zScale,
            Math.sin( r ) * zScale,
            z * scale
        );
        mesh.rotation.set( Math.random(), Math.random(), Math.random() );
        scene.add( mesh );

    }

}

function onWindowResize() {

    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const dpr = renderer.getPixelRatio();
    target.setSize( window.innerWidth * dpr, window.innerHeight * dpr );
    renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

    if ( ! supportsExtension ) return;

    requestAnimationFrame( animate );
    render();
    

    controls.update(); // required because damping is enabled

    stats.update();

}

let textureLoader = new THREE.TextureLoader();

let xClamp = 93760.0;
let yClamp = 27548.0;

async function loadTerrainNetwork () {
    let zResol = 80; 

    var coordMin = {x:128.755734, y:34.978977};//부산
    var coordMax = {x:129.314373, y:35.396265};//부산
    //var coordMin = new maptalks.Coordinate(129.148876, 35.151681);
    //var coordMax = new maptalks.Coordinate(129.155753, 35.156076);
    //var proj = proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:3857'));
    let level = 10;
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
        //if(i != 11)continue;
        const IDX = idxIdyList[i][0];
        const IDY = idxIdyList[i][1];
        const layer = "dem";
        let address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
        
        fetch(address).then(r => {
            const size = r.headers.get("content-length");
            if (Number(size) >= 16900) {
                r.arrayBuffer().then(function (buffer) {
                    //var byteArray = new Uint8Array(buffer);
                    let p = new Parser(buffer);

                    let x = unit * (IDX - (Math.pow(2, level - 1) * 10));
                    let y = unit * (IDY - (Math.pow(2, level - 2) * 10));
                    let pdata = [];
                    let sData = null;
                    let eData = null;
                    let center = [];

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
                            }else if(yy == 32 && xx == 32){
                                center = [xDegree, yDegree];
                            }
                        }
                    }
                    var geometry = new THREE.PlaneGeometry(1, 1, 64, 64);
                    let centerConv = coordinateToVector3(center, 0);
                    
                    for (var i = 0, l = geometry.attributes.position.count; i < l; i++) {
                        const z = pdata[i][2] / zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
                        const v = coordinateToVector3([pdata[i][0], pdata[i][1]], z);
                        geometry.attributes.position.setXYZ(i, v.x - centerConv.x, v.y - centerConv.y, v.z);
                    }

                    var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/ });
                    material.opacity = 1;
                    material.wireframe = 0;
                    var address = "http://xdworld.vworld.kr:8080/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
                    textureLoader.load(address, function (tx) {
                        material.map = tx;
                        material.needsUpdate = true;
                    });

                    var plane = new THREE.Mesh(geometry, material);
                    plane.position.x = centerConv.x - xClamp;
                    plane.position.y = centerConv.y - yClamp; 
                    plane.position.z = centerConv.z;

                    scene.add(plane);
                    //terrainList.push(plane);
                });//arraybuffer
            }//16900
        }); //fetch
    }//for
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

    return {x, y};
}

function prjToPoint(coord){
    var scale = 152.8740565703525;
    var matrix = [1,-1,0,0];
    var x = matrix[0] * (coord.x - matrix[2]) / scale;
    var y = -matrix[1] * (coord.y - matrix[3]) / scale;
    return {x, y};
}

function coordinateToVector3(coordinate, z) {
    if (z === void 0) { z = 0; }
    var p = project(coordinate);
    var p2 = prjToPoint(p);
    return new THREE.Vector3(p2.x, p2.y, z);
}

document.getElementById('loadPolygon').addEventListener('click', async function(e){
    loadPolygon(e);
})
async function loadPolygon(e) {
    let seq = 0;
    let customId = 'polygon_' + seq;
        
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
        var testMat = new THREE.MeshPhongMaterial({ color: 0x000000, transparent: true, wireframe:false, opacity: 1});
        // let polygonMaterial = new THREE.ShaderMaterial( {
        // 	transparent : true,
        // 	uniforms: THREE.SurfaceShader.uniforms,
        // 	vertexShader: THREE.SurfaceShader.vertexShader,
        // 	fragmentShader: THREE.SurfaceShader.fragmentShader,
        // 	// polygonOffset: true,
        // 	// polygonOffsetFactor: zoffSetGenerator.getPolygonOffsetFactor(),
        // 	// polygonOffsetUnits: zoffSetGenerator.getPolygonOffsetUnits(),
        // 	depthTest: true,
        // 	blending:  THREE.NormalBlending,
        // 	opacity: 0.8,
        // });
        // polygonMaterial.uniforms.resolution.value.copy(new THREE.Vector2(window.innerWidth, window.innerHeight)); 
        // polygonMaterial.uniforms.r.value = color.r;
        // polygonMaterial.uniforms.g.value = color.g;
        // polygonMaterial.uniforms.b.value = color.b;
        
        let threeLayer = new maptalks.ThreeLayer('test');
        let dummyCavas = document.createElement('canvas');
        let map = new maptalks.Map(dummyCavas, {
            center: [129.15158, 35.15361],
            zoom: 11,
            maxZoom: 19,
            minZoom: 0,
            centerCross: true,
            spatialReference: {
              projection: 'EPSG:3857'//map control 좌표계
            },
            centerCross: true,
            doubleClickZoom: false,
          });
        threeLayer.addTo(map);
        var polygonMesh = threeLayer.toFlatPolygons(polygons.slice(0, Infinity), {altitude:0, topColor: '#fff', interactive: false, }, 
            //new THREE.MeshBasicMaterial( { color: 'blue' } )
            surfaceMaterial
        );
        polygonMesh.object3d.customId = seq + '_polygon';
        let object3d = polygonMesh.object3d;

        object3d.position.x = object3d.position.x - xClamp;
        object3d.position.y = object3d.position.y - yClamp; 
        object3d.position.z = object3d.position.z + 0.0;
        polygons.length = 0;
        scene.add(object3d);
    }
}