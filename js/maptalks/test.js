(async () => {
    const canvasOffscreen = document.querySelector("#c").transferControlToOffscreen();
    const worker = new Worker('/js/test.worker.js');
   
    worker.postMessage({ msg: 'start', canvas: canvasOffscreen }, [canvasOffscreen]);
})();