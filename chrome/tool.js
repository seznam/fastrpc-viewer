/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
let devtools = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools

XPCOMUtils.defineLazyModuleGetter(this, "EventEmitter",
  "resource://gre/modules/devtools/event-emitter.js");
XPCOMUtils.defineLazyModuleGetter(this, "promise",
  "resource://gre/modules/commonjs/sdk/core/promise.js", "Promise");

XPCOMUtils.defineLazyGetter(this, "toolStrings", () =>
  Services.strings.createBundle("chrome://fastrpc/locale/strings.properties"));

/**
 * This file has access to the `window` and `document` objects of the add-on's
 * iframe, and is included in tool.xul. This is the add-on's controller.
 */

var webConsoleClient = null;
var target = null;
var toolbox = null;

/**
 * Called when the user select the tool tab.
 *
 * @param Toolbox toolbox
 *        The developer tools toolbox, containing all tools.
 * @param object target
 *        The local or remote target being debugged.
 * @return object
 *         A promise that should be resolved when the tool completes opening.
 */
function startup(_toolbox, _target) {
	target = _target;
	toolbox = _toolbox;
	/*
  toolbox.selectTool("webconsole").then(function(webconsole) {

	  var consoleEvent = {
	    ID: "jsm",
	    level: "log",
	    filename: "x",
	    lineNumber: "y",
	    functionName: "z",
	    timeStamp: Date.now(),
	    arguments: ["aaaaa", "bbbb"]
	  };

	  consoleEvent.wrappedJSObject = consoleEvent;

  	webconsole.hud.ui.logConsoleAPIMessage(consoleEvent);
  });
*/

  target.client.attachConsole(target.form.consoleActor, ["NetworkActivity"], function(response, _webConsoleClient) {
  	webConsoleClient = _webConsoleClient;
  	var prefs = { "NetworkMonitor.saveRequestAndResponseBodies": true };
	webConsoleClient.setPreferences(prefs, function() {
		target.client.addListener("networkEvent", onNetworkEvent);
		target.client.addListener("networkEventUpdate", onNetworkEventUpdate);
	});
  });
  target.on("will-navigate", onWillNavigate);

  document.querySelector("button").addEventListener("click", onWillNavigate);

  return promise.resolve();
}

/**
 * Called when the user closes the toolbox or disables the add-on.
 *
 * @return object
 *         A promise that should be resolved when the tool completes closing.
 */
function shutdown() {
  return promise.resolve();
}

function onWillNavigate() {
	Item.ALL = {};
	document.querySelector("tbody").innerHTML = "";
}

function onNetworkEvent(name, packet) {
	var url = packet.eventActor.url;
	Item.ALL[packet.eventActor.actor] = new Item(url);
}

function onNetworkEventUpdate(name, packet) {
	var actor = packet.from;
	switch (packet.updateType) {
		case "requestHeaders":
			webConsoleClient.getRequestHeaders(actor, onRequestHeaders);
		break;
		case "requestPostData":
			webConsoleClient.getRequestPostData(actor, onRequestPostData);
		break;
		case "responseStart":
			onResponseStart(packet);
		break;
		case "responseHeaders":
			webConsoleClient.getResponseHeaders(actor, onResponseHeaders);
		break;
		case "responseContent":
			webConsoleClient.getResponseContent(actor, onResponseContent);
		break;
	}
}

function onRequestHeaders(data) {
	var item = Item.ALL[data.from];
	item && item.setRequestHeaders(data.headers);
}

function onRequestPostData(data) {
	var item = Item.ALL[data.from];
	item && item.setRequestData(data.postData.text);
}

function onResponseStart(data) {
	var item = Item.ALL[data.from];
	item && item.setResponseStatus(data.response.status);
}

function onResponseHeaders(data) {
	var item = Item.ALL[data.from];
	item && item.setResponseHeaders(data.headers);
}

function onResponseContent(data) {
	var item = Item.ALL[data.from];
	item && item.setResponseData(data.content.text);
}

