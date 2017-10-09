const requests = {};
const responses = {}; // fixme unused, waiting for bodies
const ports = {};

const filter = {
	urls: ["<all_urls>"],
	types: ["xmlhttprequest"]
};

function getContentType(headers) {
	for (let header of headers) {
		if (header.name.match(/content-type/i)) { return header.value; }
	}
	return null;
}

function onBeforeRequest(request) {
	let tabId = request.tabId;
	let port = ports[tabId];
	if (!port) { return; } // no devtool avail, sorry

	let id = request.requestId;
	let body = request.requestBody;
	if (body) { body = body.raw[0].bytes; }

	let record = {
		id,
		tabId,
		type: null,
		url: request.url,
		body
	}

	requests[id] = record;
//	console.log("got id", id, "to", request.url);
}

function onBeforeSendHeaders(request) {
	let id = request.requestId;
	let record = requests[id];
	if (!record) { return; }
	delete requests[id];

	record.type = getContentType(request.requestHeaders);
	ports[record.tabId].postMessage(record);
}

function onHeadersReceived(request) {
	let tabId = request.tabId;
	let port = ports[tabId];
	if (!port) { return; } // no devtool avail, sorry

	let id = request.requestId;
	let record = {
		id,
		tabId,
		status: request.statusCode,
		type: getContentType(request.responseHeaders),
		body: null
	}

	port.postMessage(record);
}

browser.webRequest.onBeforeRequest.addListener(onBeforeRequest, filter, ["requestBody"]);
browser.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, filter, ["requestHeaders"]);
browser.webRequest.onHeadersReceived.addListener(onHeadersReceived, filter, ["responseHeaders"]);
//browser.webRequest.onCompleted.addListener(onCompleted, filter);

browser.runtime.onConnect.addListener(p => {
	let tabId = JSON.parse(p.name);
	ports[tabId] = p;
});
