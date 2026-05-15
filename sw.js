// Service Worker - للعمل بدون إنترنت
// احفظ هذا الملف باسم: sw.js

const CACHE_NAME = 'sales-gifts-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('فتح Cache');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('حذف Cache القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// اعتراض الطلبات
self.addEventListener('fetch', event => {
  // إذا كانت الطلب GET
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(response => {
        // إذا كانت في Cache، ارجع من Cache
        if (response) {
          return response;
        }

        // وإلا حاول من الشبكة
        return fetch(event.request).then(response => {
          // إذا فشل، ارجع fallback
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // احفظ في Cache للمرات القادمة
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return response;
        }).catch(() => {
          // إذا لم تكن متصل بالشبكة، ارجع من Cache
          return caches.match(event.request);
        });
      })
    );
  } else if (event.request.method === 'POST') {
    // للـ POST requests، حاول الشبكة أولاً ثم احفظ للمزامنة بعد
    event.respondWith(
      fetch(event.request)
        .then(response => response)
        .catch(() => {
          // إذا فشل، احفظ في IndexedDB للمزامنة لاحقاً
          return event.request.clone().text().then(body => {
            saveForSync({
              method: event.request.method,
              url: event.request.url,
              body: body
            });

            return new Response(
              JSON.stringify({ success: true, queued: true }),
              { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
  }
});

// حفظ البيانات للمزامنة لاحقاً
function saveForSync(data) {
  const dbRequest = indexedDB.open('SalesGiftsDB', 1);

  dbRequest.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('syncQueue')) {
      db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
    }
  };

  dbRequest.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    store.add(data);
  };
}

// مزامنة البيانات عند الاتصال
self.addEventListener('sync', event => {
  if (event.tag === 'sync-sales-data') {
    event.waitUntil(
      (async () => {
        const dbRequest = indexedDB.open('SalesGiftsDB', 1);
        
        dbRequest.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction(['syncQueue'], 'readonly');
          const store = transaction.objectStore('syncQueue');
          
          // ارسل البيانات المعلقة
          console.log('جاري مزامنة البيانات...');
        };
      })()
    );
  }
});
