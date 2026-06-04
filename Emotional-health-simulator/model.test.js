/*
 * Tests for the scoring model. Run with:  node model.test.js
 * No dependencies. Exits non-zero if anything fails.
 */
var M = require('./model.js');

var pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.6 : tol); }
function pct(state) { return Math.round(M.computeScores(state).ew * 100); }
function withEdit(base, patch) { return Object.assign({}, base, patch); }

var D = M.SCENARIO_DEFAULTS;

console.log('\nScenario scores:');
console.log('  current: ' + pct(D.current) + '%');
console.log('  during : ' + pct(D.during) + '%');
console.log('  after  : ' + pct(D.after) + '%');

console.log('\nCalibration:');
check('default current reads ~50%', approx(pct(D.current), 50));

console.log('\nReactivity (editing current must move the score):');
check('maxing exercise raises EW', pct(withEdit(D.current, { exercise: 14 })) > pct(D.current));
check('dropping social to 0 lowers EW', pct(withEdit(D.current, { social_time: 0 })) < pct(D.current));
check('raising partner time raises EW', pct(withEdit(D.current, { partner_time: 20 })) > pct(D.current));
check('raising studying raises EW', pct(withEdit(D.current, { studying: 20 })) > pct(D.current));

console.log('\nStress behaviour:');
var lowWork = M.computeStressScore(withEdit(D.current, { work: 25, move_abroad: false }));
var noWork = M.computeStressScore(withEdit(D.current, { work: 0, move_abroad: false }));
check('work below 30h adds no stress', lowWork === noWork);
var s40 = M.computeScores(withEdit(D.current, { work: 40 })).stressScore;
var s30 = M.computeScores(withEdit(D.current, { work: 30 })).stressScore;
check('work above 30h adds stress', s40 > s30);
var moveOn = M.computeScores(withEdit(D.current, { move_abroad: true })).stressScore;
var moveOff = M.computeScores(withEdit(D.current, { move_abroad: false })).stressScore;
check('move abroad increases stress', moveOn > moveOff);

console.log('\nScenario story:');
check('after move scores higher than current', pct(D.after) > pct(D.current));
check('during move is roughly break-even vs current', Math.abs(pct(D.during) - pct(D.current)) <= 15);

console.log('\nBounds:');
['current', 'during', 'after'].forEach(function (key) {
  var ew = M.computeScores(D[key]).ew;
  check(key + ' EW within 0..1', ew >= 0 && ew <= 1);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
