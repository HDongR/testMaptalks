importScripts('turf.tin.js');
importScripts('three.js');

var uvs = [];
for (var i = 0 ; i< 65 ; i++) {
  var v = 1.0-(i*1.0/64.0);
  for (var j=0 ; j<65 ; j++) {
     var u = j*(1.0/64.0);
     var uv = new THREE.Vector2(u, v);
     uvs.push(uv);
    //uvs.push({u,v});
  }
}

onmessage = function (e) {
    var points = e.data.points;
    var id = e.data.id;
    var indexMap = e.data.indexMap;
    var zs = e.data.zs;
    var minZ = e.data.minZ;
    var results = {
        id: id,
        result: {
            type: 'FeatureCollection',
            features: []
        },
        faces: []
    };
    if (points && Array.isArray(points)) {
        results.result = tin(e.data.points);
    }
    var features = results.result.features;
    var faces = [];
    if (features.length > 0) {
        for (var i = 0, len = features.length; i < len; i++) {
            var geometry = features[i].geometry;
            var lnglats = geometry.coordinates[0];
            for (var j = 0, len1 = lnglats.length; j < len1 - 1; j++) {
                var index = indexMap[lnglats[j].toString()];
                faces.push(index);
            }
        }
    }
    var fs = [];
    for (var i = 0, len2 = faces.length; i < len2; i += 3) {
        var index1 = faces[i],
            index2 = faces[i + 1],
            index3 = faces[i + 2];
        if ((!(zs[index1] > minZ) && (!(zs[index2] > minZ)) && (!(zs[index3] > minZ)))) {
            continue;
        }
        fs.push(index1, index2, index3);
    }
    results.faces = fs;
    results.positions = e.data.positions;
    delete results.result;


    ////////////////////////////////////////////////
    var faces = results.faces;
    const geo = new THREE.Geometry();
    geo.vertices = e.data.positions;
    for (let i = 0, len = faces.length; i < len; i += 3) {
        const index1 = faces[i],
            index2 = faces[i + 1],
            index3 = faces[i + 2];
        // if ((!(_positions[index1].z > _minZ) && (!(_positions[index2].z > _minZ)) && (!(_positions[index3].z > _minZ)))) {
        //     continue;
        // }
        const face = new THREE.Face3(index1, index2, index3);
        geo.faces.push(face);
        
        geo.faceVertexUvs[0].push([uvs[index1], uvs[index2], uvs[index3]]);
    }

    // geometry.computeVertexNormals();
    // geometry.computeFaceNormals();
    // geometry.computeFlatVertexNormals();
    // geometry.computeMorphNormals();
    // geometry.mergeVertices();
    let buffGeom = e.data.buffGeom;
    //buffGeom.fromGeometry(geo);
    // buffGeom.addAttribute('uv',new THREE.BufferAttribute(new Float32Array(uvs), 2));
    //buffGeom.removeAttribute('color');
 
    results.buffGeom = buffGeom;
    ////////////////////////////////////////////////
    
    this.postMessage(results);
};