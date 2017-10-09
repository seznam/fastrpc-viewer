const tbody = document.querySelector("tbody");
const tabId = browser.devtools.inspectedWindow.tabId;
let rows = {};

function isFrpc(ct) { return ct && ct.match(/-frpc/i); }

function send(url, method, args) {
	const ct ="application/x-frpc";
	let xhr = new XMLHttpRequest();
	xhr.open("post", url, true);
	xhr.responseType = "arraybuffer";
	xhr.setRequestHeader("Accept", ct);
	xhr.setRequestHeader("Content-Type", ct);

	let id = Math.random();
	let body = new Uint8Array(fastrpc.serializeCall(method, args)).buffer;

	let requestRecord = { id, url, type: ct, body };
	onMessage(requestRecord);

	xhr.send(body);
	xhr.addEventListener("load", e => {
		let headers = xhr.getAllResponseHeaders();
		let index = Object.keys(headers).map(h => h.toLowerCase()).findIndex(h => h.match(/content-type/i));
		let type = Object.values(headers)[index] || "";

		let responseRecord = { id, type, body, status: xhr.status };
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
	let params = row.insertCell();

	if (isFrpc(record.type)) {
		let bytes = new Uint8Array(record.body);
		try {
			let data = parse(bytes, record.type);
			method.innerHTML = data.method;
			if (data.method == "system.multicall") { data.params = data.params[0]; }
			params.appendChild(buttonOrValue(data.params));
		} catch (e) {
			method.innerHTML = e.message;
			console.log(bytes);
		}
	} else {
		method.innerHTML = "(not a FastRPC request)";
	}
}

function buildResponse(row, record) {
	row.insertCell().innerHTML = record.status;
}

/**
 * @param {object} record
 * @param {string} record.id
 * @param {string} record.tabId
 * @param {null||string} record.type
 * @param {null||ArrayBuffer} record.body
 * @param {number} [record.status]
 * @param {string} [record.url]
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
