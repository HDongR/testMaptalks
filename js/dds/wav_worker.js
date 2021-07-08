onmessage = function (e) {
    let data = e.data.data;
    let start = e.data.start;
    let end = e.data.end;
    let id = e.data.id;
    let timeAvgSlice = e.data.timeAvgSlice;
    let resultData = [];
    for (var i = 0; i < data.length; i+=2) {
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
            let _tt = splitpga_.slice(0);
            
            let timeTmpAvgList = [];
            let timeAvgList = [];
            for(var _t=1; _t<=_tt.length; _t++){
                let t = Number(_tt[_t-1]);
                timeTmpAvgList.push(t);
                if(_t % timeAvgSlice == 0){
                    let sum = 0;
                    let avg = 0;
                    for(var _t2=0; _t2<timeTmpAvgList.length; _t2++){
                        sum += timeTmpAvgList[_t2];
                    }
                    avg = sum / timeTmpAvgList.length;
                    timeAvgList.push(avg);
                    timeTmpAvgList.length = 0;
                }
                
            }
            resultData.push({lat, lon, splitpga_:timeAvgList});
            //console.log(i);
            splitpga_.length = 0;
            
            splitpga.length = 0;
            
        }
        data[i].length = 0;
        name = null;
        lat = null;
        lon = null;
        max_pgv = null;
        times_pga = null;
        splitpga_ = null;
        splitpga = null;
        data[i] = null;
    }

    this.postMessage({id,resultData});
};