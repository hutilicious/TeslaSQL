// Setup libs
const $ = require('jquery');
require('jquery-resizable-dom');
const mysql = require('mysql');
const sqlformatter = require('sql-formatter');
const storage = require('electron-json-storage');
const ipcRenderer = require('electron').ipcRenderer;
var connection = null;

/*storage.set('connection', { server: 'localhost', user: 'huti', password: 'huti' }, function (error) {
    if (error) throw error;
});*/

class TeslaSql {
    constructor(height, width) {
        this.height = height;
        this.width = width;
    }
    init() {
        this.resize();
        this.connect();
    }
    /**
     * calculate the height of the panels
     */
    resize() {
        var height = $('#teslasql-panel-container').outerHeight() + $('#teslasql-resize-log').outerHeight();
        var heightMax = $(window).height();
        $('#teslasql-log').height(heightMax - height);
        $('#teslasql-main').height($('#teslasql-panel-container').height());
        $('#teslasql-resize-v').height($('#teslasql-panel-container').height());
        $('#teslasql-main-results').height($('#teslasql-panel-container').height() - $('#teslasql-main-top').outerHeight() - $('#teslasql-resize-results').outerHeight());
    }
    /**
     * starts connection to database
     */
    connect() {
        storage.get('connection', function (error, config) {
            if (error) throw error;

            connection = mysql.createConnection({
                host: config.server,
                user: config.user,
                password: config.password
            });
            connection.connect();
            this.query('SHOW DATABASES', function (results, fields) {
                var arrDbs = [];
                results.forEach(function (element) {
                    arrDbs.push(element.Database);
                });
                arrDbs.sort();
                arrDbs.forEach(function (database) {
                    $("#teslasql-sidebar").append('<div>' + database + '</div>');
                });
            });
        }.bind(this));
    }
    /**
     * runs a query with current connection
     * @param string query 
     * @param function callbackfnc 
     */
    query(query, callbackfnc) {
        const astObj = sqlformatter.format(query);
        console.log(astObj);
        $("#teslasql-log").append('<div>' + query + ';</div>');
        connection.query(query, function (error, results, fields) {
            try {
                if (error) {
                    throw error;
                }
                if ($.isFunction(callbackfnc)) {
                    callbackfnc(results, fields);
                }
                else {
                    if ($.isArray(results)) {
                        var html = '<table>';
                        html += '<tr>';
                        fields.forEach(function (field) {
                            html += '<th>' + field.name + '</th>';
                        });
                        html += '</tr>';
                        results.forEach(function (row) {
                            html += '<tr>';
                            fields.forEach(function (field) {
                                html += '<td>' + row[field.name] + '</td>';
                            });
                            html += '</tr>';
                        });
                        html += '</table>';
                        $("#teslasql-main-results").html(html);
                    }
                    else {
                        $("#teslasql-log").append('<div>' + JSON.stringify(results) + '</div>');
                    }
                }
            }
            catch (err) {
                $("#teslasql-log").append('<div>' + err + '</div>');
            }
            $("#teslasql-log").scrollTop($("#teslasql-log")[0].scrollHeight);
        });
    }
}

var teslaSql = new TeslaSql(500, 500);

$(window).resize(teslaSql.resize);
teslaSql.init();

ipcRenderer.on('hotkey-pressed', function (event, arg) {
    if (arg == "F9") {
        var query = $("#teslasql-cmd").val();
        teslaSql.query(query);
    }
});

// Make panels resizeable
$("#teslasql-sidebar").resizable({
    handleSelector: "#teslasql-resize-v",
    resizeHeight: false
});

$("#teslasql-panel-container").resizable({
    handleSelector: "#teslasql-resize-log",
    resizeWidth: false,
    onDrag: teslaSql.resize,
    onDragEnd: teslaSql.resize
});

$("#teslasql-main-top").resizable({
    handleSelector: "#teslasql-resize-results",
    resizeWidth: false,
    onDrag: teslaSql.resize,
    onDragEnd: teslaSql.resize
});