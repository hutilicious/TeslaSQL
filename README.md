# TeslaSQL
A HeidiSQL like SQL management tool written in HTML and Javascript using electron.  
![TeslaSQL screenshot](https://raw.githubusercontent.com/hutilicious/TeslaSQL/master/TeslaSQL.png "TeslaSQL screenshot")

## Getting started
Caution: TeslaSQL is in a really early state.

Start by cloning this repo to your drive:

`git clone https://github.com/hutilicious/TeslaSQL`

You have to edit "assets/js/renderer.js" in order to get a connection. Remove the comments from this line at the top of the file and edit the connection params:  

`/*storage.set('connection', { server: 'localhost', user: 'huti', password: 'huti' }, function (error) {
    if (error) throw error;
});*/`

If this is your first time running TeslaSQL you'll have to install the dependencies:  

`npm install`

Then start the program with:  

`npm start`

Your connection params will now get stored on your drive. You have to close and restart the application now in order to connect to your server.