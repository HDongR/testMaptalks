importScripts('https://unpkg.com/@turf/turf@6.3.0/turf.min.js');


onmessage = function (e) {
    fetch('/geo/seoul.geojson').then(res=>res.json()).then(result => {
        //console.log(result);
        let geos = [];
        result.features.forEach(f =>{
          f.geometry.coordinates.forEach(c => {
            c.forEach(c2=>{
              geos.push(c2);
             //console.log(c2);
            })
            
          });
        });
        var points = turf.points([
          [126.95208669988814, 37.54821331148675],
          [127.0235313974674, 37.56394692868475],
          [-46.6062, -23.5513],
          [-46.663, -23.554],
          [-46.643, -23.557]
        ]);
        
        let param = [];
        geos.push(geos[0]);
        param.push(geos);
        
        var searchWithin = turf.polygon(param);
        
        var ptsWithin = turf.pointsWithinPolygon(points, searchWithin);
        this.postMessage({timeId:e.data,result:ptsWithin});
        
      });
    
};


