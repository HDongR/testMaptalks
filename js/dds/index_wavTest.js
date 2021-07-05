var quake = {
    map : {},
    threeLayer : {},
  //  barsLayer : {}, 
  //  geojsonVtLayer : {},
  };
 
  quake.loadWAV = function(){
      console.log('start');
  }
  
  quake.viewMap = function(){
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
    requestAnimationFrame(animation);
  }
  
 
  
  quake.setBaseLayer = function() {
    //basemap : vworld
   // var url = 'http://api.vworld.kr/req/wmts/1.0.0/' + properties.baseMapAPIKey + '/Base/{z}/{y}/{x}.png'
  
    var setillayerUrl = 'http://api.vworld.kr/req/wmts/1.0.0/' + 'D6200AF4-16B4-3161-BE8E-1CCDD332A8E3' + '/Satellite/{z}/{y}/{x}.jpeg';
    var setilLayer = new maptalks.TileLayer('tile2', {
        spatialReference:{
          projection:'EPSG:3857'
            // other properties necessary for spatial reference
        },
        'urlTemplate' : setillayerUrl
    });
  
    quake.map = new maptalks.Map("map", {
        center: [129.15158, 35.15361],
        zoom: 12,
        maxZoom: 18,
        minZoom: 9,
        centerCross: true,
        doubleClickZoom: false,
        baseLayer: setilLayer,
    });
    
  }

  //three layer 생성
  quake.setThreeLayer = function(){
    quake.threeLayer = new maptalks.ThreeLayer('t', {
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
      //addBars(scene);
      testWAVText();
    }
  
    quake.threeLayer.addTo(quake.map);
    
    //quake.map.on('moving moveend zoomend pitch rotate', update);
    
    //update();
  
    //quake.map.on('moving moveend zoomend pitch rotate', testing);
     
  }
 
  function testWAVText(){
    fetch('/test/ztest.txt').then(res=>res.text()).then(data=>{
        let sd = data.split(' ');
        console.log(sd);
    });

    fetch('/test/ztest2.txt').then(res=>res.text()).then(data=>{
        let sd = data.split(' ');
        console.log(sd);
    });
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
            const NUM = 50;
            const rows = 49,
                cols = 49;
            const app = (window.app = new App(NUM, NUM));
            for (let i = 0; i <= cols; i++) {
                const lng = ((maxLng - minLng) / cols) * i + minLng;
                for (let j = 0; j <= rows; j++) {
                    const lat = ((maxLat - minLat) / rows) * j + minLat;
                    const bar = quake.threeLayer.toBar([lng, lat], { height: 2000, radius: 100, radialSegments: 4, interactive: false }, material);
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