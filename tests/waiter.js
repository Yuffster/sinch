var log = require('util').puts;

var timeout = 500,
    pending = 0,
    failed  = 0,
    passed  = 0,
    lastTimeout = false;

log("Beginning tests; test timeout "+timeout/1000+" seconds.");

function register(expected, result) {
	if (expected!=result) {
		log("Expected: "+expected+" but got: "+result);
		failed++;
	} else passed++;
}

function complete() {
	log("All tests complete.");
	log("Passed: "+passed+"/"+(passed+failed));
	process.exit(failed);
}

function wait(expected) {
	pending++;
	var done = false;
	// Set the timeout for this test.
	setTimeout(function() {
		if (done) return;
		register(expected, "[TIMEOUT]");
		done = true;
	}, timeout);
	clearTimeout(lastTimeout);
	lastTimeout = setTimeout(function() {
		complete();
	}, timeout);
	return function(result) {
		if (done) return;
		done = true;
		register(expected, result);
	};
}

module.exports = wait;