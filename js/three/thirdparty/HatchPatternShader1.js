( function () {

	const HatchPatternShader1 = {
		uniforms: {
			resolution: {
				value: new THREE.Vector2( 1, 1 )
			},
			opacity: {
				value: 1.0
			},
			wh: {
				value: 16.0
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

        varying vec2 vUv;

        vec2 movingTiles(vec2 _st, float _zoom, float _speed){
            _st *= _zoom;
            return fract(_st);
        }
        void main() {
            vec2 st = gl_FragCoord.xy/(resolution);
         
            st = movingTiles(st,wh,1.236);

            float pct = 1.;
            float k = 1.;
            if(
                (abs(st.y - st.x) >= k - barWidth)
                ||
                (st.y - st.x >= (k - 1.) - barWidth && st.y - st.x <= (k - 1.) + barWidth)
            ){
                pct = 1.0;
            }else{
                pct = 0.0;
            }

            gl_FragColor = opacity * vec4(vec3(r,g,b), pct);
        }`
	};

	THREE.HatchPatternShader1 = HatchPatternShader1;

} )();