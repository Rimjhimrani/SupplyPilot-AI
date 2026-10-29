/* app.js - tiny hash router for the sidebar views. */
(function () {
  var views = ['overview', 'tower'];
  var titles = { overview: 'Overview', tower: 'Control tower' };

  function current() {
    var h = (location.hash || '#overview').slice(1);
    return views.indexOf(h) < 0 ? 'overview' : h;
  }
  function show() {
    var h = current();
    views.forEach(function (v) { document.getElementById('view-' + v).hidden = v !== h; });
    Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) {
      if (a.getAttribute('data-view') === h) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = titles[h] + ' · SupplyPilot AI';
    document.dispatchEvent(new CustomEvent('sp:viewshown', { detail: h }));
  }
  window.addEventListener('hashchange', function () {
    show();
    var h1 = document.querySelector('.view:not([hidden]) h1');
    if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  });
  show();
})();
