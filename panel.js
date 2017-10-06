const tbody = document.querySelector("tbody");
const tabId = browser.devtools.inspectedWindow.tabId;
let rows = {};

document.querySelector("button").onclick = () => {
	var xhr = new XMLHttpRequest();
	xhr.open("get", "https://www.seznam.cz/", true);
	xhr.send();
	xhr.addEventListener("load", e => log(xhr.responseText));
	xhr.addEventListener("error", e => log(xhr.status));
}

document.querySelector("#clear").onclick = () => {
	tbody.innerHTML = "";
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

function buildRequest(row, record) {
	row.insertCell().innerHTML = record.url;

	let method = row.insertCell();
	let params = row.insertCell();

	if (record.type) {
		let bytes = new Uint8Array(record.body);
		try {
			let data = parse(bytes, record.type);
			method.innerHTML = data.method;
			let button = document.createElement("button");
			button.innerHTML = data.params.length;
			params.appendChild(button);
			button.onclick = () => toConsole(data.params);
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
 * @param {null||ArratBuffer} record.body
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
	}
}

let port = browser.runtime.connect(null, {name: JSON.stringify(tabId)});
port.onMessage.addListener(onMessage);