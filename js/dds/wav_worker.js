onmessage = function (e) {
    let data = e.data.data;
    let timeAvgSlice = e.data.timeAvgSlice;
    let id = e.data.id;
     
    this.postMessage({resultData:data, id, eq_m_seq : e.data.eq_m_seq});
};