var Item = function(url) {
	this._params = null;
	this._response = null;
	this._requestHeaders = null;
	this._responseHeaders = null;

	this._node = document.createElement("tr");
	this._cells = [];
	for (var i=0;i<6;i++) {
		var cell = document.createElement("td");
		this._cells.push(cell);
		this._node.appendChild(cell);
	}

	this._cells[0].appendChild(document.createTextNode(url));
}

Item.ALL = {};

Item.prototype.setRequestHeaders = function(headers) {
	this._requestHeaders = headers;
	var type = this._getHeaderValue(headers, "Content-type");
	if (type && type.match(/frpc/)) {
		this._append();
	} else {
		var id = null;
		for (var p in Item.ALL) {
			if (Item.ALL[p] == this) { id = p; }
		}
		if (id) { delete Item.ALL[id]; }
	}
}

Item.prototype.setRequestData = function(data) {
	try {
		var type = this._getHeaderValue(this._requestHeaders, "Content-type");
		if (type.indexOf("base64") > -1) { data = atob(data); }
		var binary = data.split("").map(function(ch) { return ch.charCodeAt(0); })
		var result = FRPC.parse(binary);

		this._cells[1].appendChild(document.createTextNode(result.method));

		this._params = result.params;

		var button = document.createElement("button");
		button.innerHTML = "Log to Console";
		this._cells[4].appendChild(button);
		button.addEventListener("click", this._showParams.bind(this));

	} catch (e) {
		this._cells[4].appendChild(document.createTextNode("(" + e.message + ")"));
	}
}

Item.prototype.setResponseStatus = function(status) {
	this._cells[2].appendChild(document.createTextNode(status));
}

Item.prototype.setResponseHeaders = function(headers) {
	this._responseHeaders = headers;
}

Item.prototype.setResponseData = function(data) {
	try {
		var type = this._getHeaderValue(this._responseHeaders, "Content-type");
		var decoded = atob(data); // brain-damaged ff re-encodes in base64...

		if (type.indexOf("base64") > -1) { decoded = atob(decoded); }
		var binary = decoded.split("").map(function(ch) { return ch.charCodeAt(0); })
		this._response = FRPC.parse(binary);

		this._cells[3].appendChild(document.createTextNode(this._response.status));

		var button = document.createElement("button");
		button.innerHTML = "Log to Console";
		this._cells[5].appendChild(button);
		button.addEventListener("click", this._showResponse.bind(this));

	} catch (e) {
		this._cells[5].appendChild(document.createTextNode(" (" + e.message + ")"));
	}
}

Item.prototype._getHeaderValue = function(headers, name) {
	for (var i=0;i<headers.length;i++) {
		var header = headers[i];
		if (header.name.toLowerCase() == name.toLowerCase()) { return header.value; }
	}
	return null;
}

Item.prototype._append = function() {
	document.querySelector("tbody").appendChild(this._node);
}

Item.prototype._showParams = function() {
	this._show("→", this._params);
}

Item.prototype._showResponse = function() {
	this._show("←", this._response);
}

Item.prototype._show = function(prefix, data) {
	let c = toolbox.getPanel("webconsole");
	c.hud.ui.jsterm.requestEvaluation(`console.log(${JSON.stringify(prefix)}, ${JSON.stringify(data)})`);

	toolbox.selectTool("webconsole");
}
