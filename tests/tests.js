var sinch    = require('../sinch'),
    get      = require('./waiter');

// We can use normal everyday return statements and still pretend the
// code is asynchronous on the other end, when we want to.
var sync = sinch(function(mess) { 
	return "returned: "+mess;
});

// Or we can take the same code and use a traditional callback style.
var async = sinch(
	function(mess) { this.callback("called back: "+mess); }
);

// This allows us to either explicitly use a callback, as normal...
sync(
	'synchronous with traditional callback',
	get("returned: synchronous with traditional callback")
);

// Or pass the operation around and then utilize the callback response when
// it's ready.
sync('synchronous called later')(get("returned: synchronous called later"));

async('async called later')(get("called back: async called later"));

async('async with traditional callback', get(
	"called back: async with traditional callback"
));

var add_sync_cb = sinch(function() { 
	var n = 0, cb = arguments[arguments.length-1];
	if (typeof cb != "function") cb = false;
	for (var i in arguments) if (arguments[i]!=cb) n += arguments[i];
	return n;
});

var add_async_cb = sinch(function() {
	var n = 0, cb = arguments[arguments.length-1];
	if (typeof cb != "function") cb = false;
	for (var i in arguments) if (arguments[i]!=cb) n += arguments[i];
	this.callback(n);
});

// Dynamic arguments are fine, as long as the last function can be a callback.
add_async_cb(1,2,3,4,5)(get(15));
add_async_cb(1,2,3,4,5,get(15));

add_sync_cb(1,2,3,4,5,get(15));

var add_sync = sinch(function() { 
	var n = 0;
	for (var i in arguments) n += arguments[i];
	return n;
});

var add_async = sinch(function() {
	var n = 0;
	for (var i in arguments) n += arguments[i];
	this.callback(n);
});

add_async(1,2,3,4,5)(get(15));
add_async(1,2,3,4,5,get(15));
add_sync(1,2,3,4,5,get(15));


// We can pass the results of one API method to another as if the APIs were
// synchronous.
async(add_async(2,3,4))(get("called back: 9"));
add_async(add_async(12), add_async(22))(get(34));
async(add_async(add_async(12), add_async(22)))(get("called back: 34"));

// This works as expected no matter how much weird stuff we do.
add_async(4,2,add_async(add_async(3,3)), add_sync(22))(get(34));

// Wrapping all of our functions individually is a little annoying.
// Let's just wrap every function within an object.

var Sync = sinch({
	
	add: function() { 
		var n = 0, cb = arguments[arguments.length-1];
		if (typeof cb != "function") cb = false;
		for (var i in arguments) {
			if (arguments[i]!==cb) n += arguments[i];
		} return n;
	},
	
	log: function(mess) {
		return "Returned: "+mess;
	}
	
});

sync = new Sync();

var Async = sinch({
	
	// We can support object properties like in normal objects.
	total: 0,

	add: function() { 
		var n = 0, cb = arguments[arguments.length-1];
		if (typeof cb != "function") cb = false;
		for (var i in arguments) {
			if (arguments[i]!==cb) n += arguments[i];
		} this.callback(n);
	},
		
	log: function(mess) {
		this.callback("Called back: "+mess);
	},
	
	count: function() {
		this.total++;
		return "Count has been called "+this.total+" times.";
	}

});

async = new Async();

// Let's run everything through its paces again using the objects instead of
// single methods.

sync.log(
	'synchronous with traditional callback', 
	get("Returned: synchronous with traditional callback")
);
sync.log('synchronous called later')(
	get("Returned: synchronous called later")
);
async.log('async called later')(
	get("Called back: async called later")
);
async.log(
	'async with traditional callback',
	get("Called back: async with traditional callback")
);

async.add(1,2,3,4,5, get(15));
async.add(1,2,3,4,5)(get(15));
sync.add(1,2,3,4,5,get(15));
sync.add(1,2,3,4,5)(get(15));

async.log(async.add(2,3,4))(get("Called back: 9"));
async.add(async.add(12), async.add(22))(get(34));
async.log(async.add(add_async(12), async.add(22)))(get("Called back: 34"));
async.add(4,2,add_async(add_async(3,3)),add_async(22))(get(34));
sync.add(1,2,3,4)(get(10));

async.count(get("Count has been called 1 times."));
async.count(get("Count has been called 2 times."));
async.count(get("Count has been called 3 times."));

