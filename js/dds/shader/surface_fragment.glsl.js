

( function () {

	const SurfaceShader = {
		uniforms: {
            cameraNear: { 
                value: 0.0 
            },
			cameraFar: { 
                value: 0.0
            },
			tDiffuse: { 
                value: null 
            },
            depthInfo: {
                value: null
            },
            r: {
                value: 0.0
            },
            g: {
                value: 0.0
            },
            b: {
                value: 0.0
            },
		},
        vertexShader:
        /* glsl */
        `
        #include <packing>
        uniform sampler2D depthInfo;
        varying vec2 vUv;
        uniform float cameraNear;
        uniform float cameraFar;
        
        float readDepth( sampler2D depthSampler, vec2 coord ) {
            float fragCoordZ = texture2D( depthSampler, coord ).x;
            float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
            return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
        }
        
        void main() {
            vUv = uv;
            float depth = readDepth( depthInfo, vUv );
            vec3 pos = position;
            pos.z = depth + 0.;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( pos, 1.0 );
        }
        `,
        fragmentShader:
        /* glsl */
        `
        #include <packing>

        varying vec2 vUv;
        uniform sampler2D depthInfo;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform float r;
        uniform float g;
        uniform float b;
        
        float readDepth( sampler2D depthSampler, vec2 coord ) {
            float fragCoordZ = texture2D( depthSampler, coord ).x;
            float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
            return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
        }
        
        void main() {
            gl_FragColor = vec4(r,g,b, 1.0);
        }
        `
	};
    THREE.SurfaceShader = SurfaceShader;
} )();
