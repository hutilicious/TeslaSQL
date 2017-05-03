// Setup libs
const $ = require('jquery');
require('jquery-resizable-dom');
const mysql = require('mysql');
const storage = require('electron-json-storage');
const ipcRenderer = require('electron').ipcRenderer;
var connection = null;

/*storage.set('connection', { server: 'localhost', user: 'huti', password: 'huti' }, function (error) {
    if (error) throw error;
});*/

ipcRenderer.on('hotkey-pressed', function(event, arg) {
    console.log('In renderer again');
});

// Make panels resizeable
$("#teslasql-sidebar").resizable({
    handleSelector: "#teslasql-resize-v",
    resizeHeight: false
});

$("#teslasql-panel-container").resizable({
    handleSelector: "#teslasql-resize-h",
    resizeWidth: false
});

$("#mysql-test").click(function () {
    storage.get('connection', function (error, config) {
        if (error) throw error;

        connection = mysql.createConnection({
            host: config.server,
            user: config.user,
            password: config.password
        });
        connection.connect();
        connection.query('SHOW DATABASES', function (error, results, fields) {
            if (error) throw error;

            var arrDbs = [];
            results.forEach(function (element) {
                arrDbs.push(element.Database);
            });
            arrDbs.sort();
            arrDbs.forEach(function (database) {
                $("#teslasql-sidebar").append('<div>' + database + '</div>');
            });
        });
    });
});

$("#mysql-execute").click(function () {
    var query = $("#teslasql-cmd").val();
    connection.query(query, function (error, results, fields) {
        if (error) throw error;

        $("#teslasql-log").append('<div>' + query + '</div>');
        $("#teslasql-log").append('<div>' + JSON.stringify(results) + '</div>');
    });
});