// We can also queue methods from asynchronously initialized objects which 
// return (traditionally or asynchronously) objects by defining the function
// as an interface.

// Let's make a Mouse object to be returned as our type.

var Mouse = sinch({

	counts: { squeak: 0, sniff: 0 },

	init: function(name) {
		this.name = name;
		this.callback();
	},

	squeak: function() {
		var sez;
		this.counts.squeak++;
		if (this.counts.squeak>2) {
			this.counts.sniff++;
			sez = "sniffs ("+this.counts.sniff+")";
		} else sez = "squeaks ("+this.counts.squeak+")";
		return this.name+" the mouse "+sez;
	}
	
});

var mouse = new Mouse('Mortimer');
mouse.squeak()(get("Mortimer the mouse squeaks (1)"));
mouse.squeak(get("Mortimer the mouse squeaks (2)"));
mouse.squeak(get("Mortimer the mouse sniffs (1)"));

// Let's define a Cat so we have something to return a Mouse instance.

var Cat = sinch({

	counts: {'meow':0, 'meh':0},

	// For asynchronous initializations, we want to return the 
	// interface of the object and queue everything until the
	// callback is returned.
	init: function(name) {
		var self = this;
		setTimeout(function() {
			self.name = name;
			self.callback();
		}, 200);
	},

	meow: function() {
		this.counts.meow++;
		var sez;
		if (this.counts.meow>2) {
			this.counts.meh++;
			sez = "meh("+this.counts.meh+")";
		} else sez = "meow! ("+this.counts.meow+")";
		return this.name+" the cat sez: "+sez;
	},

	hiss: function() {
		return this.name+" the cat hisses.";
	},

	// Notice the definition format here. It's an array with an argument of
	// the type we want to return, followed by the actual function. There's
	// nothing special about this; it's just the nicest definition syntax I 
	// could find.
	catchMouse: [Mouse, function(name) {
		// And we can return the mouse directly if we want to. Its queue will
		// only be triggered when it is finished initilizing.
		return new Mouse(name);
	}]

});


var kitty = new Cat('Meowseph'), catty = new Cat('Mimi');
kitty.meow()(get("Meowseph the cat sez: meow! (1)"));
kitty.meow()(get("Meowseph the cat sez: meow! (2)"));
kitty.meow()(get("Meowseph the cat sez: meh(1)"));

catty.meow()(get("Mimi the cat sez: meow! (1)"));
catty.meow(get("Mimi the cat sez: meow! (2)"));
catty.meow(get("Mimi the cat sez: meh(1)"));

catty.catchMouse("Mousey").squeak(
	get("Mousey the mouse squeaks (1)")
);

catty.meow(get("Mimi the cat sez: meh(2)"));

async.log(new Cat("Meowstopher").meow())(
	get("Called back: Meowstopher the cat sez: meow! (1)")
);

async.log(
	new Cat("Doris").catchMouse('Ralph').squeak(), 
	get("Called back: Ralph the mouse squeaks (1)")
);

async.log(
	new Cat("Steve").meow(), 
	get("Called back: Steve the cat sez: meow! (1)")
);

sync.log(new Cat("Kitty").meow())(
	get("Returned: Kitty the cat sez: meow! (1)")
);

sync.log(
	new Cat("Katty").meow(), 
	get("Returned: Katty the cat sez: meow! (1)")
);

catty.meow(get("Mimi the cat sez: meh(3)"));

// We can also extend objects by using the Extends magic property.  Tiger will
// have everything associated with Cat, including the recursive merge into the
// counts object.
var Tiger = sinch({

	Extends: Cat,

	counts: { 'roars': 0 },

	roar: function() {
		this.counts.roars++;
		return this.name+" the tiger roars. ("+this.counts.roars+")";
	}

});

// And now that Tiger is defined, we can extend the Cat prototype to return a
// Tiger queued instance when catchTiger is called.
Cat.prototype.catchTiger = [Tiger, function(name,cb) {
	this.callback(new Tiger(name));
}];

var tiger = new Tiger('Tony');
tiger.meow(get("Tony the cat sez: meow! (1)"));
tiger.roar(get("Tony the tiger roars. (1)"));

var notTiger = new Cat("Catty");
sync.log(notTiger.meow())(
	get("Returned: Catty the cat sez: meow! (1)")
);

notTiger.catchTiger('Purrdita').meow(
	get("Purrdita the cat sez: meow! (1)")
);