![Sinch](logo.png)

---

[![Build Status](https://secure.travis-ci.org/Yuffster/sinch.png)](http://travis-ci.org/Yuffster/sinch)

---

Sinch sends your asynchronous code into a **patent-pending parallel dimension** 
where time has no meaning and everything acts as though it's synchronous.

Don't worry, your code will still run asynchronously, just the way your wrote
it.  Sinch isn't some sort of fly-by-night snake oil that promises the moon and
delivers an empty bottle of promises.

Even if Sinch *were* snake oil, it would be the classy kind of snake oil that's
actually fine whiskey and only pretends to be medicinal to get around
Prohibition-era liquor laws. Except in this case, think of "medicinal" as
"synchronous" and "Prohibition-era liquor laws" as "callbacks", and "fine
whiskey" as "rock-solid code with a full test barrage and one dead-simple API
method."

Why would you ever go back to drinking bathtub hooch?

So nudge nudge, wink wink, why not enjoy our "synchronous" API?

Want to return objects from asynchronous calls and call methods of those objects
*immediately*?  Go ahead.

Want to follow the convention of having your callbacks as the last argument, 
but hate having to shift variables around for optional parameters?  That
doesn't exist at all in our parallel dimension.

Want to be able to use callbacks or return statements where they makes sense,
but have your classes and APIs always work consistently?  Done.

Want to protect your interface's object internal data from pesky developers?
That's automatic.

Want to chain procedurally asynchronous interfaces which return other
asynchronous interfaces without executing a single thing until you need the 
data?  You can do that now.

Want to pass the results of an asynchronous method to any other function as if 
it were a normal everyday argument?  You can do that.  No, really.

Want to make make an asynchronous GET request to a remote server, and pass 
it to a method that looks in the content to see if there are any bees specified,
then spawns and returns a new BeeCollection(), full of buzzy asynchronous
bees who only exist in the future, which you can then manipulate at will, and
then pass that BeeCollection into a Template class that outputs a HTML list of
all your favorite bees, along with their temperaments, all without writing a 
single callback?  It's a little bit of an odd request, but you can totally do
that.

You might be asking yourself, *How is this even possible?*, and hoping that
I'd stop talking about parallel dimensions and 1920's American history and just
tell you how the damn thing works.

Sinch uses a callback at the very end of your execution chain to see what
data came from all of it, which kicks off a huge queue of everything leading up
to that value.  When you pass the "results" of Sinch API operation to another
Sinch function, the data will be desynchronized using a hidden callback before
being passed into the other Sinch function.

---

## Boring Technical Description 

Sinch is a lightweight, powerful JavaScript module which allows developers
to create APIs which act in a consistent manner regardless of whether they are
synchronous (returning their values immediately) or asynchronous (forcing the
user to utilize a callback).

Any arguments passed to a Sinch-wrapped function can be manipulated as
normal, synchronous arguments.  Using this call-forward pattern, end users are
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

	var echo = sinch(function(message, callback) {
		this.callback("I'm echoing, "+message+".");
	});
	
	var log = sinch(function(message) {
		console.log(message);
	});

	log(echo(message));

Let's try something a little less abstract, and assume we're using a Sinch-
based API which handles file transfers.  We want to chain a lot of asynchronous
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
	}); cat = sinch(cat);
	
	function read(file, callback) {
		async.file_exists(file, function(exists) {
			if (!exists) callback('');
			else async.file_read(file, callback);
		});
	}; read = sinch(read);
	
	cat(read('readme.txt'), read('file.txt'), read('other.txt'), console.log);

We could even make the example do even more advanced things without sacrificing
readability or adding much code.

	function get(url) { $.ajax(url, callback); }
	get = sinch(get);
	
	cat(read('readme.txt'), get('data.json'), read('other.txt'), console.log);
	
And, since Sinch doesn't modify the original values of the objects passed
into it, and follows the same standard callback pattern of other JavaScript
code, we could simply our code even further.

	get = sinch($.ajax);

### Dynamic Arguments

Sinch provides `this.callback` to all wrapped functions and methods to allow 
for explicit callback support, which means when we're traversing a dynamic 
arguments list, we don't have to manually check the last argument and infer
whether or not it's meant to be a callback.

Otherwise, you'd have to do something like this in every function which takes
dynamic arguments and a callback:

	for (var i in arguments) {
		if (i==arguments.length-1 && typeof arguments[i]=="function") {
			callback = arguments[i];
		} else {
			//Do your stuff here.
		}
	}

### Optional Parameters with Callback Support

It also means we can support optional parameters, and error check on them, 
without having to worry about an argument possibly being a callback
instead of what we're expecting.

For example, let's say we want to create a function called outputMessage with
an optional second parameter, and by convention the callback parameter is 
always last.

Without Sinch, we would have to do this:

	function outputMessage(msg,name,cb) {
		if (typeof name=="function") {
			cb = name;
			name = "Someone";
		}
		return name+" said: ", msg;
	}

However, using Sinch, we can make the code much more readable, and focus on
application logic rather than parsing our arguments.

	var outputMessage = sinch(function(msg,name) {
		name = name || "Someone";
		return name+" said: "+ msg;
	});

Or, asynchronously:

	var outputMessage = sinch(function(msg,name) {
		name = name || "Someone";
		this.callback(name+" said: "+ msg);
	});

### Objects

If we pass an object into Sinch, we'll get back a constructor function with
methods attached to its prototype.

	var Database = sinch({
		
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

	var Database = sinch({
	
		// [...]
		init: function(server, db) {
			var callback = this.callback;
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

	var LiteDB = sinch({
	
		Extends: Database,
		
		dblib: require('dblite')
		
	});

### Interfaces

With the simple use of a `[type, function]` syntax within object definition, you
can let Sinch know it should return a dummy interface of *type*, and run it
once everything has been initialized.

	var Cat = sinch({
	
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
fact that Mouse might or might not finish loading immediately, and Cat
definitely won't.

All of the above methods of writing code are designed to work together.  Try
them out and see which patterns seem cleanest to you.

## Roadmap

* Error handling with traditional `(e,data)` callback structure.
* Configurable timeouts which throw errors