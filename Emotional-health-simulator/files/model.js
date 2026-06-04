/*
 * Life Impact Simulator — scoring model
 *
 * Single source of truth for the math. Loaded as a plain <script> by index.html
 * (works over file://) and required() by model.test.js under Node.
 *
 * Concepts:
 *   - DIMENSIONS: the eight aspects of life being tracked. Seven are positive
 *     contributors to emotional wellbeing; "stress" is a penalty.
 *   - WEIGHTS: how strongly each dimension pulls on emotional wellbeing (0-3).
 *   - ACTIONS: things you do. Each affects one or more dimensions with a
 *     direction (+1 / -1) and a strength (1-3). Weekly actions scale by
 *     hours / max; the move-abroad decision is on/off.
 *   - CALIBRATION: a fixed factor scales the raw score so the *default* current
 *     scenario reads 50%. The factor is frozen at load, so editing scenarios
 *     moves the numbers instead of re-anchoring to 50%.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod;
  } else {
    root.LIModel = mod;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // How much each dimension pulls on emotional wellbeing.
  var WEIGHTS = {
    relationship: 3, financial: 2, learning: 1,
    cultural: 1, social: 2, physical: 3, purpose: 2
  };
  var STRESS_WEIGHT = 2;           // stress is a penalty, not a positive dimension
  var WORK_STRESS_THRESHOLD = 30;  // work stress only accrues above this many hours/week
  var CALIBRATION_TARGET = 0.50;   // default "current" scenario should read 50%

  var TOTAL_WEIGHT = Object.keys(WEIGHTS)
    .reduce(function (a, k) { return a + WEIGHTS[k]; }, 0) + STRESS_WEIGHT;

  var DIM_LABELS = {
    relationship: 'Relationship & intimacy',
    financial: 'Financial security',
    learning: 'Learning & growth',
    cultural: 'Cultural & linguistic belonging',
    social: 'Social connection',
    physical: 'Physical health',
    purpose: 'Purpose & direction',
    stress: 'Stress'
  };

  var DIM_SHORT = {
    relationship: 'Relation', financial: 'Financial', learning: 'Learning',
    cultural: 'Cultural', social: 'Social', physical: 'Physical',
    purpose: 'Purpose', stress: 'Stress'
  };

  var DIM_COLORS = {
    relationship: '#D4537E', financial: '#BA7517', learning: '#534AB7',
    cultural: '#0F6E56', social: '#378ADD', physical: '#1D9E75',
    purpose: '#993C1D', stress: '#E24B4A'
  };

  // type "binary" = on/off decision. type "weekly" = hours/week slider (0..max).
  // A "stressEffect" with a threshold means stress only builds past that many hours.
  var ACTIONS = [
    {
      id: 'move_abroad', name: 'Move abroad', type: 'binary',
      effects: [
        { dim: 'relationship', dir: 1, str: 3 },
        { dim: 'financial', dir: -1, str: 1 },
        { dim: 'cultural', dir: 1, str: 2 },
        { dim: 'social', dir: -1, str: 1 },
        { dim: 'purpose', dir: 1, str: 3 },
        { dim: 'physical', dir: -1, str: 1 },
        { dim: 'stress', dir: -1, str: 3 }
      ]
    },
    {
      id: 'partner_time', name: 'Time with partner', type: 'weekly', unit: 'hrs/week', max: 40,
      effects: [
        { dim: 'relationship', dir: 1, str: 3 },
        { dim: 'physical', dir: 1, str: 2 },
        { dim: 'social', dir: 1, str: 1 }
      ]
    },
    {
      id: 'studying', name: 'Studying', type: 'weekly', unit: 'hrs/week', max: 20,
      effects: [
        { dim: 'learning', dir: 1, str: 3 },
        { dim: 'purpose', dir: 1, str: 2 },
        { dim: 'financial', dir: 1, str: 1 }
      ]
    },
    {
      id: 'exercise', name: 'Exercise', type: 'weekly', unit: 'hrs/week', max: 14,
      effects: [
        { dim: 'physical', dir: 1, str: 3 },
        { dim: 'social', dir: 1, str: 1 }
      ]
    },
    {
      id: 'social_time', name: 'Social time with friends', type: 'weekly', unit: 'hrs/week', max: 5,
      effects: [
        { dim: 'social', dir: 1, str: 3 },
        { dim: 'cultural', dir: 1, str: 2 },
        { dim: 'physical', dir: 1, str: 1 }
      ]
    },
    {
      id: 'cultural', name: 'Cultural & language activities', type: 'weekly', unit: 'hrs/week', max: 7,
      effects: [
        { dim: 'cultural', dir: 1, str: 3 },
        { dim: 'learning', dir: 1, str: 1 },
        { dim: 'social', dir: 1, str: 2 }
      ]
    },
    {
      id: 'work', name: 'Work', type: 'weekly', unit: 'hrs/week', max: 40,
      effects: [
        { dim: 'financial', dir: 1, str: 3 },
        { dim: 'purpose', dir: 1, str: 1 },
        { dim: 'learning', dir: 1, str: 2 },
        { dim: 'physical', dir: -1, str: 2 }
      ],
      stressEffect: { str: 2, threshold: WORK_STRESS_THRESHOLD }
    }
  ];

  // The three scenarios, pre-filled with your numbers.
  var SCENARIO_DEFAULTS = {
    current: { move_abroad: false, partner_time: 3,  studying: 7,  exercise: 5,  social_time: 5, cultural: 3, work: 40 },
    during:  { move_abroad: true,  partner_time: 5,  studying: 10, exercise: 3,  social_time: 5, cultural: 4, work: 3  },
    after:   { move_abroad: false, partner_time: 30, studying: 18, exercise: 10, social_time: 1, cultural: 4, work: 10 }
  };

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  function intensityOf(action, state) {
    if (action.type === 'binary') return state[action.id] ? 1 : 0;
    return Math.min((state[action.id] || 0) / (action.max || 40), 1);
  }

  // Stress is 0..1 = (active stress points) / (max possible stress points).
  function computeStressScore(state) {
    var stress = 0, totalMax = 0;
    ACTIONS.forEach(function (a) {
      if (a.stressEffect) {
        var hrs = state[a.id] || 0;
        var t = a.stressEffect.threshold || 0;
        var range = (a.max || 40) - t;
        var intensity = range <= 0 ? 0 : Math.max(0, (hrs - t) / range);
        stress += intensity * a.stressEffect.str;
        totalMax += a.stressEffect.str;
      }
      if (a.type === 'binary') {
        a.effects.forEach(function (e) {
          if (e.dim === 'stress') {
            totalMax += e.str;
            if (state[a.id]) stress += e.str;
          }
        });
      }
    });
    return totalMax === 0 ? 0 : clamp01(stress / totalMax);
  }

  // Returns per-dimension scores (0..1), the stress score, and the raw
  // (un-calibrated) emotional wellbeing value.
  function computeRaw(state) {
    var raw = {};
    Object.keys(WEIGHTS).forEach(function (d) { raw[d] = 0; });

    ACTIONS.forEach(function (a) {
      var I = intensityOf(a, state);
      a.effects.forEach(function (e) {
        if (e.dim !== 'stress') raw[e.dim] += e.dir * e.str * I;
      });
    });

    var scores = {};
    Object.keys(WEIGHTS).forEach(function (d) {
      var maxPos = 0;
      ACTIONS.forEach(function (a) {
        a.effects.forEach(function (e) { if (e.dim === d && e.dir > 0) maxPos += e.str; });
      });
      scores[d] = maxPos === 0 ? 0 : clamp01(raw[d] / maxPos);
    });

    var stressScore = computeStressScore(state);

    var ewBase = 0;
    Object.keys(WEIGHTS).forEach(function (d) { ewBase += scores[d] * WEIGHTS[d]; });

    var rawEW = Math.max(0, (ewBase - stressScore * STRESS_WEIGHT) / TOTAL_WEIGHT);
    return { scores: scores, stressScore: stressScore, rawEW: rawEW };
  }

  // Frozen ONCE from the default current scenario. This is what keeps "current"
  // anchored at 50% as a stable reference, while still letting edits move it.
  var FROZEN_FACTOR = (function () {
    var r = computeRaw(SCENARIO_DEFAULTS.current).rawEW;
    return r > 0 ? CALIBRATION_TARGET / r : 1;
  })();

  function computeScores(state) {
    var out = computeRaw(state);
    return {
      scores: out.scores,
      stressScore: out.stressScore,
      ew: Math.min(1, out.rawEW * FROZEN_FACTOR)
    };
  }

  return {
    WEIGHTS: WEIGHTS,
    STRESS_WEIGHT: STRESS_WEIGHT,
    TOTAL_WEIGHT: TOTAL_WEIGHT,
    WORK_STRESS_THRESHOLD: WORK_STRESS_THRESHOLD,
    CALIBRATION_TARGET: CALIBRATION_TARGET,
    FROZEN_FACTOR: FROZEN_FACTOR,
    DIM_LABELS: DIM_LABELS,
    DIM_SHORT: DIM_SHORT,
    DIM_COLORS: DIM_COLORS,
    ACTIONS: ACTIONS,
    SCENARIO_DEFAULTS: SCENARIO_DEFAULTS,
    computeStressScore: computeStressScore,
    computeRaw: computeRaw,
    computeScores: computeScores
  };
});
