export function isHTMLElement(node) {
    return typeof node === 'object' && node !== null && node.nodeType && node.nodeName;
}

export function patchHistory(history) {
    const oldListen = history.listen;
    history.listen = function(callback) {
        if (callback.name !== 'handleLocationChange') {
            callback(history.location);
        }
        return oldListen.call(history, callback);
    };
    return history;
}
