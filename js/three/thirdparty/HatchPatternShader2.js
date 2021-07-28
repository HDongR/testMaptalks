( function () {

	const HatchPatternShader2 = {
		uniforms: {
			resolution: {
				value: new THREE.Vector2( 1, 1 )
			},
			opacity: {
				value: 1.0
			},
			wh: {
				value: 50.0
			},
			barWidth: {
				value: 5.0
			},
			r : {
				value: 1.0
			},
			g : {
				value: 0.0
			},
			b : {
				value: 0.0
			},
			u_time : {
				value: 0.0
			} 
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `
  		uniform vec2 resolution; 
		uniform float opacity;
		uniform float wh;
		uniform float barWidth;
		uniform float r;
		uniform float g;
		uniform float b;
		uniform float u_time;

		float plot(vec2 st, float k) {    
            return step(1. - k + 0.5, abs(st.x - st.y));
        }
        float plot2(vec2 st, float k) {
            return step(abs(st.x - st.y), k-0.5);
        }
        vec2 movingTiles(vec2 _st, float _zoom, float _speed){
            _st *= _zoom;
            return fract(_st);
        }
        void main() {
            vec2 st = gl_FragCoord.xy/resolution;
         
            st = movingTiles(st,31.832,1.236);

            float pct = 1.0; 
            float k = 1.000;
            float width = 0.17;
            if(
				(st.y + st.x >= k - width && st.y + st.x <= k+width) 
				||
				(st.y + st.x <= k - 1. + width)
				||
				(st.y + st.x >= k + 1. - width)
			){
                pct = 1.0;
            }else{
                pct = 0.0;
            }

            gl_FragColor = vec4(vec3(r,g,b), pct);
        }`
	};

	THREE.HatchPatternShader2 = HatchPatternShader2;

} )();