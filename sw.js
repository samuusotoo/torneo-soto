self.addEventListener("install",function(e){self.skipWaiting();});
self.addEventListener("activate",function(e){self.clients.claim();});
self.addEventListener("fetch",function(e){ /* passthrough: siempre red, datos en vivo */ });
