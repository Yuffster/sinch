# Sinch

---

Sinch is a lightweight, powerful JavaScript module which allows developers
to create APIs which act in a conistent manner regardless of whether they are
synchronous (returning their values immediately) or asynchronous (forcing the
user to utilize a callback).

Any arguments passed to a Sinch-wrapped function can be manipulated as
normal, synchronous arguments.  Using this callforward pattern, end users are
able to pass methods from one Sinch API to another without having to
understand that the operations are asynchronous at all.

When objects are passed to Sinch, they will be returned as prototype-based
JavaScript classes. Even if an instantiated object takes some time to
initialize, it may be utilized immediately in a procedural fashion, with all
data accessible at the end of the chain using callbacks, or passable to other
Sinch-based API endpoints.  Once the object has been fully initialized, all
queued commands will be run immediately, properly bound to the newly-created
scope.

Sinch also provides an Extends: keyword to objects which allows for the
recursive extension of one Sinch API by another.

## Examples

### Single Functions

Let's start with two simple asynchronous function which call other functions
with their values.

	function echo(message, callback) {
		callback("I'm echoing, "+message+".");
	}
	
	function log(message) {
		console.log(message);
	}
	
If we were to call `echo("hello world", console.log)`, we would get the response
of, "I'm echoing, hello world."  This is how traditional modules present their
asynchronous methods.

The problem with that is that the end user must create an intermediary anonymous
function each time it's necessary to pass a value from one endpoint to another.
This code would end up logging to the console, "I'm echoing, hello world."

	echo('hello world', function(message) {
		log(message);
	});
	
This is a pattern that JavaScript developers are very used to!  However, if we
were to wrap both `log` and `echo` into Sinch, we would--without sacrificing
our asynchronous nature--be able to present a much clear API to developers using
our code, which is indistinguishable from procedural code.

This code would have the exact same effect as the previous code.  In fact, the
previous code can still be used when wrapping methods in Sinch.

	log(echo(message));

Let's try something a little less abstract, and assume we're using a Sinch-
based API which handles file transfers.  We want to chain a lot of asynchrnous
file operations together in order to piece together a file, and use dynamic
arguments, with the last argument being considered a callback if it's a
function.  This also requires that we keep track of how many asynchronous
operations are pending and nest callbacks.

The code for something like this can get ugly fairly quickly!

	function cat() {
		var output, i, files = [], callback;
		function next() {
			if (!callback) return;
			for (var f in files) if (files[f]) output += files[f];
			callback(output);
		}
		for (i in arguments) {
			// Dynamic arguments; check the last argument for a callback.
			if (i==arguments.length-1 && typeof arguments[i]=="function") {
				callback = arguments[i];
			}
			pending++;
			async.file_exists(arguments[i], function(success) {
				pending--;
				if (pending==0) next();
				if (!success) return;
				pending++;
				async.file_read(arguments[i], function(data) {
					pending--;
					files[i] = data;
					if (pending==0) next();
				});
			});
		}
	}
	
	cat('readme.txt', 'file.txt', 'other.txt', console.log);
	
Assuming we didn't want to reinvent the file API, we could refactor the same
code using Sinch to be much easier to understand, more pleasant to use, and
far less error prone.

	function cat() {
		var output = "";
		for (var i in arguments) output += arguments[i];
		return output;
	}); cat = Sinch(cat);
	
	function read(file, callback) {
		async.file_exists(file, function(exists) {
			if (!exists) callback('');
			else async.file_read(file, callback);
		});
	}; read = Sinch(read);
	
	cat(read('readme.txt'), read('file.txt'), read('other.txt'))(console.log);

We could even make the example do even more advanced things without sacrificing
readability or adding much code.

	function get(url) { $.ajax(url, callback); }
	get = Sinch(get);
	
	cat(read('readme.txt'), get('data.json'), read('other.txt'))(console.log);
	
And, since Sinch doesn't modify the original values of the objects passed
into it, and follows the same standard callback pattern of other JavaScript
code, we could simply our code even further.

	get = Sinch($.ajax);

### Objects

If we pass an object into Sinch, we'll get back a constructor function with
methods attached to its prototype.

	var Database = Sinch({
		
		dblib: require('dblib'),
		
		execute: function(op) {
			return this.dblib.execute(op);
		},
		
		find: function(filter, callback) {
			this.execute('find '+filter, callback);
		}
		
	});
	
	var db = new Database();
	db.find('id=1', console.log);
	
We have two magic property names within this object, `init` and `Extends`.

### Asynchronous Initialization

Providing an init method tells Sinch that this object will take some time to
initialize, and that its interface should be presented through a dummy mechanism
and then queued to be later executed when the object is ready.

For example:

	var Database = Sinch({
	
		// [...]
		init: function(server, db, callback) {
			this.dblib.connect(server, db, function() {
				callback();
			});
		}
		
	});

Note that we can use the exact same code from the previous example to utilize
the Database API.  Each method will be executed when all required objects have
initialized.

	var db = new Database();
	db.find('id=1', console.log);

### Extending 

We could also use `Extends` to extend one API from another.

	var LiteDB = Sinch({
	
		Extends: Database,
		
		dblib: require('dblite')
		
	});

### Interfaces

With the simple use of a `[type, function]` syntax within object definition, you
can let Sinch know it should return a dummy interface of *type*, and run it
once everything has been initialized.

	var Cat = Sinch({
	
		init: function(name, callback) {
			console.log("Waking up a cat named", name);
			setTimeout(callback, 1000);
		},
		
		catchMouse: [Mouse, function() { 
			return new Mouse();
		}]
		
	});

This allows the user of the interface to work with the returned object as if it
were immediately available.

	new Cat('Meow-Meow').catchMouse().squeak(console.log);
	
Notice that in catchMouse, we can type simply, `return new Mouse()`, despite the
fact that the Mouse won't finish loading immediately, nor will the Cat!

All of the above methods of writing code are designed to work together.  Try
them out and see which patterns seem cleanest to you.

## Roadmap

* Error handling with traditional `(e,data)` callback structure.
* Configurable timeouts which throw errors