const CACHE_NAME = "vergi-asistani-v2";  
const CORE_ASSETS = [  
  "./",  
  "./index.html",  
  "./app.js",  
  "./manifest.json"  
];  
  
self.addEventListener("install", (event) => {  
  event.waitUntil(  
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))  
  );  
  self.skipWaiting();  
});  
  
self.addEventListener("activate", (event) => {  
  event.waitUntil(  
    caches.keys().then((keys) =>  
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))  
    )  
  );  
  self.clients.claim();  
});  
  
self.addEventListener("fetch", (event) => {  
  const url = new URL(event.request.url);  
  if (url.hostname.includes("generativelanguage.googleapis.com") || event.request.method !== "GET") {  
    return;  
  }  
  
  event.respondWith(  
    caches.match(event.request).then((cached) => {  
      if (cached) {  
        fetch(event.request)  
          .then((res) => {  
            if (res && res.status === 200) {  
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));  
            }  
          })  
          .catch(() => {});  
        return cached;  
      }  
  
      return fetch(event.request)  
        .then((res) => {  
          if (res && res.status === 200) {  
            const clone = res.clone();  
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));  
          }  
          return res;  
        })  
        .catch(() => caches.match("./index.html"));  
    })  
  );  
});  
