import * as fastrpc from "./fastrpc.js";

const devtools = (window.browser ? browser : chrome).devtools;
const tbody = document.querySelector("tbody");
let hashId = null;

function isFrpc(ct) { return ct && ct.match(/-frpc/i); }

async function getContent(har) {
	let ffPromise;
	let chromePromise = new Promise(resolve => {
		ffPromise = har.getContent((content, encoding) => resolve([content, encoding]));
	});

	let [content, encoding] = await (ffPromise || chromePromise);
	return atob(content);
}

function createClipButton(data) {
	let node = document.createElement("span");
	node.className = "clipboard";
	node.title = "Copy to clipboard";
	node.textContent = "📋";
	node.addEventListener("click", e => {
		let str = (typeof(data) == "string" ? data : JSON.stringify(data));
		navigator.clipboard.writeText(str);
	});
	return node;
}

function stringToBytes(str, ct) {
	if (ct.match(/base64/i)) {
		return atob(str).split("").map(x => x.charCodeAt(0));
	} else {
		let bytes = new Uint8Array(str.length);
		return str.split("").map(x => x.charCodeAt(0));
	}
}

function xhrToHar(xhr, url, body, ct) {
	let text = "";
	body.forEach(byte => text += String.fromCharCode(byte));
	let responseMimeType = xhr.getResponseHeader("Content-type");

	return {
		getContent() {
			let text = "";
			new Uint8Array(xhr.response).forEach(byte => text += String.fromCharCode(byte));
			return [btoa(text), responseMimeType];
		},
		request: {
			url,
			postData: {
				mimeType: ct,
				text
			}
		},
		response: {
			status: xhr.status,
			content: {
				mimeType: responseMimeType
			}
		}
	};
}

function send(url, method, args) {
	const ct ="application/x-frpc";
	let xhr = new XMLHttpRequest();
	xhr.open("post", url, true);
	xhr.responseType = "arraybuffer";
	xhr.setRequestHeader("Accept", ct);
	xhr.setRequestHeader("Content-Type", ct);
	(hashId && xhr.setRequestHeader("X-Seznam-hashId", hashId));

	let body = new Uint8Array(fastrpc.serializeCall(method, args));
	xhr.send(body);
	xhr.addEventListener("load", e => {
		let har = xhrToHar(xhr, url, body, ct);
		buildRow(har);
	});
}

function toConsole(data) {
	let method = (window.browser ? "inspect" : "console.log");
	let cmd = `${method}(${JSON.stringify(data)})`;
	devtools.inspectedWindow.eval(cmd);
}

function buttonOrValue(data) {
	let str = JSON.stringify(data);
	if (str.length > 60) {
		let button = document.createElement("button");
		let str = (data instanceof Array ? `[${data.length}]` : `{${Object.keys(data).length}}`)
		button.appendChild(document.createTextNode(str));
		button.onclick = () => toConsole(data);
		return button;
	} else {
		return document.createTextNode(str);
	}
}

function alert(what) {
	let cmd = `alert(${JSON.stringify(what)})`;
	devtools.inspectedWindow.eval(cmd);
}

function syncTheme() {
	document.body.dataset.theme = devtools.panels.themeName;
}

document.querySelector("form").onsubmit = async (e) => {
	e.preventDefault();

	let str = e.target.querySelector("[type=text]").value.trim();
	if (!str) { return; }

	let r = str.match(/^([^\(]+)\((.*)\)$/);
	if (!r) { return alert("Wrong FRPC call format"); }
	let method = r[1];
	let args;
	try {
		args = JSON.parse(`[${r[2]}]`);
	} catch (e) { return alert(e.message); }


	let base = await devtools.inspectedWindow.eval("location.href");
	let url = new URL("/RPC2", base);

	send(url.toString(), method, args);
}

document.querySelector("#clear").onclick = () => {
	tbody.innerHTML = "";
}

function buildRow(har) {
	let row = tbody.insertRow();
	buildRequest(row, har.request);
	buildResponse(row, har.response, har);
}

function buildRequest(row, request) {
	let method = row.insertCell();
	method.title = request.url;

	if (request.postData && isFrpc(request.postData.mimeType)) {
		try {
			let bytes = stringToBytes(request.postData.text, request.postData.mimeType);
			let data = fastrpc.parse(bytes);
			method.appendChild(createClipButton(data.method));
			method.appendChild(document.createTextNode(data.method));
			if (data.method == "system.multicall") { data.params = data.params[0]; }
			let params = row.insertCell();
			params.appendChild(createClipButton(data.params));
			params.appendChild(buttonOrValue(data.params));
		} catch (e) {
			method.colSpan = 2;
			method.appendChild(document.createTextNode(e.message));
		}
	} else {
		row.classList.add("no-frpc");
		method.colSpan = 2;
		method.appendChild(document.createTextNode("(not a FastRPC request)"));
	}
}

async function buildResponse(row, response, har) {
	if (response.status != 200) { row.classList.add("error"); } // non-200 http
	row.insertCell().appendChild(document.createTextNode(response.status));
	let frpcStatus = row.insertCell();

	if (isFrpc(response.content.mimeType)) {
		let content = await getContent(har);
		try {
			let bytes = stringToBytes(content, response.content.mimeType);
			let data = fastrpc.parse(bytes);
			let str;
			if (data instanceof Array) {
				if (data.some(x => x.status != 200)) { row.classList.add("error"); } // non-200 frpc multicall
				str = data.map(x => x.status).join("/");
			} else {
				if (data.status != 200) { row.classList.add("error"); } // non-200 frpc singlecall
				str = data.status;
			}
			frpcStatus.appendChild(document.createTextNode(str));
			let td = row.insertCell();
			td.appendChild(createClipButton(data));
			td.appendChild(buttonOrValue(data));
		} catch (e) {
			row.classList.add("error");
			frpcStatus.colSpan = 2;
			frpcStatus.appendChild(document.createTextNode(e.message));
		}
	} else {
		frpcStatus.colSpan = 2;
		frpcStatus.appendChild(document.createTextNode("(not a FastRPC response)"));
	}
}

function onRequestFinished(har) {
	let { request, response } = har;

	request.headers.forEach(header => {
		if (header.name.match(/X-Seznam-hashId/i)) { hashId = header.value; }
	});


	let requestOk = (request.postData && isFrpc(request.postData.mimeType));
	let responseOk = isFrpc(response.content.mimeType);

	if (requestOk || responseOk) { buildRow(har); }
}

function onNavigated() {
	let rows = tbody.querySelectorAll("tr").length;
	if (rows > 0) {
		let empty = tbody.insertRow();
		empty.className = "empty";
		let td = empty.insertCell();
		td.colSpan = 5;
	}
}

devtools.network.onRequestFinished && devtools.network.onRequestFinished.addListener(onRequestFinished);
devtools.network.onNavigated && devtools.network.onNavigated.addListener(onNavigated);
devtools.panels.onThemeChanged && devtools.panels.onThemeChanged.addListener(syncTheme);
syncTheme();
