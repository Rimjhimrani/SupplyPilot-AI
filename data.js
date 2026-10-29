/*
  data.js - synthetic data and a tiny "API" layer.

  Everything here is made-up demo data. SPApi.getOverview() returns a Promise on purpose:
  when you build the FastAPI backend, replace its body with
      return fetch('/api/overview').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  and the loading and error states in overview.js will work without other changes.

  Tip: open the page with ?simulateError=1 in the address bar to preview the error state.
*/
(function () {
  var DATA = {
    // ISO weeks. W44 is the current week and is computed live from the simulator.
    weeks: ['W33','W34','W35','W36','W37','W38','W39','W40','W41','W42','W43','W44'],
    // Previous 11 weeks (the 12th point is live).
    inventoryM: [4.41, 4.46, 4.38, 4.52, 4.60, 4.55, 4.63, 4.70, 4.66, 4.74, 4.79],
    inventoryNowM: 4.82,
    otd:        [96.2, 97.1, 95.4, 97.8, 96.9, 95.8, 97.5, 98.0, 96.2, 97.6, 97.2],
    atRisk:     [2, 1, 3, 2, 1, 2, 1, 2, 1, 2, 1],
    supplierAvg:[86.1, 86.6, 87.0, 86.4, 87.5, 88.0, 88.3, 88.1, 88.9, 89.4, 89.7],
    // Estimated disruption cost in $K for W37..W43 (the 8th point is live).
    costK: [12.4, 8.1, 21.6, 9.3, 15.8, 6.2, 7.4],
    suppliers: [
      { name: 'Shenzhen Display Works',  origin: 'SZX', score: 91.2, prev: 90.4 },
      { name: 'Saigon Cell Systems',     origin: 'HCM', score: 86.5, prev: 85.9 },
      { name: 'Lion City Components',    origin: 'SIN', score: 89.8, prev: 89.9 },
      { name: 'Western India Pharma',    origin: 'MUM', score: 93.4, prev: 92.7 }
    ]
  };

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  window.SPApi = {
    source: 'synthetic',
    getOverview: function () {
      var fail = /[?&]simulateError=1/.test(location.search);
      return wait(450).then(function () {
        if (fail) throw new Error('The overview service did not respond (simulated error).');
        return JSON.parse(JSON.stringify(DATA));
      });
    }
  };
})();
