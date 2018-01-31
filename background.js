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
	let responseBody = new Uint8Array(0);

	let filter = browser.webRequest.filterResponseData(id);
	filter.onstop = () => {
		filter.disconnect();
		onResponseBody(id, responseBody.buffer);
	}
	filter.ondata = event => {
		let chunk = new Uint8Array(event.data);
		let newBody = new Uint8Array(responseBody.length + event.data.byteLength);
		newBody.set(responseBody, 0);
		newBody.set(chunk, responseBody.length);
		responseBody = newBody;

		filter.write(event.data);
	}

	let body = request.requestBody;
	if (body) { body = body.raw[0].bytes; }

	requests[id] = {
		id,
		tabId,
		type: null,
		url: request.url,
		body
	}

	responses[id] = {
		id,
		tabId,
		body: null
	};
//	console.log("got id", id, "to", request.url);
}

function onBeforeSendHeaders(request) {
	let id = request.requestId;
	let record = requests[id];
	if (!record) { return; }
	delete requests[id];

	record.type = getContentType(request.requestHeaders);
	for (let header of request.requestHeaders) {
		if (header.name.match(/X-Seznam-hashId/i)) { record.hashId = header.value; }
	}
	ports[record.tabId].postMessage(record);
}

function onHeadersReceived(request) {
	let tabId = request.tabId;
	let port = ports[tabId];
	if (!port) { return; } // no devtool avail, sorry

	let id = request.requestId;
	let record = responses[id];
	record.status = request.statusCode;
	record.type = getContentType(request.responseHeaders);

	finalizeResponse(id); // wait for body or send to devtool
}

function onResponseBody(id, body) {
	let record = responses[id];
	record.body = body;

	finalizeResponse(id); // wait for headers or send to devtool
}

function onErrorOccurred(details) {
	let id = details.requestId;
	delete requests[id];
	delete responses[id];

	let record = {
		id,
		error: details.error
	}
	ports[details.tabId].postMessage(record);
}

function finalizeResponse(id) {
	let record = responses[id];
	if (!record.body || !record.type) { return; }

	delete responses[id];

	let tabId = record.tabId;
	let port = ports[tabId];
	port.postMessage(record);
}

browser.webRequest.onBeforeRequest.addListener(onBeforeRequest, filter, ["requestBody", "blocking"]);
browser.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, filter, ["requestHeaders"]);
browser.webRequest.onHeadersReceived.addListener(onHeadersReceived, filter, ["responseHeaders"]);
browser.webRequest.onErrorOccurred.addListener(onErrorOccurred, filter);

browser.runtime.onConnect.addListener(p => {
	let tabId = JSON.parse(p.name);
	ports[tabId] = p;
});
