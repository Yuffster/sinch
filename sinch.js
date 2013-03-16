function splat(arr) {
	var o = [];
	for (var i in arr) o[i] = arr[i];
	return o;
}

function typeOf(o){
    return Object.prototype.toString
                 .call(o).match(/(\w+)\]/)[1].toLowerCase();
}

function each(arr, fn) {
	for (var i in arr) fn(i, arr[i]);
}

function each_shift(arr, fn) {
	while (arr.length>0) fn(arr.shift());
}

function clone(o) {
	if (typeOf(o) != 'object') return o;
	var c = {};
	for (var k in o) c[k] = clone(o[k]);
	return c;
}

function extend(a,b) {
	if (typeOf(a||b)=="object") {
		if (!a) a = {};
		for (var i in b) a[i] = extend(a[i], b[i]);
	} else a = a || b;
	return a;
}

function error(message) {
	try {
		throw new Error(message);
	} catch(e) {
		e.stack = e.stack.split('\n').slice(3).join('\n');
		return e;
	}
}

function get_callback(a) {
	if (typeof a[a.length-1] == "function" && !a[a.length-1].__deferred) {
		return a.pop();
	}
}

function dsync_args(args,cb) {

	var waiting = 0, a = [], q = {}, called_back;

	function done() {
		if (waiting>0) return;
		if (!called_back) cb(a);
		called_back = true;
	}

	each(args, function(i,v){
		if (v.__deferred) {
			delete(v.__deferred);
			waiting++;
			q[i] = v;
		} else a[i] = v;
	});

	each(q, function(i,fn) {
		fn(function(d) {
			waiting--;
			a[i] = d;
			done();
		});
	});

	done();

}
 
function wrap(inner, bind) {

	if (typeOf(inner) != "function") {
		return inner;
	}
	
	return function() {

		bind = clone(bind) || {};

		var a = splat(arguments), cb;

		function callback(args, cb) {
			bind.callback = function(data) { cb(data); };
			var result = inner.apply(bind, args);
			if (result&&cb) cb(result);
		}

		// Pop the arguments, check to see if the last one is a function,
		// in which case we'll assume we're working with a callback. This
		// should also work for event code, using the same lazy pattern!
		var cb = get_callback(a);
		if (cb) dsync_args(a, function(args) { callback(args, cb); });
		else {
			// Basically just doing simple currying here to actually run this
			// code with the original arguments when something feels like
			// handling it.
			var fn = function(cb) {
				dsync_args(a, function(args) { callback(args, cb); });
			};
			fn.__deferred = true;
			return fn;
		}

	};
	
}

// Enqueue allows us to chain functions on a dummy interface to corresponding
// methods on an actual object once the object is ready.
function enqueue(o, bind) {

	var standin = {}, q = [], done = false, bound;

	function trigger(b) {
		done  = true;
		bound = bound || b || bind;
		each_shift(q, function(v) {
			var meth = o[v[0]], args = splat(v[1]), next = q[0], cb = v[2];
			if (cb) args.push(cb);
			var result = meth.apply(bound, args);
			if (result&&cb) cb(result);
			// Look ahead to see if the result is tied to a subqueue interface.
			if (next && next[0]=="__cb") {
				// Pass a callback to the result.
				result(q.shift()[1]);
			}
		});
	}

	function push(meth, args, callback) {
		q.push([meth, args, callback]);
		if (done) trigger();
	}

	each(o, function(k,v) {
		var type, fn;
		// Check to see if we're dealing with an interface declaration.
		if (typeOf(v)=="array" && typeOf(v[1])=="function") {
			type = v[0], fn = v[1];
			// We actually want to mutate o so that the interface syntax is
			// replaced by a normal function.
			o[k] = fn;
		// If we're not dealing with an interface or a function, do nothing.
		// This keeps us from doing something like wrapping an object or data
		// property. It also keeps users from being able to access properties
		// without using a callback.
		} else if (typeOf(v) != "function") {
			return;
		}
		// Return an interface if that's what we're dealing with.
		if (type) {
			standin[k] = function() {
				// Start a new queue for the interface, trigger it after this
				// method actually executes.
				var subq = enqueue(type.prototype),
				    strg = subq.__trigger,
				    a    = splat(arguments);
				delete subq.__trigger;
				// Take the result of the operation which presumably spawned the
				// actual object. Bind the enqueued calls to the returned value,
				// the actual object we're manipulating, and trigger the queue.
				// This is also where we could do an error check.
				push(k, arguments);
				// The callback will return the final returned object after the
				// enqueued operation is performed.
				push("__cb", function(bind) {
					// If we're dealing with another enqueued object, we'll want
					// to wait until that object's initialization is complete
					// before we bind it to the queue.
					// TODO: This is the only huge hack left in the project.
					if (bind._onInit) bind._onInit(strg);
					// Otherwise, we're good to go. Yay!
					else strg(bind);
				});
				return subq;
			};
		} else standin[k] = wrap(function() {
			var a = splat(arguments);
			a.push(this.callback);
			push(k, arguments, this.callback);
		});
	});
	
	standin.__trigger = trigger;
	
	return standin;

}

function dsync(o) {

	if (typeof o == "function") return wrap(o);

	var constructor = function() {

		var self  = this,
		    init  = this.init, 
		    thing = this;

		// If there's an init method, it means we could be dealing with an
		// object that takes some time to get ready for handling methods. What
		// we need to do is return a dummy interface which acts exactly like
		// the normal one, only nothing happens until it's ready.
		if (init) {

			var q   = enqueue(this, this),
			    a   = splat(arguments),
			    trg = q.__trigger,
			    cbs = [], done = false, 
			    cb  = get_callback(a);

			if (cb) cbs.push(cb);

			// See if we have a traditional callback and set it to fire when
			// the actual object is ready.
			q.interface = true;

			q._onInit = function(cb) { 
				if (done) cb(self);
				else cbs.push(cb);
			};

			function callback() { 
				trg(self);
				for (var i in cbs) cbs[i](self);
				done = true;
				delete(self.callback);
			};

			this.callback = callback;

			init.apply(this, a);

			// Let's remove these properties before they ever get out into
			// userland.
			delete(q.init);
			delete(this.init);
			delete(q.__trigger);

			thing = q;

		}

		for (var m in this) {
			if (m!='callback') this[m] = clone(wrap(this[m], this));
		}

		// If we're initializing, we want to return the queue instead of the
		// object.
		return thing;

	};

	if (o.Extends) {
		o = extend(o, o.Extends.prototype);
		delete(o.Extends);
	}

	for (var i in o) constructor.prototype[i] = o[i];

	return constructor;

}

module.exports = dsync;