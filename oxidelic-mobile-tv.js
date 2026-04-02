(function() {
  var FOCUS_SELECTOR = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    '[onclick]',
    '.movie-card',
    '.trending-card',
    '.upcoming-poster',
    '.genre-tab',
    '.cast-card',
    '.similar-card',
    '.sm-ep-row',
    '.sdrop-item',
    '.sdrop-footer',
    '.see-all',
    '[role="button"]'
  ].join(',');
  var LOCAL_ROW_SELECTOR = '.movies-grid, .trending-row, .cw-row, .trailer-row, .genre-tabs, .cast-grid, #detail-server-row, .detail-btns, .smhero-btns, .sm-ep-list, .sm-episodes-controls, .nav-right, .nav-links, .audio-lang-bar, .detail-meta-row';
  var focusHistory = [];
  var registerTimer = null;

  function isLikelyTvDevice() {
    return /Android TV|GoogleTV|SmartTV|SMART-TV|HbbTV|NetCast|TV/i.test(navigator.userAgent || '');
  }

  function isVisible(el) {
    if (!el || !document.contains(el)) return false;
    var style = window.getComputedStyle(el);
    if (!style || style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
    var rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    if (el.closest('[hidden], [aria-hidden="true"]')) return false;
    return true;
  }

  function isNaturallyFocusable(el) {
    return /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/i.test(el.tagName);
  }

  function shouldSkipFocusable(el) {
    if (!el || el.disabled) return true;
    return el.matches('.detail-overlay, .modal-overlay, .profile-overlay, .upgrade-prompt, #mob-drawer, #watchPartyOverlay, #search-dropdown');
  }

  function registerFocusable(el) {
    if (!el || shouldSkipFocusable(el)) return;
    if (!el.classList.contains('tv-focusable')) el.classList.add('tv-focusable');
    if (!isNaturallyFocusable(el) && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('role') && (el.hasAttribute('onclick') || el.matches('.movie-card, .trending-card, .upcoming-poster, .genre-tab, .cast-card, .similar-card, .sm-ep-row, .sdrop-item, .sdrop-footer, .see-all'))) {
      el.setAttribute('role', 'button');
    }
  }

  function registerFocusables(root) {
    var base = root || document.body;
    if (!base) return;
    if (base.matches && base.matches(FOCUS_SELECTOR)) registerFocusable(base);
    Array.prototype.forEach.call(base.querySelectorAll(FOCUS_SELECTOR), registerFocusable);
  }

  function syncAdaptiveMetrics() {
    var nav = document.querySelector('nav');
    document.documentElement.style.setProperty('--app-vh', (window.innerHeight * 0.01) + 'px');
    if (nav) document.documentElement.style.setProperty('--app-nav-height', nav.offsetHeight + 'px');
    document.body.classList.toggle('android-tv', isLikelyTvDevice());
  }

  function isTvNavigationActive() {
    return document.body.classList.contains('tv-mode') || document.body.classList.contains('android-tv');
  }

  function isPlayerContext(el) {
    if (document.fullscreenElement) return true;
    if (!el) return false;
    if (/^(IFRAME|VIDEO)$/.test(el.tagName)) return true;
    return !!el.closest('#video-container, #trailer-container, .detail-iframe-container, #series-video-container, #oxp-wrap');
  }

  function isFormInput(el) {
    if (!el) return false;
    return !!(el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }

  function getOpenElement(id) {
    var el = document.getElementById(id);
    return el && el.classList.contains('open') ? el : null;
  }

  function getActiveScope() {
    var drawer = document.getElementById('mob-drawer');
    var authScreen = document.getElementById('auth-screen');
    var mainSite = document.getElementById('main-site');

    if (getOpenElement('watchPartyOverlay')) return getOpenElement('watchPartyOverlay');
    if (drawer && drawer.style.display !== 'none') return drawer;
    if (getOpenElement('auth-modal-overlay')) return getOpenElement('auth-modal-overlay');
    if (getOpenElement('movieModal')) return getOpenElement('movieModal');
    if (getOpenElement('seriesModal')) return getOpenElement('seriesModal');
    if (getOpenElement('profileModal')) return getOpenElement('profileModal');
    if (getOpenElement('pricingModal')) return getOpenElement('pricingModal');
    if (getOpenElement('upgradePrompt')) return getOpenElement('upgradePrompt');
    if (mainSite && window.getComputedStyle(mainSite).display !== 'none') return mainSite;
    if (authScreen && window.getComputedStyle(authScreen).display !== 'none') return authScreen;
    return document.body;
  }

  function getFocusableCandidates(root) {
    registerFocusables(root);
    return Array.prototype.filter.call((root || document).querySelectorAll('.tv-focusable'), isVisible);
  }

  function clearFocusedClass() {
    Array.prototype.forEach.call(document.querySelectorAll('.tv-focused'), function(node) {
      node.classList.remove('tv-focused');
    });
  }

  function focusElement(el) {
    if (!el || !isVisible(el)) return false;
    clearFocusedClass();
    try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
    el.classList.add('tv-focused');
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); } catch (err2) { el.scrollIntoView(false); }
    return document.activeElement === el;
  }

  function sortCandidates(a, b) {
    var ar = a.getBoundingClientRect();
    var br = b.getBoundingClientRect();
    if (Math.abs(ar.top - br.top) > 8) return ar.top - br.top;
    return ar.left - br.left;
  }

  function preferredSelectors(scope) {
    if (!scope) return [];
    if (scope.id === 'movieModal') return ['#detail-play-btn', '.detail-back-btn', '.detail-btn-trailer'];
    if (scope.id === 'seriesModal') return ['#smhero-play-btn', '.smhero-close', '#sm-season-select'];
    if (scope.id === 'mob-drawer') return ['#mob-drawer a', '#mob-drawer button'];
    if (scope.id === 'profileModal') return ['#profileModal .profile-input', '#profileModal button'];
    if (scope.id === 'pricingModal') return ['#pricingModal .plan-btn', '#pricingModal .pricing-close'];
    if (scope.id === 'upgradePrompt') return ['#upgradePrompt .upgrade-btn-yes', '#upgradePrompt .upgrade-btn-no'];
    if (scope.id === 'watchPartyOverlay') return ['#watchPartyOverlay button', '#watchPartyOverlay input'];
    if (scope.id === 'auth-modal-overlay') return ['#auth-email', '#auth-password'];
    if (scope.id === 'main-site') return ['#hero-watch-btn', '#hero-seemore-btn', '#search-input', '.movie-card'];
    if (scope.id === 'auth-screen') return ['#auth-hero-email', '.auth-signin-btn', '.auth-get-started-btn'];
    return ['button', '[onclick]'];
  }

  function focusPreferred(scope) {
    var root = scope || getActiveScope();
    var prefs = preferredSelectors(root);
    var i;
    for (i = 0; i < prefs.length; i += 1) {
      var hit = root.querySelector(prefs[i]);
      if (isVisible(hit)) return focusElement(hit);
    }
    var all = getFocusableCandidates(root).sort(sortCandidates);
    if (!all.length && root !== document.body) all = getFocusableCandidates(document.body).sort(sortCandidates);
    return all.length ? focusElement(all[0]) : false;
  }

  function rememberFocus() {
    focusHistory.push(document.activeElement && document.activeElement !== document.body ? document.activeElement : null);
  }

  function restoreFocus() {
    while (focusHistory.length) {
      var el = focusHistory.pop();
      if (el && isVisible(el)) return focusElement(el);
    }
    return focusPreferred(getActiveScope());
  }

  function centerPoint(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function pickDirectionalCandidate(current, candidates, direction) {
    var currentRect = current.getBoundingClientRect();
    var currentCenter = centerPoint(currentRect);
    var best = null;
    var bestScore = Infinity;

    Array.prototype.forEach.call(candidates, function(candidate) {
      if (!candidate || candidate === current) return;
      var rect = candidate.getBoundingClientRect();
      var center = centerPoint(rect);
      var primary = 0;
      var secondary = 0;
      var alignedBonus = 0;

      if (direction === 'left') {
        primary = currentCenter.x - center.x;
        secondary = Math.abs(center.y - currentCenter.y);
        if (primary <= 6) return;
        if (rect.bottom > currentRect.top && rect.top < currentRect.bottom) alignedBonus = -120;
      } else if (direction === 'right') {
        primary = center.x - currentCenter.x;
        secondary = Math.abs(center.y - currentCenter.y);
        if (primary <= 6) return;
        if (rect.bottom > currentRect.top && rect.top < currentRect.bottom) alignedBonus = -120;
      } else if (direction === 'up') {
        primary = currentCenter.y - center.y;
        secondary = Math.abs(center.x - currentCenter.x);
        if (primary <= 6) return;
        if (rect.right > currentRect.left && rect.left < currentRect.right) alignedBonus = -120;
      } else if (direction === 'down') {
        primary = center.y - currentCenter.y;
        secondary = Math.abs(center.x - currentCenter.x);
        if (primary <= 6) return;
        if (rect.right > currentRect.left && rect.left < currentRect.right) alignedBonus = -120;
      } else {
        return;
      }

      var score = (primary * primary) + (secondary * secondary * 1.8) + alignedBonus;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    });

    return best;
  }

  function moveFocus(direction) {
    var scope = getActiveScope();
    var active = document.activeElement;
    if (!active || active === document.body || !scope.contains(active) || !isVisible(active)) return focusPreferred(scope);
    var localRoot = active.closest(LOCAL_ROW_SELECTOR);
    var localCandidates = localRoot ? getFocusableCandidates(localRoot) : [];
    var next = localCandidates.length ? pickDirectionalCandidate(active, localCandidates, direction) : null;
    if (!next) next = pickDirectionalCandidate(active, getFocusableCandidates(scope), direction);
    if (!next && scope !== document.body) next = pickDirectionalCandidate(active, getFocusableCandidates(document.body), direction);
    return next ? focusElement(next) : false;
  }

  function activateFocusedElement() {
    var active = document.activeElement;
    if (!active || active === document.body || isFormInput(active) || isPlayerContext(active)) return false;
    if (typeof active.click === 'function') {
      active.click();
      return true;
    }
    return false;
  }

  function handleRemoteBack() {
    var searchDropdown = document.getElementById('search-dropdown');
    var accountDropdown = document.getElementById('account-dropdown');

    if (document.getElementById('mob-drawer') && document.getElementById('mob-drawer').style.display !== 'none' && typeof closeMobMenu === 'function') return closeMobMenu(), true;
    if (searchDropdown && searchDropdown.style.display !== 'none' && typeof closeSearchDropdown === 'function') return closeSearchDropdown(), true;
    if (accountDropdown && accountDropdown.classList.contains('open') && typeof closeAccountDropdown === 'function') return closeAccountDropdown(), true;
    if (getOpenElement('watchPartyOverlay') && typeof closeWatchParty === 'function') return closeWatchParty(), true;
    if (getOpenElement('movieModal') && typeof closeModal === 'function') return closeModal(), true;
    if (getOpenElement('seriesModal') && typeof closeSeriesModal === 'function') return closeSeriesModal(), true;
    if (getOpenElement('profileModal') && typeof closeProfile === 'function') return closeProfile(), true;
    if (getOpenElement('pricingModal') && typeof closePricing === 'function') return closePricing(), true;
    if (getOpenElement('upgradePrompt') && typeof closeUpgradePrompt === 'function') return closeUpgradePrompt(), true;
    if (getOpenElement('auth-modal-overlay') && typeof authCloseModal === 'function') return authCloseModal(), true;
    return false;
  }

  function queueRegister(ensureFocus) {
    clearTimeout(registerTimer);
    registerTimer = setTimeout(function() {
      syncAdaptiveMetrics();
      registerFocusables(document.body);
      if (ensureFocus && isTvNavigationActive()) focusPreferred(getActiveScope());
    }, 50);
  }

  function wrapOpenFunction(name) {
    var original = window[name];
    if (typeof original !== 'function' || original.__tvWrapped) return;
    var wrapped = function() {
      rememberFocus();
      var result = original.apply(this, arguments);
      setTimeout(function() { queueRegister(true); }, 80);
      return result;
    };
    wrapped.__tvWrapped = true;
    window[name] = wrapped;
  }

  function wrapCloseFunction(name) {
    var original = window[name];
    if (typeof original !== 'function' || original.__tvWrapped) return;
    var wrapped = function() {
      var result = original.apply(this, arguments);
      setTimeout(function() {
        queueRegister(false);
        if (isTvNavigationActive()) restoreFocus();
      }, 60);
      return result;
    };
    wrapped.__tvWrapped = true;
    window[name] = wrapped;
  }

  function wrapToggleFunction(name, isOpenFn) {
    var original = window[name];
    if (typeof original !== 'function' || original.__tvWrapped) return;
    var wrapped = function() {
      var wasOpen = isOpenFn();
      if (!wasOpen) rememberFocus();
      var result = original.apply(this, arguments);
      setTimeout(function() {
        queueRegister(false);
        if (!wasOpen && isOpenFn()) {
          if (isTvNavigationActive()) focusPreferred(getActiveScope());
        } else if (wasOpen && !isOpenFn() && isTvNavigationActive()) {
          restoreFocus();
        }
      }, 60);
      return result;
    };
    wrapped.__tvWrapped = true;
    window[name] = wrapped;
  }

  document.addEventListener('focusin', function(event) {
    if (!event.target || !event.target.classList || !event.target.classList.contains('tv-focusable')) return;
    clearFocusedClass();
    event.target.classList.add('tv-focused');
  });

  document.addEventListener('pointerdown', function(event) {
    if (event.pointerType === 'touch' && !document.body.classList.contains('android-tv')) {
      document.body.classList.remove('tv-mode');
      clearFocusedClass();
    }
  }, { passive: true });

  document.addEventListener('keydown', function(event) {
    var key = event.key || '';
    var active = document.activeElement;

    if (key === 'Tab') {
      document.body.classList.add('tv-mode');
      return;
    }
    if (/^Arrow/.test(key) || key === 'Back' || key === 'BrowserBack' || key === 'GoBack' || key === 'Escape' || key === 'Enter' || key === ' ') {
      document.body.classList.add('tv-mode');
    }
    if (!isTvNavigationActive()) return;
    if (isPlayerContext(active)) return;
    if (isFormInput(active) && key !== 'Escape' && key !== 'Back' && key !== 'BrowserBack' && key !== 'GoBack') return;

    if (key === 'ArrowLeft') return event.preventDefault(), moveFocus('left');
    if (key === 'ArrowRight') return event.preventDefault(), moveFocus('right');
    if (key === 'ArrowUp') return event.preventDefault(), moveFocus('up');
    if (key === 'ArrowDown') return event.preventDefault(), moveFocus('down');
    if ((key === 'Enter' || key === ' ') && activateFocusedElement()) return event.preventDefault();
    if ((key === 'Escape' || key === 'Back' || key === 'BrowserBack' || key === 'GoBack' || event.keyCode === 461) && handleRemoteBack()) event.preventDefault();
  }, true);

  function isMobDrawerOpen() {
    var drawer = document.getElementById('mob-drawer');
    return !!drawer && drawer.style.display !== 'none';
  }

  function isAccountDropdownOpen() {
    var dropdown = document.getElementById('account-dropdown');
    return !!dropdown && dropdown.classList.contains('open');
  }

  function initAdaptiveUi() {
    syncAdaptiveMetrics();
    registerFocusables(document.body);
    wrapOpenFunction('openModal');
    wrapCloseFunction('closeModal');
    wrapOpenFunction('openSeriesModal');
    wrapCloseFunction('closeSeriesModal');
    wrapOpenFunction('openProfile');
    wrapCloseFunction('closeProfile');
    wrapOpenFunction('openPricing');
    wrapCloseFunction('closePricing');
    wrapOpenFunction('showUpgradePrompt');
    wrapCloseFunction('closeUpgradePrompt');
    wrapOpenFunction('authOpenModal');
    wrapCloseFunction('authCloseModal');
    wrapOpenFunction('openWatchParty');
    wrapCloseFunction('closeWatchParty');
    wrapCloseFunction('closeMobMenu');
    wrapCloseFunction('closeAccountDropdown');
    wrapToggleFunction('toggleMobMenu', isMobDrawerOpen);
    wrapToggleFunction('toggleAccountDropdown', isAccountDropdownOpen);

    new MutationObserver(function() { queueRegister(false); }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', function() { queueRegister(false); }, { passive: true });
    window.addEventListener('orientationchange', function() { queueRegister(false); });

    if (isLikelyTvDevice()) {
      document.body.classList.add('tv-mode');
      setTimeout(function() { focusPreferred(getActiveScope()); }, 1000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAdaptiveUi);
  else initAdaptiveUi();
})();
