// EduCompass Frontend Configuration
(function() {
  window.EDUCOMPASS_CONFIG = {
    getApiUrl: function() {
      if (window.__API_URL__) return window.__API_URL__.replace(/\/+$/, '');
      try {
        var stored = localStorage.getItem('ec:api_url');
        if (stored) return stored.replace(/\/+$/, '');
      } catch (e) {}
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        return (location.port === '4000') ? '' : 'http://localhost:4000';
      }
      return window.location.origin || 'https://edu-compass-2o2k.vercel.app';
    }
  };
})();
