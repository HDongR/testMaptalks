importScripts('/js/maptalks/three.js');
importScripts('/js/maptalks/maptalks_removeDom.js');
importScripts('/js/maptalks/maptalks.three_removeDom.js');
importScripts('/js/proj4.js');
importScripts('/js/util/bufferParser.js');



onmessage = async function (e) {
    if(e.data.what == 'buildingDownload'){
        let url = 'http://220.123.241.100:8181/geoserver/dds/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dds%3Atb_building_g2&outputFormat=application%2Fjson';
        let buildingSize = 80805888;
        let response = await fetch(url);
        const reader = response.body.getReader();
        const contentLength = buildingSize;//+response.headers.get('Content-Length');

        let receivedLength = 0; // received that many bytes at the moment
        let chunks = []; // array of received binary chunks (comprises the body)
        while(true) {
            const {done, value} = await reader.read();

            if (done) {
                break;
            }

            chunks.push(value);
            receivedLength += value.length;
            var tic = receivedLength / contentLength * 100;
            tic = Math.round(tic * 100) / 100;
            //if(tic < 90) quake.progressPBar(tic); else quake.progressBarContents('데이터 취합중..');
        }

        // Step 4: concatenate chunks into single Uint8Array
        let chunksAll = new Uint8Array(receivedLength); // (4.1)
        let position = 0;
        for(let chunk of chunks) {
        chunksAll.set(chunk, position); // (4.2)
        position += chunk.length;
        }

        // Step 5: decode into a string
        // let result = new TextDecoder("utf-8").decode(chunksAll);

        // // We're done!
        // buildingData = JSON.parse(result);
        // let buff = str2ab(JSON.stringify({what:'buildingDownloaded', buildingData}));
        this.postMessage(chunksAll);
    }
}
