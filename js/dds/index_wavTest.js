var quake = {
    map: {},
    threeLayer: {},
    //  barsLayer : {}, 
    //  geojsonVtLayer : {},
};

quake.loadWAV = function () {
    console.log('start');
}

quake.viewMap = function () {
    quake.setBaseLayer();
    quake.setThreeLayer();
    animation();
}

function animation() {
    // layer animation support Skipping frames
    quake.threeLayer._needsUpdate = !quake.threeLayer._needsUpdate;
    if (quake.threeLayer._needsUpdate) {
        quake.threeLayer.renderScene();
    }

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
let what = 0;
//three layer 생성
quake.setThreeLayer = function () {
    quake.threeLayer = new maptalks.ThreeLayer('t', {
        forceRenderOnMoving: false,
        forceRenderOnRotating: false
    });

    quake.threeLayer.prepareToDraw = function (gl, scene, camera) {
        console.log('what', what);
        stats = new Stats();
        stats.domElement.style.zIndex = 100;
        document.getElementById('map').appendChild(stats.domElement);

        var light = new THREE.DirectionalLight(0xffffff);
        light.position.set(0, -10, 10).normalize();
        scene.add(light);
        //addBars(scene);
        //testWAVText();
        //testTimeText();
        
    }

    quake.threeLayer.addTo(quake.map);
    if(what == 0)
    testTimeText2();
    what++;
    //quake.map.on('moving moveend zoomend pitch rotate', update);

    //update();

    //quake.map.on('moving moveend zoomend pitch rotate', testing);
}
function getColor(pga) {
    let maxV = 20;
    let maxCV = 255;
    let c = pga / maxV;
    let c2 = maxCV * c;

    let hex1 = String((Number(Math.round(c2))).toString(16));
    hex1 = hex1.length == 1 ? '0' + hex1 : hex1;
    let color = "#ff" + hex1 + "00";
    return color;
}

async function testTimeText() {
    dfd.read_csv("http://localhost:5500/test/test_time_pgv.csv")
        .then(df => {
            let data = df.data;
            let columns = df.columns;
            if (columns[0].trim() == 'name' && columns[1].trim() == 'lat' && columns[2].trim() == 'lon' && columns[3].trim() == 'max_pgv' && columns[4].trim() == 'times_pga') {
            } else {
                alert("잘못된 형식입니다.\n헤더는 [name,lat,lon,max_pgv,times_pga]로 구성되어야 합니다.");
                return;
            }

            for (var i = 0; i < data.length; i++) {
                if (i == 10000) break;
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

                    let _color = getColor(splitpga_[0]);
                    var pgaMaterial = new THREE.MeshPhongMaterial({ color: _color, transparent: true, opacity: 0.8 });
                    const bar = quake.threeLayer.toBar([lon, lat], { height: 1000, radius: 260, radialSegments: 4, interactive: false, splitpga_}, pgaMaterial);
                    bar.getObject3d().rotation.z = Math.PI / 4;
                    bars.push(bar);

                } else {
                    console.log(data.length, i, lon, lat);
                }

            }

            quake.threeLayer.addMesh(bars);

        }).catch(err => {
            console.log(err);
        })
    //new maptalks.VectorLayer('vector', points).addTo(quake.map);
}
let test_ = 0;
let isEndIdx = 0;
function barAnim(){
    bars.forEach(b=>{
        isEndIdx = b.options.splitpga_.length;
        let pga = b.options.splitpga_[test_];
        let _color = getColor(pga);
        b.object3d.material.color.set(_color);
        b.object3d.material.needsUpdate = true;
        b.setAltitude(pga * 1000);
    });
    if(bars.length > 0){
        test_++;
        if(isEndIdx <= test_){
            test_ = 0;
        }
    }
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
     

    for (var i = 0; i < data.length; i++) {
        //if (i == 10000) break;
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
            
            __data.push({lat, lon, splitpga_:splitpga_.slice(0)});
            console.log(i);
            for (var member in splitpga_) {
                delete splitpga_[member];
            }
            for (var member in splitpga) {
                delete splitpga[member];
            }
        }

        for (var member in data[i]) {
            delete data[i][member];
        }
    }
    resolutionWAV();
}

