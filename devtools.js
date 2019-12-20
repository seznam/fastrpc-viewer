const devtools = (window.browser ? browser : chrome).devtools;

devtools.panels.create("FastRPC", "icon.svg", "panel.html");
