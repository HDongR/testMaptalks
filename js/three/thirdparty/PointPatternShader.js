( function () {

	const PointPatternShader = {
		uniforms: {
			resolution: {
				value: new THREE.Vector2( 1, 1 )
			},
			opacity: {
				value: 1.0
			},
			wh: {
				value: 80.0
			},
			offset: {
				value: 10.0
			},
			radius: {
				value: 20.0
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
		uniform float offset;
		uniform float radius;
		uniform float r;
		uniform float g;
		uniform float b;
		uniform float u_time;

		const float PI = 3.1415926535897932384626433832795;

		vec2 movingTiles(vec2 _st, float _zoom, float _speed){
			_st *= _zoom;
			_st.x += fract(_speed)*2.0;
			

			return fract(_st);


			//_st *= _zoom;
			// float time = u_time*_speed;
			// if( fract(time)>0.5 ){
			// 	if (fract( _st.y * 0.5) > 0.5){
			// 		_st.x += fract(time)*2.0;
			// 	} else {
			// 		_st.x -= fract(time)*2.0;
			// 	}
			// } else {
			// 	if (fract( _st.x * 0.5) > 0.5){
			// 		_st.y += fract(time)*2.0;
			// 	} else {
			// 		_st.y -= fract(time)*2.0;
			// 	}
			// }
			// return fract(_st);
		}

		float circle(vec2 _st, float _radius){
			vec2 pos = vec2(0.520,0.500)-_st;
			return smoothstep(0.992-_radius,1.000-_radius+_radius*0.072,1.-dot(pos,pos)*9.980);
		}

		void main() {
			// vec2 st = gl_FragCoord.xy/resolution.xy;
			// st.x *= resolution.x/resolution.y;

			// st = movingTiles(st,50.000,1.500);

			// vec3 color = vec3(1.,1.,0.) * (1.-vec3( 1.000-circle(st, 1.396 )));

			// gl_FragColor = opacity * vec4(color,1.);


			vec2 st = gl_FragCoord.xy/resolution.xy;
			st.x *= resolution.x/resolution.y;
		
			st = movingTiles(st,8.448,1.500);
		
			//vec3 color = vec3(1.,1.,0.) * vec3(circle(st, 1.396 ));
			 
			float pixels = 20.0; 
		
			float dist = distance(st, vec2(0.5));
			dist = step(dist, 0.5);
			gl_FragColor = vec4(vec3(1.000,0.791,0.299), dist);
		}`
	};

	THREE.PointPatternShader = PointPatternShader;

} )();
