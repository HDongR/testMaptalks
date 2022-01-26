
THREE.SurfaceShader = {

	uniforms: {

		'tDiffuse': { value: null },
        'tDepth': {value: null},
        'cameraNear': {value: 0.1},
        'cameraFar': {value: 150.0},

	},

	vertexShader: [
        '#include <common>',
        '#include <packing>',

		'varying vec2 vUv;',

        'uniform sampler2D tDepth;',
        'uniform sampler2D tDiffuse;',
        'uniform float cameraNear;',
        'uniform float cameraFar;',

        "float getDepth( const in vec2 screenPosition ) {",
		"	//#if DEPTH_PACKING == 1",
		"	return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );",
		"	//#else",
		"	//return texture2D( tDepth, screenPosition ).x;",
		"	//#endif",
		"}",

		"float getViewZ( const in float depth ) {",
		"	//#if PERSPECTIVE_CAMERA == 1",
		"	//return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",
		"	//#else",
		"	return orthographicDepthToViewZ( depth, cameraNear, cameraFar );",
		"	//#endif",
		"}",

        'float readDepth(sampler2D depthSampler, vec2 coord){',
        '   float fragCoordZ = texture2D(depthSampler, coord).x;',
        '   float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);',
        '   return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar);',
        '}',
        
        'float readZ(sampler2D depthSampler, vec2 coord){',
        '   float fragCoordZ = texture2D(depthSampler, coord).x;',
        '   return fragCoordZ;',
        '}',
        '',
		'void main() {',
		'	vUv = uv;',
        '   float read = readZ(tDepth, vUv);',
        '   float getD = getDepth(vUv);',
        '   float depth = readDepth(tDepth, vUv);',
        '   float viewZ = getViewZ(depth);',
        '   vec3 pos = position;',
        '   pos.z = read;',
		'	gl_Position = projectionMatrix * modelViewMatrix * vec4( pos, 1.0 );',

		'}'

	].join( '\n' ),

	fragmentShader: [

        '#include <common>',
        '#include <packing>',

		'varying vec2 vUv;',

        'uniform sampler2D tDiffuse;',
        'uniform sampler2D tDepth;',
        'uniform float cameraNear;',
        'uniform float cameraFar;',

        'float readDepth(sampler2D depthSampler, vec2 coord){',
        '   float fragCoordZ = texture2D(depthSampler, coord).x;',
        '   float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);',
        '   return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar);',
        '}',

		'void main() {',
        '   float depth = readDepth(tDepth, vUv);',
        '   gl_FragColor.rgb = 1.0 - vec3(depth);',
        '   gl_FragColor.a = 1.0; ',
		'	gl_FragColor = vec4(vUv, 1.0, 1.);//1.,0.,0.,1.);//texture2D( tDiffuse, vUv );',

		'}'

	].join( '\n' )

};