function resolutionWAV(){
    const positionHelper = new THREE.Object3D();
    positionHelper.position.z = 1;
    for (var i = 0; i < __data.length; i++) {
        let __d = __data[i];
        let splitpga_ = __d.splitpga_;
        let _color = getColor(splitpga_[0]);

        let boxDepth = splitpga_[0] * 100;
        boxDepth = boxDepth == 0 ? 1 : boxDepth;
        const geometry = new THREE.BoxGeometry(1, 1, boxDepth);
        var position = quake.threeLayer.coordinateToVector3([__d.lon, __d.lat]);
        positionHelper.position.y = position.y;
        positionHelper.position.x = position.x; 
        positionHelper.position.z = boxDepth/2;
        
        positionHelper.updateWorldMatrix(true, false);
        geometry.applyMatrix4(positionHelper.matrixWorld);

        const color = new THREE.Color(_color); 
        const rgb = color.toArray().map(v => v * 255);

        const numVerts = geometry.getAttribute('position').count;
        const itemSize = 3;  // r, g, b
        const colors = new Uint8Array(itemSize * numVerts);
        colors.forEach((v, ndx) => {
            colors[ndx] = rgb[ndx % 3];
        });
        const normalized = true;
        const colorAttrib = new THREE.BufferAttribute(colors, itemSize, normalized);
        geometry.setAttribute('color', colorAttrib);
        geometries.push(geometry);
 
    }

    if(geometries.length > 0){
        const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries, false);
        const material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity:0.8
        });
            
        mergedBars = new THREE.Mesh(mergedGeometry, material);
        quake.threeLayer.addMesh(mergedBars);
    }
}

let test_2 = 0;
let isEndIdx2 = 0;
function barAnim2(){
    if(mergedBars != null){
        isEndIdx2 = 12200;
        let attr = mergedBars.geometry.attributes;
        let psCnt = 24;
        let nextIdx = 0;
        for(var i=0; i<attr.position.count; i++){
            
            if(i % psCnt == 0 && i >= psCnt){
                nextIdx++;
            }

            let mz = [2,8,17,23,32,35,38,41,50,53,56,59];
            let kk = i*3;
            let kk2 = kk-1;
            
            if(kk2 % 2 == 0 || kk2 % 8 == 0 || kk2 % 17 == 0 || kk2 % 23 == 0 || kk2 % 32 == 0 || kk2 % 35 == 0 || kk2 % 38 == 0 || kk2 % 41 == 0 || kk2 % 50 == 0 ||
                kk2 % 53 == 0 || kk2 % 56 == 0 || kk2 % 59 == 0){
 
                let v = __data[nextIdx].splitpga_[test_2];
                let boxDepth = v * 100;
                if(boxDepth == 0){
                    continue;
                }
                boxDepth = boxDepth == 0 ? 1 : boxDepth;

                attr.position.setZ(i, boxDepth);//array[i] = boxDepth;
            }
        }
        mergedBars.geometry.attributes.position.needsUpdate = true;
        mergedBars.geometry.computeBoundingBox();
        mergedBars.geometry.computeBoundingSphere();

        // isEndIdx = b.options.splitpga_.length;
        // let pga = b.options.splitpga_[test_];
        // let _color = getColor(pga);
        // b.object3d.material.color.set(_color);
        // b.object3d.material.needsUpdate = true;
        // b.setAltitude(pga * 1000);

        test_2++;
        if(isEndIdx2 <= test_2){
            test_2 = 0;
        }
    } 
}


async function testWAVText() {
    fetch('/test/ztest.txt').then(res => res.text()).then(data => {
        let sd = data.split(' ');
        console.log(sd);
    });

    fetch('/test/ztest2.txt').then(res => res.text()).then(data => {
        let sd = data.split(' ');
        console.log(sd);
    });

    let pros = await fetch('/test/ph.csv');
    let prosTxt = await pros.text();
    let points = [];
    Papa.parse(prosTxt, {
        complete: function (results) {
            let data = results.data;
            for (var i = 0; i < data.length; i++) {
                let row = data[i];
                if (i == 0) { //헤더
                    if (row[0] == 'name' && row[1] == 'lat' && row[2] == 'lon' && row[3] == 'pgv') {
                    } else {
                        alert("잘못된 형식입니다.\n헤더는 [name,lat,lon,pgv]로 구성되어야 합니다.");
                        return;
                    }
                } else {
                    let name = row[0];
                    let lat = Number(row[1]);
                    let lon = Number(row[2]);
                    let pgv = Number(row[3]);
                    if (lon && lat) {
                        var point = new maptalks.Marker([lon, lat],
                            {
                                visible: true,
                                editable: true,
                                cursor: 'pointer',
                                shadowBlur: 0,
                                shadowColor: 'black',
                                draggable: false,
                                dragShadow: false, // display a shadow during dragging
                                drawOnAxis: null,  // force dragging stick on a axis, can be: x, y
                                symbol: {
                                    'textFaceName': 'sans-serif',
                                    'textName': 'MapTalks',
                                    'textFill': '#34495e',
                                    'textHorizontalAlignment': 'right',
                                    'textSize': 40
                                }
                            });
                        points.push(point);
                    }
                }

            }
        }
    });

    new maptalks.VectorLayer('vector', points).addTo(quake.map);
}

