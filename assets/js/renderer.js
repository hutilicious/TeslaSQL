// Setup libs
const $ = require('jquery');
require('jquery-resizable-dom');
const rangy = require('rangy/lib/rangy-selectionsaverestore.js');
const Handsontable = require('handsontable');
const striptags = require('striptags');
const mysql = require('mysql');
const sqlformatter = require('sql-formatter')
const storage = require('electron-json-storage');
const shortcutListener = require('electron').ipcRenderer;
let connection = null;
let _singleton = Symbol();
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
        this.bolLoggedSomething = false;
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
            TeslaSql.getInstance().query('SHOW FULL PROCESSLIST');
        });
        this.listenToShortcuts();

        $(window).resize(this.resize);

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

        var _this = this;

        $(document).on('dblclick', '.database-entry', function()
        {
            var $elem = $(this);
            if (!$elem.hasClass("open"))
            {
                _this.query('USE ' + $elem.data("database"), function()
                {
                    $('.database-entry').removeClass('in-use');
                    $elem.addClass("in-use");
                    _this.query('SHOW TABLES FROM ' + $elem.data("database"), function(results, fields)
                    {
                        var arrTables = [];
                        results.forEach(function(element)
                        {
                            var key = "";
                            for (key in element) break;
                            arrTables.push(element[key]);
                        });
                        arrTables.sort();
                        var htmlTables = '<div class="table-list">';
                        arrTables.forEach(function(table)
                        {
                            htmlTables += '<div class="table-entry list-entry" data-table="' + table + '"><span class="list-icon-container"><img class="list-icon" src="../icons/table.svg" /></span><span class="list-title">' + table + '</span></div>';
                        });
                        htmlTables += '</div>';
                        $elem.after(htmlTables);
                        $elem.addClass("open");
                    });
                });
            }
            else
            {
                // close database
                $elem.removeClass("open").next().remove();
            }
        });
        $(document).on('click', '.table-entry', function()
        {
            var $elem = $(this);
            if (!$elem.hasClass("open"))
            {
                _this.query('SELECT * FROM ' + $elem.data("table") + ' LIMIT 0,1000', function()
                {
                    $('.table-entry').removeClass('open');
                    $elem.addClass("open");
                }, true);
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
        $('.CodeMirror').each(function(i, el)
        {
            el.CodeMirror.refresh();
        });
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
                var htmlDatabases = '<div class="databases-list">';
                arrDbs.forEach(function(database)
                {
                    htmlDatabases += '<div class="database-entry list-entry" data-database="' + database + '"><span class="list-icon-container"><img class="list-icon" src="../icons/database.svg" /></span><span class="list-title">' + database + '</span></div>';
                });
                htmlDatabases += '</div>';
                $sidebar.html(htmlDatabases);
            });
        });
    }

    sanitizeString(query)
    {
        query = query.replace(/\s+/g, " ");
        query = $.trim(query);
        return query;
    }

    formatQuery()
    {
        var query = window.editor.getValue();
        window.editor.setValue(sqlformatter.format(query));
        window.editor.setCursor({ line: 2, ch: 5 });
    }

    log(string, bolComment)
    {
        var output = "";
        if (this.bolLoggedSomething)
        {
            output = "\n";
        }
        if (bolComment === true)
        {
            output += '/* ';
        }
        output += this.sanitizeString(string);
        if (bolComment === true)
        {
            output += ' */';
        }
        window.log.replaceRange(output, CodeMirror.Pos(window.log.lastLine()));
        window.log.scrollTo(0, window.log.getScrollInfo().height);
        this.bolLoggedSomething = true;
    }

    /**
     * runs a query with current connection
     * @param string query 
     * @param function callbackfnc 
     */
    query(query, callbackfnc, bolDisplayResult)
    {
        var _this = this;
        this.log(query);
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
                }
                if (bolDisplayResult === true || !$.isFunction(callbackfnc))
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
                            readOnly: true,
                            colWidths: 150,
                            beforeChange: function(changes, source)
                            {
                                console.log(changes);
                            },
                            height: $('#results').height(),
                            width: $('#results').width()
                        });
                    } else
                    {
                        _this.log(JSON.stringify(results));
                    }
                }
            } catch (err)
            {
                _this.log(err.toString(), true);
            }
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
                var query = window.editor.getValue();
                _this.query(query);
            }
            else if (arg == "F8")
            {
                _this.formatQuery();
            }
            else if (arg == "F7")
            {
                // no action
            }
        });
    }
}

/**
 * void main()
 */
TeslaSql.getInstance().init();
