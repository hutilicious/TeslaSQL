// Setup libs
const $ = require('jquery');
require('jquery-resizable-dom');


// Make panels resizeable
$(".panel-left").resizable({
    handleSelector: ".splitter",
    resizeHeight: false
});

$(".panel-container").resizable({
    handleSelector: ".splitter-horizontal",
    resizeWidth: false
});