//var events = [];

function onEvent(param) {
    // events.push(param);
    var content = '';
    // for (var i = events.length - 1; i >= 0; i--) {
    //     content += events[i].type + ' on ' +
    //     events[i].coordinate.toArray().map(function (c) { return c.toFixed(5); }).join() +
    //     '<br>';
    // }
    console.log(param.target._symbol.textName);
    // document.getElementById('events').innerHTML = '<div>' + content + '</div>';
    //return false to stop event propagation
    return false;
}

var bars = [];
const vertexShader = `
    varying vec2 vUv;
    void main()	{
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
    `;

const fragmentShader = `
    #if __VERSION__ == 100
        #extension GL_OES_standard_derivatives : enable
    #endif

    varying vec2 vUv;
    uniform float thickness;

    float edgeFactor(vec2 p){
        vec2 grid = abs(fract(p - 0.5) - 0.5) / fwidth(p) / thickness;
        return min(grid.x, grid.y);
    }

    void main() {

        float a = edgeFactor(vUv);

        vec3 c = mix(vec3(1), vec3(0), a);

        gl_FragColor = vec4(c, 1.0);
    }
    `;


const material = new THREE.ShaderMaterial({
    uniforms: {
        thickness: {
            value: 1.5
        }
    },
    vertexShader,
    fragmentShader
});

function addBars(scene) {
    const minLng = 128.755734,
        maxLng = 129.314373,
        minLat = 34.978977,
        maxLat = 35.396265;
    const lnglats = [];
    const NUM = 100;
    const rows = 99,
        cols = 99;
    const app = (window.app = new App(NUM, NUM));
    for (let i = 0; i <= cols; i++) {
        const lng = ((maxLng - minLng) / cols) * i + minLng;
        for (let j = 0; j <= rows; j++) {
            const lat = ((maxLat - minLat) / rows) * j + minLat;
            const bar = quake.threeLayer.toBar([lng, lat], { height: 2000, radius: 260, radialSegments: 4, interactive: false }, material);
            bar.getObject3d().rotation.z = Math.PI / 4;
            bars.push(bar);
            app.staggerArray.push({
                altitude: 0
            });
        }
    }
    quake.threeLayer.addMesh(bars);
    app.init();
    animation();
}
class App {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;

        this.randFrom = ["first", "last", "center"];

        this.easing = [
            "linear",
            "easeInOutQuad",
            "easeInOutCubic",
            "easeInOutQuart",
            "easeInOutQuint",
            "easeInOutSine",
            "easeInOutExpo",
            "easeInOutCirc",
            "easeInOutBack",
            "cubicBezier(.5, .05, .1, .3)",
            "spring(1, 80, 10, 0)",
            "steps(10)"
        ];
        this.staggerArray = [];
    }

    init() {
        this.beginAnimationLoop();
    }
    beginAnimationLoop() {
        // random from array
        let randFrom = this.randFrom[
            Math.floor(Math.random() * this.randFrom.length)
        ];
        let easingString = this.easing[
            Math.floor(Math.random() * this.easing.length)
        ];

        anime({
            targets: this.staggerArray,
            altitude: [
                { value: 10000 * 0.25, duration: 500 },
                { value: -(0 * 0.25), duration: 2000 }
            ],
            delay: anime.stagger(200, {
                grid: [this.rows, this.cols],
                from: randFrom
            }),
            easing: easingString,
            complete: (anim) => {
                this.beginAnimationLoop();
            },
            update: () => {
                for (let i = 0, len = bars.length; i < len; i++) {
                    bars[i].setAltitude(this.staggerArray[i].altitude);
                }
            }
        });
    }
}