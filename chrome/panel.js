/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { require, loader } = Components.utils.import("resource://devtools/shared/Loader.jsm", {});

this.EXPORTED_SYMBOLS = ["FastRPCPanel"];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const { Task } = require("resource://gre/modules/Task.jsm");
loader.lazyRequireGetter(this, "Services");
loader.lazyRequireGetter(this, "promise");
loader.lazyRequireGetter(this, "EventEmitter", "devtools/shared/event-emitter");

/**
 * This is the add-on's panel, wrapping the tool's contents.
 *
 * @param nsIDOMWindow iframeWindow
 *        The iframe window containing the tool's markup and logic.
 * @param Toolbox toolbox
 *        The developer tools toolbox, containing all tools.
 */
function FastRPCPanel(iframeWindow, toolbox) {
  this.panelWin = iframeWindow;
  this.toolbox = toolbox;
  EventEmitter.decorate(this);
};

FastRPCPanel.prototype = {
  get target() this._toolbox.target,

  /**
   * Open is effectively an asynchronous constructor.
   * Called when the user select the tool tab.
   *
   * @return object
   *         A promise that is resolved when the tool completes opening.
   */
  open: Task.async(function*() {
    yield this.panelWin.startup(this.toolbox, this.target);
    this.isReady = true;
    this.emit("ready");
    return this;
  }),

  /**
   * Called when the user closes the toolbox or disables the add-on.
   *
   * @return object
   *         A promise that is resolved when the tool completes closing.
   */
  destroy: Task.async(function*() {
    yield this.panelWin.shutdown();
    this.isReady = false;
    this.emit("destroyed");
  })
};

this.EXPORTED_SYMBOLS = ["MyAddonPanel"];
