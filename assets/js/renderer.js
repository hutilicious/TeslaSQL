// Setup libs
const $ = require('jquery');
require('jquery-resizable-dom');
const hljs = require('highlightjs');
const rangy = require('rangy/lib/rangy-selectionsaverestore.js');
const Handsontable = require('handsontable');
const striptags = require('striptags');
const mysql = require('mysql');
const sqlformatter = require('sql-formatter')
const storage = require('electron-json-storage');
const shortcutListener = require('electron').ipcRenderer;
let connection = null;
let _singleton = Symbol();
let $log = null;
let $sidebar = null;
let datagrid = null;
// Modify DB connection here
/*storage.set('connection', { server: 'localhost', user: 'huti', password: 'huti' }, function (error) {
    if (error) throw error;
});*/

// This is where we put our code, just for the hell of it
class TeslaSql
{
    /**
     * constructer cant be private, so we hack it a bit
     */
    constructor(singletonToken)
    {
        if (_singleton !== singletonToken)
        {
            throw new Error('Cannot instantiate directly.');
        }
    }

    /**
     * returns an instance to TeslaSql
     * @returns TeslaSql
     */
    static getInstance()
    {
        if (!this[_singleton])
        {
            this[_singleton] = new TeslaSql(_singleton);
        }

        return this[_singleton];
    }

    /**
     * entry point, init gui
     */
    init()
    {
        this.resize();
        this.connect(function()
        {
            TeslaSql.getInstance().query('SHOW full processlist');
        });
        this.listenToShortcuts();

        $(window).resize(this.resize);

        $log = $("#log");
        $sidebar = $("#sidebar");

        // Make panels resizeable
        $("#split-sidebar-content").resizable({
            handleSelector: "#splitter-view-log",
            resizeWidth: false,
            onDrag: this.resize,
            onDragEnd: this.resize
        });

        $("#sidebar").resizable({
            handleSelector: "#splitter-sidebar-content",
            resizeHeight: false,
            onDrag: this.resize,
            onDragEnd: this.resize
        });

        $("#tabs").resizable({
            handleSelector: "#splitter-tabs-results",
            resizeWidth: false,
            onDrag: this.resize,
            onDragEnd: this.resize
        });

        $('#query').focus();
        $('#query').keyup(function(event)
        {
            if (!event.shiftKey && !event.altKey && !event.ctrlKey)
            {
                TeslaSql.getInstance().highlightQuery();
            }
        });
        $('#query').keydown(function(event)
        {
            if (!event.shiftKey && !event.altKey && !event.ctrlKey)
            {
                TeslaSql.getInstance().highlightQuery();
            }
        });
    }
    /**
     * calculate the height of the panels
     */
    resize()
    {
        if (datagrid !== null)
        {
            datagrid.updateSettings({ height: $('#results').height(), width: $('#results').width() });
        }
    }
    /**
     * starts connection to database
     */
    connect(callbackfnc)
    {
        var _this = this;
        storage.get('connection', function(error, config)
        {
            if (error) throw error;

            connection = mysql.createConnection({
                host: config.server,
                user: config.user,
                password: config.password,
                multipleStatements: true
            });
            connection.connect();
            if ($.isFunction(callbackfnc))
            {
                callbackfnc();
            }
            _this.query('SHOW DATABASES', function(results, fields)
            {
                var arrDbs = [];
                results.forEach(function(element)
                {
                    arrDbs.push(element.Database);
                });
                arrDbs.sort();
                arrDbs.forEach(function(database)
                {
                    $sidebar.append('<div>' + database + '</div>');
                });
            });
        });
    }

    sanitizeQuery(query)
    {
        query = query.replace(/<br>/g, "\n");
        query = striptags(query);
        return query;
    }

    formatQuery()
    {
        var savedSel = rangy.saveSelection();
        var elem = $("#query");
        var savedSelElem = elem.find('.rangySelectionBoundary');
        var savedSelElemHtml = savedSelElem[0].outerHTML;
        savedSelElem.replaceWith('_TESLASQL_QUERY_CURSOR_');
        var query = this.sanitizeQuery($("#query").html());
        var formatted = sqlformatter.format(query);
        elem.html(formatted);
        elem.html(elem.html().replace('_TESLASQL_QUERY_CURSOR_', savedSelElemHtml));
        rangy.restoreSelection(savedSel);
        this.highlightQuery();
    }

    highlightQuery()
    {
        var savedSel = rangy.saveSelection();
        var html = $("#query");
        html.find('.hljs-keyword').replaceWith(function() { return this.innerHTML; });
        html.find('font').replaceWith(function() { return this.innerHTML; });
        $("#query").each(function(i, block)
        {
            hljs.highlightBlock(block);
        });

        rangy.restoreSelection(savedSel);
    }

    /**
     * runs a query with current connection
     * @param string query 
     * @param function callbackfnc 
     */
    query(query, callbackfnc)
    {
        var _this = this;
        $log.append('<div>' + sqlformatter.format(query) + '</div>');
        connection.query(query, function(error, results, fields)
        {
            try
            {
                if (error)
                {
                    throw error;
                }
                if ($.isFunction(callbackfnc))
                {
                    callbackfnc(results, fields);
                } else
                {
                    if ($.isArray(results))
                    {
                        $("#results").html('<div id="results--datagrid"></div>');

                        var container = document.getElementById('results--datagrid');
                        if (datagrid !== null)
                        {
                            datagrid.destroy();
                        }
                        datagrid = new Handsontable(container, {
                            data: results,
                            minSpareCols: 0,
                            fillHandle: false,
                            colHeaders: fields.map(function(elem) { return elem.name }),
                            columns: fields.map(function(elem) { return { data: elem.name, editor: 'text' } }),
                            minSpareRows: 0,
                            rowHeaders: false,
                            contextMenu: false,
                            manualColumnResize: true,
                            height: $('#results').height(),
                            width: $('#results').width()
                        });

						/*$("#teslasql-main-results table").containerTableFixedHeader({
							scrollContainer: $("#teslasql-main-results")
						});*/
                    } else
                    {
                        $log.append('<div>' + JSON.stringify(results) + '</div>');
                    }
                }
            } catch (err)
            {
                console.log(err);
                $log.append('<div>' + err + '</div>');
            }
            $log.scrollTop($log[0].scrollHeight);
        });
    }
    /**
     * handle shortcut events registered in main.js
     */
    listenToShortcuts()
    {
        var _this = this;
        shortcutListener.on('shortcut-pressed', function(event, arg)
        {
            if (arg == "F9")
            {
                var query = _this.sanitizeQuery($("#query").html());
                _this.query(query);
            }
            else if (arg == "F8")
            {
                _this.formatQuery();
            }
            else if (arg == "F7")
            {
                _this.highlightQuery();
            }
        });
    }
}

/**
 * void main()
 */
TeslaSql.getInstance().init();
