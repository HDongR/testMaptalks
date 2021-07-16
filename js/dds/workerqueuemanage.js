class WorkerThreadQueue {
    constructor() {
        this.queue = [
            // {
            //     worker,
            //     params,
            //     callback
            // }
        ];
        
        this.runing = false;
    }

    pushQueue(worker, params, callback) {
        this.queue.push({
            worker,
            params,
            callback
        });
        if (!this.runing) {
            this.message_();
        }
    }

    message_() {
        if (this.queue.length > 0) {
            const { worker, params, callback } = this.queue[0];
            worker.postMessage(params);
            this.runing = true;
            worker.onmessage = (e) => {
                callback(e);
                this.queue.splice(0, 1);
                this.message_();
            };
        } else {
            this.runing = false;
        }
    }
}