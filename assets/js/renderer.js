// Setup libs
const $ = require('jquery');
require('jquery-resizable-dom');
//require('jquery-table-fixed-header');
const Handsontable = require('handsontable');
const mysql = require('mysql');
const sqlformatter = require('sql-formatter');
const storage = require('electron-json-storage');
const shortcutListener = require('electron').ipcRenderer;
let connection = null;
let _singleton = Symbol();
let datagrid = null;
// Modify DB connection here
/*storage.set('connection', { server: 'localhost', user: 'huti', password: 'huti' }, function (error) {
    if (error) throw error;
});*/

// This is where we put our code, just for the hell of it
class TeslaSql {
    /**
     * constructer cant be private, so we hack it a bit
     */
    constructor(singletonToken) {
        if (_singleton !== singletonToken) {
            throw new Error('Cannot instantiate directly.');
        }
    }

    /**
     * returns an instance to TeslaSql
     * @returns TeslaSql
     */
    static getInstance() {
        if (!this[_singleton]) {
            this[_singleton] = new TeslaSql(_singleton);
        }

        return this[_singleton];
    }

    /**
     * entry point, init gui
     */
    init() {
        this.resize();
        this.connect();
        this.listenToShortcuts();

        $(window).resize(this.resize);

        // Make panels resizeable
        $("#teslasql-sidebar").resizable({
            handleSelector: "#teslasql-resize-v",
            resizeHeight: false,
			onDragStart: this.resize,
			onDrag: this.resize,
            onDragEnd: this.resize
        });

        $("#teslasql-panel-container").resizable({
            handleSelector: "#teslasql-resize-log",
            resizeWidth: false,
            onDragStart: this.resize,
			onDrag: this.resize,
            onDragEnd: this.resize
        });

        $("#teslasql-main-top").resizable({
            handleSelector: "#teslasql-resize-results",
            resizeWidth: false,
            onDragStart: this.resize,
			onDrag: this.resize,
            onDragEnd: this.resize
        });

        $('#teslasql-cmd').focus();
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
		if (datagrid !== null) datagrid.render();
		//$("#teslasql-main-results").trigger("scroll"); // fixed header table refresh
    }
    /**
     * starts connection to database
     */
    connect() {
        var _this = this;
        storage.get('connection', function (error, config) {
            if (error) throw error;

            connection = mysql.createConnection({
                host: config.server,
                user: config.user,
                password: config.password
            });
            connection.connect();
            _this.query('SHOW DATABASES', function (results, fields) {
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
    }
    /**
     * runs a query with current connection
     * @param string query 
     * @param function callbackfnc 
     */
    query(query, callbackfnc) {
        var _this = this;
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
                } else {
                    if ($.isArray(results)) {
							console.log(fields.map(function(elem){return elem.name}));
							//$("#teslasql-main-results").html(_this.renderResultsTable(results, fields));
						
							var container = document.getElementById('teslasql-main-results');
							if (datagrid !== null)
							{
								datagrid.destroy();
							}
							datagrid = new Handsontable(container, {
							  data: results,
							  minSpareCols: 1,
							  fillHandle : false,
							  colHeaders : fields.map(function(elem){return elem.name}),
							  columns : fields.map(function(elem){return {data:elem.name,editor:'text'}}),
							  minSpareRows: 1,
							  rowHeaders: false,
							  contextMenu: true,
							 manualColumnResize: true
							});
						
						/*$("#teslasql-main-results table").containerTableFixedHeader({
							scrollContainer: $("#teslasql-main-results")
						});*/
                    } else {
                        $("#teslasql-log").append('<div>' + JSON.stringify(results) + '</div>');
                    }
                }
            } catch (err) {
                $("#teslasql-log").append('<div>' + err + '</div>');
            }
            $("#teslasql-log").scrollTop($("#teslasql-log")[0].scrollHeight);
        });
    }
    /**
     * takes resulsts array and fields array and returns html of the table
     * @param array results 
     * @param array fields 
     */
    renderResultsTable(results, fields) {
        var html = '<table class="bordered">';
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

        return html;
    }
    /**
     * handle shortcut events registered in main.js
     */
    listenToShortcuts() {
        var _this = this;
        shortcutListener.on('shortcut-pressed', function (event, arg) {
            if (arg == "F9") {
                var query = $("#teslasql-cmd").val();
                _this.query(query);
            }
        });
    }
}

/**
 * void main()
 */
TeslaSql.getInstance().init();
