const tbody = document.querySelector("tbody");
const tabId = browser.devtools.inspectedWindow.tabId;
let rows = {};
let hashId = null;

function isFrpc(ct) { return ct && ct.match(/-frpc/i); }

function send(url, method, args) {
	const ct ="application/x-frpc";
	let xhr = new XMLHttpRequest();
	xhr.open("post", url, true);
	xhr.responseType = "arraybuffer";
	xhr.setRequestHeader("Accept", ct);
	xhr.setRequestHeader("Content-Type", ct);
	(hashId && xhr.setRequestHeader("X-Seznam-hashId", hashId));

	let id = Math.random();
	let body = new Uint8Array(fastrpc.serializeCall(method, args)).buffer;

	let requestRecord = { id, url, type: ct, body };
	onMessage(requestRecord);

	xhr.send(body);
	xhr.addEventListener("load", e => {
		let type = xhr.getResponseHeader("Content-type");
		let responseRecord = { id, type, body:xhr.response, status: xhr.status };
		onMessage(responseRecord);
	});
}

function parse(bytes, ct) {
	if (ct.match(/base64/i)) {
		let str = String.fromCharCode(...bytes);
		bytes = atob(str).split("").map(x => x.charCodeAt(0));
	}
	return fastrpc.parse(bytes);
}

function toConsole(data) {
	let cmd = `console.log(${JSON.stringify(data)})`;
	browser.devtools.inspectedWindow.eval(cmd);
}

function buttonOrValue(data) {
	let str = JSON.stringify(data);
	if (str.length > 60) {
		let button = document.createElement("button");
		button.innerHTML = (data instanceof Array ? `[${data.length}]` : `{${Object.keys(data).length}}`);
		button.onclick = () => toConsole(data);
		return button;
	} else {
		return document.createTextNode(str);
	}
}

function buildRequest(row, record) {
	row.insertCell().innerHTML = record.url;

	let method = row.insertCell();

	if (isFrpc(record.type)) {
		let bytes = new Uint8Array(record.body);
		try {
			let data = parse(bytes, record.type);
			method.innerHTML = data.method;
			if (data.method == "system.multicall") { data.params = data.params[0]; }
			let params = row.insertCell();
			params.appendChild(buttonOrValue(data.params));
		} catch (e) {
			method.colSpan = 2;
			method.innerHTML = e.message;
		}
	} else {
		row.classList.add("no-frpc");
		method.colSpan = 2;
		method.innerHTML = "(not a FastRPC request)";
	}
}

function buildResponse(row, record) {
	row.insertCell().innerHTML = record.status;
	let frpcStatus = row.insertCell();

	if (isFrpc(record.type)) {
		let bytes = new Uint8Array(record.body);
		try {
			let data = parse(bytes, record.type);
			frpcStatus.innerHTML = (data instanceof Array ? data.map(x => x.status).join("/") : data.status);
			row.insertCell().appendChild(buttonOrValue(data));
		} catch (e) {
			frpcStatus.colSpan = 2;
			frpcStatus.innerHTML = e.message;
		}
	} else {
		frpcStatus.colSpan = 2;
		frpcStatus.innerHTML = "(not a FastRPC response)";

		if (row.classList.contains("no-frpc")) { row.parentNode.removeChild(row); } // frpc not in request nor response
	}
}

/**
 * @param {object} record
 * @param {string} record.id
 * @param {string} record.tabId
 * @param {null||string} record.type
 * @param {null||ArrayBuffer} record.body
 * @param {number} [record.status]
 * @param {string} [record.url]
 * @param {string} [record.hashId]
 */
function onMessage(record) {
	let id = record.id;
	let row = rows[id];

	if (row) { /* response */
		buildResponse(row, record);
		delete rows[id];
	} else { /* request */
		let row = tbody.insertRow();
		rows[id] = row;

		buildRequest(row, record);
		if (record.hashId) { hashId = record.hashId; }

		let node = document.documentElement;
		node.scrollTop = node.scrollHeight;
	}
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


	let base = await browser.devtools.inspectedWindow.eval("location.href");
	let url = new URL("/RPC2", base);

	send(url.toString(), method, args);
}

document.querySelector("#clear").onclick = () => {
	tbody.innerHTML = "";
}

let port = browser.runtime.connect(null, {name: JSON.stringify(tabId)});
port.onMessage.addListener(onMessage);
