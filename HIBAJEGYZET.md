# 🔍 DragonWave Projekt - Hibajegyzet

## Projektállapot: ⚠️ MŰKÖDÉSKÉPTELEN - 13 kritikus hiba

Ezt a dokumentumot automatikus elemzés készítette. Minden hiba javítható, de a sorrend fontos!

---

## 📋 HIBA LISTA (Prioritási sorrend)

### 🚨 KRITIKUS (Felépítésből adódó hibák)

#### 1. **.env fájl hiányzik**

- **Fájl**: `.env` (nem létezik)
- **Probléma**: Az összes environment variable hiányzik
- **Hatás**: Az app nem tud csatlakozni a Supabase-hez, biztonsági szekrét nincs
- **Megoldás**: Hozz létre egy `.env` fájlt a project gyökerében:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_public_key_here
ADMIN_PASSWORD=very_secure_password_123
BARION_POS_KEY=your_barion_poskey_or_skip
PORT=3001
```

- **Megjegyzés**: A `.env` fájl privát legyen - nem kerülhet a git-be!

---

#### 2. **Adatbázis kulcs típuscsere**

- **Fájl**: [database.js](database.js#L10)
- **Probléma**:
    ```javascript
    const supabaseKey = process.env.SUPABASE_KEY; // ❌ ROSSZ
    ```
- **Helyes forma**:
    ```javascript
    const supabaseKey = process.env.SUPABASE_ANON_KEY; // ✅ JÓ
    ```
- **Ok**: A Supabase séma megköveteli az `ANON_KEY` használatát az ügyfél-oldali műveletekhez
- **Javítás**: Cseréld le a `SUPABASE_KEY`-t `SUPABASE_ANON_KEY`-re

---

#### 3. **Teszt fájl hardcoded táblera hivatkozik**

- **Fájl**: [teszt-supabase.js](teszt-supabase.js#L8)
- **Probléma**:
    ```javascript
    const { data, error } = await supabase.from('your_table').select('*');
    // ❌ 'your_table' nem létezik az adatbázisban
    ```
- **Helyes forma**:
    ```javascript
    const { data, error } = await supabase.from('racers').select('*');
    // ✅ Valós tábla neveket használ
    ```
- **Javítás**: Cseréld le `'your_table'`-t `'racers'`-re vagy más valós táblanévre

---

### ⚠️ MAGAS PRIORITÁS (Logikai hibák)

#### 4. **Race start/stop időszinkronizálási hiba**

- **Fájl**: [server.js](server.js#L226-L240)
- **Probléma**:
    ```javascript
    const now = Date.now(); // Client-side time!
    await supabase
        .from('racers')
        .update({
            status: 'running',
            start_time: now, // ❌ Ez lehet eltérő a server időtől
        })
        .eq('status', 'registered');
    ```
- **Hatás**: Ha a szerver és az admin kliens óra eltér, a műveletek helytelen időpontból indulnak
- **Javítás**:
    - Szerver-oldal időt kell küldeni a kliensnek
    - Hozz létre egy `/api/server-time` végpontot
    - Valódi szerver UNIX timestamp-et használj az adatbázisban

---

#### 5. **Duplikáció ellenőrzés hibás logikája**

- **Fájl**: [server.js](server.js#L267-L277)
- **Probléma**:
    ```javascript
    const { data } = await supabase
        .from('members')
        .select('id')
        .ilike('name', m.name.trim()) // ❌ Ez case-insensitive, de nem teljes match
        .eq('birth_date', m.birth_date.trim())
        .limit(1);
    if (data && data.length > 0) {
        isDuplicate = true;
    }
    // ❌ Nem elég csak egy rekord - lehetnek több az ugyanazzal a névvel!
    ```
- **Hatás**: Hasonló nevű versenyezők között false positive
- **Javítás**:
    - Használj egyedi `otproba_id` alapú keresést
    - Ha `birth_date` eltér, ne egy duplikáció
    - Vagy készíts számított mezőt az egyediséghez

---

#### 6. **Rollback nem teljes a regisztráció során**

- **Fájl**: [server.js](server.js#L215-L245)
- **Probléma**:

    ```javascript
    const { error: rError } = await supabase.from('racers').insert({...});
    if (rError) throw rError;  // Beillesztve

    const { error: mError } = await supabase.from('members').insert(...);
    if (mError) {
      await supabase.from('racers').delete().eq('id', racerId);
      // ❌ De a BIB szám nem "felszabadul"! Már foglalt lesz
      throw mError;
    }
    ```

- **Hatás**: Sikertelen regisztráció után a BIB szám nem újrahasznosítható
- **Javítás**:
    - Egy adatbázis tranzakció vagy
    - Egy `bib_availability` tábla kezelése a rollback során

---

#### 7. **Start időmérés inkonzisztenciája**

- **Fájl**: [server.js](server.js#L226-L240) és [schema.sql](supabase/schema.sql#L15-L18)
- **Probléma**:
    - Az adatbázisban: `start_time BIGINT`, `finish_time BIGINT`, `total_time BIGINT` (UNIX timestamp milliszekundumban)
    - De néha: `created_at TIMESTAMP WITH TIME ZONE` (PostgreSQL timestamp)
    - Keveredik az idő reprezentáció!
- **Hatás**: Timezonás eltolódások, sorrendezési problémák
- **Javítás**:
    - Válassz EGY időformátumot: vagy BIGINT (ms), vagy TIMESTAMP
    - Javasolt: TIMESTAMP WITH TIME ZONE az összes timestamp-hez
    - Cseréld le az összes `BIGINT` timestamp-et `TIMESTAMP WITH TIME ZONE`-re

---

### 🔐 BIZTONSÁGI HIBÁK (KRITIKUS!)

#### 8. **Socket.io CORS nyitott a világnak**

- **Fájl**: [server.js](server.js#L70)
- **Probléma**:
    ```javascript
    const io = new Server(server, {
        cors: { origin: '*' }, // ❌ BÁRKI csatlakozhat!
    });
    ```
- **Hatás**: Cross-Site Request Forgery (CSRF) támadás veszélye, DDoS
- **Javítás**:
    ```javascript
    const io = new Server(server, {
        cors: {
            origin: ['http://localhost:3000', 'https://yourdomain.com', 'https://www.yourdomain.com'],
            methods: ['GET', 'POST'],
        },
    });
    ```

---

#### 9. **Admin jelszó plain-text tárolása**

- **Fájl**: [server.js](server.js#L115)
- **Probléma**:
    ```javascript
    if (password === ADMIN_PASSWORD) {
        // ❌ Direktes string összehasonlítás!
        res.json({ success: true });
    }
    // A jelszó bárki által olvasható a .env-ben
    ```
- **Hatás**: Ha valakiről szivárog a .env, az admin hozzáférés veszélyes
- **Javítás**:
    - Implementálj bcrypt hashelést
    - Vagy használj JWT tokeneket
    - Minimum: A jelszó ne kerüljön szource-ba

---

#### 10. **Admin autentikáció hiányzik számos végpontról**

- **Fájl**: [server.js](server.js#L275-L350)
- **Probléma**:
    ```javascript
    app.post('/api/stop-category', authenticateAdmin, ...)  // ✅ Ez OK
    app.post('/api/reset-category', authenticateAdmin, ...)  // ✅ Ez OK
    // De:
    app.post('/api/register', ...)  // ❌ PUBLIKUS - bárki regisztrálhat!
    app.post('/api/barion/payment', ...)  // ❌ PUBLIKUS - fizet bárki!
    ```
- **Hatás**: Szándékos vagy véletlen rendszerzavarás
- **Javítás**:
    - Nem minden végpont igényel admin-jelszót
    - De a regisztráció legyen korlátozva (rate-limit, CAPTCHA, email verifikáció)

---

#### 11. **API Authentication Header helytelenül implementálva**

- **Fájl**: [js/api.js](js/api.js#L23-L26)
- **Probléma**:
    ```javascript
    if (adminPassword) {
        opts.headers['Authorization'] = `Bearer ${adminPassword}`; // ❌ HIBÁS!
    }
    // Az admin jelszó nem JWT token, ez biztonsági hiba!
    ```
- **Hatás**: A jelszó HTTP headerben utazik (még HTTPS-en is rizikós)
- **Javítás**:
    - Készíts JWT token-eket
    - Vagy cookie-based session-t
    - Ne szállítsd a plain jelszót HTTP-n

---

### ⚠️ KÖZEPES PRIORITÁS (Konfigurációs/Minőségi hibák)

#### 12. **Jest teszt konfigurációja hiányzik**

- **Fájl**: [package.json](package.json#L13)
- **Probléma**:
    ```json
    {
        "scripts": {
            "test": "jest" // ❌ Jest nem konfigurálva!
        }
    }
    ```
- **Hatás**: `npm test` nem futtatható
- **Javítás**:
    - Hozz létre egy `jest.config.js` fájlt
    - Vagy add hozzá a `package.json`-hez a Jest konfigurációt:
    ```json
    {
        "jest": {
            "testEnvironment": "node",
            "testMatch": ["**/__tests__/**/*.test.js"]
        }
    }
    ```

---

#### 13. **Szukcesszív Promise-ek hiányzó await**

- **Fájl**: [server.js](server.js#L300-L320)
- **Probléma**:
    ```javascript
    await Promise.all(
        runningRacers.map(
            r =>
                supabase
                    .from('racers')
                    .update({
                        status: 'finished',
                        finish_time: now,
                        total_time: now - r.start_time,
                    })
                    .eq('id', r.id)
            // ❌ Nincs .select() - lekérdezés nem végrehajtódik!
        )
    );
    ```
- **Hatás**: Frissítések nem kerülhetnek végrehajtásra
- **Javítás**: Adj hozzá `.select()` vagy `.then()` a végére

---

## 📊 HIBÁK ÖSSZEFOGLALÁSA

| Kategória     | Darab  | Súlyosság              |
| ------------- | ------ | ---------------------- |
| Konfigurációs | 3      | 🔴 KRITIKUS            |
| Logikai       | 4      | 🟠 MAGAS               |
| Biztonsági    | 4      | 🔴 KRITIKUS            |
| Minőségi      | 2      | 🟡 KÖZEPES             |
| **ÖSSZESEN**  | **13** | ⚠️ **MŰKÖDÉSKÉPTELEN** |

---

## ✅ JAVÍTÁS SORRENDJE (AJÁNLOTT)

1. ✋ Készítsd el a `.env` fájlt
2. ✋ Javítsd a `database.js` kulcs nevét
3. ✋ Javítsd a `teszt-supabase.js` tábla nevét
4. ✋ Biztonsági javítások: CORS, jelszó
5. ✋ Logikai hibák: Duplikáció, Rollback, Idő szinkronizálás
6. ✋ Konfigurációs hibák: Jest, Promises

---

## 🚀 KÖVETKEZŐ LÉPÉSEK

Miután javítottad a hibákat:

- [ ] Futtasd le: `npm start`
- [ ] Ellenőrizd: `curl http://localhost:3001/api/health`
- [ ] Készíts test suite-t minden API végpontnak
- [ ] Végezz integrációs teszteket

---

**Dokumentum készült**: 2026. május 15.  
**Projekt**: DragonWave 2026 - Race Management System  
**Szerzőség**: Automatikus kódanalízis
