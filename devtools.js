const devtools = (window.browser ? browser : chrome).devtools;

devtools.panels.create("FastRPC", "icon-48.png", "panel.html");
